import * as Colyseus from 'colyseus.js';
import Component from './Component';

export default class NetworkManager extends Component {
    constructor() {
        super();
        this.name = 'NetworkManager';
        this.client = null;
        this.room = null;
        this.isConnected = false;
        this.playerId = null;
    }

    async Initialize() {
        // Connect to Colyseus server
        // When running standalone: ws://localhost:3001
        // When running in HARD2KILL iframe: proxied through /three-fps-ws
        const isIframe = window.self !== window.top;
        const wsUrl = isIframe
            ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/three-fps-ws`
            : 'ws://localhost:3001';

        console.log('Connecting to Colyseus:', wsUrl);
        this.client = new Colyseus.Client(wsUrl);

        try {
            // Get matchId from URL if present
            const urlParams = new URLSearchParams(window.location.search);
            const matchId = urlParams.get('matchId');

            // Join or create a wasteland game room
            if (matchId) {
                this.room = await this.client.joinById(matchId);
            } else {
                this.room = await this.client.joinOrCreate('wasteland');
            }
            this.playerId = this.room.sessionId;
            this.isConnected = true;

            console.log('✅ Connected to Colyseus. Session ID:', this.playerId);

            // Wait for state to sync, then set up local player listeners
            setTimeout(() => {
                const localPlayer = this.room.state.players.get(this.playerId);
                if (localPlayer) {
                    console.log('Setting up local player listeners');
                    localPlayer.onChange = (changes) => {
                        const healthChange = changes.find(change => change.field === 'health');
                        if (healthChange) {
                            console.log('Local player health changed:', healthChange.value);
                            // Broadcast to Player entity, not Network entity
                            const playerEntity = this.FindEntity('Player');
                            if (playerEntity) {
                                playerEntity.Broadcast({
                                    topic: 'network.localPlayerHealth',
                                    data: {
                                        health: localPlayer.health
                                    }
                                });
                            }
                        }

                        const potChange = changes.find(change => change.field === 'pot');
                        if (potChange) {
                            console.log('Local player pot changed:', potChange.value);
                            // Broadcast pot update to UI
                            const uiEntity = this.FindEntity('UIManager');
                            if (uiEntity) {
                                uiEntity.Broadcast({
                                    topic: 'network.localPlayerPot',
                                    data: {
                                        pot: localPlayer.pot
                                    }
                                });
                            }
                        }
                    };
                } else {
                    console.error('Local player not found in state!');
                }
            }, 100);

            // Listen for state changes
            this.room.state.players.onAdd = (player, sessionId) => {
                if (sessionId !== this.playerId) {
                    console.log('Remote player joined:', sessionId);
                    this.Broadcast({
                        topic: 'network.playerJoined',
                        data: { playerId: sessionId, player: player }
                    });

                    // Listen for changes on this specific player
                    player.onChange = (changes) => {
                        // Check if position/rotation/velocity changed
                        const hasMovement = changes.some(change =>
                            ['x', 'y', 'z', 'rx', 'ry', 'rz', 'rw', 'velocity'].includes(change.field)
                        );

                        if (hasMovement) {
                            this.Broadcast({
                                topic: 'network.playerPosition',
                                data: {
                                    playerId: sessionId,
                                    position: { x: player.x, y: player.y, z: player.z },
                                    rotation: { x: player.rx, y: player.ry, z: player.rz, w: player.rw },
                                    velocity: player.velocity || 0
                                }
                            });
                        }

                        // Check if health changed
                        const healthChange = changes.find(change => change.field === 'health');
                        if (healthChange) {
                            console.log('Health changed for', sessionId, ':', healthChange.value);
                            this.Broadcast({
                                topic: 'network.playerHealth',
                                data: {
                                    playerId: sessionId,
                                    health: player.health
                                }
                            });
                        }
                    };
                }
            };

            this.room.state.players.onRemove = (player, sessionId) => {
                console.log('Remote player left:', sessionId);
                this.Broadcast({
                    topic: 'network.playerLeft',
                    data: { playerId: sessionId }
                });
            };

            // Listen for shoot events
            this.room.onMessage('playerShoot', (data) => {
                this.Broadcast({
                    topic: 'network.playerShoot',
                    data: data
                });
            });

            // Listen for death events
            this.room.onMessage('playerDied', (data) => {
                console.log('Player died:', data);
                this.Broadcast({
                    topic: 'network.playerDied',
                    data: data
                });
            });

            // Listen for match end
            this.room.onMessage('matchEnd', (data) => {
                console.log('Match ended:', data);
                // Handle match end (redirect, show results, etc.)
            });

        } catch (error) {
            console.error('❌ Failed to connect to Colyseus:', error);
            console.log('Make sure the server is running: cd server && npm start');
        }
    }

    // Send data to server
    Send(type, payload) {
        if (!this.isConnected || !this.room || !this.room.connection || this.room.connection.isOpen === false) {
            return;
        }

        try {
            this.room.send(type, payload);
        } catch (error) {
            // Connection closed, stop trying to send
            this.isConnected = false;
        }
    }

    // Request respawn
    Respawn() {
        this.Send('respawn', {});
    }

    Update(_) {
        // Network updates happen via callbacks
    }
}
