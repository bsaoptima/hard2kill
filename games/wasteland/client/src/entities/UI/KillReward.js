import Component from '../../Component';

export default class KillReward extends Component {
    constructor() {
        super();
        this.name = 'KillReward';
        this.element = null;
        this.visible = false;
        this.hideTimer = null;
    }

    Initialize() {
        // Create HTML element for kill reward
        this.element = document.createElement('div');
        this.element.style.cssText = `
            position: absolute;
            top: 30%;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            animation: pulse 0.5s ease-out;
            transition: opacity 0.3s ease-out;
            pointer-events: none;
            z-index: 100;
        `;

        document.body.appendChild(this.element);

        // Listen for kill reward events from Network entity
        const networkEntity = this.FindEntity('Network');
        if (networkEntity) {
            networkEntity.RegisterEventHandler(this.OnKillReward, 'player.killReward');
        }
    }

    OnKillReward = (msg) => {
        const { amount, victimName } = msg.data;

        this.element.innerHTML = `
            <div style="
                font-size: 18px;
                font-weight: bold;
                color: #ff4444;
                letter-spacing: 4px;
                text-shadow: 0 0 20px rgba(255, 68, 68, 0.8);
            ">ELIMINATED</div>
            <div style="
                font-size: 24px;
                font-weight: bold;
                color: #fff;
                text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            ">${victimName}</div>
            <div style="display: flex; align-items: center; gap: 4px;">
                <span style="
                    font-size: 48px;
                    font-weight: bold;
                    color: #4ade80;
                    text-shadow: 0 0 30px rgba(74, 222, 128, 0.8);
                ">+</span>
                <span style="
                    font-size: 64px;
                    font-weight: bold;
                    color: #4ade80;
                    font-family: monospace;
                    text-shadow: 0 0 30px rgba(74, 222, 128, 0.8), 0 0 60px rgba(74, 222, 128, 0.4);
                ">$${amount}</span>
            </div>
            <div style="
                font-size: 14px;
                font-weight: bold;
                color: #4ade80;
                letter-spacing: 2px;
                opacity: 0.8;
            ">POT CLAIMED</div>
        `;

        this.Show();
    }

    Show() {
        this.element.style.display = 'flex';
        this.element.style.opacity = '1';

        // Clear existing timer
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
        }

        // Hide after 2 seconds
        this.hideTimer = setTimeout(() => {
            this.element.style.opacity = '0';
            setTimeout(() => {
                this.element.style.display = 'none';
            }, 300);
        }, 2000);
    }

    Update() {
        // No update needed
    }
}
