import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPlayerVehicle } from "./playerVehicles.js";
import { VEHICLES, ENVIRONMENTS_BY_ID, TIMES_BY_ID } from "./data.js";

export class Showroom {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = true;
    this.rotation = 2.35;
    this.targetRotation = 2.35;
    this.autoSpin = true;
    this.idleTime = 0;
    this.zoom = 1;
    this.vehicleModel = null;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 240);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environmentMap;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight(0xe8f2ff, 0x14181f, 0.85);
    this.scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0xfff4e2, 3.2);
    this.key.position.set(-6, 9, 7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 40;
    this.key.shadow.camera.left = -12;
    this.key.shadow.camera.right = 12;
    this.key.shadow.camera.top = 12;
    this.key.shadow.camera.bottom = -12;
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key);

    this.rimLight = new THREE.DirectionalLight(0x60d8ff, 2.2);
    this.rimLight.position.set(7, 4, -6);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0xffb066, 0.9);
    this.fillLight.position.set(-7, 3, -5);
    this.scene.add(this.fillLight);

    this.pedestal = new THREE.Group();
    this.scene.add(this.pedestal);

    this.buildStage(3.2, "#22e6ff");
    this.setEnvironment("city", "sunset");

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildStage(radius, accentHex) {
    while (this.pedestal.children.length) {
      const child = this.pedestal.children.pop();
      child.traverse?.((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) node.material.dispose();
      });
    }

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.04, 0.22, 72),
      new THREE.MeshStandardMaterial({
        color: 0x0d1118,
        roughness: 0.32,
        metalness: 0.72,
      })
    );
    floor.position.y = -0.11;
    floor.receiveShadow = true;
    this.pedestal.add(floor);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.94, 64),
      new THREE.MeshStandardMaterial({
        color: 0x070a0e,
        roughness: 0.18,
        metalness: 0.85,
      })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.001;
    inner.receiveShadow = true;
    this.pedestal.add(inner);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: accentHex,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.86, 0.025, 6, 120),
      ringMaterial
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.014;
    this.pedestal.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.55, 0.012, 5, 90),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.012;
    this.pedestal.add(ring2);

    this.ringMaterial = ringMaterial;

    // Contact shadow under the vehicle.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, "rgba(0,0,0,0.55)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 1.25, radius * 1.55),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    this.pedestal.add(shadow);
  }

  setVehicle(vehicleId, wrap, rimId) {
    if (this.vehicleModel) {
      this.vehicleModel.dispose();
      this.vehicleModel = null;
    }
    const def = VEHICLES[vehicleId] || VEHICLES.supercar;
    const model = createPlayerVehicle(def.id, wrap, rimId);
    model.group.position.y = 0.02;
    this.scene.add(model.group);
    this.vehicleModel = model;
    this.vehicleId = def.id;

    const radius = Math.max(2.6, Math.max(def.physics.halfLength * 1.15, 2) + 0.7);
    const env = ENVIRONMENTS_BY_ID[this.environmentId] || ENVIRONMENTS_BY_ID.city;
    this.buildStage(radius, env.accent);
    this.titleScale = def.physics.halfLength;

    const length = def.physics.halfLength * 2;
    const diagonal = Math.hypot(length, def.physics.halfWidth * 2);
    this.baseDistance = Math.max(10.4, diagonal * 2.8);
    this.targetHeight = Math.min(4.2, 1.45 + def.physics.halfLength * 0.3);
  }

  setWrap(wrap) {
    if (this.vehicleModel) this.vehicleModel.setWrap(wrap);
  }

  setRim(rimId) {
    if (this.vehicleModel) this.vehicleModel.setRim(rimId);
  }

  setEnvironment(environmentId, timeId) {
    this.environmentId = environmentId;
    this.timeId = timeId;
    const env = ENVIRONMENTS_BY_ID[environmentId] || ENVIRONMENTS_BY_ID.city;
    if (this.ringMaterial) this.ringMaterial.color.set(env.accent);
    const time = TIMES_BY_ID[timeId] || TIMES_BY_ID.sunset;
    const t = timeId === "auto" ? 0.46 : time.t;
    const theta = (t - 0.25) * Math.PI * 2;
    const daylight = Math.max(0, Math.min(1, Math.sin(theta) * 1.7 + 0.24));
    this.scene.environmentIntensity = 0.25 + daylight * 0.45;
    this.hemi.intensity = 0.25 + daylight * 0.85;
    this.key.intensity = 0.7 + daylight * 2.7;
    this.rimLight.intensity = 1.1 + (1 - daylight) * 1.8;
    this.fillLight.intensity = 0.4 + daylight * 0.5;
    this.key.color.set(daylight > 0.5 ? 0xfff4e2 : 0x9fc4ff);
  }

  rotate(delta) {
    this.targetRotation += delta;
    this.autoSpin = false;
    this.idleTime = 0;
  }

  spin(direction = 1) {
    this.targetRotation += direction * (Math.PI / 4);
    this.autoSpin = false;
    this.idleTime = 0;
  }

  zoomBy(delta) {
    this.zoom = Math.max(0.68, Math.min(1.55, this.zoom + delta));
  }

  attach(container) {
    if (this.canvas.parentElement !== container) container.appendChild(this.canvas);
    this.resize();
  }

  setActive(active) {
    this.active = active;
    if (active) this.resize();
  }

  resize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 640;
    const height = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 480;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = Math.max(0.3, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (!this.active) return;

    if (this.autoSpin) {
      this.targetRotation += dt * 0.32;
      this.idleTime += dt;
      if (this.idleTime > 12) this.autoSpin = true;
    } else {
      this.idleTime += dt;
      if (this.idleTime > 4.5) this.autoSpin = true;
    }
    this.rotation += (this.targetRotation - this.rotation) * (1 - Math.exp(-10 * dt));

    const length = this.titleScale || 2;
    const distance = (this.baseDistance || 12) / this.zoom;
    const height = (this.targetHeight || 2.4) + distance * 0.15;
    this.camera.position.set(
      Math.sin(this.rotation) * distance,
      height,
      Math.cos(this.rotation) * distance
    );
    this.camera.lookAt(0, Math.min(1.55, 0.72 + length * 0.19), 0);

    if (this.vehicleModel) {
      this.vehicleModel.update(now / 1000, dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.active = false;
    if (this.vehicleModel) this.vehicleModel.dispose();
    this.scene.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      }
    });
    this.environmentMap?.dispose();
    this.renderer.dispose();
  }
}
