import { Constants, Maths, Models, Types } from '@hard2kill/gladiatorz-common';
import { Client, Room } from 'colyseus';
import { GameState } from '../states/GameState';
import { creditBalance, deductBalance, getBalance } from '@hard2kill/shared';
import { GladiatorBot } from '../bots/GladiatorBot';

export class GameRoom extends Room<GameState> {
    private bot?: GladiatorBot;
    private botSpawnTimer?: NodeJS.Timeout;
    //
    // Lifecycle
    //
    onCreate(options: Types.RoomOptions) {
        // Set max number of clients for this room
        this.maxClients = Maths.clamp(
            options.roomMaxPlayers || 0,
            Constants.ROOM_PLAYERS_MIN,
            Constants.ROOM_PLAYERS_MAX,
        );

        const playerName = options.playerName.slice(0, Constants.PLAYER_NAME_MAX);
        const roomName = options.roomName.slice(0, Constants.ROOM_NAME_MAX);

        const betAmount = options.betAmount || Constants.DEFAULT_BET_AMOUNT;

        // Init Metadata
        this.setMetadata({
            playerName,
            roomName,
            roomMap: options.roomMap,
            roomMaxPlayers: this.maxClients,
            mode: options.mode,
            betAmount,
        });

        // Init State
        this.setState(new GameState(roomName, options.roomMap, this.maxClients, options.mode, betAmount, this.handleMessage));

        this.setSimulationInterval(() => this.handleTick());

        console.log(
            `${new Date().toISOString()} [Create] player=${playerName} room=${roomName} map=${options.roomMap} max=${
                this.maxClients
            } mode=${options.mode}`,
        );

        // Listen to messages from clients
        this.onMessage('*', (client: Client, type: string | number, message: Models.ActionJSON) => {
            const playerId = client.sessionId;

            // Validate which type of message is accepted
            switch (type) {
                case 'move':
                case 'rotate':
                case 'shoot':
                    this.state.playerPushAction({
                        playerId,
                        ...message,
                    });
                    break;
                default:
                    break;
            }
        });
    }

    async onJoin(client: Client, options: Types.PlayerOptions) {
        const betAmount = this.state.game.betAmount;

        // Check and deduct balance if user has odinsId
        if (options.odinsId && betAmount > 0) {
            console.log(`${new Date().toISOString()} [Bet Check] userId=${options.odinsId} betAmount=${betAmount}`);
            const balance = await getBalance(options.odinsId);
            console.log(`${new Date().toISOString()} [Bet Check] userId=${options.odinsId} balance=${balance}`);
            if (balance < betAmount) {
                throw new Error(`Insufficient balance. Need ${betAmount}, have ${balance}`);
            }
            await deductBalance(options.odinsId, betAmount);
            console.log(`${new Date().toISOString()} [Bet] Deducted ${betAmount} from ${options.odinsId}`);
        }

        this.state.playerAdd(client.sessionId, options.playerName, options.odinsId);

        console.log(`${new Date().toISOString()} [Join] id=${client.sessionId} player=${options.playerName} odinsId=${options.odinsId}`);

        // Count real players (not bots)
        const realPlayers = Array.from(this.state.players.values()).filter(p => !p.playerId.startsWith('bot_'));

        // For 2-player deathmatch, handle bot spawning
        if (this.maxClients === 2 && this.state.game.mode === 'deathmatch') {
            if (realPlayers.length === 1 && !this.bot && !this.botSpawnTimer) {
                // First player joined, wait 2 seconds for second player before spawning bot
                console.log(`${new Date().toISOString()} [Bot] Waiting 2s for second player...`);
                this.botSpawnTimer = setTimeout(() => {
                    // Check if second player joined
                    const currentRealPlayers = Array.from(this.state.players.values()).filter(p => !p.playerId.startsWith('bot_'));
                    if (currentRealPlayers.length === 1 && !this.bot) {
                        this.bot = new GladiatorBot(this.state);
                        console.log(`${new Date().toISOString()} [Bot] Spawned bot (no second player found)`);
                    }
                    this.botSpawnTimer = undefined;
                }, 2000);
            } else if (realPlayers.length === 2) {
                // Second player joined! Cancel bot spawn if scheduled
                if (this.botSpawnTimer) {
                    clearTimeout(this.botSpawnTimer);
                    this.botSpawnTimer = undefined;
                    console.log(`${new Date().toISOString()} [Bot] Cancelled bot spawn - second player joined`);
                }
            }
        }
    }

    onLeave(client: Client) {
        this.state.playerRemove(client.sessionId);

        console.log(`${new Date().toISOString()} [Leave] id=${client.sessionId}`);
    }

    onDispose() {
        // Clean up bot spawn timer
        if (this.botSpawnTimer) {
            clearTimeout(this.botSpawnTimer);
            this.botSpawnTimer = undefined;
        }

        // Clean up bot
        if (this.bot) {
            this.bot.destroy();
            this.bot = undefined;
        }

        console.log(`${new Date().toISOString()} [Dispose] Room disposed`);
    }

    //
    // Handlers
    //
    handleTick = () => {
        this.state.update();

        // Update bot if it exists
        if (this.bot) {
            this.bot.update();
        }
    };

    handleMessage = (message: Models.MessageJSON) => {
        this.broadcast(message.type, message);
    };
}
