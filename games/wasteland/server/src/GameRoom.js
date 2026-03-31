const { Room } = require('colyseus');
const { GameState, Player } = require('./GameState');

class GameRoom extends Room {
  onCreate(options) {
    console.log('GameRoom created:', this.roomId);

    // Initialize state with Schema
    this.setState(new GameState());

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
    this.onMessage('damage', (client, data) => {
      const targetPlayer = this.state.players.get(data.targetId);
      if (targetPlayer && targetPlayer.health > 0) {
        const previousHealth = targetPlayer.health;
        targetPlayer.health = Math.max(0, targetPlayer.health - data.damage);
        console.log(`Player ${data.targetId} took ${data.damage} damage. Health: ${targetPlayer.health}`);

        // Check if player died (only trigger once when crossing 0)
        if (previousHealth > 0 && targetPlayer.health <= 0) {
          const killer = this.state.players.get(client.sessionId);
          const victim = targetPlayer;

          // Transfer pot from victim to killer
          const potWon = victim.pot;
          console.log(`[POT] Before: killer=${client.sessionId} pot=${killer.pot}, victim=${data.targetId} pot=${victim.pot}`);
          killer.pot += victim.pot;
          victim.pot = 0;
          console.log(`[POT] After: killer=${client.sessionId} pot=${killer.pot}, victim=${data.targetId} pot=${victim.pot}`);

          console.log(`Player ${data.targetId} was killed by ${client.sessionId}`);
          // Broadcast death event with pot information
          this.broadcast('playerDied', {
            victimId: data.targetId,
            killerId: client.sessionId,
            killerName: killer.id,
            victimName: victim.id,
            potWon: potWon
          });
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
        console.log(`Player ${client.sessionId} respawned`);
      }
    });
  }

  onJoin(client, options) {
    console.log('Player joined:', client.sessionId);

    // Create new player
    const player = new Player();
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

    console.log('Total players:', this.state.players.size);
  }

  onLeave(client, consented) {
    console.log('Player left:', client.sessionId);

    // Remove player from state
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log('GameRoom disposed:', this.roomId);
  }
}

module.exports = { GameRoom };
