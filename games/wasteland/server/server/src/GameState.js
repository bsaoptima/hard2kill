const { Schema, MapSchema, type } = require('@colyseus/schema');

class Player extends Schema {
  constructor() {
    super();
    this.id = '';
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.rx = 0;
    this.ry = 0;
    this.rz = 0;
    this.rw = 1;
  }
}

type('string')(Player.prototype, 'id');
type('number')(Player.prototype, 'x');
type('number')(Player.prototype, 'y');
type('number')(Player.prototype, 'z');
type('number')(Player.prototype, 'rx');
type('number')(Player.prototype, 'ry');
type('number')(Player.prototype, 'rz');
type('number')(Player.prototype, 'rw');

class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}

type({ map: Player })(GameState.prototype, 'players');

module.exports = { GameState, Player };
