import * as THREE from 'three';
import Component from '../../Component';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';

export default class RemotePlayer extends Component {
    constructor(scene, playerId, mutantModel, mutantAnims, weaponModel) {
        super();
        this.name = 'RemotePlayer';
        this.scene = scene;
        this.playerId = playerId;
        this.mutantModel = mutantModel;
        this.mutantAnims = mutantAnims;
        this.weaponModel = weaponModel;
        this.model = null;
        this.weapon = null;
        this.mixer = null;
        this.animations = {};
        this.targetPosition = new THREE.Vector3();
        this.targetRotation = new THREE.Quaternion();
        this.isDead = false;
        this.currentAnim = null;

        // Camera offset from physics capsule: yOffset (0.5) + capsule half (0.65 + 0.3) = 1.45
        this.CAMERA_TO_FEET_OFFSET = 1.45;
    }

    Initialize() {
        // Create a container group for positioning
        this.container = new THREE.Group();

        // Clone the mutant model for this remote player
        this.model = SkeletonUtils.clone(this.mutantModel);
        this.model.scale.setScalar(0.01);

        // Rotate model 180 degrees so it faces the correct direction
        this.model.rotation.y = Math.PI;

        // Offset the model down so feet are on the ground
        // The server sends camera position, so we need to move the model down
        this.model.position.y = -this.CAMERA_TO_FEET_OFFSET;

        // Set up animations - just idle for now
        this.mixer = new THREE.AnimationMixer(this.model);
        if (this.mutantAnims['idle']) {
            const action = this.mixer.clipAction(this.mutantAnims['idle']);
            this.animations['idle'] = { clip: this.mutantAnims['idle'], action };
        }

        // Tag meshes for raycast detection
        this.model.traverse(child => {
            if (child.isSkinnedMesh) {
                child.frustumCulled = false;
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.isRemotePlayer = true;
                child.userData.playerId = this.playerId;
            }
        });

        this.container.add(this.model);

        // Attach weapon to hand
        this.AttachWeapon();

        // Add name tag
        this.CreateNameTag();

        // Add health bar
        this.CreateHealthBar();

        // Add muzzle flash
        this.CreateMuzzleFlash();

        // Play idle animation
        if (this.animations['idle']) {
            this.animations['idle'].action.play();
            this.currentAnim = 'idle';
        }

        this.scene.add(this.container);
    }

    AttachWeapon() {
        if (!this.weaponModel) {
            console.warn('No weapon model provided');
            return;
        }

        // Clone the weapon model
        this.weapon = this.weaponModel.clone();

        // Make sure weapon is visible
        this.weapon.visible = true;
        this.weapon.traverse((child) => {
            if (child.isMesh) {
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Attach to container at a visible position
        // Position it to the right side at chest level
        this.weapon.position.set(0.2, -0.4, 0.3);
        // Rotate to point forward
        this.weapon.rotation.set(0, -Math.PI / 2, 0);
        this.weapon.scale.setScalar(1.0);

        this.container.add(this.weapon);
        console.log('Weapon attached to container at position:', this.weapon.position);
    }

    CreateHealthBar() {
        // Health bar background
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);

        // Health bar foreground (green)
        const fgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
        this.healthBarFg.position.z = 0.001; // Slightly in front

        const healthBarGroup = new THREE.Group();
        healthBarGroup.add(this.healthBarBg);
        healthBarGroup.add(this.healthBarFg);
        healthBarGroup.position.y = 0.6; // Above container (at head level)

        this.container.add(healthBarGroup);
        this.healthBarGroup = healthBarGroup;
    }

    UpdateHealth(health) {
        if (this.healthBarFg) {
            const healthPercent = Math.max(0, Math.min(1, health / 100));
            this.healthBarFg.scale.x = healthPercent;
            this.healthBarFg.position.x = -(1 - healthPercent) * 0.5;

            // Color based on health
            if (healthPercent > 0.6) {
                this.healthBarFg.material.color.setHex(0x00ff00); // Green
            } else if (healthPercent > 0.3) {
                this.healthBarFg.material.color.setHex(0xffff00); // Yellow
            } else {
                this.healthBarFg.material.color.setHex(0xff0000); // Red
            }
        }
    }

    CreateMuzzleFlash() {
        // Simple muzzle flash using a point light and sphere
        this.muzzleFlash = new THREE.Group();

        const flashGeometry = new THREE.SphereGeometry(0.2);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0
        });
        this.flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);

        this.flashLight = new THREE.PointLight(0xffaa00, 2, 3);
        this.flashLight.visible = false;

        this.muzzleFlash.add(this.flashMesh);
        this.muzzleFlash.add(this.flashLight);

        // Position in front of player (approximate gun position)
        // Relative to container which is at camera height
        this.muzzleFlash.position.set(0.3, -0.3, 0.5);

        this.container.add(this.muzzleFlash);
        this.flashDuration = 0;
    }

    ShowMuzzleFlash() {
        // Show flash for brief moment
        this.flashDuration = 0.1;
        this.flashMesh.material.opacity = 1;
        this.flashLight.visible = true;
    }

    CreateNameTag() {
        // Simple sprite for name (you can enhance this later)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Player ${this.playerId.substr(0, 6)}`, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = 1.0; // Above container (above health bar)

        this.container.add(sprite);
    }

    UpdatePosition(position, rotation, velocity) {
        // Store target position for smooth interpolation
        this.targetPosition.set(position.x, position.y, position.z);
        this.targetRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);

        // Animation disabled for now
        // if (velocity > 0.1) {
        //     console.log(`[Remote ${this.playerId.substr(0,6)}] Received velocity: ${velocity.toFixed(2)}`);
        // }
        // this.UpdateAnimation(velocity || 0);
    }

    UpdateAnimation(velocity) {
        // Determine which animation to play based on velocity
        const walkThreshold = 0.5;
        const runThreshold = 3.0;

        let targetAnim = 'idle';
        if (velocity > runThreshold) {
            targetAnim = 'run';
        } else if (velocity > walkThreshold) {
            targetAnim = 'walk';
        }

        // Debug logging
        if (velocity > 0.1) {
            console.log(`Velocity: ${velocity.toFixed(2)}, Animation: ${targetAnim}`);
        }

        // Switch animation if different from current
        if (this.currentAnim !== targetAnim && this.animations[targetAnim]) {
            console.log(`Switching animation from ${this.currentAnim} to ${targetAnim}`);

            // Stop current animation
            if (this.currentAnim && this.animations[this.currentAnim]) {
                this.animations[this.currentAnim].action.fadeOut(0.2);
            }

            // Play new animation
            this.animations[targetAnim].action.reset().fadeIn(0.2).play();
            this.currentAnim = targetAnim;
        }
    }

    Hide() {
        if (this.container) {
            this.container.visible = false;
        }
    }

    Show() {
        if (this.container) {
            this.container.visible = true;
            // Reset rotation when respawning
            this.model.rotation.x = 0;
            this.deathAnimationActive = false;
        }
    }

    SetDead(dead) {
        this.isDead = dead;

        if (dead) {
            // Play death animation - rotate the character to fall down
            this.PlayDeathAnimation();
        }
    }

    PlayDeathAnimation() {
        // Rotate the character 90 degrees to make it look like it's falling down
        // Animate it over 0.5 seconds for a smooth fall
        const startRotation = this.model.rotation.x;
        const endRotation = Math.PI / 2; // 90 degrees
        const duration = 0.5; // seconds
        let elapsed = 0;

        this.deathAnimationActive = true;
        this.deathAnimationProgress = 0;
        this.deathAnimationDuration = duration;
    }

    Update(timeElapsed, camera) {
        if (!this.container) return;

        // Update animations
        if (this.mixer) {
            this.mixer.update(timeElapsed);
        }

        // Update death animation
        if (this.deathAnimationActive) {
            this.deathAnimationProgress += timeElapsed;
            const progress = Math.min(this.deathAnimationProgress / this.deathAnimationDuration, 1.0);

            // Ease out animation
            const eased = 1 - Math.pow(1 - progress, 3);

            // Rotate model to fall down
            this.model.rotation.x = eased * (Math.PI / 2);

            if (progress >= 1.0) {
                this.deathAnimationActive = false;
            }
        }

        // Smooth interpolation (lerp) for position
        this.container.position.lerp(this.targetPosition, 0.2);

        // Smooth interpolation for rotation
        this.container.quaternion.slerp(this.targetRotation, 0.2);

        // Make health bar face camera
        if (this.healthBarGroup && camera) {
            this.healthBarGroup.lookAt(camera.position);
        }

        // Animate muzzle flash fade out
        if (this.flashDuration > 0) {
            this.flashDuration -= timeElapsed;
            const ratio = Math.max(0, this.flashDuration / 0.1);
            this.flashMesh.material.opacity = ratio;

            if (this.flashDuration <= 0) {
                this.flashLight.visible = false;
            }
        }
    }

    Destroy() {
        if (this.container) {
            this.scene.remove(this.container);
            this.container.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
    }
}
