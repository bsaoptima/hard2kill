import { GameState } from '../states/GameState';
import { Player } from '../entities/Player';

enum BotState {
    WANDER,
    CHASE,
    ATTACK
}

// Reddit-style random username generator
const ADJECTIVES = [
    'Brave', 'Swift', 'Silent', 'Fierce', 'Ancient', 'Noble', 'Wild', 'Iron',
    'Shadow', 'Thunder', 'Crimson', 'Golden', 'Silver', 'Dark', 'Mighty',
    'Legendary', 'Epic', 'Raging', 'Frozen', 'Blazing', 'Mystic', 'Phantom',
    'Savage', 'Royal', 'Supreme', 'Divine', 'Infernal', 'Celestial', 'Eternal',
    'Lethal', 'Deadly', 'Ruthless', 'Fearless', 'Bold', 'Daring', 'Valiant'
];

const NOUNS = [
    'Warrior', 'Hunter', 'Knight', 'Champion', 'Slayer', 'Assassin', 'Gladiator',
    'Berserker', 'Sentinel', 'Warden', 'Guardian', 'Reaper', 'Titan', 'Ronin',
    'Samurai', 'Viking', 'Spartan', 'Crusader', 'Duelist', 'Mercenary', 'Soldier',
    'Fighter', 'Striker', 'Ranger', 'Blade', 'Storm', 'Fang', 'Wolf', 'Bear',
    'Eagle', 'Dragon', 'Phoenix', 'Hawk', 'Lion', 'Tiger', 'Viper'
];

function generateBotName(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const number = Math.floor(Math.random() * 9999);
    return `${adjective}${noun}${number}`;
}

export class GladiatorBot {
    private botId: string;
    private state: BotState = BotState.WANDER;
    private gameState: GameState;
    private lastShotTime: number = 0;
    private wanderAngle: number = 0;
    private wanderTimer: number = 0;

    // Bot parameters
    private visionRange: number = 250;
    private attackRange: number = 180;
    private aimError: number = 0.15; // radians
    private reactionDelay: number = 0;
    private reactionDelayMax: number = 20; // ~330ms at 60fps

    constructor(gameState: GameState, botName?: string) {
        this.gameState = gameState;
        this.botId = `bot_${Date.now()}`;

        // Generate random name if not provided
        const name = botName || generateBotName();

        // Add bot as a player (no odinsId = no balance check)
        this.gameState.playerAdd(this.botId, name, '');

        console.log(`[Bot] ${name} (${this.botId}) joined the game`);
    }

    update() {
        const bot = this.gameState.players.get(this.botId);
        if (!bot || !bot.isAlive) return;

        // Find nearest visible player
        const target = this.findNearestPlayer(bot);

        if (target) {
            const distance = Math.hypot(target.x - bot.x, target.y - bot.y);

            if (this.state === BotState.WANDER) {
                // Spotted player - reaction delay
                this.state = BotState.CHASE;
                this.reactionDelay = this.reactionDelayMax;
            }

            if (this.reactionDelay > 0) {
                this.reactionDelay--;
                this.wander(bot);
                return;
            }

            if (distance < this.attackRange) {
                this.state = BotState.ATTACK;
                this.attack(bot, target);
            } else {
                this.state = BotState.CHASE;
                this.chase(bot, target);
            }
        } else {
            this.state = BotState.WANDER;
            this.wander(bot);
        }
    }

    private findNearestPlayer(bot: Player): Player | null {
        let nearest: Player | null = null;
        let minDist = this.visionRange;

        this.gameState.players.forEach((player, id) => {
            if (id === this.botId || !player.isAlive) return;

            const distance = Math.hypot(player.x - bot.x, player.y - bot.y);

            if (distance < minDist) {
                minDist = distance;
                nearest = player;
            }
        });

        return nearest;
    }

    private wander(bot: Player) {
        // Change direction every 2 seconds (120 ticks at 60fps)
        this.wanderTimer++;
        if (this.wanderTimer > 120) {
            this.wanderAngle = Math.random() * Math.PI * 2;
            this.wanderTimer = 0;
        }

        // Move in wander direction
        const x = Math.cos(this.wanderAngle);
        const y = Math.sin(this.wanderAngle);

        this.gameState.playerPushAction({
            type: 'move',
            ts: Date.now(),
            playerId: this.botId,
            value: { x, y }
        });

        // Slowly rotate
        this.gameState.playerPushAction({
            type: 'rotate',
            ts: Date.now(),
            playerId: this.botId,
            value: { rotation: bot.rotation + 0.03 }
        });
    }

    private chase(bot: Player, target: Player) {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;

        // Move toward target with slight randomness
        const noise = 0.15;
        const x = dx + (Math.random() - 0.5) * noise * 100;
        const y = dy + (Math.random() - 0.5) * noise * 100;

        this.gameState.playerPushAction({
            type: 'move',
            ts: Date.now(),
            playerId: this.botId,
            value: { x, y }
        });

        // Rotate toward target
        const angle = Math.atan2(dy, dx);
        this.gameState.playerPushAction({
            type: 'rotate',
            ts: Date.now(),
            playerId: this.botId,
            value: { rotation: angle }
        });
    }

    private attack(bot: Player, target: Player) {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;

        // Strafe perpendicular to target
        const perpX = -dy;
        const perpY = dx;
        const strafeDir = Math.sin(Date.now() / 1000) > 0 ? 1 : -1;

        const x = dx * 0.2 + perpX * 0.8 * strafeDir;
        const y = dy * 0.2 + perpY * 0.8 * strafeDir;

        this.gameState.playerPushAction({
            type: 'move',
            ts: Date.now(),
            playerId: this.botId,
            value: { x, y }
        });

        // Aim at target
        const angle = Math.atan2(dy, dx);
        this.gameState.playerPushAction({
            type: 'rotate',
            ts: Date.now(),
            playerId: this.botId,
            value: { rotation: angle }
        });

        // Shoot with imperfect aim
        const now = Date.now();
        if (now - this.lastShotTime > 650) {
            const aimError = (Math.random() - 0.5) * this.aimError;
            this.gameState.playerPushAction({
                type: 'shoot',
                ts: now,
                playerId: this.botId,
                value: { angle: angle + aimError }
            });
            this.lastShotTime = now;
        }
    }

    destroy() {
        console.log(`[Bot] ${this.botId} destroyed`);
    }
}
