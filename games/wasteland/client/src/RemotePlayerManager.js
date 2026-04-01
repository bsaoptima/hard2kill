import Component from './Component';
import RemotePlayer from './entities/Player/RemotePlayer';
// import { updatePot, recordTransaction, getCurrentUser } from '@hard2kill/shared';

// Stub functions for now
const updatePot = async (amount) => { console.log('updatePot:', amount); };
const recordTransaction = async (amount, type) => { console.log('recordTransaction:', amount, type); };
const getCurrentUser = async () => { console.log('getCurrentUser'); return null; };

export default class RemotePlayerManager extends Component {
    constructor(scene, camera, mutantModel, mutantAnims, weaponModel) {
        super();
        this.name = 'RemotePlayerManager';
        this.scene = scene;
        this.camera = camera;
        this.mutantModel = mutantModel;
        this.mutantAnims = mutantAnims;
        this.weaponModel = weaponModel;
        this.remotePlayers = new Map();
        this.networkManager = null;
        this.respawnTimer = null;
    }

    Initialize() {
        // Get NetworkManager
        const networkEntity = this.FindEntity('Network');
        if (networkEntity) {
            this.networkManager = networkEntity.GetComponent('NetworkManager');
        }

        // Listen for network events
        this.parent.RegisterEventHandler(this.OnPlayerJoined, 'network.playerJoined');
        this.parent.RegisterEventHandler(this.OnPlayerLeft, 'network.playerLeft');
        this.parent.RegisterEventHandler(this.OnPlayerPosition, 'network.playerPosition');
        this.parent.RegisterEventHandler(this.OnPlayerShoot, 'network.playerShoot');
        this.parent.RegisterEventHandler(this.OnPlayerHealth, 'network.playerHealth');
        this.parent.RegisterEventHandler(this.OnPlayerDied, 'network.playerDied');
    }

    OnPlayerJoined = (msg) => {
        const { playerId, player } = msg.data;

        if (this.remotePlayers.has(playerId)) {
            return; // Already exists
        }

        console.log('Spawning remote player:', playerId, 'Initial health:', player ? player.health : 'unknown');

        // Create remote player with character model and weapon
        const remotePlayer = new RemotePlayer(this.scene, playerId, this.mutantModel, this.mutantAnims, this.weaponModel);
        remotePlayer.Initialize();

        // Set initial health
        if (player && player.health !== undefined) {
            remotePlayer.UpdateHealth(player.health);
        }

        this.remotePlayers.set(playerId, remotePlayer);
    }

    OnPlayerHealth = (msg) => {
        const { playerId, health } = msg.data;

        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            console.log('Updating health for player', playerId, 'to', health);
            remotePlayer.UpdateHealth(health);
        }
    }

    OnPlayerLeft = (msg) => {
        const { playerId } = msg.data;

        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            console.log('Removing remote player:', playerId);
            remotePlayer.Destroy();
            this.remotePlayers.delete(playerId);
        }
    }

    OnPlayerPosition = (msg) => {
        const { playerId, position, rotation, velocity } = msg.data;

        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            remotePlayer.UpdatePosition(position, rotation, velocity);
        }
    }

    OnPlayerShoot = (msg) => {
        const { playerId } = msg.data;

        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            console.log('Player shot:', playerId);
            remotePlayer.ShowMuzzleFlash();
        }
    }

    OnPlayerDied = (msg) => {
        const { victimId, killerId, killerName, victimName, potWon } = msg.data;

        console.log(`Player ${victimId} was killed by ${killerId}`);

        // Hide the victim's remote player
        const remotePlayer = this.remotePlayers.get(victimId);
        if (remotePlayer && !remotePlayer.isDead) {
            remotePlayer.SetDead(true);
            remotePlayer.Hide();

            // Respawn after 3 seconds
            setTimeout(() => {
                if (remotePlayer) {
                    remotePlayer.Show();
                    remotePlayer.UpdateHealth(100);
                    remotePlayer.SetDead(false);
                }
            }, 3000);
        }

        // Check if local player got the kill
        if (this.networkManager && killerId === this.networkManager.playerId) {
            console.log(`You killed ${victimName} and won $${potWon}!`);
            this.Broadcast({
                topic: 'player.killReward',
                data: { amount: potWon, victimName }
            });

            // Record kill transaction in Supabase
            recordTransaction(potWon, 'kill').catch(err =>
                console.error('Failed to record kill transaction:', err)
            );
        }

        // Check if local player died
        if (this.networkManager && victimId === this.networkManager.playerId) {
            console.log(`You died and lost $${potWon} to ${killerName}!`);
            this.Broadcast({
                topic: 'player.died',
                data: { killerId }
            });

            // Broadcast pot lost
            this.Broadcast({
                topic: 'player.potLost',
                data: { amount: potWon, killerName }
            });

            // Record death transaction in Supabase
            recordTransaction(-potWon, 'death').catch(err =>
                console.error('Failed to record death transaction:', err)
            );

            // Request respawn after delay (only once)
            if (!this.respawnTimer) {
                this.respawnTimer = setTimeout(() => {
                    this.networkManager.Respawn();
                    this.Broadcast({
                        topic: 'player.respawned',
                        data: {}
                    });
                    this.respawnTimer = null;
                }, 3000);
            }
        }
    }

    Update(timeElapsed) {
        // Update all remote players
        for (const [playerId, remotePlayer] of this.remotePlayers) {
            remotePlayer.Update(timeElapsed, this.camera);
        }
    }
}
