import { Client, Room, matchMaker } from 'colyseus';
import { Constants } from '@hard2kill/gladiatorz-common';

interface WaitingPlayer {
    client: Client;
    playerName: string;
    odinsId: string;
    betAmount: number;
}

export class MatchmakingRoom extends Room {
    private waitingPlayers: WaitingPlayer[] = [];

    onCreate() {
        console.log('MatchmakingRoom created');
        // Keep room alive even when empty so all players join the same room
        this.autoDispose = false;
    }

    onJoin(client: Client, options: { playerName: string; odinsId: string; betAmount?: number }) {
        const betAmount = options.betAmount || Constants.DEFAULT_BET_AMOUNT;
        console.log(`[Matchmaking] Player joined queue: ${options.playerName} (bet: $${betAmount})`);

        this.waitingPlayers.push({
            client,
            playerName: options.playerName || 'Anonymous',
            odinsId: options.odinsId || '',
            betAmount,
        });

        // Count players waiting with same bet amount
        const sameAmountCount = this.waitingPlayers.filter(p => p.betAmount === betAmount).length;
        client.send('matchmaking:status', { status: 'waiting', position: sameAmountCount });

        this.tryMatch();
    }

    onLeave(client: Client) {
        this.waitingPlayers = this.waitingPlayers.filter((p) => p.client.sessionId !== client.sessionId);
        console.log(`[Matchmaking] Player left queue. Remaining: ${this.waitingPlayers.length}`);
    }

    private async tryMatch() {
        // Match each waiting player against a bot immediately
        while (this.waitingPlayers.length > 0) {
            const player = this.waitingPlayers.shift();
            if (!player) continue;

            console.log(`[Matchmaking] Matching ${player.playerName} vs Bot (bet: $${player.betAmount})`);

            try {
                // Generate a unique match ID
                const matchId = `match_${Date.now()}`;

                console.log(`[Matchmaking] Match created: ${matchId}`);

                // Send match info to player - they will create the room and bot will join automatically
                player.client.send('matchmaking:found', {
                    matchId,
                    isCreator: true,
                    playerName: player.playerName,
                    opponentName: 'Bot', // Generic name, actual bot name is randomized
                    betAmount: player.betAmount,
                });
            } catch (error) {
                console.error('[Matchmaking] Failed to create match:', error);
                // Put player back in queue
                this.waitingPlayers.push(player);
            }
        }
    }
}
