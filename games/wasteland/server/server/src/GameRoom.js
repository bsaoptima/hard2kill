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
