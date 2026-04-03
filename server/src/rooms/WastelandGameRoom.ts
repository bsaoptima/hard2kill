import { Room, Client } from 'colyseus';
import { WastelandGameState, WastelandPlayer } from './WastelandGameState';
import { creditBalance, deductBalance, logGameResult } from '@hard2kill/shared';

interface MatchPlayer {
  userId?: string;
  sessionId: string;
  playerName: string;
  betAmount: number;
}

export class WastelandGameRoom extends Room<WastelandGameState> {
  private matchId?: string;
  private betAmount: number = 0;
  private matchPlayers: Map<string, MatchPlayer> = new Map();
  private isMatchRoom: boolean = false;
  private matchStartedAt?: Date;

  onCreate(options: any) {
    console.log('[Wasteland] GameRoom created:', this.roomId);

    // Check if this is a matchmaking room
    if (options.matchId && options.betAmount) {
      this.matchId = options.matchId;
      this.betAmount = options.betAmount;
      this.isMatchRoom = true;
      this.maxClients = 2; // Limit to 2 players for match
      console.log(`[Wasteland Match] Created match room ${this.matchId} with bet $${this.betAmount}`);
    }

    // Initialize state with Schema
    this.setState(new WastelandGameState());

    // Handle player position updates
    this.onMessage('position', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = data.position.x;
        player.y = data.position.y;
        player.z = data.position.z;
        player.rx = data.rotation.x;
        player.ry = data.rotation.y;
        player.rz = data.rotation.z;
        player.rw = data.rotation.w;
        player.velocity = data.velocity || 0;
      }
    });

    // Handle shooting events
    this.onMessage('shoot', (client, data) => {
      // Broadcast shoot event to all other players
      this.broadcast('playerShoot', {
        playerId: client.sessionId,
        ...data
      }, { except: client });
    });

    // Handle damage events
    this.onMessage('damage', async (client, data) => {
      const targetPlayer = this.state.players.get(data.targetId);
      if (targetPlayer && targetPlayer.health > 0) {
        const previousHealth = targetPlayer.health;
        targetPlayer.health = Math.max(0, targetPlayer.health - data.damage);
        console.log(`[Wasteland] Player ${data.targetId} took ${data.damage} damage. Health: ${targetPlayer.health}`);

        // Check if player died (only trigger once when crossing 0)
        if (previousHealth > 0 && targetPlayer.health <= 0) {
          const killer = this.state.players.get(client.sessionId);
          const victim = targetPlayer;

          if (killer) {
            // Transfer pot from victim to killer
            const potWon = victim.pot;
            console.log(`[Wasteland POT] Before: killer=${client.sessionId} pot=${killer.pot}, victim=${data.targetId} pot=${victim.pot}`);
            killer.pot += victim.pot;
            victim.pot = 0;
            console.log(`[Wasteland POT] After: killer=${client.sessionId} pot=${killer.pot}, victim=${data.targetId} pot=${victim.pot}`);

            console.log(`[Wasteland] Player ${data.targetId} was killed by ${client.sessionId}`);
            // Broadcast death event with pot information
            this.broadcast('playerDied', {
              victimId: data.targetId,
              killerId: client.sessionId,
              killerName: killer.id,
              victimName: victim.id,
              potWon: potWon
            });

            // No longer closing the room - players continue playing
            // Balance transactions only happen at the start when joining
          }
        }
      }
    });

    // Handle respawn requests
    this.onMessage('respawn', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.health = 100;
        player.pot = 100; // Reset pot to starting amount
        player.x = 2.14;
        player.y = 1.48;
        player.z = -1.36;
        console.log(`[Wasteland] Player ${client.sessionId} respawned`);
      }
    });
  }

  async onJoin(client: Client, options: any) {
    console.log('[Wasteland] Player joined:', client.sessionId);

    // Create new player
    const player = new WastelandPlayer();
    player.id = client.sessionId;
    player.x = 2.14;
    player.y = 1.48;
    player.z = -1.36;
    player.rx = 0;
    player.ry = 0;
    player.rz = 0;
    player.rw = 1;
    player.health = 100;

    // Add to state
    this.state.players.set(client.sessionId, player);

    // If this is a match room, track the player and deduct bet
    if (this.isMatchRoom) {
      const playerName = options.playerName || 'Player';
      const userId = options.userId;

      this.matchPlayers.set(client.sessionId, {
        userId,
        sessionId: client.sessionId,
        playerName,
        betAmount: this.betAmount,
      });

      // Deduct bet from player's balance if they have a userId
      if (userId) {
        const success = await deductBalance(userId, this.betAmount);
        if (!success) {
          console.error(`[Wasteland Match] Failed to deduct bet from ${userId}`);
        } else {
          console.log(`[Wasteland Match] Deducted $${this.betAmount} from ${playerName}`);
        }
      }

      console.log(`[Wasteland Match] ${playerName} joined match (${this.matchPlayers.size}/2)`);

      // Start tracking match time when both players have joined
      if (this.matchPlayers.size === 2) {
        this.matchStartedAt = new Date();
        console.log(`[Wasteland Match] Match started at ${this.matchStartedAt.toISOString()}`);
      }
    }

    console.log('[Wasteland] Total players:', this.state.players.size);
  }

  async handleMatchEnd(killerSessionId: string, victimSessionId: string) {
    const winner = this.matchPlayers.get(killerSessionId);
    const loser = this.matchPlayers.get(victimSessionId);

    if (!winner || !loser) {
      console.error('[Wasteland Match] Could not find match players');
      return;
    }

    const totalPot = this.betAmount * 2;
    console.log(`[Wasteland Match] Match ended! Winner: ${winner.playerName}, Loser: ${loser.playerName}, Pot: $${totalPot}`);

    // Credit winner with the pot
    if (winner.userId) {
      await creditBalance(winner.userId, totalPot);
      console.log(`[Wasteland Match] Credited $${totalPot} to ${winner.playerName}`);
    }

    // Log match result to database
    if (winner.userId && loser.userId && this.matchStartedAt) {
      await logGameResult(
        winner.userId,
        loser.userId,
        this.betAmount * 2,
        this.matchStartedAt
      );
    }

    // Broadcast match end to all players
    this.broadcast('matchEnd', {
      winnerId: killerSessionId,
      winnerName: winner.playerName,
      loserId: victimSessionId,
      loserName: loser.playerName,
      winnings: totalPot,
    });

    // Close the room after a delay
    setTimeout(() => {
      console.log(`[Wasteland Match] Closing match room ${this.matchId}`);
      this.disconnect();
    }, 10000); // 10 second delay to show results
  }

  onLeave(client: Client, consented: boolean) {
    console.log('[Wasteland] Player left:', client.sessionId);

    // Remove player from state
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log('[Wasteland] GameRoom disposed:', this.roomId);
  }
}
