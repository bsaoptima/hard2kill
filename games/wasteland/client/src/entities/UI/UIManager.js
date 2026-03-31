import Component from '../../Component'

export default class UIManager extends Component{
    constructor(){
        super();
        this.name = 'UIManager';
    }

    SetAmmo(mag, rest){
        document.getElementById("current_ammo").innerText = mag;
        document.getElementById("max_ammo").innerText = rest;
    }

    SetHealth(health){
        document.getElementById("health_progress").style.width = `${health}%`;
    }

    SetPot(pot){
        const potElement = document.getElementById("pot_display");
        if (potElement) {
            potElement.innerText = `$${pot}`;
        }
    }

    Initialize(){
        document.getElementById("game_hud").style.visibility = 'visible';

        // Listen for local player pot updates
        this.parent.RegisterEventHandler(this.OnLocalPlayerPot, 'network.localPlayerPot');
    }

    OnLocalPlayerPot = (msg) => {
        this.SetPot(msg.data.pot);
    }
}