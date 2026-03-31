import { Schema, MapSchema, type } from '@colyseus/schema';

export class WastelandPlayer extends Schema {
  @type('string') id: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') rx: number = 0;
  @type('number') ry: number = 0;
  @type('number') rz: number = 0;
  @type('number') rw: number = 1;
  @type('number') health: number = 100;
  @type('number') velocity: number = 0;
  @type('number') pot: number = 100;
}

export class WastelandGameState extends Schema {
  @type({ map: WastelandPlayer }) players = new MapSchema<WastelandPlayer>();
}
