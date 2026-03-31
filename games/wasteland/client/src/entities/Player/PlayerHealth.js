import Component from "../../Component";

export default class PlayerHealth extends Component{
    constructor(){
        super();

        this.health = 100;
        this.isDead = false;
    }

    TakeHit = e =>{
        this.health = Math.max(0, this.health - 10);
        this.uimanager.SetHealth(this.health);
    }

    OnPlayerDied = (msg) => {
        this.isDead = true;
        this.health = 0;
        this.uimanager.SetHealth(0);
    }

    OnPlayerRespawned = (msg) => {
        this.isDead = false;
        this.health = 100;
        this.uimanager.SetHealth(100);
    }

    OnNetworkHealthChanged = (msg) => {
        console.log('PlayerHealth received network health update:', msg.data.health);
        const oldHealth = this.health;
        this.health = msg.data.health;
        this.uimanager.SetHealth(this.health);

        // Broadcast damage event if health decreased
        if (this.health < oldHealth) {
            this.Broadcast({
                topic: 'player.tookDamage',
                data: { damage: oldHealth - this.health }
            });
        }
    }

    Initialize(){
        this.uimanager = this.FindEntity("UIManager").GetComponent("UIManager");
        this.parent.RegisterEventHandler(this.TakeHit, "hit");
        this.parent.RegisterEventHandler(this.OnPlayerDied, "player.died");
        this.parent.RegisterEventHandler(this.OnPlayerRespawned, "player.respawned");
        this.parent.RegisterEventHandler(this.OnNetworkHealthChanged, "network.localPlayerHealth");
        this.uimanager.SetHealth(this.health);
    }
}