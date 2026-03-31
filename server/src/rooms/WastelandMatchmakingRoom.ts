import { Client, Room } from 'colyseus';
import { Constants } from '@hard2kill/gladiatorz-common';

interface WaitingPlayer {
    client: Client;
    playerName: string;
    betAmount: number;
}

export class WastelandMatchmakingRoom extends Room {
    private waitingPlayers: WaitingPlayer[] = [];

    onCreate() {
        console.log('[Wasteland Matchmaking] Room created');
        // Keep room alive even when empty so all players join the same room
        this.autoDispose = false;
    }

    onJoin(client: Client, options: { playerName: string; betAmount?: number }) {
        const betAmount = options.betAmount || Constants.DEFAULT_BET_AMOUNT;
        console.log(`[Wasteland Matchmaking] Player joined queue: ${options.playerName} (bet: $${betAmount})`);

        this.waitingPlayers.push({
            client,
            playerName: options.playerName || 'Anonymous',
            betAmount,
        });

        // Count players waiting with same bet amount
        const sameAmountCount = this.waitingPlayers.filter(p => p.betAmount === betAmount).length;
        client.send('matchmaking:status', { status: 'waiting', position: sameAmountCount });

        this.tryMatch();
    }

    onLeave(client: Client) {
        this.waitingPlayers = this.waitingPlayers.filter((p) => p.client.sessionId !== client.sessionId);
        console.log(`[Wasteland Matchmaking] Player left queue. Remaining: ${this.waitingPlayers.length}`);
    }

    private async tryMatch() {
        // Group players by bet amount and try to match within each group
        const betAmounts = [...new Set(this.waitingPlayers.map(p => p.betAmount))];

        for (const betAmount of betAmounts) {
            const playersAtAmount = this.waitingPlayers.filter(p => p.betAmount === betAmount);

            if (playersAtAmount.length >= 2) {
                const player1 = playersAtAmount[0];
                const player2 = playersAtAmount[1];

                // Remove from waiting list
                this.waitingPlayers = this.waitingPlayers.filter(
                    p => p.client.sessionId !== player1.client.sessionId && p.client.sessionId !== player2.client.sessionId
                );

                console.log(`[Wasteland Matchmaking] Matching ${player1.playerName} vs ${player2.playerName} (bet: $${betAmount})`);

                try {
                    // Generate a unique match ID
                    const matchId = `wasteland_${Date.now()}`;

                    console.log(`[Wasteland Matchmaking] Match created: ${matchId}`);

                    // Send match info to both players
                    player1.client.send('matchmaking:found', {
                        matchId,
                        isCreator: true,
                        playerName: player1.playerName,
                        opponentName: player2.playerName,
                        betAmount,
                    });
                    player2.client.send('matchmaking:found', {
                        matchId,
                        isCreator: false,
                        playerName: player2.playerName,
                        opponentName: player1.playerName,
                        betAmount,
                    });
                } catch (error) {
                    console.error('[Wasteland Matchmaking] Failed to create room:', error);

                    // Put players back in queue
                    this.waitingPlayers.push(player1);
                    this.waitingPlayers.push(player2);
                }
            }
        }
    }
}
