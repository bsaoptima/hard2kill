import Component from '../../Component';

export default class DamageFlash extends Component {
    constructor() {
        super();
        this.name = 'DamageFlash';
        this.element = null;
    }

    Initialize() {
        // Create HTML element for damage flash
        this.element = document.createElement('div');
        this.element.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 0, 0, 0);
            pointer-events: none;
            z-index: 50;
            transition: background-color 0.1s ease-out;
        `;

        document.body.appendChild(this.element);

        // Listen for damage events from Player entity
        const playerEntity = this.FindEntity('Player');
        if (playerEntity) {
            playerEntity.RegisterEventHandler(this.OnDamage, 'player.tookDamage');
        }
    }

    OnDamage = (msg) => {
        // Flash red
        this.element.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';

        // Fade out
        setTimeout(() => {
            this.element.style.backgroundColor = 'rgba(255, 0, 0, 0)';
        }, 100);
    }

    Update() {
        // No update needed
    }
}
