import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------------------
// Traffic catalogue. Speeds are metres per second, sizes are metres.
// ---------------------------------------------------------------------------
export const TRAFFIC_TYPES = {
  sedan: {
    length: 4.4,
    width: 1.86,
    height: 1.56,
    minSpeed: 28,
    maxSpeed: 36,
    weight: 5,
    weaver: true,
    signalY: 0.98,
    variants: [0xd94b4b, 0x3f7fd9, 0xe3b544, 0x7a5bd6, 0x3fae8a, 0xd8dae2],
  },
  sport: {
    length: 4.25,
    width: 1.9,
    height: 1.22,
    minSpeed: 34,
    maxSpeed: 42,
    weight: 1.5,
    weaver: true,
    signalY: 0.8,
    variants: [0xff5533, 0x2bd4c4, 0xffcc33, 0xc04bff],
  },
  van: {
    length: 5.3,
    width: 2.02,
    height: 2.14,
    minSpeed: 25,
    maxSpeed: 31,
    weight: 2,
    weaver: true,
    signalY: 1.15,
    variants: [0xe6e1d3, 0x4d90d0, 0xc46a3a],
  },
  bus: {
    length: 10.4,
    width: 2.5,
    height: 2.78,
    minSpeed: 19,
    maxSpeed: 24,
    weight: 1.1,
    weaver: false,
    variants: [0xe9bb3e, 0xd94d5f, 0x47a7b8],
  },
  truck: {
    length: 8.9,
    width: 2.45,
    height: 2.95,
    minSpeed: 20,
    maxSpeed: 27,
    weight: 1.6,
    weaver: false,
    variants: [0x4a8ec9, 0xc75b3f, 0x5cbf8f, 0xd6a83f],
  },
};

const GLASS = 0x0b1522;
const DARK = 0x0c0d12;
const TRIM = 0x252a36;
const TIRE = 0x08090c;
const CHROME = 0x788294;

const solidMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.52,
  metalness: 0.25,
  flatShading: true,
});

const glowMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  toneMapped: false,
});

const signalMaterial = new THREE.MeshBasicMaterial({
  color: 0xffb03a,
  toneMapped: false,
});

const signalGeometry = new THREE.BoxGeometry(0.18, 0.11, 0.22);

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function paint(geometry, color) {
  geometry.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(g, color);
}

function wheel(r, len, color, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, len, 10, 1);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return paint(g, color);
}

function merge(parts) {
  if (!parts.length) return null;
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// ---------------------------------------------------------------------------
// Traffic bodies. Every body returns { solid, glow } geometry part arrays.
// ---------------------------------------------------------------------------
function buildSedan(color) {
  const solid = [
    box(1.86, 0.52, 4.25, color, 0, 0.72, 0),
    box(1.62, 0.5, 2.05, GLASS, 0, 1.23, 0.12),
    box(1.54, 0.09, 1.86, color, 0, 1.51, 0.16),
    box(1.9, 0.22, 0.3, TRIM, 0, 0.5, -2.06),
    box(1.9, 0.22, 0.26, TRIM, 0, 0.5, 2.06),
    box(0.8, 0.16, 0.06, DARK, 0, 0.62, -2.13),
    box(0.15, 0.09, 0.16, color, -1.0, 1.17, -0.3),
    box(0.15, 0.09, 0.16, color, 1.0, 1.17, -0.3),
    box(0.16, 0.1, 0.2, DARK, -0.93, 0.98, 1.98),
    box(0.16, 0.1, 0.2, DARK, 0.93, 0.98, 1.98),
    wheel(0.34, 0.24, TIRE, -0.94, 0.35, -1.42),
    wheel(0.34, 0.24, TIRE, 0.94, 0.35, -1.42),
    wheel(0.34, 0.24, TIRE, -0.94, 0.35, 1.42),
    wheel(0.34, 0.24, TIRE, 0.94, 0.35, 1.42),
    wheel(0.17, 0.255, CHROME, -0.94, 0.35, -1.42),
    wheel(0.17, 0.255, CHROME, 0.94, 0.35, -1.42),
    wheel(0.17, 0.255, CHROME, 0.94, 0.35, 1.42),
    wheel(0.17, 0.255, CHROME, -0.94, 0.35, 1.42),
  ];
  const glow = [
    box(0.4, 0.13, 0.07, 0xfff0c2, -0.58, 0.79, -2.14),
    box(0.4, 0.13, 0.07, 0xfff0c2, 0.58, 0.79, -2.14),
    box(0.46, 0.13, 0.07, 0xff2f4d, -0.58, 0.8, 2.11),
    box(0.46, 0.13, 0.07, 0xff2f4d, 0.58, 0.8, 2.11),
  ];
  return { solid, glow };
}

function buildSport(color) {
  const solid = [
    box(1.9, 0.38, 4.2, color, 0, 0.55, 0),
    box(1.8, 0.22, 1.15, color, 0, 0.66, -1.85),
    box(1.48, 0.36, 1.72, GLASS, 0, 0.93, 0.2),
    box(1.44, 0.07, 1.52, color, 0, 1.14, 0.22),
    box(1.85, 0.16, 0.85, color, 0, 0.71, 1.72),
    box(1.9, 0.05, 0.42, DARK, 0, 1.12, 2.03),
    box(0.06, 0.26, 0.14, DARK, -0.72, 0.99, 2.02),
    box(0.06, 0.26, 0.14, DARK, 0.72, 0.99, 2.02),
    box(0.14, 0.08, 0.18, color, -0.99, 0.92, -0.35),
    box(0.14, 0.08, 0.18, color, 0.99, 0.92, -0.35),
    box(0.16, 0.09, 0.2, DARK, -0.94, 0.78, 1.96),
    box(0.16, 0.09, 0.2, DARK, 0.94, 0.78, 1.96),
    wheel(0.33, 0.25, TIRE, -0.93, 0.33, -1.4),
    wheel(0.33, 0.25, TIRE, 0.93, 0.33, -1.4),
    wheel(0.33, 0.25, TIRE, -0.93, 0.33, 1.4),
    wheel(0.33, 0.25, TIRE, 0.93, 0.33, 1.4),
    wheel(0.16, 0.265, CHROME, -0.93, 0.33, -1.4),
    wheel(0.16, 0.265, CHROME, 0.93, 0.33, 1.4),
  ];
  const glow = [
    box(0.032, 0.05, 2.5, 0xffd56b, -0.955, 0.55, 0.1),
    box(0.032, 0.05, 2.5, 0xffd56b, 0.955, 0.55, 0.1),
    box(0.36, 0.1, 0.06, 0xfff0c2, -0.56, 0.66, -2.41),
    box(0.36, 0.1, 0.06, 0xfff0c2, 0.56, 0.66, -2.41),
    box(1.25, 0.09, 0.06, 0xff2f4d, 0, 0.72, 2.2),
  ];
  return { solid, glow };
}

function buildVan(color) {
  const solid = [
    box(2.02, 1.3, 5.25, color, 0, 0.98, 0),
    box(1.94, 0.62, 4.9, color, 0, 1.75, 0.05),
    box(1.8, 0.5, 0.08, GLASS, 0, 1.74, -2.64),
    box(0.04, 0.45, 2.6, GLASS, -1.005, 1.74, -0.5),
    box(0.04, 0.45, 2.6, GLASS, 1.005, 1.74, -0.5),
    box(1.82, 0.07, 4.7, color, 0, 2.09, 0.05),
    box(2.08, 0.26, 5.15, TRIM, 0, 0.5, 0),
    box(2.06, 0.22, 0.28, TRIM, 0, 0.55, -2.67),
    box(2.06, 0.22, 0.26, TRIM, 0, 0.55, 2.67),
    box(1.9, 0.16, 0.06, DARK, 0, 0.94, -2.67),
    box(0.18, 0.1, 0.22, DARK, -1.01, 1.15, 2.56),
    box(0.18, 0.1, 0.22, DARK, 1.01, 1.15, 2.56),
    wheel(0.36, 0.26, TIRE, -1.03, 0.36, -1.7),
    wheel(0.36, 0.26, TIRE, 1.03, 0.36, -1.7),
    wheel(0.36, 0.26, TIRE, -1.03, 0.36, 1.7),
    wheel(0.36, 0.26, TIRE, 1.03, 0.36, 1.7),
    wheel(0.18, 0.275, CHROME, -1.03, 0.36, -1.7),
    wheel(0.18, 0.275, CHROME, 1.03, 0.36, 1.7),
  ];
  const glow = [
    box(0.42, 0.14, 0.07, 0xfff0c2, -0.66, 0.94, -2.7),
    box(0.42, 0.14, 0.07, 0xfff0c2, 0.66, 0.94, -2.7),
    box(0.36, 0.3, 0.07, 0xff2f4d, -0.8, 1.0, 2.69),
    box(0.36, 0.3, 0.07, 0xff2f4d, 0.8, 1.0, 2.69),
  ];
  return { solid, glow };
}

function buildBus(color) {
  const solid = [
    box(2.5, 2.3, 10.4, color, 0, 1.5, 0),
    box(2.54, 0.5, 10.3, TRIM, 0, 0.6, 0),
    box(2.54, 0.8, 8.5, GLASS, 0, 2.02, -0.15),
    box(2.28, 0.86, 0.08, GLASS, 0, 2.06, -5.23),
    box(2.42, 0.1, 10.2, color, 0, 2.73, 0),
    box(2.56, 0.18, 0.4, TRIM, 0, 0.55, -5.18),
    box(2.56, 0.18, 0.4, TRIM, 0, 0.55, 5.18),
    box(0.08, 0.16, 10.2, TRIM, -1.28, 0.9, 0),
    box(0.08, 0.16, 10.2, TRIM, 1.28, 0.9, 0),
    box(0.18, 0.1, 0.24, DARK, -1.24, 1.15, 5.0),
    box(0.18, 0.1, 0.24, DARK, 1.24, 1.15, 5.0),
    wheel(0.46, 0.3, TIRE, -1.16, 0.46, -3.5),
    wheel(0.46, 0.3, TIRE, 1.16, 0.46, -3.5),
    wheel(0.46, 0.3, TIRE, -1.16, 0.46, 3.15),
    wheel(0.46, 0.3, TIRE, 1.16, 0.46, 3.15),
    wheel(0.22, 0.315, CHROME, -1.16, 0.46, -3.5),
    wheel(0.22, 0.315, CHROME, 1.16, 0.46, 3.15),
  ];
  const glow = [
    box(0.5, 0.18, 0.08, 0xfff0c2, -0.82, 0.88, -5.24),
    box(0.5, 0.18, 0.08, 0xfff0c2, 0.82, 0.88, -5.24),
    box(1.4, 0.26, 0.08, 0xffc24a, 0, 2.58, -5.24),
    box(0.5, 0.32, 0.08, 0xff2f4d, -0.84, 1.15, 5.21),
    box(0.5, 0.32, 0.08, 0xff2f4d, 0.84, 1.15, 5.21),
    box(0.04, 0.04, 7.6, 0xffc24a, -1.27, 1.1, 0),
    box(0.04, 0.04, 7.6, 0xffc24a, 1.27, 1.1, 0),
  ];
  return { solid, glow };
}

function buildTruck(color) {
  const trailer = 0x30384b;
  const solid = [
    box(2.3, 1.8, 2.8, color, 0, 1.3, -3.1),
    box(2.45, 2.6, 6.2, trailer, 0, 1.85, 1.3),
    box(2.1, 0.35, 8.6, TRIM, 0, 0.55, 0),
    box(2.2, 0.62, 0.06, GLASS, 0, 1.82, -4.52),
    box(2.35, 0.24, 0.3, TRIM, 0, 0.55, -4.58),
    box(2.35, 0.24, 0.26, TRIM, 0, 0.55, 4.32),
    box(2.46, 0.5, 6.15, trailer, 0, 0.65, 1.3),
    box(0.18, 0.1, 0.24, DARK, -1.15, 1.1, 4.2),
    box(0.18, 0.1, 0.24, DARK, 1.15, 1.1, 4.2),
    box(0.5, 0.28, 0.06, DARK, 0, 2.9, 1.3),
    wheel(0.45, 0.3, TIRE, -1.1, 0.45, -3.2),
    wheel(0.45, 0.3, TIRE, 1.1, 0.45, -3.2),
    wheel(0.45, 0.3, TIRE, -1.1, 0.45, 1.9),
    wheel(0.45, 0.3, TIRE, 1.1, 0.45, 1.9),
    wheel(0.45, 0.3, TIRE, -1.1, 0.45, 3.1),
    wheel(0.45, 0.3, TIRE, 1.1, 0.45, 3.1),
    wheel(0.22, 0.315, CHROME, -1.1, 0.45, -3.2),
    wheel(0.22, 0.315, CHROME, 1.1, 0.45, 3.1),
  ];
  const glow = [
    box(0.44, 0.16, 0.08, 0xfff0c2, -0.76, 0.92, -4.55),
    box(0.44, 0.16, 0.08, 0xfff0c2, 0.76, 0.92, -4.55),
    box(0.44, 0.26, 0.08, 0xff2f4d, -0.86, 1.0, 4.35),
    box(0.44, 0.26, 0.08, 0xff2f4d, 0.86, 1.0, 4.35),
    box(0.04, 0.06, 5.6, 0xff8938, -1.24, 1.95, 1.3),
    box(0.04, 0.06, 5.6, 0xff8938, 1.24, 1.95, 1.3),
    box(0.8, 0.4, 0.06, 0xffc24a, 0, 2.55, -1.8),
  ];
  return { solid, glow };
}

const BUILDERS = {
  sedan: buildSedan,
  sport: buildSport,
  van: buildVan,
  bus: buildBus,
  truck: buildTruck,
};

const assetCache = new Map();

export function getTrafficAsset(type, variant) {
  const key = `${type}:${variant}`;
  let asset = assetCache.get(key);
  if (asset) return asset;

  const spec = TRAFFIC_TYPES[type];
  const color = spec.variants[variant % spec.variants.length];
  const built = BUILDERS[type](color);

  asset = {
    solid: merge(built.solid),
    glow: merge(built.glow),
    spec,
    type,
  };
  assetCache.set(key, asset);
  return asset;
}

export function warmupVehicles() {
  for (const type of Object.keys(TRAFFIC_TYPES)) {
    for (let i = 0; i < TRAFFIC_TYPES[type].variants.length; i++) {
      getTrafficAsset(type, i);
    }
  }
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------
export function createTrafficVehicle(type, variant) {
  const asset = getTrafficAsset(type, variant);
  const spec = asset.spec;
  const group = new THREE.Group();

  const body = new THREE.Mesh(asset.solid, solidMaterial);
  body.castShadow = true;
  body.receiveShadow = false;
  group.add(body);

  const glow = new THREE.Mesh(asset.glow, glowMaterial);
  group.add(glow);

  let signalL = null;
  let signalR = null;
  if (spec.weaver) {
    signalL = new THREE.Mesh(signalGeometry, signalMaterial);
    signalR = new THREE.Mesh(signalGeometry, signalMaterial);
    const y = spec.signalY;
    const z = spec.length / 2 - 0.28;
    signalL.position.set(-spec.width / 2 - 0.055, y, z);
    signalR.position.set(spec.width / 2 + 0.055, y, z);
    signalL.visible = false;
    signalR.visible = false;
    group.add(signalL, signalR);
  }

  return {
    group,
    body,
    glow,
    signalL,
    signalR,
    spec,
    type,
    halfWidth: spec.width / 2,
    halfLength: spec.length / 2,
  };
}

// ---------------------------------------------------------------------------
// Player cars
// ---------------------------------------------------------------------------
function buildPlayerCar(accent, accentBright, accentDark) {
  const solid = [
    box(1.98, 0.42, 4.5, accent, 0, 0.6, 0),
    box(2.03, 0.18, 4.15, accentDark, 0, 0.37, 0),
    box(1.82, 0.24, 1.15, accent, 0, 0.75, -1.9),
    box(1.56, 0.44, 1.92, GLASS, 0, 1.02, 0.05),
    box(1.48, 0.09, 1.62, accentDark, 0, 1.28, 0.1),
    box(1.9, 0.2, 0.95, accent, 0, 0.8, 1.8),
    box(2.0, 0.06, 0.45, DARK, 0, 1.22, 2.12),
    box(0.07, 0.3, 0.12, DARK, -0.72, 1.05, 2.1),
    box(0.07, 0.3, 0.12, DARK, 0.72, 1.05, 2.1),
    box(1.95, 0.07, 0.4, DARK, 0, 0.3, -2.28),
    box(1.6, 0.18, 0.18, DARK, 0, 0.62, 2.27),
    box(0.14, 0.08, 0.2, accent, -1.02, 1.02, -0.55),
    box(0.14, 0.08, 0.2, accent, 1.02, 1.02, -0.55),
    box(0.3, 0.02, 1.5, accentBright, 0, 0.815, -1.25),
    box(0.3, 0.02, 1.45, accentBright, 0, 1.332, 0.1),
    wheel(0.35, 0.28, TIRE, -0.95, 0.35, -1.48),
    wheel(0.35, 0.28, TIRE, 0.95, 0.35, -1.48),
    wheel(0.35, 0.28, TIRE, -0.95, 0.35, 1.48),
    wheel(0.35, 0.28, TIRE, 0.95, 0.35, 1.48),
    wheel(0.21, 0.29, DARK, -0.95, 0.35, 1.48),
    wheel(0.21, 0.29, DARK, 0.95, 0.35, 1.48),
  ];
  const glow = [
    box(0.035, 0.06, 3.0, accentBright, -0.995, 0.57, 0),
    box(0.035, 0.06, 3.0, accentBright, 0.995, 0.57, 0),
    box(0.5, 0.12, 0.06, 0xd9fbff, -0.55, 0.73, -2.31),
    box(0.5, 0.12, 0.06, 0xd9fbff, 0.55, 0.73, -2.31),
    box(1.7, 0.09, 0.06, 0xff2a55, 0, 0.83, 2.26),
    box(1.9, 0.035, 0.035, accentBright, 0, 1.26, 2.36),
    wheel(0.16, 0.305, accentBright, -0.95, 0.35, -1.48),
    wheel(0.16, 0.305, accentBright, 0.95, 0.35, -1.48),
    wheel(0.16, 0.305, accentBright, -0.95, 0.35, 1.48),
    wheel(0.16, 0.305, accentBright, 0.95, 0.35, 1.48),
  ];
  return { solid: merge(solid), glow: merge(glow) };
}

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function createPlayerCar(accent, accentBright, accentDark) {
  const group = new THREE.Group();
  const built = buildPlayerCar(accent, accentBright, accentDark);

  const body = new THREE.Mesh(built.solid, solidMaterial);
  body.castShadow = true;
  body.receiveShadow = false;
  group.add(body);

  const glow = new THREE.Mesh(built.glow, glowMaterial);
  group.add(glow);

  const underglowMaterial = new THREE.MeshBasicMaterial({
    map: getGlowTexture(),
    color: accentBright,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 7.2), underglowMaterial);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.025;
  group.add(underglow);

  return { group, body, glow, underglow };
}
