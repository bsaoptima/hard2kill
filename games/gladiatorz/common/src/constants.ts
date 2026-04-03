import { GameMode } from './types';

export const APP_TITLE = 'TOSIOS';

// General
export const WS_PORT = 3001;
export const ROOM_NAME = 'game'; // Colyseus Room<T>'s name (no need to change)
export const ROOM_REFRESH = 3000;
export const PLAYERS_REFRESH = 1000;
export const DEBUG = false;
export const BET_AMOUNTS = [1, 5, 10];
export const DEFAULT_BET_AMOUNT = 5;
export const BOT_USER_ID = 'e1a2763b-8862-4e49-b935-fcf547d90f3a'; // Special bot account for game_history

// Game
export const MAPS_NAMES = ['small', 'gigantic'];
export const ROOM_PLAYERS_MIN = 2;
export const ROOM_PLAYERS_MAX = 16;
export const ROOM_PLAYERS_SCALES = [2, 4, 8, 16];
export const ROOM_NAME_MAX = 16;
export const PLAYER_NAME_MAX = 16;
export const LOG_LINES_MAX = 5;
export const LOBBY_DURATION = 1000 * 10; // 10 seconds
export const GAME_DURATION = 1000 * 90; // 90 seconds
export const GAME_MODES: GameMode[] = ['deathmatch', 'team deathmatch'];

// Background
export const BACKGROUND_COLOR = '#25131A';

// Tile (rectangle)
export const TILE_SIZE = 32;

// Player (circle)
export const PLAYER_SIZE = 32;
export const PLAYER_SPEED = 3;
export const PLAYER_MAX_LIVES = 3;
export const PLAYER_WEAPON_SIZE = 12; // The bigger, the further away a bullet will be shot from.
export const PLAYER_HEARING_DISTANCE = 256;

// Monster
export const MONSTERS_COUNT = 3;
export const MONSTER_SIZE = 32;
export const MONSTER_SPEED_PATROL = 0.75;
export const MONSTER_SPEED_CHASE = 1.25;
export const MONSTER_SIGHT = 192;
export const MONSTER_LIVES = 3;
export const MONSTER_IDLE_DURATION_MIN = 1000;
export const MONSTER_IDLE_DURATION_MAX = 3000;
export const MONSTER_PATROL_DURATION_MIN = 1000;
export const MONSTER_PATROL_DURATION_MAX = 3000;
export const MONSTER_ATTACK_BACKOFF = 3000;

// Props (rectangle)
export const FLASKS_COUNT = 3;
export const FLASK_SIZE = 24;

// Bullet (circle)
export const BULLET_SIZE = 8;
export const BULLET_SPEED = 6;
export const BULLET_RATE = 600; // The bigger, the slower.

