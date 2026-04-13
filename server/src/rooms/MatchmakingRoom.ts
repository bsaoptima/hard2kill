import { Client, Room, matchMaker } from 'colyseus';
import { Constants } from '@hard2kill/gladiatorz-common';
import { supabase, Currency } from '@hard2kill/shared';

interface WaitingPlayer {
    client: Client;
    playerName: string;
    odinsId: string;
    betAmount: number;
    currency: Currency;
    joinedAt: number;
    botTimer?: NodeJS.Timeout;
}

const BOT_MATCH_DELAY = 5000; // 5 seconds before matching with bot
const MAX_BOT_GAMES = 3; // Maximum bot games allowed per player

export class MatchmakingRoom extends Room {
    private waitingPlayers: WaitingPlayer[] = [];

    onCreate() {
        console.log('MatchmakingRoom created');
        // Keep room alive even when empty so all players join the same room
        this.autoDispose = false;
    }

    onJoin(client: Client, options: { playerName: string; odinsId: string; betAmount?: number; currency?: Currency }) {
        const betAmount = options.betAmount || Constants.DEFAULT_BET_AMOUNT;
        const currency: Currency = options.currency === 'coins' ? 'coins' : 'cash';
        console.log(`[Matchmaking] Player joined queue: ${options.playerName} (bet: ${betAmount} ${currency})`);

        const player: WaitingPlayer = {
            client,
            playerName: options.playerName || 'Anonymous',
            odinsId: options.odinsId || '',
            betAmount,
            currency,
            joinedAt: Date.now(),
        };

        this.waitingPlayers.push(player);

        // Count players waiting with same bet amount AND currency
        const sameQueueCount = this.waitingPlayers.filter(p => p.betAmount === betAmount && p.currency === currency).length;
        client.send('matchmaking:status', { status: 'waiting', position: sameQueueCount });

        // Try to match with another player first
        this.tryMatchPlayers(player);
    }

    onLeave(client: Client) {
        const player = this.waitingPlayers.find(p => p.client.sessionId === client.sessionId);

        // Clear bot timer if player leaves
        if (player?.botTimer) {
            clearTimeout(player.botTimer);
        }

        this.waitingPlayers = this.waitingPlayers.filter((p) => p.client.sessionId !== client.sessionId);
        console.log(`[Matchmaking] Player left queue. Remaining: ${this.waitingPlayers.length}`);
    }

    private tryMatchPlayers(newPlayer: WaitingPlayer) {
        // Look for another player with same bet amount AND currency (excluding the new player)
        const opponent = this.waitingPlayers.find(
            p => p.client.sessionId !== newPlayer.client.sessionId &&
                 p.betAmount === newPlayer.betAmount &&
                 p.currency === newPlayer.currency
        );

        if (opponent) {
            // Found another player! Match them together
            console.log(`[Matchmaking] Matching ${newPlayer.playerName} vs ${opponent.playerName} (bet: ${newPlayer.betAmount} ${newPlayer.currency})`);

            // Clear bot timer if opponent had one
            if (opponent.botTimer) {
                clearTimeout(opponent.botTimer);
            }

            // Remove both players from queue
            this.waitingPlayers = this.waitingPlayers.filter(
                p => p.client.sessionId !== newPlayer.client.sessionId &&
                     p.client.sessionId !== opponent.client.sessionId
            );

            // Create match
            const matchId = `match_${Date.now()}`;
            console.log(`[Matchmaking] PvP Match created: ${matchId}`);

            // Send match info to both players
            newPlayer.client.send('matchmaking:found', {
                matchId,
                isCreator: true,
                playerName: newPlayer.playerName,
                opponentName: opponent.playerName,
                betAmount: newPlayer.betAmount,
                currency: newPlayer.currency,
            });

            opponent.client.send('matchmaking:found', {
                matchId,
                isCreator: false,
                playerName: opponent.playerName,
                opponentName: newPlayer.playerName,
                betAmount: opponent.betAmount,
                currency: opponent.currency,
            });
        } else {
            // No player found, schedule bot match after delay
            console.log(`[Matchmaking] No opponent found for ${newPlayer.playerName}, scheduling bot match in ${BOT_MATCH_DELAY/1000}s`);

            newPlayer.botTimer = setTimeout(() => {
                this.matchWithBot(newPlayer);
            }, BOT_MATCH_DELAY);
        }
    }

    private async matchWithBot(player: WaitingPlayer) {
        // Check if player is still in queue
        const stillWaiting = this.waitingPlayers.find(p => p.client.sessionId === player.client.sessionId);
        if (!stillWaiting) {
            console.log(`[Matchmaking] Player ${player.playerName} no longer in queue`);
            return;
        }

        // Check bot game limit (cash games only — coin games are unlimited since coins are free/non-withdrawable)
        if (player.currency === 'cash' && player.odinsId && supabase) {
            try {
                // Count cash games where player faced the bot (either as winner or loser)
                const { count, error } = await supabase
                    .from('game_history')
                    .select('*', { count: 'exact', head: true })
                    .eq('currency', 'cash')
                    .or(`and(winner_id.eq.${player.odinsId},loser_id.eq.${Constants.BOT_USER_ID}),and(loser_id.eq.${player.odinsId},winner_id.eq.${Constants.BOT_USER_ID})`);

                if (error) {
                    console.error('[Matchmaking] Error checking bot game count:', error);
                } else if (count !== null && count >= MAX_BOT_GAMES) {
                    console.log(`[Matchmaking] Player ${player.playerName} has reached cash bot game limit (${count}/${MAX_BOT_GAMES}) - keeping in queue for real opponent`);
                    return;
                }

                console.log(`[Matchmaking] Player ${player.playerName} cash bot games: ${count}/${MAX_BOT_GAMES}`);
            } catch (err) {
                console.error('[Matchmaking] Error checking bot games:', err);
            }
        }

        console.log(`[Matchmaking] Matching ${player.playerName} vs Bot (bet: ${player.betAmount} ${player.currency})`);

        // Remove player from queue
        this.waitingPlayers = this.waitingPlayers.filter(
            p => p.client.sessionId !== player.client.sessionId
        );

        try {
            // Generate a unique match ID
            const matchId = `match_${Date.now()}`;

            console.log(`[Matchmaking] Bot Match created: ${matchId}`);

            // Send match info to player - they will create the room and bot will join automatically
            player.client.send('matchmaking:found', {
                matchId,
                isCreator: true,
                playerName: player.playerName,
                opponentName: 'Bot', // Generic name, actual bot name is randomized
                betAmount: player.betAmount,
                currency: player.currency,
            });
        } catch (error) {
            console.error('[Matchmaking] Failed to create bot match:', error);
            // Put player back in queue
            this.waitingPlayers.push(player);
        }
    }
}
