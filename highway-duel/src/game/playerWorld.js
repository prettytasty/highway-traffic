import * as THREE from "three";
import {
  ROAD,
  LANE_CENTERS,
  PLAYER,
  DUEL,
  RACE_SECONDS,
} from "./config.js";
import {
  createEnvironment,
  updateEnvironment,
  createSpeedLines,
  updateSpeedLines,
} from "./world.js";
import {
  TRAFFIC_TYPES,
  createPlayerCar,
  createTrafficVehicle,
} from "./vehicles.js";
import { mulberry32, pickWeighted, randRange, randInt, shuffle } from "./rng.js";

const TYPE_ENTRIES = Object.keys(TRAFFIC_TYPES).map((value) => ({
  value,
  weight: TRAFFIC_TYPES[value].weight,
}));

const TRAFFIC_LIMIT = 42;
const HALF_PI = Math.PI / 2;

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function createSparks(scene) {
  const count = 54;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffb45e,
    size: 0.55,
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
  return { points, material, positions, velocities, life: 0, maxLife: 0.7, count };
}

function spawnSparks(sparks, x, y, z) {
  const { positions, velocities, count } = sparks;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = x + (Math.random() - 0.5) * 1.8;
    positions[i3 + 1] = y + Math.random() * 0.8;
    positions[i3 + 2] = z + (Math.random() - 0.5) * 2.4;
    velocities[i3] = (Math.random() - 0.5) * 16;
    velocities[i3 + 1] = 1.5 + Math.random() * 9;
    velocities[i3 + 2] = (Math.random() - 0.5) * 18;
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
    const i3 = i * 3;
    positions[i3] += velocities[i3] * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;
    velocities[i3 + 1] -= 22 * dt;
  }
  sparks.material.opacity = Math.max(0, sparks.life / sparks.maxLife);
  sparks.points.geometry.attributes.position.needsUpdate = true;
  if (sparks.life <= 0) sparks.points.visible = false;
}

export class PlayerWorld {
  constructor({ renderer, driver, seed, audio, onFeedback }) {
    this.driver = driver;
    this.audio = audio;
    this.onFeedback = onFeedback;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 0.9, 0.1, 3000);
    this.env = createEnvironment(this.scene, renderer);
    this.speedLines = createSpeedLines(this.scene);
    this.sparks = createSparks(this.scene);

    const carVisual = createPlayerCar(
      driver.accent,
      driver.id === "p1" ? 0xbdffff : 0xffe0b0,
      driver.id === "p1" ? 0x0b2b36 : 0x3a1a08
    );
    this.playerGroup = carVisual.group;
    this.playerBody = carVisual.body;
    this.scene.add(this.playerGroup);

    this.car = {
      x: LANE_CENTERS[PLAYER.spawnLane],
      z: 0,
      prevZ: 0,
      speed: 0,
      latVel: 0,
    };
    this.input = { throttle: false, brake: false, left: false, right: false };
    this.traffic = [];
    this.spawnTimer = 1;
    this.camX = this.car.x * 0.78;
    this.introProgress = 0;
    this.animTime = 0;
    this.cameraFov = 68;
    this.reset(seed);
  }

  reset(seed) {
    for (const traffic of this.traffic) {
      this.scene.remove(traffic.group);
    }
    this.traffic.length = 0;

    this.spawnRng = mulberry32(seed);
    this.aiRng = mulberry32(seed ^ 0x9e3779b9);
    this.seed = seed;
    this.elapsed = 0;
    this.difficulty = 0;
    this.spawnTimer = 1.1;
    this.introProgress = 0;
    this.animTime = 0;
    this.shake = 0;
    this.invuln = 0;
    this.finished = false;

    this.car.x = LANE_CENTERS[PLAYER.spawnLane];
    this.car.z = 0;
    this.car.prevZ = 0;
    this.car.speed = 0;
    this.car.latVel = 0;
    this.camX = this.car.x * 0.78;
    this.setInput({ throttle: false, brake: false, left: false, right: false });

    this.score = 0;
    this.distance = 0;
    this.topSpeed = 0;
    this.overtakes = 0;
    this.nearMisses = 0;
    this.crashes = 0;
    this.crashPenaltyTotal = 0;
    this.lastFeedbackAt = -99;

    this.sparks.life = 0;
    this.sparks.points.visible = false;
    this.playerGroup.visible = true;
    this.playerGroup.position.set(this.car.x, 0, this.car.z);
    this.playerGroup.rotation.set(0, 0, 0);

    this.populateInitialTraffic();
    this.updateCamera(0.016);
    this.updatePlayerVisuals(0.016);
    updateEnvironment(this.env, this.camera, this.car, 0);
    updateSpeedLines(this.speedLines, this.car.z, 0, 0.016);
  }

  setInput(input) {
    this.input.throttle = !!input.throttle;
    this.input.brake = !!input.brake;
    this.input.left = !!input.left;
    this.input.right = !!input.right;
  }

  // -------------------------------------------------------------------------
  // Traffic creation
  // -------------------------------------------------------------------------
  populateInitialTraffic() {
    let distance = 135;
    for (let i = 0; i < 12; i++) {
      const z = this.car.z - distance;
      const type = pickWeighted(this.spawnRng, TYPE_ENTRIES);
      const spec = TRAFFIC_TYPES[type];
      const variant = randInt(this.spawnRng, 0, spec.variants.length - 1);
      const speed = randRange(this.spawnRng, spec.minSpeed, spec.maxSpeed);
      const lanes = shuffle(this.spawnRng, [0, 1, 2, 3]);
      for (const lane of lanes) {
        if (this.isLaneClear(lane, z, spec.length / 2, 24)) {
          this.addTraffic(type, variant, lane, z, speed, false);
          break;
        }
      }
      distance += randRange(this.spawnRng, 32, 62);
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
      laneChangeTimer: randRange(this.aiRng, 2.5, 8),
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
      if (Math.abs(traffic.x - x) > 1.7) continue;
      if (Math.abs(traffic.z - z) < traffic.halfLength + halfLength + buffer) {
        return false;
      }
    }
    return true;
  }

  spawnTraffic(difficulty) {
    if (this.traffic.length >= TRAFFIC_LIMIT) return;

    const z = this.car.z - randRange(this.spawnRng, 215, 350);
    const type = pickWeighted(this.spawnRng, TYPE_ENTRIES);
    const spec = TRAFFIC_TYPES[type];
    const variant = randInt(this.spawnRng, 0, spec.variants.length - 1);
    const speed = randRange(this.spawnRng, spec.minSpeed, spec.maxSpeed);
    const lanes = shuffle(this.spawnRng, [0, 1, 2, 3]);
    const canWeave = spec.weaver && this.spawnRng() < 0.16 + difficulty * 0.12;

    for (const lane of lanes) {
      if (this.isLaneClear(lane, z, spec.length / 2, 30)) {
        this.addTraffic(type, variant, lane, z, speed, canWeave);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------
  update(dt, running) {
    this.animTime += dt;
    this.introProgress = Math.min(1, this.introProgress + dt / 3.1);

    if (running) {
      this.elapsed += dt;
      this.difficulty = Math.min(1, this.elapsed / RACE_SECONDS);
      this.invuln = Math.max(0, this.invuln - dt);
      this.shake = Math.max(0, this.shake - dt * 2.4);

      this.updatePlayer(dt);
      this.updateTraffic(dt);
      this.resolveCollisionsAndRewards();

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTraffic(this.difficulty);
        if (this.difficulty > 0.5 && this.spawnRng() < 0.22) {
          this.spawnTraffic(this.difficulty);
        }
        const baseInterval = 1.28 - this.difficulty * 0.62;
        this.spawnTimer = baseInterval * randRange(this.spawnRng, 0.72, 1.24);
      }
      updateSparks(this.sparks, dt);
    } else {
      updateSparks(this.sparks, dt);
    }

    this.updatePlayerVisuals(dt);
    this.updateTrafficVisuals();
    this.updateCamera(dt);
    updateEnvironment(this.env, this.camera, this.car, this.animTime);
    updateSpeedLines(this.speedLines, this.car.z, running ? this.car.speed : 0, dt);
  }

  updatePlayer(dt) {
    const car = this.car;
    const input = this.input;
    const speedRatio = Math.max(0, Math.min(1, car.speed / PLAYER.maxSpeed));

    if (input.throttle) {
      const accel = PLAYER.accel * (1 - 0.68 * (car.speed / PLAYER.maxSpeed));
      car.speed += Math.max(2.5, accel) * dt;
    }
    if (input.brake) {
      car.speed -= PLAYER.brake * dt;
    } else if (!input.throttle) {
      car.speed -= (PLAYER.coastDrag + car.speed * PLAYER.speedDrag) * dt;
    } else {
      car.speed -= car.speed * 0.012 * dt;
    }
    car.speed = Math.max(0, Math.min(PLAYER.maxSpeed, car.speed));

    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const maxLateral = PLAYER.lateralBase + PLAYER.lateralGain * speedRatio;
    const targetLateral = steer * maxLateral;
    const response = steer !== 0 ? PLAYER.steerResponse : PLAYER.steerResponse * 1.35;
    car.latVel += (targetLateral - car.latVel) * (1 - Math.exp(-response * dt));

    car.prevZ = car.z;
    car.z -= car.speed * dt;
    car.x += car.latVel * dt;

    const limit = ROAD.width / 2 - PLAYER.halfWidth - 0.12;
    if (car.x > limit) {
      car.x = limit;
      car.latVel = Math.min(0, car.latVel);
    } else if (car.x < -limit) {
      car.x = -limit;
      car.latVel = Math.max(0, car.latVel);
    }

    const travelled = car.speed * dt;
    this.distance += travelled;
    this.score += travelled;
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
        if (traffic.laneChangeTimer <= 0) {
          this.tryStartLaneChange(traffic);
        }
      }

      if (traffic.laneState === "signal") {
        traffic.signalTimer -= dt;
        if (traffic.signalTimer <= 0) {
          traffic.laneState = "moving";
          traffic.moveFromX = traffic.x;
          traffic.moveProgress = 0;
        }
      } else if (traffic.laneState === "moving") {
        traffic.moveProgress += dt / 1.05;
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
          traffic.laneChangeTimer = randRange(this.aiRng, 4.5, 11);
        }
      }
    }

    // Keep traffic in a lane from driving through the vehicle ahead.
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
          const gap =
            traffic.z - leader.z - leader.halfLength - traffic.halfLength;
          if (gap < 16) {
            traffic.vz = Math.min(traffic.vz, Math.max(3, leader.vz * 0.98));
          }
          if (gap < 1) {
            traffic.z = leader.z + leader.halfLength + traffic.halfLength + 1;
          }
        }
        traffic.vz = Math.max(3, traffic.vz);
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

    // Cull vehicles far behind or far ahead.
    const keep = [];
    for (const traffic of this.traffic) {
      if (traffic.z > this.car.z + 80) {
        this.scene.remove(traffic.group);
        continue;
      }
      if (traffic.z < this.car.z - 760) {
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
      traffic.laneChangeTimer = randRange(this.aiRng, 2, 5);
      return;
    }
    // Be predictable when the player is close.
    if (Math.abs(traffic.z - this.car.z) < 85) {
      traffic.laneChangeTimer = randRange(this.aiRng, 0.8, 2.2);
      return;
    }

    const candidates = shuffle(this.aiRng, [
      traffic.lane - 1,
      traffic.lane + 1,
    ]).filter((lane) => lane >= 0 && lane < ROAD.laneCount);
    for (const lane of candidates) {
      const targetX = LANE_CENTERS[lane];
      let blocked = false;
      for (const other of this.traffic) {
        if (other === traffic) continue;
        if (Math.abs(other.x - targetX) > 1.8) continue;
        if (
          Math.abs(other.z - traffic.z) <
          other.halfLength + traffic.halfLength + 30
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      traffic.laneState = "signal";
      traffic.targetLane = lane;
      traffic.signalTimer = 0.9;
      return;
    }
    traffic.laneChangeTimer = randRange(this.aiRng, 2, 4.5);
  }

  resolveCollisionsAndRewards() {
    const car = this.car;
    const prevFront = car.prevZ - PLAYER.halfLength;
    const currentFront = car.z - PLAYER.halfLength;
    const carHalfW = PLAYER.halfWidth * 0.94;
    const carHalfL = PLAYER.halfLength * 0.96;
    let collidedThisFrame = false;

    if (this.invuln <= 0) {
      for (const traffic of this.traffic) {
        const dx = Math.abs(car.x - traffic.x);
        const dz = Math.abs(car.z - traffic.z);
        if (
          dx < carHalfW + traffic.halfWidth * 0.93 &&
          dz < carHalfL + traffic.halfLength * 0.96
        ) {
          traffic.passed = true;
          collidedThisFrame = true;
          car.z = traffic.z + traffic.halfLength + PLAYER.halfLength + 0.3;
          car.speed = Math.min(car.speed * 0.24, traffic.vz * 0.55);
          car.latVel *= 0.3;
          const push = Math.sign(car.x - traffic.x) || 1;
          car.x = THREE.MathUtils.clamp(
            car.x + push * 0.35,
            -ROAD.width / 2 + PLAYER.halfWidth,
            ROAD.width / 2 - PLAYER.halfWidth
          );
          this.invuln = PLAYER.invulnSeconds;
          this.shake = 1.5;
          this.crashes++;
          this.score = Math.max(0, this.score - PLAYER.crashPenalty);
          this.crashPenaltyTotal += PLAYER.crashPenalty;
          spawnSparks(this.sparks, car.x, 0.8, car.z);
          this.audio.crash(this.driver.pan);
          this.emitFeedback("crash", "CRASH", `−${PLAYER.crashPenalty}`);
          break;
        }
      }
    }

    if (!collidedThisFrame) {
      for (const traffic of this.traffic) {
        if (traffic.passed) continue;
        const rearPrev = traffic.prevZ + traffic.halfLength * 0.96;
        const rearNow = traffic.z + traffic.halfLength * 0.96;
        const passed = prevFront > rearPrev && currentFront <= rearNow;
        if (!passed) continue;

        traffic.passed = true;
        const gap =
          Math.abs(car.x - traffic.x) - (PLAYER.halfWidth + traffic.halfWidth);
        if (gap < 0) continue;

        const speedFactor = Math.min(1.2, Math.max(0.5, car.speed / 45));
        const overtimePts = Math.round(
          DUEL.overtakeBase + DUEL.overtakeSpeedBonus * speedFactor
        );
        this.score += overtimePts;
        this.overtakes++;
        this.audio.overtake(this.driver.pan);

        if (gap < DUEL.nearMissGap && car.speed > 15) {
          const bonus = Math.round(
            DUEL.nearMissBase + DUEL.nearMissSpeedBonus * speedFactor
          );
          this.score += bonus;
          this.nearMisses++;
          this.audio.nearMiss(this.driver.pan);
          this.emitFeedback("near", "NEAR MISS", `+${bonus}`);
        }
      }
    }
  }

  emitFeedback(kind, title, detail) {
    if (!this.onFeedback) return;
    this.onFeedback({
      kind,
      title,
      detail,
      driver: this.driver,
    });
  }

  updatePlayerVisuals(dt) {
    const car = this.car;
    const speedRatio = Math.min(1, car.speed / PLAYER.maxSpeed);
    this.playerGroup.position.set(car.x, 0, car.z);
    this.playerGroup.rotation.y = -car.latVel * 0.022;
    this.playerGroup.rotation.z = car.latVel * 0.0045;

    if (this.invuln > 0) {
      this.playerGroup.visible = Math.floor(this.invuln * 22) % 2 === 0;
    } else {
      this.playerGroup.visible = true;
    }

    // A tiny idle vibration when the car is stationary.
    this.playerGroup.position.y =
      Math.sin(this.animTime * 28) * (1 - speedRatio) * 0.008;
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
      const distance = Math.abs(traffic.z - this.car.z);
      traffic.body.castShadow = distance < 150;
    }
  }

  updateCamera(dt) {
    const car = this.car;
    const speedRatio = Math.min(1, car.speed / PLAYER.maxSpeed);
    const intro = 1 - Math.pow(1 - this.introProgress, 3);

    const targetX = car.x * 0.78;
    const follow = 1 - Math.exp(-7.5 * dt);
    this.camX += (targetX - this.camX) * follow;
    if (dt === 0) this.camX = targetX;

    const shake = this.shake;
    const shakeX = Math.sin(this.animTime * 61) * shake * 0.42;
    const shakeY = Math.cos(this.animTime * 53) * shake * 0.3;
    const rumble = speedRatio * 0.025;

    const back = 15.8 - 4.8 * intro;
    const height = 8.6 - 3.7 * intro;
    this.camera.position.set(
      this.camX + shakeX,
      height + speedRatio * 0.5 + shakeY + Math.sin(this.animTime * 31) * rumble,
      car.z + back
    );
    const lookAhead = 24 + speedRatio * 12;
    this.camera.lookAt(
      car.x * 0.9 + shakeX * 0.2,
      1.15 + speedRatio * 0.35,
      car.z - lookAhead
    );

    const targetFov = 66 + speedRatio * 11;
    if (Math.abs(targetFov - this.cameraFov) > 0.05) {
      this.cameraFov = targetFov;
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect) {
    if (Math.abs(this.camera.aspect - aspect) > 0.0001) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  snapshot() {
    return {
      score: Math.max(0, Math.floor(this.score)),
      distance: Math.floor(this.distance),
      speed: this.car.speed,
      speedKmh: Math.round(this.car.speed * 3.6),
      topSpeedKmh: Math.round(this.topSpeed * 3.6),
      overtakes: this.overtakes,
      nearMisses: this.nearMisses,
      crashes: this.crashes,
    };
  }
}
