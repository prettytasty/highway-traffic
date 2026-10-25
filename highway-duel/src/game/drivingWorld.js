import * as THREE from "three";
import {
  ROAD,
  LANE_CENTERS,
  RUN_SECONDS,
  COUNTDOWN_SECONDS,
  NEAR_MISS,
  CREDITS_PER_METRE,
  OVERTAKE_CREDITS,
  COMPLETION_BONUS,
  METRES_PER_MILE,
} from "./config.js";
import { VEHICLES, TIMES_BY_ID, randomSeed } from "./data.js";
import { createScenery } from "./scenery.js";
import { createPlayerVehicle } from "./playerVehicles.js";
import { TRAFFIC_TYPES, createTrafficVehicle } from "./vehicles.js";
import { mulberry32, pickWeighted, randRange, randInt, shuffle } from "./rng.js";

const TRAFFIC_LIMIT = 36;
const CRASH_PENALTY = 55;
const TYPE_ENTRIES = Object.keys(TRAFFIC_TYPES).map((value) => ({
  value,
  weight: TRAFFIC_TYPES[value].weight,
}));

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function createSparks(scene) {
  const count = 46;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffb45e,
    size: 0.42,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return { points, material, positions, velocities, life: 0, maxLife: 0.65, count };
}

function spawnSparks(sparks, x, y, z) {
  const { positions, velocities, count } = sparks;
  for (let i = 0; i < count; i++) {
    const index = i * 3;
    positions[index] = x + (Math.random() - 0.5) * 1.6;
    positions[index + 1] = y + Math.random() * 0.7;
    positions[index + 2] = z + (Math.random() - 0.5) * 2.2;
    velocities[index] = (Math.random() - 0.5) * 13;
    velocities[index + 1] = 1 + Math.random() * 8;
    velocities[index + 2] = (Math.random() - 0.5) * 15;
  }
  sparks.life = sparks.maxLife;
  sparks.material.opacity = 1;
  sparks.points.visible = true;
  sparks.points.geometry.attributes.position.needsUpdate = true;
}

function updateSparks(sparks, dt) {
  if (sparks.life <= 0) return;
  sparks.life -= dt;
  const { positions, velocities, count } = sparks;
  for (let i = 0; i < count; i++) {
    const index = i * 3;
    positions[index] += velocities[index] * dt;
    positions[index + 1] += velocities[index + 1] * dt;
    positions[index + 2] += velocities[index + 2] * dt;
    velocities[index + 1] -= 20 * dt;
  }
  sparks.material.opacity = Math.max(0, sparks.life / sparks.maxLife);
  sparks.points.geometry.attributes.position.needsUpdate = true;
  if (sparks.life <= 0) sparks.points.visible = false;
}

function createSpeedLines(scene) {
  const count = 64;
  const random = mulberry32(5512);
  const items = [];
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    items.push({
      x: (random() < 0.5 ? -1 : 1) * randRange(random, 9.5, 28),
      y: randRange(random, 0.4, 7),
      z: -randRange(random, 0, 240),
      length: randRange(random, 4, 14),
      speed: randRange(random, 0.75, 1.25),
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xcfe8ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  scene.add(lines);
  return { lines, items, positions, count, material, random };
}

function updateSpeedLines(speedLines, carZ, speed, dt) {
  const { items, positions, count, material, random } = speedLines;
  const ratio = Math.min(1, speed / 70);
  material.opacity = speed < 18 ? 0 : (0.06 + ratio * 0.3) * Math.min(1, (speed - 18) / 12);
  if (material.opacity <= 0.001) {
    speedLines.lines.visible = false;
    return;
  }
  speedLines.lines.visible = true;
  for (let i = 0; i < count; i++) {
    const item = items[i];
    if (item.z > carZ + 25) {
      item.z = carZ - randRange(random, 140, 280);
      item.x = (random() < 0.5 ? -1 : 1) * randRange(random, 9.5, 28);
      item.y = randRange(random, 0.4, 7);
      item.length = randRange(random, 4, 14);
    }
    const index = i * 6;
    positions[index] = item.x;
    positions[index + 1] = item.y;
    positions[index + 2] = item.z;
    positions[index + 3] = item.x;
    positions[index + 4] = item.y;
    positions[index + 5] = item.z - item.length * (0.55 + ratio);
  }
  speedLines.lines.geometry.attributes.position.needsUpdate = true;
}

function disposeSceneObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material && !child.userData.sharedMaterial) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
  });
}

export class DrivingWorld {
  constructor({
    renderer,
    canvas,
    vehicleId,
    wrap,
    rimId,
    environmentId,
    timeId,
    audio,
    onEvent,
  }) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.audio = audio;
    this.onEvent = onEvent;
    this.vehicleId = VEHICLES[vehicleId] ? vehicleId : "supercar";
    this.def = VEHICLES[this.vehicleId];
    this.phys = this.def.physics;
    this.wrap = wrap;
    this.rimId = rimId;
    this.environmentId = environmentId;
    this.timeId = timeId;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(67, 1, 0.1, 3200);
    this.scenery = createScenery(
      this.scene,
      renderer,
      environmentId,
      timeId
    );

    this.player = createPlayerVehicle(this.vehicleId, wrap, rimId);
    this.playerGroup = this.player.group;
    this.scene.add(this.playerGroup);
    this.playerGroup.position.set(LANE_CENTERS[1], 0, 0);

    this.headlight = new THREE.SpotLight(0xffe3b0, 0, 110, 0.62, 0.55, 1.2);
    this.headlight.castShadow = false;
    this.scene.add(this.headlight);
    this.headlight.target = new THREE.Object3D();
    this.scene.add(this.headlight.target);

    this.sparks = createSparks(this.scene);
    this.speedLines = createSpeedLines(this.scene);

    this.input = { throttle: false, brake: false, left: false, right: false };
    this.paused = false;
    this.animTime = 0;
    this.cameraFov = this.def.camera.fov;

    this.car = {
      x: LANE_CENTERS[1],
      z: 0,
      prevZ: 0,
      speed: 0,
      latVel: 0,
    };
    this.traffic = [];

    this.reset(randomSeed());
    this.resize();
  }

  reset(seed) {
    for (const traffic of this.traffic) {
      this.scene.remove(traffic.group);
    }
    this.traffic.length = 0;

    this.spawnRng = mulberry32(seed);
    this.aiRng = mulberry32(seed ^ 0x9e3779b9);
    this.seed = seed;
    this.phase = "countdown";
    this.countdown = COUNTDOWN_SECONDS;
    this.lastCountdownNumber = null;
    this.elapsed = 0;
    this.difficulty = 0;
    this.spawnTimer = 0.6;
    this.introProgress = 0;
    this.animTime = 0;
    this.shake = 0;
    this.invuln = 0;
    this.finished = false;
    this.paused = false;

    this.car.x = LANE_CENTERS[1];
    this.car.z = 0;
    this.car.prevZ = 0;
    this.car.speed = 0;
    this.car.latVel = 0;
    this.setInput({});
    this.camX = this.car.x * 0.78;

    this.distance = 0;
    this.topSpeed = 0;
    this.overtakes = 0;
    this.nearMisses = 0;
    this.crashes = 0;
    this.lastFeedbackAt = -99;

    this.sparks.life = 0;
    this.sparks.points.visible = false;
    this.playerGroup.position.set(this.car.x, 0, this.car.z);
    this.playerGroup.rotation.set(0, 0, 0);
    this.playerGroup.visible = true;

    this.populateInitialTraffic();
    this.updateCamera(1 / 60);
    this.updatePlayerVisuals(1 / 60);
    this.scenery.update(1 / 60, this.camera, this.car.z, this.car.x);
    this.headlight.intensity = 0;

    if (this.audio) {
      this.audio.startEngine(this.vehicleId);
      this.audio.updateEngine(0, 0, false);
    }
  }

  setInput(input) {
    this.input.throttle = !!input.throttle;
    this.input.brake = !!input.brake;
    this.input.left = !!input.left;
    this.input.right = !!input.right;
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.audio) {
      if (this.paused || this.phase === "finished") this.audio.duckEngine(true);
      else this.audio.duckEngine(false);
    }
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  populateInitialTraffic() {
    let distance = 130;
    for (let i = 0; i < 14; i++) {
      const z = this.car.z - distance;
      const type = pickWeighted(this.spawnRng, TYPE_ENTRIES);
      const spec = TRAFFIC_TYPES[type];
      const variant = randInt(this.spawnRng, 0, spec.variants.length - 1);
      const speed = randRange(this.spawnRng, spec.minSpeed, spec.maxSpeed);
      const lanes = shuffle(this.spawnRng, [0, 1, 2, 3]);
      for (const lane of lanes) {
        if (this.isLaneClear(lane, z, spec.length / 2, 32)) {
          this.addTraffic(type, variant, lane, z, speed, false);
          break;
        }
      }
      distance += randRange(this.spawnRng, 38, 72);
    }
  }

  addTraffic(type, variant, lane, z, speed, canWeave) {
    const vehicle = createTrafficVehicle(type, variant);
    const x = LANE_CENTERS[lane];
    vehicle.group.position.set(x, 0, z);
    this.scene.add(vehicle.group);

    const traffic = {
      ...vehicle,
      lane,
      targetLane: lane,
      x,
      z,
      prevZ: z,
      speed,
      vz: speed,
      baseSpeed: speed,
      passed: false,
      laneState: "cruise",
      laneChangeTimer: randRange(this.aiRng, 3, 9),
      laneChangeCount: 0,
      moveFromX: x,
      moveProgress: 0,
      canWeave,
    };
    this.traffic.push(traffic);
    return traffic;
  }

  isLaneClear(lane, z, halfLength, buffer) {
    const x = LANE_CENTERS[lane];
    for (const traffic of this.traffic) {
      if (Math.abs(traffic.x - x) > 1.8) continue;
      if (Math.abs(traffic.z - z) < traffic.halfLength + halfLength + buffer) {
        return false;
      }
    }
    return true;
  }

  spawnTraffic() {
    if (this.traffic.length >= TRAFFIC_LIMIT) return;
    const z = this.car.z - randRange(this.spawnRng, 230, 360);

    // Never close all four lanes in one band — that would be unavoidable.
    let nearby = 0;
    for (const traffic of this.traffic) {
      if (Math.abs(traffic.z - z) < 58) nearby++;
    }
    if (nearby >= 3) return;

    const type = pickWeighted(this.spawnRng, TYPE_ENTRIES);
    const spec = TRAFFIC_TYPES[type];
    const variant = randInt(this.spawnRng, 0, spec.variants.length - 1);
    const speed = randRange(this.spawnRng, spec.minSpeed, spec.maxSpeed);
    const lanes = shuffle(this.spawnRng, [0, 1, 2, 3]);
    const canWeave = spec.weaver && this.spawnRng() < 0.16 + this.difficulty * 0.14;

    for (const lane of lanes) {
      if (this.isLaneClear(lane, z, spec.length / 2, 34)) {
        this.addTraffic(type, variant, lane, z, speed, canWeave);
        return;
      }
    }
  }

  update(dt) {
    dt = Math.min(0.05, Math.max(0.0001, dt));
    this.animTime += dt;

    if (this.phase === "countdown") {
      this.introProgress = Math.min(1, this.introProgress + dt / 2.4);
      this.countdown -= dt;
      const display = Math.max(1, Math.ceil(this.countdown));
      if (display !== this.lastCountdownNumber) {
        this.lastCountdownNumber = display;
        this.audio?.countdown();
        this.onEvent?.({ type: "countdown", value: display });
      }
      if (this.countdown <= 0) {
        this.phase = "racing";
        this.introProgress = 1;
        this.audio?.go();
        this.onEvent?.({ type: "go" });
      }
    } else if (this.phase === "racing" && !this.paused) {
      this.introProgress = 1;
      this.elapsed += dt;
      this.difficulty = Math.min(1, this.elapsed / RUN_SECONDS);
      this.invuln = Math.max(0, this.invuln - dt);
      this.shake = Math.max(0, this.shake - dt * 2.6);

      this.updatePlayer(dt);
      this.updateTraffic(dt);
      this.resolveCollisionsAndRewards();

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTraffic();
        if (this.difficulty > 0.45 && this.spawnRng() < 0.25) this.spawnTraffic();
        const base = 1.4 - this.difficulty * 0.72;
        this.spawnTimer = base * randRange(this.spawnRng, 0.75, 1.2);
      }

      if (this.elapsed >= RUN_SECONDS) {
        this.finish("time");
      }
    } else if (this.phase === "finished") {
      this.shake = Math.max(0, this.shake - dt * 2.6);
    }

    updateSparks(this.sparks, dt);
    this.updatePlayerVisuals(dt);
    this.updateTrafficVisuals();
    this.updateCamera(dt);
    this.scenery.update(dt, this.camera, this.car.z, this.car.x);

    const night = this.scenery.nightFactor;
    this.headlight.intensity = this.phase === "finished" ? 0 : night * 85;
    this.headlight.position.set(this.car.x, 1.0, this.car.z - this.phys.halfLength);
    this.headlight.target.position.set(this.car.x, 0.1, this.car.z - 55);
    this.headlight.target.updateMatrixWorld();
    this.headlight.visible = night > 0.12;
    this.player.setUnderglowIntensity(0.12 + night * 0.4);

    updateSpeedLines(
      this.speedLines,
      this.car.z,
      this.phase === "racing" && !this.paused ? this.car.speed : 0,
      dt
    );

    if (this.audio) {
      const active = this.phase === "racing" && !this.paused;
      this.audio.updateEngine(
        this.car.speed / this.phys.maxSpeed,
        active && this.input.throttle,
        active
      );
    }

    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt) {
    const car = this.car;
    const input = this.input;
    const phys = this.phys;
    const ratio = Math.max(0, Math.min(1, car.speed / phys.maxSpeed));

    if (input.throttle) {
      const accel = phys.accel * (1 - 0.62 * ratio);
      car.speed += Math.max(1.8, accel) * dt;
    }
    if (input.brake) {
      car.speed -= phys.brake * dt;
    } else if (!input.throttle) {
      car.speed -= (phys.coastDrag + car.speed * phys.speedDrag) * dt;
    } else {
      car.speed -= car.speed * 0.012 * dt;
    }
    car.speed = Math.max(0, Math.min(phys.maxSpeed, car.speed));

    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const maxLateral = phys.lateralBase + phys.lateralGain * ratio;
    const targetLateral = steer * maxLateral;
    const response = steer !== 0 ? phys.steerResponse : phys.steerResponse * 1.4;
    car.latVel += (targetLateral - car.latVel) * (1 - Math.exp(-response * dt));

    car.prevZ = car.z;
    car.z -= car.speed * dt;
    car.x += car.latVel * dt;

    const limit = ROAD.width / 2 - phys.halfWidth - 0.1;
    if (car.x > limit) {
      car.x = limit;
      car.latVel = Math.min(0, car.latVel);
    } else if (car.x < -limit) {
      car.x = -limit;
      car.latVel = Math.max(0, car.latVel);
    }

    const travelled = car.speed * dt;
    this.distance += travelled;
    this.topSpeed = Math.max(this.topSpeed, car.speed);
  }

  updateTraffic(dt) {
    for (const traffic of this.traffic) {
      traffic.prevZ = traffic.z;
      if (
        traffic.laneState === "cruise" &&
        traffic.canWeave &&
        traffic.laneChangeCount < 2
      ) {
        traffic.laneChangeTimer -= dt;
        if (traffic.laneChangeTimer <= 0) this.tryStartLaneChange(traffic);
      }

      if (traffic.laneState === "signal") {
        traffic.signalTimer -= dt;
        if (traffic.signalTimer <= 0) {
          traffic.laneState = "moving";
          traffic.moveFromX = traffic.x;
          traffic.moveProgress = 0;
        }
      } else if (traffic.laneState === "moving") {
        traffic.moveProgress += dt / 1.1;
        const t = smoothstep(traffic.moveProgress);
        traffic.x = THREE.MathUtils.lerp(
          traffic.moveFromX,
          LANE_CENTERS[traffic.targetLane],
          t
        );
        if (traffic.moveProgress >= 1) {
          traffic.lane = traffic.targetLane;
          traffic.x = LANE_CENTERS[traffic.targetLane];
          traffic.laneState = "cruise";
          traffic.laneChangeCount++;
          traffic.laneChangeTimer = randRange(this.aiRng, 5, 12);
        }
      }
    }

    const lanes = [[], [], [], []];
    for (const traffic of this.traffic) {
      lanes[Math.max(0, Math.min(3, traffic.lane))].push(traffic);
    }
    for (const lane of lanes) {
      lane.sort((a, b) => a.z - b.z);
      let leader = null;
      for (const traffic of lane) {
        traffic.vz = traffic.speed;
        if (leader) {
          const gap = traffic.z - leader.z - leader.halfLength - traffic.halfLength;
          if (gap < 17) {
            traffic.vz = Math.min(traffic.vz, Math.max(4, leader.vz * 0.98));
          }
          if (gap < 1) {
            traffic.z = leader.z + leader.halfLength + traffic.halfLength + 1;
          }
        }
        traffic.vz = Math.max(4, traffic.vz);
        leader = traffic;
      }
    }

    for (const traffic of this.traffic) {
      traffic.z -= traffic.vz * dt;
      traffic.group.position.set(traffic.x, 0, traffic.z);
      traffic.group.rotation.y = THREE.MathUtils.clamp(
        (traffic.x - LANE_CENTERS[traffic.targetLane]) * 0.2,
        -0.16,
        0.16
      );
    }

    const keep = [];
    for (const traffic of this.traffic) {
      if (traffic.z > this.car.z + 110 || traffic.z < this.car.z - 780) {
        this.scene.remove(traffic.group);
        continue;
      }
      keep.push(traffic);
    }
    this.traffic = keep;
  }

  tryStartLaneChange(traffic) {
    if (traffic.laneChangeCount >= 2) return;
    if (traffic.z > this.car.z + 20) {
      traffic.laneChangeTimer = randRange(this.aiRng, 2.5, 5);
      return;
    }
    if (Math.abs(traffic.z - this.car.z) < 95) {
      traffic.laneChangeTimer = randRange(this.aiRng, 1, 2.6);
      return;
    }
    const candidates = shuffle(this.aiRng, [traffic.lane - 1, traffic.lane + 1]).filter(
      (lane) => lane >= 0 && lane < ROAD.laneCount
    );
    for (const lane of candidates) {
      const targetX = LANE_CENTERS[lane];
      let blocked = false;
      for (const other of this.traffic) {
        if (other === traffic) continue;
        if (Math.abs(other.x - targetX) > 1.8) continue;
        if (Math.abs(other.z - traffic.z) < other.halfLength + traffic.halfLength + 36) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      traffic.laneState = "signal";
      traffic.targetLane = lane;
      traffic.signalTimer = 0.85;
      return;
    }
    traffic.laneChangeTimer = randRange(this.aiRng, 2.5, 5);
  }

  resolveCollisionsAndRewards() {
    const car = this.car;
    const phys = this.phys;
    const prevFront = car.prevZ - phys.halfLength;
    const currentFront = car.z - phys.halfLength;
    const carHalfW = phys.halfWidth * 0.92;
    const carHalfL = phys.halfLength * 0.96;
    let collided = false;

    if (this.invuln <= 0) {
      for (const traffic of this.traffic) {
        const dx = Math.abs(car.x - traffic.x);
        const dz = Math.abs(car.z - traffic.z);
        if (
          dx < carHalfW + traffic.halfWidth * 0.9 &&
          dz < carHalfL + traffic.halfLength * 0.94
        ) {
          traffic.passed = true;
          collided = true;
          car.z = traffic.z + traffic.halfLength + phys.halfLength + 0.25;
          car.speed = Math.min(car.speed * phys.crashKeep, traffic.vz * 0.5);
          car.latVel *= 0.25;
          const push = Math.sign(car.x - traffic.x) || 1;
          car.x = THREE.MathUtils.clamp(
            car.x + push * 0.3,
            -ROAD.width / 2 + phys.halfWidth,
            ROAD.width / 2 - phys.halfWidth
          );
          this.invuln = phys.invulnSeconds;
          this.shake = 1.4;
          this.crashes++;
          spawnSparks(this.sparks, car.x, 0.75, car.z);
          this.audio?.crash();
          this.onEvent?.({
            type: "crash",
            title: "COLLISION",
            detail: `-${CRASH_PENALTY}`,
          });
          break;
        }
      }
    }

    if (collided) return;
    for (const traffic of this.traffic) {
      if (traffic.passed) continue;
      const rearPrev = traffic.prevZ + traffic.halfLength * 0.94;
      const rearNow = traffic.z + traffic.halfLength * 0.94;
      const passed = prevFront > rearPrev && currentFront <= rearNow;
      if (!passed) continue;
      traffic.passed = true;
      const gap = Math.abs(car.x - traffic.x) - (phys.halfWidth + traffic.halfWidth);
      if (gap < 0) continue;

      this.overtakes++;
      this.audio?.overtake();

      if (gap < NEAR_MISS.gap && car.speed > NEAR_MISS.minSpeed) {
        this.nearMisses++;
        const bonus = Math.round(NEAR_MISS.baseCredits * this.phys.nearMissMultiplier);
        this.audio?.nearMiss();
        this.onEvent?.({
          type: "nearMiss",
          title: "NEAR MISS",
          detail: `+${bonus}`,
        });
      }
    }
  }

  updatePlayerVisuals(dt) {
    const car = this.car;
    const phys = this.phys;
    const ratio = Math.min(1, car.speed / phys.maxSpeed);
    const lean = this.def.camera.lean;
    this.playerGroup.position.set(car.x, 0, car.z);
    this.playerGroup.rotation.y = -car.latVel * 0.02;
    this.playerGroup.rotation.z = THREE.MathUtils.clamp(
      -car.latVel * lean,
      -0.14,
      0.14
    );
    this.playerGroup.rotation.x = this.input.brake ? 0.012 : -0.006 * (this.input.throttle ? 1 : 0);

    if (this.invuln > 0 && this.phase === "racing") {
      this.playerGroup.visible = Math.floor(this.invuln * 20) % 2 === 0;
    } else {
      this.playerGroup.visible = true;
    }

    const idle = Math.sin(this.animTime * 26) * (1 - ratio) * 0.006;
    this.playerGroup.position.y = idle;

    const spin = (car.speed * dt) / this.player.wheelRadius;
    for (const wheel of this.player.wheels) {
      wheel.group.rotation.x -= spin;
    }
    this.player.update(this.animTime, dt);
  }

  updateTrafficVisuals() {
    for (const traffic of this.traffic) {
      const signalling =
        traffic.laneState === "signal" || traffic.laneState === "moving";
      if (traffic.signalL && traffic.signalR) {
        if (signalling) {
          const on = Math.floor(this.animTime * 10) % 2 === 0;
          traffic.signalL.visible = on && traffic.targetLane < traffic.lane;
          traffic.signalR.visible = on && traffic.targetLane > traffic.lane;
        } else {
          traffic.signalL.visible = false;
          traffic.signalR.visible = false;
        }
      }
      traffic.body.castShadow = Math.abs(traffic.z - this.car.z) < 160;
    }
  }

  updateCamera(dt) {
    const car = this.car;
    const cfg = this.def.camera;
    const ratio = Math.min(1, car.speed / this.phys.maxSpeed);
    const intro = 1 - Math.pow(1 - this.introProgress, 3);
    const targetX = car.x * 0.78;
    const follow = 1 - Math.exp(-7.5 * dt);
    this.camX += (targetX - this.camX) * follow;
    if (dt >= 0.05) this.camX = targetX;

    const shake = this.shake;
    const shakeX = Math.sin(this.animTime * 59) * shake * 0.34;
    const shakeY = Math.cos(this.animTime * 51) * shake * 0.24;
    const rumble = ratio * 0.022;
    const back = cfg.back + (1 - intro) * 7;
    const height = cfg.height + (1 - intro) * 3.4 + ratio * 0.45;

    this.camera.position.set(
      this.camX + shakeX,
      height + shakeY + Math.sin(this.animTime * 30) * rumble,
      car.z + back
    );
    this.camera.lookAt(
      car.x * 0.92 + shakeX * 0.15,
      1.15 + ratio * 0.3,
      car.z - cfg.lookAhead - ratio * 10
    );

    const targetFov = cfg.fov + ratio * 9;
    if (Math.abs(targetFov - this.cameraFov) > 0.04) {
      this.cameraFov = targetFov;
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  calculateEarnings(reason = "time") {
    const distancePay = Math.floor(
      this.distance * CREDITS_PER_METRE * this.phys.earnMultiplier
    );
    const overtakePay = this.overtakes * OVERTAKE_CREDITS;
    const nearPay = Math.round(
      this.nearMisses * NEAR_MISS.baseCredits * this.phys.nearMissMultiplier
    );
    const completion = reason === "time" ? COMPLETION_BONUS : 0;
    const penalties = this.crashes * CRASH_PENALTY;
    const total = Math.max(0, distancePay + overtakePay + nearPay + completion - penalties);
    return { distancePay, overtakePay, nearPay, completion, penalties, total };
  }

  finish(reason = "time") {
    if (this.phase === "finished") return;
    this.phase = "finished";
    this.finished = true;
    this.playerGroup.visible = true;
    this.audio?.duckEngine(true);
    this.audio?.finish(reason);
    const earnings = this.calculateEarnings(reason);
    const miles = this.distance / METRES_PER_MILE;
    this.onEvent?.({
      type: "finish",
      reason,
      miles,
      distanceMetres: this.distance,
      topSpeedMph: Math.round(this.topSpeed * 2.236936),
      overtakes: this.overtakes,
      nearMisses: this.nearMisses,
      crashes: this.crashes,
      earnings,
      vehicleId: this.vehicleId,
      time: Math.min(RUN_SECONDS, this.elapsed),
    });
  }

  quitToResults() {
    if (this.phase === "finished") return;
    this.finish("quit");
  }

  getSnapshot() {
    const miles = this.distance / METRES_PER_MILE;
    const earnings = this.calculateEarnings(this.phase === "finished" ? "time" : "live");
    return {
      speedKmh: Math.round(this.car.speed * 3.6),
      speedMph: Math.round(this.car.speed * 2.236936),
      speedRatio: Math.min(1, this.car.speed / this.phys.maxSpeed),
      distanceMiles: miles,
      distanceMetres: this.distance,
      timeLeft: Math.max(0, RUN_SECONDS - this.elapsed),
      elapsed: this.elapsed,
      overtakes: this.overtakes,
      nearMisses: this.nearMisses,
      crashes: this.crashes,
      runCredits: earnings.total,
      topSpeedMph: Math.round(this.topSpeed * 2.236936),
      night: this.scenery.nightFactor,
      phase: this.phase,
    };
  }

  setTime(timeId) {
    this.timeId = timeId;
    this.scenery.setTime(timeId);
  }

  dispose() {
    this.audio?.stopEngine();
    for (const traffic of this.traffic) this.scene.remove(traffic.group);
    this.traffic.length = 0;
    this.player.dispose();
    this.scene.remove(this.playerGroup);
    disposeSceneObject(this.sparks.points);
    disposeSceneObject(this.speedLines.lines);
    this.scene.remove(this.sparks.points);
    this.scene.remove(this.speedLines.lines);
    this.scene.remove(this.headlight);
    this.scene.remove(this.headlight.target);
    this.scenery.dispose();
    this.scene.clear();
  }
}
