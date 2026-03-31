import Component from '../../Component';
import * as THREE from 'three';

export default class NetworkedPlayer extends Component {
    constructor() {
        super();
        this.name = 'NetworkedPlayer';
        this.networkManager = null;
        this.updateInterval = 0.05; // Send updates every 50ms
        this.timeSinceLastUpdate = 0;
        this.lastPosition = new THREE.Vector3();
        this.velocity = 0;
    }

    Initialize() {
        // Get NetworkManager from another entity
        const networkEntity = this.FindEntity('Network');
        if (networkEntity) {
            this.networkManager = networkEntity.GetComponent('NetworkManager');
        }

        // Initialize last position
        this.lastPosition.copy(this.parent.Position);
    }

    Update(timeElapsed) {
        if (!this.networkManager) {
            return;
        }

        this.timeSinceLastUpdate += timeElapsed;

        // Send position updates at fixed intervals
        if (this.timeSinceLastUpdate >= this.updateInterval) {
            this.SendPosition();
            this.timeSinceLastUpdate = 0;
        }
    }

    SendPosition() {
        const position = this.parent.Position;
        const rotation = this.parent.Rotation;

        // Calculate velocity (speed) - only XZ plane for ground movement
        const dx = position.x - this.lastPosition.x;
        const dz = position.z - this.lastPosition.z;
        this.velocity = Math.sqrt(dx * dx + dz * dz) / this.updateInterval;

        // Update last position
        this.lastPosition.copy(position);

        this.networkManager.Send('position', {
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z,
                w: rotation.w
            },
            velocity: this.velocity
        });
    }
}
