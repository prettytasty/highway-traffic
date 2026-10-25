import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ROAD } from "./config.js";
import { ENVIRONMENTS_BY_ID, TIMES_BY_ID } from "./data.js";
import { mulberry32, randRange } from "./rng.js";

const START_Z = 200;
const END_Z = -15700;
const LENGTH = START_Z - END_Z;
const CENTRE_Z = (START_Z + END_Z) / 2;

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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
  const random = mulberry32(44109);

  ctx.fillStyle = "#23252a";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 6800; i++) {
    const shade = 27 + Math.floor(random() * 22);
    ctx.fillStyle = `rgba(${shade},${shade + 1},${shade + 4},${0.2 + random() * 0.4})`;
    const size = 1 + random() * 2.5;
    ctx.fillRect(random() * W, random() * H, size, size);
  }

  // Long tar seams.
  ctx.strokeStyle = "rgba(12,13,16,0.5)";
  for (let i = 0; i < 10; i++) {
    ctx.lineWidth = 1 + random() * 2;
    ctx.beginPath();
    let x = random() * W;
    let y = random() * H;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (random() - 0.5) * 50;
      y += random() * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Tyre-worn lane centres.
  const pxPerMetre = W / ROAD.width;
  for (let lane = 0; lane < ROAD.laneCount; lane++) {
    const centre = (lane - (ROAD.laneCount - 1) / 2) * ROAD.laneWidth;
    for (const offset of [-0.8, 0.8]) {
      const u = (centre + offset) * pxPerMetre + W / 2;
      const gradient = ctx.createLinearGradient(u - 32, 0, u + 32, 0);
      gradient.addColorStop(0, "rgba(7,8,10,0)");
      gradient.addColorStop(0.5, "rgba(7,8,10,0.26)");
      gradient.addColorStop(1, "rgba(7,8,10,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(u - 32, 0, 64, H);
    }
  }

  const boundaries = [-5.55, -1.85, 1.85];
  const dashHeight = (4 / 24) * H;
  const dashCycle = (10 / 24) * H;
  for (const x of boundaries) {
    const u = (x / ROAD.width) * W + W / 2;
    ctx.fillStyle = "rgba(228,232,236,0.82)";
    for (let y = 4; y < H; y += dashCycle) {
      ctx.fillRect(u - 3, y, 5, dashHeight);
    }
  }

  ctx.fillStyle = "rgba(236,239,242,0.92)";
  const inset = 0.3;
  const left = (-ROAD.width / 2 + inset) * pxPerMetre + W / 2;
  const right = (ROAD.width / 2 - inset) * pxPerMetre + W / 2;
  ctx.fillRect(left - 3, 0, 6, H);
  ctx.fillRect(right - 3, 0, 6, H);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function makeGroundTexture(key, base, fleckA, fleckB, seed, density = 2400) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < density; i++) {
    ctx.fillStyle = random() < 0.5 ? fleckA : fleckB;
    ctx.globalAlpha = 0.12 + random() * 0.35;
    const w = 1 + random() * 3;
    ctx.fillRect(random() * size, random() * size, w, w);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 420);
  return texture;
}

function makeWindowTexture() {
  const W = 128;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(7713);
  ctx.fillStyle = "#0a1018";
  ctx.fillRect(0, 0, W, H);
  const cols = 5;
  const rows = 12;
  const cellW = W / cols;
  const cellH = H / rows;
  const palette = ["#ffd08a", "#ffb36b", "#8fe6ff", "#b7a3ff", "#121b28", "#121b28", "#0d141f"];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = palette[Math.floor(random() * palette.length)];
      ctx.globalAlpha = 0.3 + random() * 0.7;
      ctx.fillRect(
        col * cellW + 4,
        row * cellH + 5,
        cellW - 7,
        cellH - 8
      );
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignTexture(title, subtitle, accent = "#ffcf6a") {
  const W = 1024;
  const H = 320;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a1210";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = "#f2f5ef";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 112px 'Arial Narrow', 'Trebuchet MS', sans-serif";
  ctx.fillText(title, W / 2, 128);
  ctx.fillStyle = accent;
  ctx.font = "bold 46px 'Courier New', monospace";
  ctx.fillText(subtitle, W / 2, 235);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeGlowTexture() {
  return cached("glow", () => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

// ---------------------------------------------------------------------------
// Instancing helper
// ---------------------------------------------------------------------------
function makeInstances(geometry, material, placements, { colors = null, castShadow = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < placements.length; i++) {
    const item = placements[i];
    dummy.position.set(item.x, item.y ?? 0, item.z);
    dummy.rotation.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0);
    dummy.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colors && item.color != null) {
      mesh.setColorAt(i, color.set(item.color));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && value.isTexture && cache.has("shared")) {
            // shared textures remain alive for the session
          }
        }
        material.dispose();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------
function createSky(scene) {
  const group = new THREE.Group();
  const uniforms = {
    uTop: { value: new THREE.Color(0x1a2a48) },
    uHorizon: { value: new THREE.Color(0xffb070) },
    uSunColor: { value: new THREE.Color(0xffdca8) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunStrength: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunStrength;
      varying vec3 vDir;

      void main() {
        vec3 dir = normalize(vDir);
        float height = clamp(dir.y, -0.2, 1.0);
        float blend = smoothstep(-0.04, 0.7, height);
        vec3 color = mix(uHorizon, uTop, blend);
        float sun = max(dot(dir, normalize(uSunDir)), 0.0);
        color += uSunColor * pow(sun, 900.0) * 2.4 * uSunStrength;
        color += uSunColor * pow(sun, 7.0) * 0.22 * uSunStrength;
        color = mix(color, uHorizon * 0.5, smoothstep(0.02, -0.16, height));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.toneMapped = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 20), material);
  dome.renderOrder = -30;
  group.add(dome);

  const sunSpriteMaterial = new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xffe6b8,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sunSprite = new THREE.Sprite(sunSpriteMaterial);
  sunSprite.scale.set(420, 420, 1);
  sunSprite.renderOrder = -20;
  group.add(sunSprite);

  const moonSpriteMaterial = new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xd7e4ff,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const moonSprite = new THREE.Sprite(moonSpriteMaterial);
  moonSprite.scale.set(150, 150, 1);
  moonSprite.renderOrder = -20;
  group.add(moonSprite);

  const starCount = 760;
  const starPositions = new Float32Array(starCount * 3);
  const random = mulberry32(8821);
  for (let i = 0; i < starCount; i++) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(0.05 + random() * 0.95);
    const radius = 2100;
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius;
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xe8f0ff,
    size: 3.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -25;
  group.add(stars);

  scene.add(group);
  return { group, uniforms, sunSprite, sunSpriteMaterial, moonSprite, moonSpriteMaterial, stars, starMaterial };
}

// ---------------------------------------------------------------------------
// Road, ground and common roadside detail
// ---------------------------------------------------------------------------
function createRoad(scene, envDef, anisotropy) {
  const roadTexture = makeRoadTexture();
  roadTexture.anisotropy = anisotropy;
  roadTexture.repeat.set(1, LENGTH / 24);
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTexture,
    roughness: 0.9,
    metalness: 0.04,
    color: 0xffffff,
  });
  const roadGeometry = new THREE.PlaneGeometry(ROAD.width, LENGTH);
  roadGeometry.rotateX(-Math.PI / 2);
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.position.set(0, 0, CENTRE_Z);
  road.receiveShadow = true;
  scene.add(road);

  const shoulderMaterial = new THREE.MeshStandardMaterial({
    color: envDef.shoulder,
    roughness: 0.96,
    metalness: 0.02,
  });
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.12, LENGTH),
      shoulderMaterial
    );
    shoulder.position.set(side * (ROAD.width / 2 + 1.3), -0.05, CENTRE_Z);
    shoulder.receiveShadow = true;
    scene.add(shoulder);
  }

  const groundTexture = makeGroundTexture(
    envDef.id,
    envDef.groundBase,
    envDef.groundFleckA,
    envDef.groundFleckB,
    envDef.seed
  );
  groundTexture.anisotropy = Math.min(4, anisotropy);
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  });
  const groundGeometry = new THREE.PlaneGeometry(1100, LENGTH);
  groundGeometry.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(0, -0.09, CENTRE_Z);
  ground.receiveShadow = true;
  scene.add(ground);

  return { road, ground, roadMaterial, groundMaterial };
}

function createReflectorPosts(scene) {
  const placements = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= 44) {
      placements.push({
        x: side * (ROAD.width / 2 + 2.05),
        y: 0.42,
        z,
        ry: 0,
      });
    }
  }
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9dde2,
    roughness: 0.55,
    metalness: 0.2,
  });
  const postGeometry = new THREE.BoxGeometry(0.12, 0.84, 0.08);
  const posts = makeInstances(postGeometry, postMaterial, placements);
  scene.add(posts);

  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffb84d, toneMapped: false });
  const markerGeometry = new THREE.BoxGeometry(0.16, 0.08, 0.05);
  const markers = makeInstances(
    markerGeometry,
    markerMaterial,
    placements.map((item) => ({ ...item, y: 0.7 }))
  );
  scene.add(markers);
  return { markerMaterial };
}

function createStartGantry(scene) {
  const group = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x30343d,
    roughness: 0.55,
    metalness: 0.55,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.4, 0.5), postMaterial);
    post.position.set(side * 9.2, 3.7, 0);
    post.castShadow = true;
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.42, 0.55), postMaterial);
  beam.position.y = 7.2;
  group.add(beam);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(13.2, 4.12),
    new THREE.MeshBasicMaterial({
      map: makeSignTexture("HIGHWAY TRAFFIC", "OPEN ROAD  ·  BIG SKY", "#ffcf6a"),
      toneMapped: false,
    })
  );
  panel.position.set(0, 5.75, 0.34);
  group.add(panel);
  group.position.z = -22;
  scene.add(group);
}

function createGantry(scene, z, title, subtitle, accent) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x3d4550,
    roughness: 0.6,
    metalness: 0.4,
  });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), material);
    post.position.set(side * 9.0, 3.5, 0);
    group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.32, 0.4), material);
  beam.position.y = 6.9;
  group.add(beam);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10.5, 3.28),
    new THREE.MeshBasicMaterial({
      map: makeSignTexture(title, subtitle, accent),
      toneMapped: false,
    })
  );
  sign.position.set(0, 6.2, 0.25);
  group.add(sign);
  group.position.z = z;
  scene.add(group);
}

function createGuardrail(scene, style) {
  if (style === "none") return;
  const railMaterial = new THREE.MeshStandardMaterial({
    color: style === "wood" ? 0x7a5c3e : 0x9aa3ad,
    roughness: style === "wood" ? 0.9 : 0.42,
    metalness: style === "wood" ? 0.02 : 0.6,
  });
  const postMaterial = new THREE.MeshStandardMaterial({
    color: style === "wood" ? 0x5e452e : 0x3d444d,
    roughness: 0.85,
    metalness: style === "wood" ? 0.02 : 0.4,
  });
  const spacing = style === "wood" ? 14 : 9;
  const placements = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= spacing) {
      placements.push({ x: side * (ROAD.width / 2 + 2.4), y: 0.55, z });
    }
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.34, LENGTH),
      railMaterial
    );
    rail.position.set(side * (ROAD.width / 2 + 2.4), style === "wood" ? 0.9 : 0.78, CENTRE_Z);
    rail.castShadow = false;
    scene.add(rail);
    if (style === "wood") {
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.22, LENGTH),
        railMaterial
      );
      lower.position.set(side * (ROAD.width / 2 + 2.4), 0.48, CENTRE_Z);
      scene.add(lower);
    }
  }
  const geometry =
    style === "wood"
      ? new THREE.BoxGeometry(0.22, 1.15, 0.22)
      : new THREE.BoxGeometry(0.15, 0.95, 0.15);
  const posts = makeInstances(geometry, postMaterial, placements);
  scene.add(posts);
}

function createConcreteBarrier(scene) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x8f959c,
    roughness: 0.94,
    metalness: 0.02,
  });
  for (const side of [-1, 1]) {
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.95, LENGTH),
      material
    );
    barrier.position.set(side * (ROAD.width / 2 + 2.05), 0.45, CENTRE_Z);
    barrier.receiveShadow = true;
    barrier.castShadow = true;
    scene.add(barrier);
  }
}

// ---------------------------------------------------------------------------
// City
// ---------------------------------------------------------------------------
function buildCity(scene, dynamic) {
  const random = mulberry32(51122);
  const windowTexture = makeWindowTexture();
  const buildingMaterial = new THREE.MeshStandardMaterial({
    map: windowTexture,
    emissiveMap: windowTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.1,
    color: 0x69727d,
    roughness: 0.85,
    metalness: 0.12,
  });
  dynamic.windowMaterials.push(buildingMaterial);

  const buildings = [];
  for (const side of [-1, 1]) {
    let z = 160;
    while (z > END_Z + 80) {
      const depth = randRange(random, 18, 44);
      const width = randRange(random, 16, 38);
      const height = randRange(random, 18, 92) * (random() < 0.12 ? 1.8 : 1);
      buildings.push({
        x: side * randRange(random, 46, 210),
        y: height / 2,
        z: z + randRange(random, -20, 20),
        sx: width,
        sy: height,
        sz: depth,
        ry: (random() - 0.5) * 0.2,
        color: [0x5c6672, 0x4c5866, 0x6b6a73, 0x44515d, 0x73655f][
          Math.floor(random() * 5)
        ],
      });
      z -= randRange(random, 44, 96);
    }
  }
  const buildingMesh = makeInstances(
    new THREE.BoxGeometry(1, 1, 1),
    buildingMaterial,
    buildings,
    { colors: true }
  );
  scene.add(buildingMesh);

  // Distant skyline blocks with emissive tops.
  const skylineMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b3542,
    roughness: 0.82,
    metalness: 0.35,
    emissive: 0x101926,
    emissiveIntensity: 0.4,
  });
  const skyline = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 34; i++) {
      const height = randRange(random, 40, 170);
      skyline.push({
        x: side * randRange(random, 230, 480),
        y: height / 2,
        z: randRange(random, END_Z, START_Z),
        sx: randRange(random, 24, 60),
        sy: height,
        sz: randRange(random, 24, 60),
        color: 0x2e3946,
      });
    }
  }
  scene.add(
    makeInstances(new THREE.BoxGeometry(1, 1, 1), skylineMaterial, skyline, {
      colors: true,
    })
  );

  // Street lights.
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0.2,
    toneMapped: false,
  });
  dynamic.lampMaterials.push(lampMaterial);

  const poleParts = [
    new THREE.BoxGeometry(0.18, 8.8, 0.18).translate(0, 4.4, 0),
    new THREE.BoxGeometry(2.6, 0.14, 0.14).translate(1.3, 8.7, 0),
  ];
  const poleGeometry = mergeGeometries(poleParts, false);
  poleParts.forEach((part) => part.dispose());
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x565f69,
    roughness: 0.55,
    metalness: 0.5,
  });
  const polePlacements = [];
  const lampPlacements = [];
  for (let z = START_Z; z > END_Z; z -= 58) {
    for (const side of [-1, 1]) {
      polePlacements.push({
        x: side * (ROAD.width / 2 + 3.6),
        z,
        ry: side === -1 ? 0 : Math.PI,
      });
      lampPlacements.push({
        x: side * (ROAD.width / 2 + 3.6) + side * 2.6,
        y: 8.6,
        z,
      });
    }
  }
  scene.add(makeInstances(poleGeometry, poleMaterial, polePlacements));
  scene.add(
    makeInstances(new THREE.BoxGeometry(1.2, 0.12, 0.36), lampMaterial, lampPlacements)
  );

  // Overhead signs punctuate the corridor.
  const signs = [
    ["NORTH 101", "CITY CENTRE", "#54d6ff"],
    ["EXIT 14", "RIVERFRONT", "#ffcf6a"],
    ["LOOP 9", "AIRPORT", "#ff8f6a"],
  ];
  for (let i = 0; i < 7; i++) {
    const z = -260 - i * 520;
    const [title, subtitle, accent] = signs[i % signs.length];
    createGantry(scene, z, title, subtitle, accent);
  }

  // Concrete barriers and a few planters.
  createConcreteBarrier(scene);
  const planterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c4235,
    roughness: 0.95,
  });
  const planter = [];
  for (let z = START_Z - 80; z > END_Z; z -= 120) {
    planter.push({
      x: (random() < 0.5 ? -1 : 1) * (ROAD.width / 2 + 5.5),
      y: 0.3,
      z,
      sx: randRange(random, 1.2, 2.4),
      sy: randRange(random, 0.5, 0.9),
      sz: randRange(random, 1.4, 3),
    });
  }
  scene.add(
    makeInstances(new THREE.BoxGeometry(1, 1, 1), planterMaterial, planter)
  );
}

// ---------------------------------------------------------------------------
// Country
// ---------------------------------------------------------------------------
function createBarn(scene, x, z, scale = 1) {
  const group = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x8c3f30,
    roughness: 0.9,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x3e3a38,
    roughness: 0.88,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6dcc4,
    roughness: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(13, 7.5, 18), wallMaterial);
  body.position.y = 3.75;
  body.castShadow = true;
  group.add(body);

  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.35, 19), roofMaterial);
    roof.position.set(side * 3.6, 8.6, 0);
    roof.rotation.z = side * 0.62;
    roof.castShadow = true;
    group.add(roof);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5), trimMaterial);
  door.position.set(0, 2.5, 9.02);
  group.add(door);
  const doorSplit = new THREE.Mesh(new THREE.BoxGeometry(0.15, 5, 0.1), roofMaterial);
  doorSplit.position.set(0, 2.5, 9.06);
  group.add(doorSplit);

  const silo = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 11, 14),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a2, roughness: 0.7, metalness: 0.3 })
  );
  silo.position.set(9.6, 5.5, -2);
  silo.castShadow = true;
  group.add(silo);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7e8588, roughness: 0.6, metalness: 0.4 })
  );
  cap.position.set(9.6, 11, -2);
  group.add(cap);

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  group.rotation.y = x > 0 ? -0.5 : 0.5;
  scene.add(group);
}

function createWindTurbine(scene, position, dynamic) {
  const group = new THREE.Group();
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0xe4e6e4,
    roughness: 0.55,
    metalness: 0.25,
  });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.9, 42, 12), towerMaterial);
  tower.position.y = 21;
  tower.castShadow = true;
  group.add(tower);
  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.9, 2.2), towerMaterial);
  nacelle.position.set(0, 42.2, 0);
  group.add(nacelle);

  const rotor = new THREE.Group();
  rotor.position.set(0, 42.2, 2.2);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 21, 0.28),
      towerMaterial
    );
    blade.position.y = 10;
    blade.rotation.z = (i / 3) * Math.PI * 2;
    rotor.add(blade);
  }
  group.add(rotor);
  group.position.copy(position);
  group.rotation.y = position.x > 0 ? -0.7 : 0.7;
  scene.add(group);
  dynamic.turbines.push(rotor);
}

function buildCountry(scene, dynamic) {
  const random = mulberry32(39117);
  createGuardrail(scene, "wood");

  // Utility poles with a continuous wire run.
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b3e32,
    roughness: 0.95,
  });
  const poleParts = [
    new THREE.CylinderGeometry(0.16, 0.22, 10, 7).translate(0, 5, 0),
    new THREE.BoxGeometry(3.4, 0.18, 0.18).translate(0, 8.7, 0),
    new THREE.BoxGeometry(2.4, 0.14, 0.14).translate(0, 9.5, 0),
  ];
  const poleGeometry = mergeGeometries(poleParts, false);
  poleParts.forEach((part) => part.dispose());
  const poles = [];
  const wirePoints = [[], []];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= 85) {
      poles.push({ x: side * randRange(random, 15, 26), z });
      wirePoints[side === -1 ? 0 : 1].push(
        new THREE.Vector3(side * 18, 9.2, z)
      );
    }
  }
  scene.add(makeInstances(poleGeometry, poleMaterial, poles));
  for (const points of wirePoints) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const wires = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x22252a, transparent: true, opacity: 0.65 })
    );
    scene.add(wires);
  }

  // Fence lines and hay bales.
  const hayMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4b46a,
    roughness: 0.98,
  });
  const hay = [];
  for (let z = START_Z; z > END_Z; z -= randRange(random, 30, 80)) {
    hay.push({
      x: (random() < 0.5 ? -1 : 1) * randRange(random, 24, 82),
      y: 0.8,
      z,
      rx: Math.PI / 2,
      sx: randRange(random, 0.85, 1.25),
      sy: randRange(random, 0.85, 1.25),
      sz: randRange(random, 0.85, 1.25),
      ry: random() * Math.PI,
    });
  }
  scene.add(makeInstances(new THREE.CylinderGeometry(1, 1, 2.2, 12), hayMaterial, hay));

  // Deciduous trees.
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b3626,
    roughness: 0.95,
  });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0x496b34,
    roughness: 0.92,
    flatShading: true,
  });
  const trunks = [];
  const foliage = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= randRange(random, 18, 42)) {
      const x = side * randRange(random, 22, 105);
      const height = randRange(random, 3.2, 5.6);
      const scale = randRange(random, 1.2, 2.4);
      trunks.push({ x, y: height / 2, z, sy: height, sx: 0.55, sz: 0.55 });
      foliage.push({
        x,
        y: height + scale * 2,
        z,
        sx: scale * 2.6,
        sy: scale * 2.2,
        sz: scale * 2.6,
        color: [0x4f7439, 0x3d6230, 0x5d7f3c, 0x6b8037][Math.floor(random() * 4)],
      });
    }
  }
  scene.add(makeInstances(new THREE.BoxGeometry(1, 1, 1), trunkMaterial, trunks));
  scene.add(
    makeInstances(new THREE.IcosahedronGeometry(1, 0), foliageMaterial, foliage, {
      colors: true,
      castShadow: false,
    })
  );

  // Barns and turbines.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    createBarn(
      scene,
      side * randRange(random, 55, 110),
      -160 - i * 820,
      randRange(random, 0.85, 1.2)
    );
  }
  for (let i = 0; i < 5; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    createWindTurbine(
      scene,
      new THREE.Vector3(side * randRange(random, 130, 230), 0, -320 - i * 1250),
      dynamic
    );
  }

  // Field strips to break up the grass.
  const stripMaterial = new THREE.MeshStandardMaterial({
    color: 0x6e7639,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
  });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(randRange(random, 40, 90), LENGTH),
        stripMaterial
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(side * randRange(random, 60, 240), -0.04, CENTRE_Z);
      scene.add(strip);
    }
  }
}

// ---------------------------------------------------------------------------
// Desert
// ---------------------------------------------------------------------------
function buildDesert(scene, dynamic) {
  const random = mulberry32(91007);
  createGuardrail(scene, "none");

  // Buttes and mesas.
  const mesaMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b4f31,
    roughness: 0.98,
    flatShading: true,
  });
  const mesas = [];
  const caps = [];
  for (let i = 0; i < 26; i++) {
    const side = random() < 0.5 ? -1 : 1;
    const height = randRange(random, 26, 95);
    const radius = randRange(random, 16, 44);
    mesas.push({
      x: side * randRange(random, 160, 480),
      y: height / 2,
      z: randRange(random, END_Z, START_Z),
      sx: radius,
      sy: height,
      sz: radius * randRange(random, 0.7, 1.3),
      ry: random() * Math.PI,
      color: [0x9b4f31, 0x8a452b, 0xb5623b, 0xa45734][Math.floor(random() * 4)],
    });
    caps.push({
      x: side * 170,
      y: 0,
      z: 0,
    });
  }
  scene.add(
    makeInstances(new THREE.CylinderGeometry(0.82, 1, 1, 6), mesaMaterial, mesas, {
      colors: true,
    })
  );

  // Rocks and boulders near the road.
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x8c5b42,
    roughness: 0.98,
    flatShading: true,
  });
  const rocks = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= randRange(random, 20, 60)) {
      const scale = randRange(random, 0.8, 3.2);
      rocks.push({
        x: side * randRange(random, 14, 56),
        y: scale * 0.45,
        z,
        sx: scale * randRange(random, 0.8, 1.6),
        sy: scale,
        sz: scale * randRange(random, 0.8, 1.5),
        ry: random() * Math.PI,
        color: [0x8c5b42, 0x744a36, 0xa36a4b, 0x664331][Math.floor(random() * 4)],
      });
    }
  }
  scene.add(
    makeInstances(new THREE.DodecahedronGeometry(1, 0), rockMaterial, rocks, {
      colors: true,
    })
  );

  // Saguaro cacti, built once and instanced.
  const cactusParts = [
    new THREE.CylinderGeometry(0.28, 0.34, 3.4, 8).translate(0, 1.7, 0),
    new THREE.CylinderGeometry(0.17, 0.17, 0.9, 7).rotateZ(Math.PI / 2).translate(0.72, 1.6, 0),
    new THREE.CylinderGeometry(0.15, 0.15, 1.2, 7).translate(0.72, 2.05, 0),
    new THREE.CylinderGeometry(0.17, 0.17, 0.8, 7).rotateZ(Math.PI / 2).translate(-0.62, 2.15, 0),
    new THREE.CylinderGeometry(0.14, 0.14, 1.0, 7).translate(-0.62, 2.55, 0),
  ];
  const cactusGeometry = mergeGeometries(cactusParts, false);
  cactusParts.forEach((part) => part.dispose());
  const cactusMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b6b3a,
    roughness: 0.9,
    flatShading: true,
  });
  const cacti = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z - 30; z > END_Z; z -= randRange(random, 28, 95)) {
      cacti.push({
        x: side * randRange(random, 15, 80),
        z,
        sx: randRange(random, 0.75, 1.3),
        sy: randRange(random, 0.75, 1.6),
        sz: randRange(random, 0.75, 1.3),
        ry: random() * Math.PI * 2,
      });
    }
  }
  scene.add(makeInstances(cactusGeometry, cactusMaterial, cacti));

  // Scrub.
  const scrubMaterial = new THREE.MeshStandardMaterial({
    color: 0x777345,
    roughness: 1,
    flatShading: true,
  });
  const scrub = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= randRange(random, 12, 40)) {
      const scale = randRange(random, 0.3, 0.9);
      scrub.push({
        x: side * randRange(random, 9.5, 36),
        y: scale * 0.5,
        z,
        sx: scale * 1.8,
        sy: scale,
        sz: scale * 1.7,
      });
    }
  }
  scene.add(
    makeInstances(new THREE.IcosahedronGeometry(1, 0), scrubMaterial, scrub)
  );

  // Long power line with sagging spans.
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x5b4635,
    roughness: 0.95,
  });
  const poleParts = [
    new THREE.BoxGeometry(0.22, 11, 0.22).translate(0, 5.5, 0),
    new THREE.BoxGeometry(4.8, 0.16, 0.16).translate(0, 10.2, 0),
  ];
  const poleGeometry = mergeGeometries(poleParts, false);
  poleParts.forEach((part) => part.dispose());
  const poles = [];
  const wirePoints = [];
  for (const side of [-1, 1]) {
    const points = [];
    for (let z = START_Z; z > END_Z; z -= 110) {
      const x = side * 22;
      poles.push({ x, z });
      points.push(new THREE.Vector3(x, 10.3, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x1e1a18, transparent: true, opacity: 0.6 })
    );
    scene.add(line);
    wirePoints.push(points);
  }
  scene.add(makeInstances(poleGeometry, poleMaterial, poles));

  // Dunes far out.
  const duneMaterial = new THREE.MeshStandardMaterial({
    color: 0xb27c51,
    roughness: 1,
    flatShading: true,
  });
  const dunes = [];
  for (let i = 0; i < 30; i++) {
    const side = random() < 0.5 ? -1 : 1;
    dunes.push({
      x: side * randRange(random, 120, 420),
      y: -2,
      z: randRange(random, END_Z, START_Z),
      sx: randRange(random, 40, 110),
      sy: randRange(random, 4, 12),
      sz: randRange(random, 40, 150),
    });
  }
  scene.add(
    makeInstances(new THREE.SphereGeometry(1, 12, 7), duneMaterial, dunes)
  );
}

// ---------------------------------------------------------------------------
// Mountain
// ---------------------------------------------------------------------------
function buildMountain(scene, dynamic) {
  const random = mulberry32(76021);

  // Stone barrier.
  const barrierMaterial = new THREE.MeshStandardMaterial({
    color: 0x77786f,
    roughness: 0.96,
  });
  const barrierPosts = [];
  for (const side of [-1, 1]) {
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.8, LENGTH),
      barrierMaterial
    );
    barrier.position.set(side * (ROAD.width / 2 + 2.15), 0.38, CENTRE_Z);
    barrier.castShadow = true;
    scene.add(barrier);
    for (let z = START_Z; z > END_Z; z -= 14) {
      barrierPosts.push({
        x: side * (ROAD.width / 2 + 2.15),
        y: 0.95,
        z,
      });
    }
  }
  scene.add(
    makeInstances(
      new THREE.BoxGeometry(0.72, 0.32, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x8b8b80, roughness: 0.9 }),
      barrierPosts
    )
  );

  // Mountain range.
  const mountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x727f88,
    roughness: 0.97,
    flatShading: true,
  });
  const mountains = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26; i++) {
      const height = randRange(random, 90, 260);
      mountains.push({
        x: side * randRange(random, 190, 520),
        y: height / 2 - 3,
        z: randRange(random, END_Z - 400, START_Z),
        sx: randRange(random, 90, 220),
        sy: height,
        sz: randRange(random, 80, 210),
        ry: random() * Math.PI,
        color: [0x6c7b83, 0x79868d, 0x5f6d77, 0x87949a][Math.floor(random() * 4)],
      });
    }
  }
  scene.add(
    makeInstances(new THREE.ConeGeometry(1, 1, 7), mountainMaterial, mountains, {
      colors: true,
    })
  );

  // Snow caps on the tallest peaks.
  const snowMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9edf0,
    roughness: 0.82,
    flatShading: true,
  });
  const snow = [];
  for (const mountain of mountains) {
    if (mountain.sy < 155) continue;
    snow.push({
      x: mountain.x,
      y: mountain.sy * 0.84,
      z: mountain.z,
      sx: mountain.sx * 0.34,
      sy: mountain.sy * 0.26,
      sz: mountain.sz * 0.34,
      ry: mountain.ry,
    });
  }
  scene.add(makeInstances(new THREE.ConeGeometry(1, 1, 7), snowMaterial, snow));

  // Pines and outcrops.
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2e28,
    roughness: 1,
  });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e4a3d,
    roughness: 0.95,
    flatShading: true,
  });
  const trunks = [];
  const foliage = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= randRange(random, 8, 20)) {
      const x = side * randRange(random, 14, 150);
      const height = randRange(random, 7, 18);
      trunks.push({ x, y: height * 0.35, z, sx: 0.4, sy: height * 0.7, sz: 0.4 });
      foliage.push({
        x,
        y: height * 0.6,
        z,
        sx: randRange(random, 2, 3.8),
        sy: height,
        sz: randRange(random, 2, 3.8),
        color: [0x2b4437, 0x344f3e, 0x243c33][Math.floor(random() * 3)],
      });
    }
  }
  scene.add(makeInstances(new THREE.CylinderGeometry(0.7, 1, 1, 6), trunkMaterial, trunks));
  scene.add(
    makeInstances(new THREE.ConeGeometry(1, 1, 7), foliageMaterial, foliage, {
      colors: true,
      castShadow: false,
    })
  );

  const outcropMaterial = new THREE.MeshStandardMaterial({
    color: 0x66645c,
    roughness: 1,
    flatShading: true,
  });
  const outcrops = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z - 60; z > END_Z; z -= randRange(random, 90, 220)) {
      const scale = randRange(random, 3, 12);
      outcrops.push({
        x: side * randRange(random, 13, 40),
        y: scale * 0.4,
        z,
        sx: scale * randRange(random, 0.7, 1.3),
        sy: scale,
        sz: scale * randRange(random, 0.8, 1.5),
        ry: random() * Math.PI,
      });
    }
  }
  scene.add(
    makeInstances(new THREE.DodecahedronGeometry(1, 0), outcropMaterial, outcrops)
  );

  // Alpine guard posts with a cold reflector.
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5259,
    roughness: 0.7,
    metalness: 0.4,
  });
  const posts = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= 34) {
      posts.push({ x: side * (ROAD.width / 2 + 1.75), y: 0.65, z });
    }
  }
  scene.add(makeInstances(new THREE.BoxGeometry(0.1, 1.3, 0.1), postMaterial, posts));
}

// ---------------------------------------------------------------------------
// Forest
// ---------------------------------------------------------------------------
function buildForest(scene, dynamic) {
  const random = mulberry32(62073);
  createGuardrail(scene, "steel");

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2a20,
    roughness: 1,
  });
  const pineMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    flatShading: true,
  });
  const trunks = [];
  const lower = [];
  const upper = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= randRange(random, 5, 12)) {
      const x = side * randRange(random, 12.5, 130);
      const height = randRange(random, 10, 25);
      const width = height * randRange(random, 0.22, 0.32);
      trunks.push({ x, y: height * 0.25, z, sx: 0.45, sy: height * 0.5, sz: 0.45 });
      lower.push({
        x,
        y: height * 0.55,
        z,
        sx: width,
        sy: height * 0.7,
        sz: width,
        color: [0x1e3a2a, 0x284632, 0x173428, 0x315138][Math.floor(random() * 4)],
      });
      upper.push({
        x,
        y: height * 0.8,
        z,
        sx: width * 0.68,
        sy: height * 0.52,
        sz: width * 0.68,
        color: [0x24402e, 0x2f4e37, 0x1b372a][Math.floor(random() * 3)],
      });
    }
  }
  scene.add(makeInstances(new THREE.CylinderGeometry(0.65, 1, 1, 6), trunkMaterial, trunks));
  scene.add(
    makeInstances(new THREE.ConeGeometry(1, 1, 7), pineMaterial, lower, {
      colors: true,
      castShadow: false,
    })
  );
  scene.add(
    makeInstances(new THREE.ConeGeometry(1, 1, 7), pineMaterial, upper, {
      colors: true,
      castShadow: false,
    })
  );

  // Undergrowth.
  const scrubMaterial = new THREE.MeshStandardMaterial({
    color: 0x37543a,
    roughness: 1,
    flatShading: true,
  });
  const scrub = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z; z > END_Z; z -= randRange(random, 4, 15)) {
      const scale = randRange(random, 0.4, 1.4);
      scrub.push({
        x: side * randRange(random, 9.5, 40),
        y: scale * 0.35,
        z,
        sx: scale * 1.8,
        sy: scale,
        sz: scale * 1.6,
      });
    }
  }
  scene.add(
    makeInstances(new THREE.IcosahedronGeometry(1, 0), scrubMaterial, scrub)
  );

  // Cabins with warm windows.
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc16b,
    transparent: true,
    opacity: 0.1,
    toneMapped: false,
  });
  dynamic.cabinWindowMaterials.push(windowMaterial);

  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const group = new THREE.Group();
    const logMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b382a,
      roughness: 0.95,
    });
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b2a28,
      roughness: 0.9,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.4, 7.4), logMaterial);
    body.position.y = 1.7;
    body.castShadow = true;
    group.add(body);
    for (const stripe of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.28, 8.2), roofMaterial);
      roof.position.set(stripe * 1.6, 4.0, 0);
      roof.rotation.z = stripe * 0.6;
      group.add(roof);
    }
    for (const wx of [-1.7, 1.7]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), windowMaterial);
      window.position.set(wx, 1.9, 3.72);
      group.add(window);
    }
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 2.2, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.9 })
    );
    chimney.position.set(1.9, 4.2, -1.5);
    group.add(chimney);
    group.position.set(
      side * randRange(random, 24, 60),
      0,
      -280 - i * 900
    );
    group.rotation.y = side === -1 ? 0.6 : -0.6;
    scene.add(group);
  }

  // Lantern posts near the road.
  const lampMaterial = new THREE.MeshBasicMaterial({
    color: 0xffbd76,
    transparent: true,
    opacity: 0.1,
    toneMapped: false,
  });
  dynamic.lampMaterials.push(lampMaterial);
  const lampPosts = [];
  const lamps = [];
  for (const side of [-1, 1]) {
    for (let z = START_Z - 60; z > END_Z; z -= 160) {
      const x = side * (ROAD.width / 2 + 3.1);
      lampPosts.push({ x, z });
      lamps.push({ x, y: 2.35, z });
    }
  }
  const postGeometry = new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6).translate(0, 1.2, 0);
  scene.add(
    makeInstances(
      postGeometry,
      new THREE.MeshStandardMaterial({ color: 0x2c2c2a, roughness: 0.8, metalness: 0.4 }),
      lampPosts
    )
  );
  scene.add(
    makeInstances(new THREE.BoxGeometry(0.32, 0.38, 0.32), lampMaterial, lamps)
  );

  // Closed canopy feel: more distant tree silhouettes.
  const distanceTrees = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 200; i++) {
      const height = randRange(random, 14, 30);
      distanceTrees.push({
        x: side * randRange(random, 130, 420),
        y: height * 0.5,
        z: randRange(random, END_Z, START_Z),
        sx: height * 0.25,
        sy: height,
        sz: height * 0.25,
      });
    }
  }
  scene.add(
    makeInstances(
      new THREE.ConeGeometry(1, 1, 5),
      new THREE.MeshStandardMaterial({
        color: 0x1a3226,
        roughness: 0.95,
        flatShading: true,
      }),
      distanceTrees
    )
  );
}

// ---------------------------------------------------------------------------
// Per-environment presentation values
// ---------------------------------------------------------------------------
const ENV_STYLE = {
  city: {
    shoulder: 0x4a4d53,
    groundBase: "#34373b",
    groundFleckA: "#4a4e54",
    groundFleckB: "#272a2e",
    seed: 112,
    fogNear: 160,
    fogFar: 800,
    accent: "#54d6ff",
    build: buildCity,
  },
  country: {
    shoulder: 0x7a6f4d,
    groundBase: "#3d5a2c",
    groundFleckA: "#53723a",
    groundFleckB: "#2b4522",
    seed: 201,
    fogNear: 230,
    fogFar: 1100,
    accent: "#ffcf6a",
    build: buildCountry,
  },
  desert: {
    shoulder: 0x9a7047,
    groundBase: "#aa7448",
    groundFleckA: "#c08a57",
    groundFleckB: "#835636",
    seed: 302,
    fogNear: 250,
    fogFar: 1200,
    accent: "#ff9b52",
    build: buildDesert,
  },
  mountain: {
    shoulder: 0x5f655e,
    groundBase: "#46513e",
    groundFleckA: "#5c6851",
    groundFleckB: "#333c31",
    seed: 403,
    fogNear: 150,
    fogFar: 900,
    accent: "#9fd8ff",
    build: buildMountain,
  },
  forest: {
    shoulder: 0x4a4537,
    groundBase: "#233a24",
    groundFleckA: "#34502f",
    groundFleckB: "#172818",
    seed: 504,
    fogNear: 90,
    fogFar: 560,
    accent: "#8fe36d",
    build: buildForest,
  },
};

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------
const SKY_PALETTES = {
  nightTop: new THREE.Color(0x03060f),
  nightHorizon: new THREE.Color(0x101b31),
  dayTop: new THREE.Color(0x2e6fb0),
  dayHorizon: new THREE.Color(0xbdd6e8),
  duskTop: new THREE.Color(0x30264f),
  duskHorizon: new THREE.Color(0xf37a5a),
  warmSun: new THREE.Color(0xff9a62),
  daySun: new THREE.Color(0xfff4dc),
  moon: new THREE.Color(0x8da7de),
};

function createTimeSystem(scene, renderer, envDef, timeId, sky, lights) {
  const state = {
    auto: timeId === "auto",
    timeId,
    t: TIMES_BY_ID[timeId]?.t ?? 0.8,
    night: 0,
    sunset: 0,
    elapsed: 0,
  };
  if (state.auto) state.t = 0.34;
  const top = new THREE.Color();
  const horizon = new THREE.Color();
  const sunColor = new THREE.Color();
  const sunDir = new THREE.Vector3();
  state.sunDir = sunDir;

  function apply() {
    const theta = (state.t - 0.25) * Math.PI * 2;
    sunDir.set(Math.cos(theta) * 0.9, Math.sin(theta), 0.3).normalize();
    const elevation = sunDir.y;
    const day = smoothstep(-0.045, 0.22, elevation);
    const twilight = Math.max(0, 1 - Math.abs(elevation) / 0.27);
    state.night = 1 - day;
    state.sunset = twilight * day;

    horizon.copy(SKY_PALETTES.nightHorizon).lerp(SKY_PALETTES.dayHorizon, day);
    top.copy(SKY_PALETTES.nightTop).lerp(SKY_PALETTES.dayTop, day);
    horizon.lerp(SKY_PALETTES.duskHorizon, twilight * 0.88);
    top.lerp(SKY_PALETTES.duskTop, twilight * 0.65);
    sunColor.copy(SKY_PALETTES.daySun).lerp(SKY_PALETTES.warmSun, twilight);

    sky.uniforms.uTop.value.copy(top);
    sky.uniforms.uHorizon.value.copy(horizon);
    sky.uniforms.uSunColor.value.copy(sunColor);
    sky.uniforms.uSunDir.value.copy(sunDir);
    sky.uniforms.uSunStrength.value = smoothstep(-0.07, 0.04, elevation) * 0.9;

    const sunVisible = elevation > -0.04;
    sky.sunSprite.visible = sunVisible;
    sky.sunSpriteMaterial.opacity = sunVisible ? 0.8 : 0;
    sky.sunSprite.position.copy(sunDir).multiplyScalar(1900);
    sky.sunSpriteMaterial.color.copy(sunColor);

    sky.moonSprite.visible = state.night > 0.2;
    sky.moonSprite.position
      .set(-sunDir.x * 0.8, Math.abs(sunDir.y) * 0.8 + 0.2, -sunDir.z)
      .normalize()
      .multiplyScalar(1900);
    sky.moonSpriteMaterial.opacity = state.night * 0.85;
    sky.starMaterial.opacity = state.night * 0.9;

    scene.fog.color.copy(horizon);
    scene.fog.near = envDef.fogNear;
    scene.fog.far = envDef.fogFar * (0.68 + day * 0.32);

    lights.sun.color.copy(sunColor);
    lights.sun.intensity = Math.max(0, elevation) * 2.9 + 0.06;
    lights.hemi.color.copy(top);
    lights.hemi.groundColor.setHex(envDef.shoulder);
    lights.hemi.intensity = 0.34 + day * 1.0;
    lights.ambient.color.copy(horizon);
    lights.ambient.intensity = 0.18 + day * 0.24;
    lights.moon.color.copy(SKY_PALETTES.moon);
    lights.moon.intensity = state.night * 0.42;

    for (const material of lights.dynamic.windowMaterials) {
      material.emissiveIntensity = 0.07 + state.night * 1.25;
    }
    for (const material of lights.dynamic.lampMaterials) {
      material.opacity = 0.12 + state.night * 0.88;
    }
    for (const material of lights.dynamic.cabinWindowMaterials) {
      material.opacity = 0.08 + state.night * 0.92;
    }
  }

  return {
    state,
    apply,
    setTime(nextTimeId) {
      state.timeId = nextTimeId;
      state.auto = nextTimeId === "auto";
      state.t = TIMES_BY_ID[nextTimeId]?.t ?? state.t;
      if (state.auto) state.t = 0.34;
      apply();
    },
    update(dt) {
      if (state.auto) {
        state.t = (state.t + dt / 240) % 1;
      }
      state.elapsed += dt;
      apply();
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function createScenery(scene, renderer, environmentId, timeId) {
  const envDef = ENV_STYLE[environmentId] ? environmentId : "city";
  const style = ENV_STYLE[envDef];
  const environment = ENVIRONMENTS_BY_ID[envDef] || ENVIRONMENTS_BY_ID.city;
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  scene.fog = new THREE.Fog(0xbdd6e8, style.fogNear, style.fogFar);
  const sky = createSky(scene);

  const hemi = new THREE.HemisphereLight(0xbdd6e8, style.shoulder, 1.1);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x7f8fa8, 0.32);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff1d5, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 190;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x8da7de, 0.3);
  moon.position.set(40, 80, -60);
  scene.add(moon);

  const dynamic = {
    turbines: [],
    windowMaterials: [],
    lampMaterials: [],
    cabinWindowMaterials: [],
  };
  const road = createRoad(scene, style, anisotropy);
  createReflectorPosts(scene);
  createStartGantry(scene);
  style.build(scene, dynamic);

  const time = createTimeSystem(scene, renderer, style, timeId, sky, {
    sun,
    hemi,
    ambient,
    moon,
    dynamic,
  });
  time.apply();

  let elapsed = 0;
  return {
    environmentId: envDef,
    environment,
    style,
    group: sky.group,
    road,
    sun,
    get nightFactor() {
      return time.state.night;
    },
    setTime: time.setTime,
    update(dt, camera, carZ, carX = 0) {
      elapsed += dt;
      time.update(dt);
      sky.group.position.set(camera.position.x, 0, camera.position.z);
      const dir = time.state.sunDir;
      sun.position.set(
        carX + dir.x * 115,
        Math.max(4, dir.y * 125),
        carZ + dir.z * 115
      );
      sun.target.position.set(carX, 0, carZ - 30);
      sun.target.updateMatrixWorld();
      sun.shadow.camera.updateProjectionMatrix();
      for (let i = 0; i < dynamic.turbines.length; i++) {
        dynamic.turbines[i].rotation.z += dt * (0.55 + i * 0.03);
      }
    },
    dispose() {
      scene.remove(sky.group);
      scene.remove(hemi);
      scene.remove(ambient);
      scene.remove(sun);
      scene.remove(sun.target);
      scene.remove(moon);
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const material of materials) material.dispose();
        }
      });
    },
  };
}
