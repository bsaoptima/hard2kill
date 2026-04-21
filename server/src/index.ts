import { config } from 'dotenv';
import { join } from 'path';

// Load .env from root directory
config({ path: join(__dirname, '../../.env') });

import { monitor, MonitorOptions } from '@colyseus/monitor';
import { Constants } from '@hard2kill/gladiatorz-common';
import { Server } from 'colyseus';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import Stripe from 'stripe';
import { GameRoom } from './rooms/GameRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { WastelandGameRoom } from './rooms/WastelandGameRoom';
import { WastelandMatchmakingRoom } from './rooms/WastelandMatchmakingRoom';
import { CS16MatchmakingRoom } from './rooms/CS16MatchmakingRoom';
import { getMatch, resolveMatch, CS16MatchResult } from './cs16/matchEvents';
import { verifyWebhookSignature } from './cs16/tokens';
import { creditBalance, supabase, claimCoins, getCoinClaimStatus } from '@hard2kill/shared';

const PORT = Number(process.env.PORT || Constants.WS_PORT);
const PUBLIC_DIR = join(__dirname, '../../platform/public');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripeEnabled = STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET;
if (!stripeEnabled) {
    console.warn('[Stripe] Payment processing disabled - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
}

const stripe = stripeEnabled ? new Stripe(STRIPE_SECRET_KEY) : null;

const app = express();
app.use(cors());

// Stripe webhook needs raw body
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !stripeEnabled) {
        return res.status(503).json({ error: 'Payment processing not configured' });
    }

    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const amount = session.amount_total ? session.amount_total / 100 : 0; // Convert cents to dollars

        if (userId && amount > 0) {
            // Credit the user's balance
            await creditBalance(userId, amount);

            // Record deposit transaction
            await supabase.from('transactions').insert({
                user_id: userId,
                amount,
                type: 'deposit',
            });

            console.log(`[Stripe] Deposited $${amount} for user ${userId}`);
        }
    }

    res.json({ received: true });
});

// CS 1.6 match-result webhook — sidecar on CS droplet POSTs here with HMAC signature in X-H2K-Signature header
// Uses raw body so HMAC can be verified byte-for-byte before JSON.parse
app.post('/api/cs16/match-result', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.header('x-h2k-signature') || '';
    const rawBody = req.body.toString('utf8');

    if (!verifyWebhookSignature(rawBody, signature)) {
        console.warn('[CS16 webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload: CS16MatchResult;
    try {
        payload = JSON.parse(rawBody) as CS16MatchResult;
    } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    if (!payload.matchId) {
        return res.status(400).json({ error: 'Missing matchId' });
    }

    const match = getMatch(payload.matchId);
    if (!match) {
        console.warn(`[CS16 webhook] Unknown matchId: ${payload.matchId}`);
        return res.status(404).json({ error: 'Unknown match' });
    }

    // Validate the winner/loser belong to this match
    const validUserIds = new Set([match.p1.userId, match.p2.userId]);
    if (payload.winnerId && !validUserIds.has(payload.winnerId)) {
        console.warn(`[CS16 webhook] winnerId ${payload.winnerId} not in match ${payload.matchId}`);
        return res.status(400).json({ error: 'winnerId not in match' });
    }
    if (payload.loserId && !validUserIds.has(payload.loserId)) {
        console.warn(`[CS16 webhook] loserId ${payload.loserId} not in match ${payload.matchId}`);
        return res.status(400).json({ error: 'loserId not in match' });
    }

    console.log(`[CS16 webhook] Result for ${payload.matchId}: winner=${payload.winnerId} loser=${payload.loserId} reason=${payload.reason}`);
    await resolveMatch(payload);
    return res.json({ ok: true });
});

app.use(express.json());
app.use(compression());

// Create Stripe checkout session
app.post('/api/create-checkout', async (req, res) => {
    if (!stripe || !stripeEnabled) {
        return res.status(503).json({ error: 'Payment processing not configured' });
    }

    const { userId, amount } = req.body;

    if (!userId || !amount || amount < 1) {
        return res.status(400).json({ error: 'Invalid userId or amount' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${amount} Game Credits`,
                            description: 'Credits for HARD2KILL',
                        },
                        unit_amount: amount * 100, // Convert to cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.origin}/?deposit=success`,
            cancel_url: `${req.headers.origin}/?deposit=cancelled`,
            metadata: {
                userId,
            },
        });

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Claim hourly coins
app.post('/api/claim-coins', async (req, res) => {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const result = await claimCoins(userId);
        return res.json(result);
    } catch (err: any) {
        console.error('[claim-coins] error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Get coin claim status (balance + next claim time) without claiming
app.get('/api/coin-status', async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    if (!userId) {
        return res.status(400).json({ error: 'Invalid userId' });
    }
    try {
        const status = await getCoinClaimStatus(userId);
        return res.json(status);
    } catch (err: any) {
        console.error('[coin-status] error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Game server
const httpServer = createServer(app);
const server = new Server({
    server: httpServer,
});

// Game Rooms
server.define(Constants.ROOM_NAME, GameRoom).filterBy(['matchId']); // GladiatorZ
server.define('matchmaking', MatchmakingRoom);
server.define('wasteland', WastelandGameRoom).filterBy(['matchId']); // Wasteland game
server.define('wasteland-matchmaking', WastelandMatchmakingRoom); // Wasteland matchmaking
server.define('cs16-matchmaking', CS16MatchmakingRoom); // deduct+register on pair; no CS16 game room — client redirects to fps.hard2kill.me

// Serve static resources from the "public" folder
app.use(express.static(PUBLIC_DIR));

// If you don't want people accessing your server stats, comment this line.
app.use('/colyseus', monitor(server as Partial<MonitorOptions>));

// Serve the frontend client
app.get('*', (req: any, res: any) => {
    res.sendFile(join(PUBLIC_DIR, 'index.html'));
});

server.onShutdown(() => {
    console.log(`Shutting down...`);
});

server.listen(PORT);
console.log(`Listening on ws://localhost:${PORT}`);
