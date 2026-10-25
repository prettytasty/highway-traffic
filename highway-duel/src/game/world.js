import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { ROAD, COLORS } from "./config.js";
import { mulberry32, randRange } from "./rng.js";

const ROAD_TILE_LENGTH = 24; // metres represented by one vertical road-texture tile

const textureCache = new Map();

function cachedTexture(key, make) {
  let texture = textureCache.get(key);
  if (!texture) {
    texture = make();
    textureCache.set(key, texture);
  }
  return texture;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
function makeRoadTexture() {
  const W = 512;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(90421);

  ctx.fillStyle = "#191a23";
  ctx.fillRect(0, 0, W, H);

  // Asphalt grain
  for (let i = 0; i < 5200; i++) {
    const shade = 22 + Math.floor(random() * 24);
    ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 8},${0.25 + random() * 0.4})`;
    const size = 1 + random() * 3;
    ctx.fillRect(random() * W, random() * H, size, size);
  }

  // Patched asphalt seams and cracks
  ctx.strokeStyle = "rgba(8,9,14,0.55)";
  for (let i = 0; i < 12; i++) {
    ctx.lineWidth = 1 + random() * 2;
    ctx.beginPath();
    let x = random() * W;
    let y = random() * H;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (random() - 0.5) * 70;
      y += (random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Darker tyre-worn lane centres
  const pxPerMetre = W / ROAD.width;
  for (let lane = 0; lane < ROAD.laneCount; lane++) {
    const centre = (lane - (ROAD.laneCount - 1) / 2) * ROAD.laneWidth;
    const u = centre * pxPerMetre + W / 2;
    const gradient = ctx.createLinearGradient(u - 60, 0, u + 60, 0);
    gradient.addColorStop(0, "rgba(8,9,14,0)");
    gradient.addColorStop(0.5, "rgba(8,9,14,0.24)");
    gradient.addColorStop(1, "rgba(8,9,14,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(u - 60, 0, 120, H);
  }

  const laneBoundaries = [-5.55, -1.85, 1.85];
  const dashHeight = (4 / ROAD_TILE_LENGTH) * H;
  const dashCycle = (8 / ROAD_TILE_LENGTH) * H;

  // Dashed lane dividers
  for (const x of laneBoundaries) {
    const u = (x / ROAD.width) * W + W / 2;
    ctx.fillStyle = "rgba(233,238,245,0.9)";
    for (let y = 6; y < H; y += dashCycle) {
      const jitter = (random() - 0.5) * 3;
      ctx.fillRect(u - 3 + jitter, y, 6, dashHeight);
    }
  }

  // Solid edge lines
  ctx.fillStyle = "rgba(241,245,255,0.95)";
  const edgeInset = 0.34;
  const leftEdge = (-ROAD.width / 2 + edgeInset) * pxPerMetre + W / 2;
  const rightEdge = (ROAD.width / 2 - edgeInset) * pxPerMetre + W / 2;
  ctx.fillRect(leftEdge - 3, 0, 6, H);
  ctx.fillRect(rightEdge - 3, 0, 6, H);

  // Faint cyan/magenta edge tint, arcade style
  ctx.fillStyle = "rgba(34,230,255,0.22)";
  ctx.fillRect(leftEdge - 7, 0, 2, H);
  ctx.fillStyle = "rgba(255,61,154,0.22)";
  ctx.fillRect(rightEdge + 5, 0, 2, H);

  // Reflector studs on lane boundaries
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (const x of laneBoundaries) {
    const u = (x / ROAD.width) * W + W / 2;
    for (let y = 0; y < H; y += dashCycle) {
      ctx.fillRect(u - 1.5, y - 3, 3, 3);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(3111);
  ctx.fillStyle = "#0b1a20";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const g = 22 + Math.floor(random() * 22);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.5)},${g},${g + 8},${0.18 + random() * 0.3})`;
    ctx.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeSkyTexture() {
  const W = 32;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#050310");
  gradient.addColorStop(0.3, "#160a2b");
  gradient.addColorStop(0.5, "#3a1247");
  gradient.addColorStop(0.64, "#7e234f");
  gradient.addColorStop(0.74, "#d84658");
  gradient.addColorStop(0.82, "#ff8a55");
  gradient.addColorStop(0.88, "#ffb46a");
  gradient.addColorStop(0.93, "#6b2748");
  gradient.addColorStop(1, "#241329");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Pixel stars
  const random = mulberry32(5521);
  for (let i = 0; i < 140; i++) {
    const y = random() * H * 0.52;
    const bright = 90 + Math.floor(random() * 150);
    ctx.fillStyle = `rgba(${bright},${bright},${Math.min(255, bright + 40)},${0.25 + random() * 0.55})`;
    const s = random() < 0.15 ? 2 : 1;
    ctx.fillRect(random() * W, y, s, s);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function makeSunTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const glow = ctx.createRadialGradient(256, 256, 70, 256, 256, 250);
  glow.addColorStop(0, "rgba(255,196,94,0.55)");
  glow.addColorStop(0.6, "rgba(255,80,130,0.18)");
  glow.addColorStop(1, "rgba(255,80,130,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const disc = ctx.createLinearGradient(0, 130, 0, 370);
  disc.addColorStop(0, "#ffe28a");
  disc.addColorStop(0.45, "#ffb357");
  disc.addColorStop(0.72, "#ff5d7a");
  disc.addColorStop(1, "#d92b83");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(256, 256, 148, 0, Math.PI * 2);
  ctx.fill();

  // Retro horizontal slits in the lower half of the sun
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 8; i++) {
    const y = 262 + i * 13;
    const h = 3 + i * 1.3;
    ctx.fillRect(70, y, 372, h);
  }
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWindowTexture() {
  const W = 128;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(8812);
  ctx.fillStyle = "#0a0e1d";
  ctx.fillRect(0, 0, W, H);

  const cols = 5;
  const rows = 12;
  const padX = 10;
  const padY = 8;
  const cellW = (W - padX * 2) / cols;
  const cellH = (H - padY * 2) / rows;
  const palette = ["#ffd27a", "#ff9b6a", "#69e7ff", "#8b7dff", "#1a2338", "#1a2338"];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = palette[Math.floor(random() * palette.length)];
      ctx.globalAlpha = 0.35 + random() * 0.65;
      ctx.fillRect(padX + col * cellW + 2, padY + row * cellH + 2, cellW - 5, cellH - 6);
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const BILLBOARD_COPY = [
  ["TURBO", "FUEL FOR THE FAST"],
  ["NEON OIL", "STAY SLICK"],
  ["PIT 24", "OPEN ALL NIGHT"],
  ["ZERO-E", "ELECTRIC THUNDER"],
  ["HIGHWAY", "DUEL LEAGUE"],
  ["MOTEL 9", "VACANCY"],
  ["DRIVE", "FAST. STAY. FREE."],
  ["LAST EXIT", "NEXT 2 MILES"],
  ["CHROME", "DINER"],
  ["RADIO 88", "ARCADE FM"],
  ["NITRO", "NO LIMITS"],
  ["SUNSET", "SPEEDWAY"],
];

function makeBillboardTexture(index, accent, secondary) {
  const W = 512;
  const H = 224;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const [title, sub] = BILLBOARD_COPY[index % BILLBOARD_COPY.length];

  ctx.fillStyle = "#080a14";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.strokeStyle = secondary;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.12;
  for (let x = -H; x < W; x += 34) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(-0.35);
    ctx.fillRect(0, 0, 10, H * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f7f4ff";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;
  ctx.font = "bold 74px 'Courier New', monospace";
  ctx.fillText(title, W / 2, 92);
  ctx.shadowBlur = 0;
  ctx.fillStyle = secondary;
  ctx.font = "bold 30px 'Courier New', monospace";
  ctx.fillText(sub, W / 2, 164);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeGantryTexture() {
  const W = 1024;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0c1020";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLORS.p1Css;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = "#f6f1ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = COLORS.magenta;
  ctx.shadowBlur = 30;
  ctx.font = "bold 96px 'Courier New', monospace";
  ctx.fillText("HIGHWAY DUEL", W / 2, 100);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.p2Css;
  ctx.font = "bold 42px 'Courier New', monospace";
  ctx.fillText("1V1  ·  SPLIT SCREEN  ·  90 SECONDS", W / 2, 186);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStartLineTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const cell = 32;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < size / cell; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f2f0ff" : "#16151f";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
export function createEnvironment(scene, renderer) {
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene.fog = new THREE.Fog(0x351c3a, 190, 660);

  const skyTexture = cachedTexture("sky", makeSkyTexture);
  const skyGroup = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2100, 32, 20),
    new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  sky.renderOrder = -20;
  skyGroup.add(sky);

  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshBasicMaterial({
      map: cachedTexture("sun", makeSunTexture),
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.95,
    })
  );
  sun.position.set(0, 255, -1120);
  sun.renderOrder = -10;
  skyGroup.add(sun);
  scene.add(skyGroup);

  // Lighting
  const hemi = new THREE.HemisphereLight(0x9a7cff, 0x09141d, 1.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffb077, 2.9);
  key.position.set(-32, 70, -48);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 240;
  key.shadow.camera.left = -62;
  key.shadow.camera.right = 62;
  key.shadow.camera.top = 62;
  key.shadow.camera.bottom = -62;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0x38dcff, 1.15);
  rim.position.set(48, 38, 42);
  scene.add(rim);

  // A soft, warm bounce from behind keeps traffic silhouettes readable.
  const fill = new THREE.DirectionalLight(0xffb27f, 0.95);
  fill.position.set(18, 26, 80);
  scene.add(fill);

  const ambient = new THREE.AmbientLight(0x372b52, 0.7);
  scene.add(ambient);

  // Road
  const roadTexture = cachedTexture("road", makeRoadTexture);
  roadTexture.anisotropy = maxAnisotropy;
  roadTexture.repeat.set(1, ROAD.length / ROAD_TILE_LENGTH);
  const roadGeometry = new THREE.PlaneGeometry(ROAD.width, ROAD.length);
  roadGeometry.rotateX(-Math.PI / 2);
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.84,
    metalness: 0.16,
    color: 0xffffff,
  });
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.position.set(0, 0, 200 - ROAD.length / 2);
  road.receiveShadow = true;
  scene.add(road);

  // Ground
  const groundTexture = cachedTexture("ground", makeGroundTexture);
  groundTexture.anisotropy = Math.min(4, maxAnisotropy);
  groundTexture.repeat.set(36, 380);
  const groundGeometry = new THREE.PlaneGeometry(700, ROAD.length);
  groundGeometry.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, metalness: 0 })
  );
  ground.position.set(0, -0.07, 200 - ROAD.length / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // Shoulders
  const shoulderMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2934,
    roughness: 0.96,
    metalness: 0.04,
  });
  for (const side of [-1, 1]) {
    const shoulderGeometry = new THREE.PlaneGeometry(2.1, ROAD.length);
    shoulderGeometry.rotateX(-Math.PI / 2);
    const shoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial);
    shoulder.position.set(side * (ROAD.width / 2 + 1.05), 0.004, 200 - ROAD.length / 2);
    shoulder.receiveShadow = true;
    scene.add(shoulder);
  }

  // Curbs
  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0x50505f,
    roughness: 0.8,
    metalness: 0.2,
  });
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, ROAD.length),
      curbMaterial
    );
    curb.position.set(side * (ROAD.width / 2 + 2.1), 0.045, 200 - ROAD.length / 2);
    scene.add(curb);
  }

  buildGuardrails(scene);
  buildStreetlights(scene);
  buildTrees(scene);
  buildBuildings(scene);
  buildBillboards(scene);
  buildStartGate(scene);

  return { skyGroup, key, hemi, rim, ambient };
}

function buildGuardrails(scene) {
  const from = 200;
  const to = -6500;
  const spacing = 6;
  const count = Math.floor((from - to) / spacing);
  const positions = [];

  for (let i = 0; i < count; i++) {
    positions.push(from - i * spacing);
  }

  const dummy = new THREE.Object3D();

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a9aaa,
    roughness: 0.32,
    metalness: 0.78,
  });
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b4250,
    roughness: 0.75,
    metalness: 0.35,
  });
  const railGeometry = new THREE.BoxGeometry(0.12, 0.34, spacing - 0.06);
  const postGeometry = new THREE.BoxGeometry(0.16, 0.82, 0.16);
  const rails = new THREE.InstancedMesh(railGeometry, railMaterial, count * 2);
  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, count * 2);

  const neonLeftMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.p1,
    toneMapped: false,
  });
  const neonRightMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.magenta,
    toneMapped: false,
  });
  const neonGeometry = new THREE.BoxGeometry(0.055, 0.055, spacing - 0.06);
  const neonLeft = new THREE.InstancedMesh(neonGeometry, neonLeftMaterial, count);
  const neonRight = new THREE.InstancedMesh(neonGeometry, neonRightMaterial, count);

  let index = 0;
  let neonIndex = 0;
  for (const z of positions) {
    for (const side of [-1, 1]) {
      const x = side * (ROAD.width / 2 + 1.28);
      dummy.position.set(x, 0.76, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rails.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, 0.41, z);
      dummy.updateMatrix();
      posts.setMatrixAt(index, dummy.matrix);

      if (side === -1) {
        dummy.position.set(x + 0.06, 0.96, z);
        dummy.updateMatrix();
        neonLeft.setMatrixAt(neonIndex, dummy.matrix);
      } else {
        dummy.position.set(x - 0.06, 0.96, z);
        dummy.updateMatrix();
        neonRight.setMatrixAt(neonIndex, dummy.matrix);
      }
      index++;
    }
    neonIndex++;
  }

  rails.instanceMatrix.needsUpdate = true;
  posts.instanceMatrix.needsUpdate = true;
  neonLeft.instanceMatrix.needsUpdate = true;
  neonRight.instanceMatrix.needsUpdate = true;
  rails.castShadow = true;
  rails.frustumCulled = false;
  posts.frustumCulled = false;
  neonLeft.frustumCulled = false;
  neonRight.frustumCulled = false;
  scene.add(rails, posts, neonLeft, neonRight);
}

function buildStreetlights(scene) {
  const spacing = 82;
  const from = 160;
  const to = -6400;
  const count = Math.floor((from - to) / spacing);
  const zs = Array.from({ length: count }, (_, i) => from - i * spacing);

  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c5668,
    roughness: 0.55,
    metalness: 0.55,
  });
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58c,
    toneMapped: false,
  });

  for (const side of [-1, 1]) {
    const armStart = side * 0.1;
    const armEnd = side * -2.9;
    const poleParts = [
      new THREE.BoxGeometry(0.24, 8.6, 0.24).translate(0, 4.3, 0),
      new THREE.BoxGeometry(Math.abs(armEnd - armStart), 0.16, 0.16).translate(
        (armStart + armEnd) / 2,
        8.5,
        0
      ),
    ];
    const poleGeometry = BufferGeometryUtils.mergeGeometries(poleParts, false);
    poleParts.forEach((p) => p.dispose());

    const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, count);
    const lamps = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.05, 0.2, 0.5),
      lampMaterial,
      count
    );

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(side * (ROAD.width / 2 + 4.4), 0, zs[i]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        side * (ROAD.width / 2 + 4.4) + side * -2.9,
        8.4,
        zs[i]
      );
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
    }
    poles.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    poles.frustumCulled = false;
    lamps.frustumCulled = false;
    poles.castShadow = true;
    scene.add(poles, lamps);
  }
}

function buildTrees(scene) {
  const random = mulberry32(77231);
  const items = [];
  for (const side of [-1, 1]) {
    let z = 180;
    while (z > -6550) {
      const x = side * randRange(random, 12.5, 52);
      const trunkH = randRange(random, 2.6, 4.6);
      const foliageH = randRange(random, 5.5, 11.5);
      const radius = randRange(random, 1.5, 3.6);
      items.push({ x, z: z + randRange(random, -7, 7), trunkH, foliageH, radius });
      z -= randRange(random, 17, 34);
    }
  }

  const dummy = new THREE.Object3D();
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x3a2a2e, roughness: 0.95 }),
    items.length
  );
  const foliageMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true,
    }),
    items.length
  );

  const color = new THREE.Color();
  const palette = [0x123a39, 0x0e2c33, 0x1b4742, 0x243052, 0x3a2450];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    dummy.position.set(item.x, item.trunkH / 2, item.z);
    dummy.scale.set(1, item.trunkH, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(item.x, item.trunkH + item.foliageH / 2 - 0.4, item.z);
    dummy.scale.set(item.radius, item.foliageH, item.radius);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.updateMatrix();
    foliageMesh.setMatrixAt(i, dummy.matrix);
    foliageMesh.setColorAt(i, color.setHex(palette[Math.floor(random() * palette.length)]));
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  foliageMesh.instanceMatrix.needsUpdate = true;
  if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
  trunkMesh.castShadow = true;
  foliageMesh.castShadow = true;
  trunkMesh.frustumCulled = false;
  foliageMesh.frustumCulled = false;
  scene.add(trunkMesh, foliageMesh);
}

function buildBuildings(scene) {
  const random = mulberry32(44512);
  const items = [];
  for (const side of [-1, 1]) {
    let z = 120;
    while (z > -6500) {
      const width = randRange(random, 13, 30);
      const depth = randRange(random, 13, 26);
      const height = randRange(random, 9, 46) * (random() < 0.18 ? 1.7 : 1);
      const x = side * randRange(random, 48, 128);
      items.push({ x, z: z + randRange(random, -30, 30), width, depth, height });
      z -= randRange(random, 63, 128);
    }
  }

  const dummy = new THREE.Object3D();
  const material = new THREE.MeshStandardMaterial({
    map: cachedTexture("windows", makeWindowTexture),
    emissiveMap: cachedTexture("windows", makeWindowTexture),
    emissive: 0xffffff,
    emissiveIntensity: 0.22,
    color: 0x9a9ac4,
    roughness: 0.9,
    metalness: 0.1,
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length);
  const color = new THREE.Color();
  const palette = [0x4b4470, 0x38345c, 0x5a3f6e, 0x2d3d63, 0x6a415d];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    dummy.position.set(item.x, item.height / 2, item.z);
    dummy.scale.set(item.width, item.height, item.depth);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.setHex(palette[Math.floor(random() * palette.length)]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
}

function buildBillboards(scene) {
  const random = mulberry32(92817);
  const accents = [COLORS.p1Css, COLORS.p2Css, "#ff3d9a", "#ffd166"];
  const secondary = ["#ff3d9a", "#22e6ff", "#ffd166", "#f7f4ff"];
  const sides = [-1, 1];
  let index = 0;
  for (let z = 40; z > -6200; z -= 470) {
    const side = sides[index % 2];
    const accent = accents[index % accents.length];
    const second = secondary[(index + 1) % secondary.length];
    const texture = makeBillboardTexture(index, accent, second);

    const group = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(11, 5.2, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x151826, roughness: 0.7, metalness: 0.4 })
    );
    frame.position.y = 8.6;
    group.add(frame);

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(10.4, 4.6),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    );
    panel.position.set(0, 8.6, 0.18);
    group.add(panel);

    for (const support of [-3.4, 3.4]) {
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 6.4, 0.32),
        new THREE.MeshStandardMaterial({ color: 0x394052, roughness: 0.6, metalness: 0.5 })
      );
      pole.position.set(support, 3.2, -0.2);
      group.add(pole);
    }

    const x = side * randRange(random, 19, 25);
    group.position.set(x, 0, z + randRange(random, -25, 25));
    group.rotation.y = side === -1 ? 0.92 : -0.92;
    scene.add(group);
    index++;
  }
}

function buildStartGate(scene) {
  const gate = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x323a4d,
    roughness: 0.5,
    metalness: 0.6,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.6, 0.55), postMaterial);
    post.position.set(side * 9.1, 3.8, 0);
    post.castShadow = true;
    gate.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.5, 0.6), postMaterial);
  beam.position.set(0, 7.45, 0);
  gate.add(beam);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(13.5, 3.35),
    new THREE.MeshBasicMaterial({
      map: cachedTexture("gantry", makeGantryTexture),
      toneMapped: false,
    })
  );
  sign.position.set(0, 5.9, 0.35);
  gate.add(sign);
  gate.position.z = -16;
  scene.add(gate);

  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD.width, 2.2),
    new THREE.MeshBasicMaterial({
      map: cachedTexture("startline", makeStartLineTexture),
      toneMapped: false,
      transparent: true,
    })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.012, -2.2);
  scene.add(line);
}

// ---------------------------------------------------------------------------
// Per-frame environment updates and speed lines
// ---------------------------------------------------------------------------
export function updateEnvironment(env, camera, car, elapsed) {
  env.skyGroup.position.x = camera.position.x;
  env.skyGroup.position.z = camera.position.z;
  env.skyGroup.position.y = 0;

  env.key.position.set(car.x - 34, 72, car.z - 52);
  env.key.target.position.set(car.x, 0, car.z - 12);
  env.key.target.updateMatrixWorld();
}

export function createSpeedLines(scene) {
  const count = 88;
  const random = mulberry32(6619);
  const items = [];
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    items.push({
      x: (random() < 0.5 ? -1 : 1) * randRange(random, 9.5, 30),
      y: randRange(random, 0.35, 7.5),
      z: -randRange(random, 0, 240),
      length: randRange(random, 4, 15),
      speed: randRange(random, 0.75, 1.25),
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xa5efff,
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

export function updateSpeedLines(speedLines, carZ, speed, dt) {
  const { items, positions, count, material, random } = speedLines;
  const speedRatio = Math.min(1, speed / 55);
  material.opacity = speed < 16 ? 0 : (0.08 + speedRatio * 0.34) * Math.min(1, (speed - 16) / 12);
  if (material.opacity <= 0.001) {
    speedLines.lines.visible = false;
    return;
  }
  speedLines.lines.visible = true;
  for (let i = 0; i < count; i++) {
    const item = items[i];
    if (item.z > carZ + 30) {
      item.z = carZ - randRange(random, 130, 280);
      item.x = (random() < 0.5 ? -1 : 1) * randRange(random, 9.5, 30);
      item.y = randRange(random, 0.35, 7.5);
      item.length = randRange(random, 4, 15);
    }
    const idx = i * 6;
    positions[idx] = item.x;
    positions[idx + 1] = item.y;
    positions[idx + 2] = item.z;
    positions[idx + 3] = item.x;
    positions[idx + 4] = item.y;
    positions[idx + 5] = item.z - item.length * (0.5 + speedRatio);
  }
  speedLines.lines.geometry.attributes.position.needsUpdate = true;
}
