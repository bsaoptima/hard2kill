import { createClient } from '@supabase/supabase-js';

// Check if we're in Node.js (server) or browser
const isServer = typeof window === 'undefined';

const supabaseUrl = isServer
    ? process.env.SUPABASE_URL || 'https://nyxpjzexjzzilkwivoiv.supabase.co'
    : 'https://nyxpjzexjzzilkwivoiv.supabase.co';

const supabaseAnonKey = isServer
    ? process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHBqemV4anp6aWxrd2l2b2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM0ODQsImV4cCI6MjA4Njk5OTQ4NH0.eUVsjHs-uGAiKeOsPqk4gDW95MsG2WCG2Pod_K457e4'
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eHBqemV4anp6aWxrd2l2b2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM0ODQsImV4cCI6MjA4Njk5OTQ4NH0.eUVsjHs-uGAiKeOsPqk4gDW95MsG2WCG2Pod_K457e4';

// Extract project ref from URL for localStorage key
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
export const SUPABASE_STORAGE_KEY = `sb-${projectRef}-auth-token`;

// Client for regular operations (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server operations (bypasses RLS) - Only available server-side!
export const supabaseAdmin = isServer && process.env.SUPABASE_SERVICE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null as any; // Type assertion for client-side (will never be used)

export type Currency = 'cash' | 'coins';

// Map a Currency to its DB column on the `balances` table
function balanceColumn(currency: Currency): 'balance' | 'coins' {
    return currency === 'coins' ? 'coins' : 'balance';
}

/**
 * Get the current user's balance for a given currency (defaults to cash).
 */
export async function getBalance(userId?: string, currency: Currency = 'cash'): Promise<number> {
    let targetUserId = userId;

    if (!targetUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            return 0;
        }
        targetUserId = session.user.id;
    }

    const client = supabaseAdmin || supabase;
    const column = balanceColumn(currency);

    const { data, error } = await client
        .from('balances')
        .select(column)
        .eq('id', targetUserId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching balance:', error);
        return 0;
    }

    return ((data as any)?.[column]) || 0;
}

/**
 * Get the current user's pot (in-game currency)
 */
export async function getPot(): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        return 100; // Default pot for guests
    }

    const { data, error } = await supabase
        .from('balances')
        .select('pot')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('Error fetching pot:', error);
        return 100;
    }
    return data?.pot || 100;
}

/**
 * Update the user's pot after kills/deaths
 */
export async function updatePot(newPot: number): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
        .from('balances')
        .update({ pot: newPot })
        .eq('id', session.user.id);

    if (error) {
        console.error('Error updating pot:', error);
    }
}

/**
 * Record a transaction
 */
export async function recordTransaction(
    amount: number,
    type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'kill' | 'death',
    game?: string
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount,
        type,
        game,
    });
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}

/**
 * Credit balance for a given currency (defaults to cash).
 * Used by Stripe webhook, game wins, and coin claims.
 */
export async function creditBalance(userId: string, amount: number, currency: Currency = 'cash'): Promise<void> {
    if (!supabaseAdmin) {
        console.error('Cannot credit balance: admin client not available');
        return;
    }

    const column = balanceColumn(currency);

    const { data: balance } = await supabaseAdmin
        .from('balances')
        .select(column)
        .eq('id', userId)
        .maybeSingle();

    const current = ((balance as any)?.[column]) || 0;
    const newAmount = current + amount;

    await supabaseAdmin
        .from('balances')
        .upsert({ id: userId, [column]: newAmount });
}

/**
 * Deduct balance for a given currency (defaults to cash). Used when placing bets.
 */
export async function deductBalance(userId: string, amount: number, currency: Currency = 'cash'): Promise<boolean> {
    if (!supabaseAdmin) {
        console.error('Cannot deduct balance: admin client not available');
        return false;
    }

    const column = balanceColumn(currency);

    const { data: balance } = await supabaseAdmin
        .from('balances')
        .select(column)
        .eq('id', userId)
        .maybeSingle();

    const current = ((balance as any)?.[column]) || 0;

    if (current < amount) {
        return false; // Insufficient balance
    }

    const { error } = await supabaseAdmin
        .from('balances')
        .update({ [column]: current - amount })
        .eq('id', userId);

    return !error;
}

// ---------- Coin claim (hourly) ----------

export const COIN_CLAIM_AMOUNT = 10;
export const COIN_CLAIM_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export interface CoinClaimResult {
    success: boolean;
    coins: number;          // new coin balance after claim (or current if not claimed)
    nextClaimAt: string;    // ISO timestamp when next claim is allowed
    reason?: 'cooldown' | 'error';
}

/**
 * Attempt to claim hourly coins. Server-authoritative cooldown via last_coin_claim.
 * Returns success + new balance, or failure + when the user can claim next.
 */
export async function claimCoins(userId: string): Promise<CoinClaimResult> {
    if (!supabaseAdmin) {
        console.error('Cannot claim coins: admin client not available');
        return { success: false, coins: 0, nextClaimAt: new Date().toISOString(), reason: 'error' };
    }

    const { data: row, error: fetchError } = await supabaseAdmin
        .from('balances')
        .select('coins, last_coin_claim')
        .eq('id', userId)
        .maybeSingle();

    if (fetchError) {
        console.error('[claimCoins] fetch error:', fetchError);
        return { success: false, coins: 0, nextClaimAt: new Date().toISOString(), reason: 'error' };
    }

    const now = Date.now();
    const lastClaimMs = row?.last_coin_claim ? new Date(row.last_coin_claim).getTime() : 0;
    const elapsed = now - lastClaimMs;
    const currentCoins = row?.coins || 0;

    if (elapsed < COIN_CLAIM_COOLDOWN_MS) {
        const nextAt = new Date(lastClaimMs + COIN_CLAIM_COOLDOWN_MS).toISOString();
        return { success: false, coins: currentCoins, nextClaimAt: nextAt, reason: 'cooldown' };
    }

    const newCoins = currentCoins + COIN_CLAIM_AMOUNT;
    const nowIso = new Date(now).toISOString();

    const { error: updateError } = await supabaseAdmin
        .from('balances')
        .upsert({ id: userId, coins: newCoins, last_coin_claim: nowIso });

    if (updateError) {
        console.error('[claimCoins] update error:', updateError);
        return { success: false, coins: currentCoins, nextClaimAt: nowIso, reason: 'error' };
    }

    const nextAt = new Date(now + COIN_CLAIM_COOLDOWN_MS).toISOString();
    return { success: true, coins: newCoins, nextClaimAt: nextAt };
}

/**
 * Get the timestamp the user can next claim coins. Useful for UI countdown on mount.
 */
export async function getCoinClaimStatus(userId: string): Promise<{ coins: number; nextClaimAt: string }> {
    const client = supabaseAdmin || supabase;
    const { data } = await client
        .from('balances')
        .select('coins, last_coin_claim')
        .eq('id', userId)
        .maybeSingle();

    const coins = data?.coins || 0;
    const lastClaimMs = data?.last_coin_claim ? new Date(data.last_coin_claim).getTime() : 0;
    const nextAt = lastClaimMs ? new Date(lastClaimMs + COIN_CLAIM_COOLDOWN_MS).toISOString() : new Date(0).toISOString();
    return { coins, nextClaimAt: nextAt };
}

/**
 * Log game result to database for leaderboard/analytics
 */
export type GameName = 'gladiatorz' | 'wasteland' | 'cs16';

export async function logGameResult(
    winnerId: string,
    loserId: string,
    amount: number,
    startedAt: Date,
    currency: Currency = 'cash',
    game: GameName = 'gladiatorz'
): Promise<boolean> {
    if (!supabaseAdmin) {
        console.error('[logGameResult] Cannot log game result: admin client not available');
        return false;
    }

    console.log(`[logGameResult] Inserting: winner=${winnerId}, loser=${loserId}, amount=${amount}, currency=${currency}, game=${game}`);

    const { data, error } = await supabaseAdmin.from('game_history').insert({
        winner_id: winnerId,
        loser_id: loserId,
        amount,
        currency,
        game,
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
    });

    if (error) {
        console.error('[logGameResult] Error logging game result:', JSON.stringify(error, null, 2));
        return false;
    }

    console.log('[logGameResult] Successfully inserted game history');
    return true;
}
