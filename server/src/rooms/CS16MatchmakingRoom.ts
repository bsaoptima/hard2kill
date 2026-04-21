import { Client, Room } from 'colyseus';
import { Currency } from '@hard2kill/shared';
import { signMatchToken } from '../cs16/tokens';
import { registerAndDebitMatch } from '../cs16/matchEvents';

interface WaitingPlayer {
    client: Client;
    playerName: string;
    odinsId: string;
    betAmount: number;
    currency: Currency;
    joinedAt: number;
}

const CS16_SERVER_HOST = process.env.CS16_SERVER_HOST || 'fps.hard2kill.me';
const CS16_SERVER_CONNECT = process.env.CS16_SERVER_CONNECT || 'fps.hard2kill.me:27018';
const MATCH_TOKEN_TTL_SECONDS = 600;

export class CS16MatchmakingRoom extends Room {
    private waitingPlayers: WaitingPlayer[] = [];

    onCreate() {
        console.log('[CS16 Matchmaking] Room created');
        this.autoDispose = false;
    }

    onJoin(client: Client, options: { playerName: string; odinsId: string; betAmount?: number; currency?: Currency }) {
        const betAmount = options.betAmount || 1;
        const currency: Currency = options.currency === 'coins' ? 'coins' : 'cash';
        console.log(`[CS16 Matchmaking] Player joined queue: ${options.playerName} (bet: ${betAmount} ${currency})`);

        if (!options.odinsId) {
            client.send('matchmaking:error', { message: 'Not authenticated' });
            client.leave();
            return;
        }

        const player: WaitingPlayer = {
            client,
            playerName: options.playerName || 'Anonymous',
            odinsId: options.odinsId,
            betAmount,
            currency,
            joinedAt: Date.now(),
        };

        this.waitingPlayers.push(player);

        const sameQueueCount = this.waitingPlayers.filter(p => p.betAmount === betAmount && p.currency === currency).length;
        client.send('matchmaking:status', { status: 'waiting', position: sameQueueCount });

        void this.tryMatchPlayers(player);
    }

    onLeave(client: Client) {
        this.waitingPlayers = this.waitingPlayers.filter(p => p.client.sessionId !== client.sessionId);
        console.log(`[CS16 Matchmaking] Player left queue. Remaining: ${this.waitingPlayers.length}`);
    }

    private async tryMatchPlayers(newPlayer: WaitingPlayer) {
        const opponent = this.waitingPlayers.find(
            p => p.client.sessionId !== newPlayer.client.sessionId &&
                 p.betAmount === newPlayer.betAmount &&
                 p.currency === newPlayer.currency,
        );

        if (!opponent) return;

        console.log(`[CS16 Matchmaking] Pair found: ${newPlayer.playerName} vs ${opponent.playerName}`);

        this.waitingPlayers = this.waitingPlayers.filter(
            p => p.client.sessionId !== newPlayer.client.sessionId &&
                 p.client.sessionId !== opponent.client.sessionId,
        );

        const matchId = `cs16_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const exp = Math.floor(Date.now() / 1000) + MATCH_TOKEN_TTL_SECONDS;

        // Deduct bets up-front (before issuing tokens). If either fails, both refunded inside registerAndDebitMatch.
        const ok = await registerAndDebitMatch({
            matchId,
            p1: { userId: newPlayer.odinsId, username: newPlayer.playerName },
            p2: { userId: opponent.odinsId, username: opponent.playerName },
            betAmount: newPlayer.betAmount,
            currency: newPlayer.currency,
        });

        if (!ok) {
            newPlayer.client.send('matchmaking:error', { message: 'Could not debit both players — try again' });
            opponent.client.send('matchmaking:error', { message: 'Could not debit both players — try again' });
            return;
        }

        const p1Token = signMatchToken({
            matchId, userId: newPlayer.odinsId, username: newPlayer.playerName,
            betAmount: newPlayer.betAmount, currency: newPlayer.currency, exp,
        });
        const p2Token = signMatchToken({
            matchId, userId: opponent.odinsId, username: opponent.playerName,
            betAmount: opponent.betAmount, currency: opponent.currency, exp,
        });

        const payload = (token: string, self: WaitingPlayer, other: WaitingPlayer, isCreator: boolean) => ({
            matchId,
            isCreator,
            playerName: self.playerName,
            opponentName: other.playerName,
            betAmount: self.betAmount,
            currency: self.currency,
            token,
            serverHost: CS16_SERVER_HOST,
            serverConnect: CS16_SERVER_CONNECT,
        });

        newPlayer.client.send('matchmaking:found', payload(p1Token, newPlayer, opponent, true));
        opponent.client.send('matchmaking:found', payload(p2Token, opponent, newPlayer, false));
    }
}
