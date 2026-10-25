import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { VEHICLES, RIMS_BY_ID, DEFAULT_WRAP_ID, WRAPS_BY_ID } from "./data.js";

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function prepareGeometry(geometry) {
  geometry.deleteAttribute("uv");
  return geometry;
}

function box(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) {
    const matrix = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(rx, ry, rz)
    );
    geometry.applyMatrix4(matrix);
  }
  geometry.translate(x, y, z);
  return prepareGeometry(geometry);
}

function cylinder(
  radius,
  height,
  x = 0,
  y = 0,
  z = 0,
  axis = "y",
  segments = 12
) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1);
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  else if (axis === "z") geometry.rotateX(Math.PI / 2);
  geometry.translate(x, y, z);
  return prepareGeometry(geometry);
}

function sphere(radius, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 12) {
  const geometry = new THREE.SphereGeometry(radius, detail, Math.max(7, Math.floor(detail * 0.7)));
  geometry.scale(sx, sy, sz);
  geometry.translate(x, y, z);
  return prepareGeometry(geometry);
}

function add(parts, role, geometry) {
  if (!parts[role]) parts[role] = [];
  parts[role].push(geometry);
}

function emptyParts() {
  return {};
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
function createMaterials() {
  const primary = new THREE.MeshStandardMaterial({
    color: 0xc8d3e2,
    roughness: 0.28,
    metalness: 0.42,
    flatShading: true,
  });
  const secondary = new THREE.MeshStandardMaterial({
    color: 0x1b2331,
    roughness: 0.32,
    metalness: 0.38,
    flatShading: true,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x22e6ff,
    roughness: 0.35,
    metalness: 0.3,
    flatShading: true,
  });
  const accent2 = new THREE.MeshStandardMaterial({
    color: 0xff3d9a,
    roughness: 0.35,
    metalness: 0.3,
    flatShading: true,
  });

  return {
    primary,
    secondary,
    accent,
    accent2,
    accentGlow: new THREE.MeshBasicMaterial({ color: 0x22e6ff, toneMapped: false }),
    trim: new THREE.MeshStandardMaterial({
      color: 0x11151c,
      roughness: 0.62,
      metalness: 0.38,
      flatShading: true,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x09121c,
      roughness: 0.08,
      metalness: 0.9,
      flatShading: true,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xc7d0da,
      roughness: 0.18,
      metalness: 0.95,
      flatShading: true,
    }),
    headlight: new THREE.MeshBasicMaterial({ color: 0xfff2cf, toneMapped: false }),
    taillight: new THREE.MeshBasicMaterial({ color: 0xff2b45, toneMapped: false }),
    marker: new THREE.MeshBasicMaterial({ color: 0xffa229, toneMapped: false }),
    tire: new THREE.MeshStandardMaterial({
      color: 0x08090c,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    }),
    rimStock: new THREE.MeshStandardMaterial({
      color: 0xc6cfdb,
      roughness: 0.28,
      metalness: 0.82,
      flatShading: true,
    }),
    rimAero: new THREE.MeshStandardMaterial({
      color: 0x697789,
      roughness: 0.38,
      metalness: 0.7,
      flatShading: true,
    }),
    rimNeon: new THREE.MeshStandardMaterial({
      color: 0x121923,
      roughness: 0.35,
      metalness: 0.7,
      flatShading: true,
    }),
    rimGold: new THREE.MeshStandardMaterial({
      color: 0xf0c45c,
      roughness: 0.22,
      metalness: 0.9,
      flatShading: true,
    }),
    rimGlow: new THREE.MeshBasicMaterial({ color: 0x22e6ff, toneMapped: false }),
    bill: new THREE.MeshStandardMaterial({
      color: 0xff8c1a,
      roughness: 0.45,
      metalness: 0.05,
      flatShading: true,
    }),
    eye: new THREE.MeshBasicMaterial({ color: 0xf9f5e8, toneMapped: false }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x0b0b0e }),
    skin: new THREE.MeshStandardMaterial({
      color: 0x9c6b50,
      roughness: 0.75,
      metalness: 0.02,
      flatShading: true,
    }),
    suit: new THREE.MeshStandardMaterial({
      color: 0x202a39,
      roughness: 0.72,
      metalness: 0.12,
      flatShading: true,
    }),
    shoe: new THREE.MeshStandardMaterial({
      color: 0x0b0d12,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: true,
    }),
  };
}

const ROLE_MATERIAL = {
  primary: "primary",
  secondary: "secondary",
  accent: "accent",
  accent2: "accent2",
  accentGlow: "accentGlow",
  glow: "accentGlow",
  trim: "trim",
  glass: "glass",
  chrome: "chrome",
  headlight: "headlight",
  taillight: "taillight",
  marker: "marker",
  bill: "bill",
  eye: "eye",
  pupil: "pupil",
  skin: "skin",
  suit: "suit",
  shoe: "shoe",
};

// ---------------------------------------------------------------------------
// Wheel construction
// ---------------------------------------------------------------------------
function spokeGeometry(radius, width, count, colorMaterial) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI;
    const spoke = new THREE.BoxGeometry(width * 0.52, radius * 0.13, radius * 1.7);
    spoke.rotateX(angle);
    parts.push(prepareGeometry(spoke));
  }
  const barrel = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width * 0.95, 12);
  barrel.rotateZ(Math.PI / 2);
  parts.push(prepareGeometry(barrel));
  const hub = new THREE.CylinderGeometry(radius * 0.14, radius * 0.14, width * 1.08, 8);
  hub.rotateZ(Math.PI / 2);
  parts.push(prepareGeometry(hub));
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return { geometry: merged, material: colorMaterial };
}

function createWheel({ radius, width, x, z, y = radius, name }, materials) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.name = name || "wheel";

  const tireGeometry = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeometry.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeometry, materials.tire);
  tire.castShadow = true;
  tire.receiveShadow = true;
  group.add(tire);

  const variants = {};

  const stock = new THREE.Group();
  stock.add(new THREE.Mesh(spokeGeometry(radius, width, 3, null).geometry, materials.rimStock));
  variants.stock = stock;

  const aero = new THREE.Group();
  const aeroGeo = new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, width * 1.01, 16);
  aeroGeo.rotateZ(Math.PI / 2);
  aero.add(new THREE.Mesh(aeroGeo, materials.rimAero));
  variants.aero = aero;

  const neon = new THREE.Group();
  neon.add(new THREE.Mesh(spokeGeometry(radius, width, 3, null).geometry, materials.rimNeon));
  const glowGeo = new THREE.TorusGeometry(radius * 0.7, Math.max(0.02, radius * 0.035), 5, 18);
  glowGeo.rotateY(Math.PI / 2);
  const glow = new THREE.Mesh(glowGeo, materials.rimGlow);
  glow.name = "rimGlow";
  neon.add(glow);
  variants.neon = neon;

  const gold = new THREE.Group();
  gold.add(new THREE.Mesh(spokeGeometry(radius, width, 4, null).geometry, materials.rimGold));
  variants.gold = gold;

  for (const [style, variant] of Object.entries(variants)) {
    variant.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    variant.visible = style === "stock";
    group.add(variant);
  }

  return { group, radius, variants };
}

// ---------------------------------------------------------------------------
// Livery overlays
// ---------------------------------------------------------------------------
function patternBox(parts, role, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  add(parts, role, box(w, h, d, x, y, z, rx, ry, rz));
}

function buildPatternParts(anchors) {
  const {
    length,
    width,
    side,
    topY,
    bodyY,
    hoodY,
    hoodZ,
    roofZ = 0,
  } = anchors;
  const patterns = {
    stripe: { accent: [], accent2: [], glow: [] },
    geometric: { accent: [], accent2: [], glow: [] },
    retro: { accent: [], accent2: [], glow: [] },
    theme: { accent: [], accent2: [], glow: [] },
  };

  const s = side + 0.008;
  const top = topY + 0.012;
  const hood = hoodY + 0.016;

  // Racing stripes
  patternBox(patterns.stripe, "accent", 0.28, 0.014, length * 0.62, 0, top, roofZ);
  patternBox(patterns.stripe, "accent2", 0.075, 0.015, length * 0.62, 0.24, top + 0.001, roofZ);
  patternBox(patterns.stripe, "accent", 0.015, 0.07, length * 0.64, -s, bodyY, 0);
  patternBox(patterns.stripe, "accent", 0.015, 0.07, length * 0.64, s, bodyY, 0);
  patternBox(patterns.stripe, "accent2", 0.33, 0.016, length * 0.2, 0, hood, hoodZ);

  // Geometric panels
  patternBox(patterns.geometric, "accent", 0.018, 0.3, length * 0.18, -s, bodyY + 0.08, -length * 0.16, 0.35);
  patternBox(patterns.geometric, "accent2", 0.018, 0.2, length * 0.23, -s, bodyY - 0.02, length * 0.15, -0.35);
  patternBox(patterns.geometric, "accent2", 0.018, 0.3, length * 0.18, s, bodyY + 0.08, -length * 0.16, -0.35);
  patternBox(patterns.geometric, "accent", 0.018, 0.2, length * 0.23, s, bodyY - 0.02, length * 0.15, 0.35);
  patternBox(patterns.geometric, "accent", width * 0.65, 0.016, length * 0.2, 0, top + 0.002, roofZ + length * 0.02, 0, 0.18);
  patternBox(patterns.geometric, "accent2", width * 0.2, 0.018, length * 0.22, width * 0.2, top + 0.004, roofZ - length * 0.18, 0, -0.2);

  // Retro blade
  patternBox(patterns.retro, "accent", 0.02, 0.18, length * 0.68, -s, bodyY + 0.03, 0);
  patternBox(patterns.retro, "accent", 0.02, 0.18, length * 0.68, s, bodyY + 0.03, 0);
  patternBox(patterns.retro, "accent2", 0.02, 0.035, length * 0.68, -s - 0.002, bodyY + 0.16, 0);
  patternBox(patterns.retro, "accent2", 0.02, 0.035, length * 0.68, s + 0.002, bodyY + 0.16, 0);
  patternBox(patterns.retro, "accent2", width * 0.6, 0.016, length * 0.15, 0, hood, hoodZ);
  patternBox(patterns.retro, "accent", width * 0.32, 0.018, length * 0.22, 0, top + 0.003, roofZ);

  // Themed slashes and light edges
  patternBox(patterns.theme, "accent", 0.022, 0.16, length * 0.23, -s, bodyY + 0.1, -length * 0.12, 0.55);
  patternBox(patterns.theme, "accent2", 0.022, 0.12, length * 0.26, -s, bodyY - 0.03, length * 0.06, -0.4);
  patternBox(patterns.theme, "accent2", 0.022, 0.16, length * 0.23, s, bodyY + 0.1, -length * 0.12, -0.55);
  patternBox(patterns.theme, "accent", 0.022, 0.12, length * 0.26, s, bodyY - 0.03, length * 0.06, 0.4);
  patternBox(patterns.theme, "accent", 0.022, 0.04, length * 0.7, -s - 0.002, bodyY + 0.2, 0);
  patternBox(patterns.theme, "accent", 0.022, 0.04, length * 0.7, s + 0.002, bodyY + 0.2, 0);
  patternBox(patterns.theme, "accent2", width * 0.52, 0.018, length * 0.16, 0, hood, hoodZ);
  patternBox(patterns.theme, "glow", 0.03, 0.02, length * 0.3, -s - 0.006, bodyY + 0.02, length * 0.16);
  patternBox(patterns.theme, "glow", 0.03, 0.02, length * 0.3, s + 0.006, bodyY + 0.02, length * 0.16);

  return patterns;
}

function mergeRoleParts(parts, materials, patterns = false) {
  const group = new THREE.Group();
  for (const [role, geometries] of Object.entries(parts)) {
    if (!geometries || !geometries.length) continue;
    const geometry = mergeGeometries(geometries, false);
    for (const part of geometries) part.dispose();
    if (!geometry) continue;
    const materialKey = ROLE_MATERIAL[role] || "trim";
    const mesh = new THREE.Mesh(geometry, materials[materialKey]);
    mesh.castShadow = ![
      "headlight",
      "taillight",
      "marker",
      "eye",
      "pupil",
      "glass",
    ].includes(role);
    mesh.receiveShadow = ["primary", "secondary"].includes(role);
    mesh.name = role;
    group.add(mesh);
  }
  return group;
}

// ---------------------------------------------------------------------------
// Individual vehicle builders
// ---------------------------------------------------------------------------
function buildSupercar(parts, anchors) {
  add(parts, "primary", box(1.98, 0.42, 4.5, 0, 0.62, 0));
  add(parts, "primary", box(1.84, 0.23, 1.12, 0, 0.79, -1.9));
  add(parts, "primary", box(1.9, 0.2, 0.95, 0, 0.82, 1.8));
  add(parts, "secondary", box(2.04, 0.17, 4.16, 0, 0.43, 0));
  add(parts, "secondary", box(1.48, 0.085, 1.62, 0, 1.3, 0.1));
  add(parts, "glass", box(1.56, 0.45, 1.92, 0, 1.02, 0.05));
  add(parts, "trim", box(1.96, 0.07, 0.42, 0, 0.31, -2.28));
  add(parts, "trim", box(1.6, 0.18, 0.2, 0, 0.61, 2.26));
  add(parts, "trim", box(2, 0.06, 0.46, 0, 1.25, 2.13));
  add(parts, "trim", box(0.07, 0.28, 0.12, -0.72, 1.06, 2.11));
  add(parts, "trim", box(0.07, 0.28, 0.12, 0.72, 1.06, 2.11));
  add(parts, "trim", box(0.08, 0.17, 2.2, -0.995, 0.51, 0.12));
  add(parts, "trim", box(0.08, 0.17, 2.2, 0.995, 0.51, 0.12));
  add(parts, "accent", box(0.15, 0.08, 0.2, -1.03, 1.01, -0.55));
  add(parts, "accent", box(0.15, 0.08, 0.2, 1.03, 1.01, -0.55));
  add(parts, "chrome", cylinder(0.075, 0.22, -0.56, 0.45, 2.22, "z"));
  add(parts, "chrome", cylinder(0.075, 0.22, 0.56, 0.45, 2.22, "z"));
  add(parts, "headlight", box(0.5, 0.11, 0.055, -0.56, 0.77, -2.29));
  add(parts, "headlight", box(0.5, 0.11, 0.055, 0.56, 0.77, -2.29));
  add(parts, "taillight", box(1.65, 0.09, 0.055, 0, 0.85, 2.28));
  anchors.length = 4.5;
  anchors.width = 2.02;
  anchors.side = 1.015;
  anchors.topY = 1.34;
  anchors.bodyY = 0.64;
  anchors.hoodY = 0.81;
  anchors.hoodZ = -1.4;
  anchors.roofZ = 0.08;
  return [
    { x: -0.96, z: -1.48, radius: 0.36, width: 0.3, name: "frontL" },
    { x: 0.96, z: -1.48, radius: 0.36, width: 0.3, name: "frontR" },
    { x: -0.96, z: 1.48, radius: 0.36, width: 0.3, name: "rearL" },
    { x: 0.96, z: 1.48, radius: 0.36, width: 0.3, name: "rearR" },
  ];
}

function buildMotorcycle(parts, anchors) {
  add(parts, "trim", box(0.17, 0.16, 1.65, 0, 0.62, 0));
  add(parts, "trim", box(0.1, 0.1, 0.75, 0, 0.42, 0.52));
  add(parts, "primary", sphere(0.34, 0, 0.91, -0.06, 0.72, 0.5, 0.9, 10));
  add(parts, "primary", box(0.48, 0.34, 0.52, 0, 1.03, -0.62));
  add(parts, "primary", box(0.36, 0.19, 0.48, 0, 0.9, 0.68));
  add(parts, "secondary", box(0.36, 0.09, 0.58, 0, 1.01, 0.4));
  add(parts, "secondary", box(0.24, 0.07, 0.48, 0, 1.08, -0.16));
  add(parts, "glass", box(0.28, 0.2, 0.08, 0, 1.16, -0.92, -0.25));
  add(parts, "trim", box(0.05, 0.92, 0.05, -0.14, 0.7, -1.03));
  add(parts, "trim", box(0.05, 0.92, 0.05, 0.14, 0.7, -1.03));
  add(parts, "trim", box(0.68, 0.05, 0.06, 0, 1.27, -0.73));
  add(parts, "trim", box(0.06, 0.2, 0.06, -0.28, 1.18, -0.73));
  add(parts, "trim", box(0.06, 0.2, 0.06, 0.28, 1.18, -0.73));
  add(parts, "chrome", box(0.2, 0.05, 0.08, 0, 0.55, -0.3));
  add(parts, "chrome", cylinder(0.055, 0.9, 0.22, 0.48, 0.45, "z"));
  add(parts, "chrome", cylinder(0.055, 0.9, -0.22, 0.48, -0.2, "z"));
  add(parts, "headlight", cylinder(0.14, 0.06, 0, 1.06, -0.9, "z"));
  add(parts, "taillight", box(0.16, 0.07, 0.04, 0, 0.96, 0.91));
  add(parts, "accent", box(0.52, 0.025, 0.055, 0, 1.17, -0.63));
  add(parts, "accent", box(0.025, 0.035, 0.6, -0.28, 0.88, 0.02));
  add(parts, "accent", box(0.025, 0.035, 0.6, 0.28, 0.88, 0.02));

  // Rider
  add(parts, "suit", box(0.38, 0.52, 0.32, 0, 1.43, 0.12, -0.24));
  add(parts, "suit", box(0.34, 0.17, 0.3, 0, 1.13, 0.24));
  add(parts, "suit", box(0.12, 0.42, 0.12, -0.2, 1.19, -0.22, -0.65));
  add(parts, "suit", box(0.12, 0.42, 0.12, 0.2, 1.19, -0.22, -0.65));
  add(parts, "suit", box(0.13, 0.5, 0.13, -0.22, 0.8, 0.24, 0.85));
  add(parts, "suit", box(0.13, 0.5, 0.13, 0.22, 0.8, 0.24, 0.85));
  add(parts, "shoe", box(0.12, 0.1, 0.28, -0.22, 0.55, 0.38));
  add(parts, "shoe", box(0.12, 0.1, 0.28, 0.22, 0.55, 0.38));
  add(parts, "skin", box(0.11, 0.1, 0.12, -0.26, 1.16, -0.5));
  add(parts, "skin", box(0.11, 0.1, 0.12, 0.26, 1.16, -0.5));
  add(parts, "secondary", sphere(0.23, 0, 1.76, 0.02, 0.95, 1.05, 1.08, 12));
  add(parts, "glass", box(0.28, 0.13, 0.08, 0, 1.75, -0.2));
  add(parts, "accent", box(0.03, 0.06, 0.32, 0, 1.98, 0.02));

  anchors.length = 2.35;
  anchors.width = 0.66;
  anchors.side = 0.3;
  anchors.topY = 1.02;
  anchors.bodyY = 0.8;
  anchors.hoodY = 0.97;
  anchors.hoodZ = -0.45;
  anchors.roofZ = 0.25;
  return [
    { x: 0, z: -1.28, radius: 0.34, width: 0.16, name: "front" },
    { x: 0, z: 1.05, radius: 0.34, width: 0.18, name: "rear" },
  ];
}

function buildTruck(parts, anchors) {
  add(parts, "primary", box(2.34, 1.86, 2.9, 0, 1.45, -3.15));
  add(parts, "primary", box(2.2, 0.5, 1.0, 0, 2.65, -2.95));
  add(parts, "secondary", box(2.5, 2.7, 6.2, 0, 2.0, 1.3));
  add(parts, "secondary", box(2.46, 0.25, 6.24, 0, 3.42, 1.3));
  add(parts, "trim", box(2.12, 0.36, 8.5, 0, 0.56, 0));
  add(parts, "trim", box(2.42, 0.28, 0.32, 0, 0.56, -4.62));
  add(parts, "trim", box(2.42, 0.28, 0.3, 0, 0.56, 4.43));
  add(parts, "trim", box(0.08, 0.32, 6.2, -1.25, 0.82, 1.3));
  add(parts, "trim", box(0.08, 0.32, 6.2, 1.25, 0.82, 1.3));
  add(parts, "glass", box(2.26, 0.68, 0.06, 0, 2.03, -4.61));
  add(parts, "glass", box(0.06, 0.5, 0.9, -1.18, 1.95, -3.15));
  add(parts, "glass", box(0.06, 0.5, 0.9, 1.18, 1.95, -3.15));
  add(parts, "chrome", box(1.7, 0.4, 0.08, 0, 1.0, -4.62));
  add(parts, "chrome", cylinder(0.09, 0.8, -0.96, 0.7, -2.45, "z"));
  add(parts, "chrome", cylinder(0.09, 0.8, 0.96, 0.7, -2.45, "z"));
  add(parts, "chrome", cylinder(0.34, 1.3, -1.05, 0.55, 0.0, "z"));
  add(parts, "chrome", cylinder(0.34, 1.3, 1.05, 0.55, 0.0, "z"));
  add(parts, "accent", box(0.04, 1.8, 6.0, -1.255, 2.15, 1.3));
  add(parts, "accent", box(0.04, 1.8, 6.0, 1.255, 2.15, 1.3));
  add(parts, "headlight", box(0.5, 0.2, 0.06, -0.78, 0.9, -4.64));
  add(parts, "headlight", box(0.5, 0.2, 0.06, 0.78, 0.9, -4.64));
  add(parts, "taillight", box(0.4, 0.18, 0.05, -0.9, 0.85, 4.45));
  add(parts, "taillight", box(0.4, 0.18, 0.05, 0.9, 0.85, 4.45));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add(parts, "marker", box(0.15, 0.08, 0.04, side * 0.86, 3.46, 0.1 + i * 0.9));
    }
  }
  anchors.length = 8.8;
  anchors.width = 2.56;
  anchors.side = 1.29;
  anchors.topY = 3.45;
  anchors.bodyY = 1.65;
  anchors.hoodY = 2.68;
  anchors.hoodZ = -3.0;
  anchors.roofZ = 1.3;
  return [
    { x: -1.12, z: -3.25, radius: 0.48, width: 0.34, name: "frontL" },
    { x: 1.12, z: -3.25, radius: 0.48, width: 0.34, name: "frontR" },
    { x: -1.12, z: 1.85, radius: 0.48, width: 0.34, name: "midL" },
    { x: 1.12, z: 1.85, radius: 0.48, width: 0.34, name: "midR" },
    { x: -1.12, z: 3.15, radius: 0.48, width: 0.34, name: "rearL" },
    { x: 1.12, z: 3.15, radius: 0.48, width: 0.34, name: "rearR" },
  ];
}

function buildDuck(parts, anchors) {
  add(parts, "primary", sphere(0.98, 0, 0.78, 0.05, 1.06, 0.56, 1.55, 16));
  add(parts, "secondary", sphere(0.82, 0, 0.55, 0.12, 0.94, 0.34, 1.36, 14));
  add(parts, "primary", sphere(0.5, 0, 1.34, -0.58, 0.92, 0.95, 0.9, 14));
  add(parts, "primary", cylinder(0.27, 0.5, 0, 1.08, -0.42, "y", 10));
  add(parts, "glass", box(1.14, 0.38, 0.9, 0, 0.98, 0.35));
  add(parts, "secondary", box(1.38, 0.1, 0.5, 0, 1.19, 1.45));
  add(parts, "secondary", box(0.8, 0.1, 0.35, 0, 1.06, 1.63, 0.35));
  add(parts, "primary", box(0.3, 0.35, 0.3, -0.65, 1.34, 1.35));
  add(parts, "primary", box(0.3, 0.35, 0.3, 0.65, 1.34, 1.35));
  add(parts, "secondary", box(0.16, 0.5, 0.62, -0.93, 0.9, 0.05, 0.1));
  add(parts, "secondary", box(0.16, 0.5, 0.62, 0.93, 0.9, 0.05, 0.1));
  add(parts, "bill", sphere(0.3, 0, 1.29, -1.01, 1.25, 0.42, 0.7, 10));
  add(parts, "bill", box(0.42, 0.09, 0.36, 0, 1.22, -1.08));
  add(parts, "eye", sphere(0.13, -0.22, 1.48, -0.86, 0.9, 1.15, 0.6, 10));
  add(parts, "eye", sphere(0.13, 0.22, 1.48, -0.86, 0.9, 1.15, 0.6, 10));
  add(parts, "pupil", sphere(0.055, -0.24, 1.48, -0.96, 1, 1.2, 0.65, 8));
  add(parts, "pupil", sphere(0.055, 0.24, 1.48, -0.96, 1, 1.2, 0.65, 8));
  add(parts, "accent", box(1.84, 0.1, 0.3, 0, 0.56, -1.5));
  add(parts, "accent", box(1.45, 0.08, 0.24, 0, 0.6, 1.64));
  add(parts, "trim", box(1.9, 0.12, 0.34, 0, 0.38, -1.6));
  add(parts, "headlight", box(0.28, 0.14, 0.06, -0.6, 0.67, -1.54));
  add(parts, "headlight", box(0.28, 0.14, 0.06, 0.6, 0.67, -1.54));
  add(parts, "taillight", box(0.32, 0.12, 0.05, -0.55, 0.7, 1.62));
  add(parts, "taillight", box(0.32, 0.12, 0.05, 0.55, 0.7, 1.62));
  anchors.length = 3.4;
  anchors.width = 2.0;
  anchors.side = 0.99;
  anchors.topY = 1.15;
  anchors.bodyY = 0.72;
  anchors.hoodY = 1.08;
  anchors.hoodZ = -1.05;
  anchors.roofZ = 0.2;
  return [
    { x: -0.8, z: -1.18, radius: 0.32, width: 0.26, name: "frontL" },
    { x: 0.8, z: -1.18, radius: 0.32, width: 0.26, name: "frontR" },
    { x: -0.8, z: 1.2, radius: 0.32, width: 0.26, name: "rearL" },
    { x: 0.8, z: 1.2, radius: 0.32, width: 0.26, name: "rearR" },
  ];
}

function buildWheelchair(parts, anchors) {
  add(parts, "primary", box(0.07, 0.08, 1.25, -0.46, 0.53, -0.04));
  add(parts, "primary", box(0.07, 0.08, 1.25, 0.46, 0.53, -0.04));
  add(parts, "primary", box(0.74, 0.07, 0.8, 0, 0.64, 0.05));
  add(parts, "primary", box(0.06, 0.72, 0.07, -0.48, 0.98, 0.42));
  add(parts, "primary", box(0.06, 0.72, 0.07, 0.48, 0.98, 0.42));
  add(parts, "primary", box(0.72, 0.06, 0.06, 0, 1.32, 0.42));
  add(parts, "secondary", box(0.66, 0.1, 0.62, 0, 0.7, 0.08));
  add(parts, "secondary", box(0.62, 0.52, 0.09, 0, 1.04, 0.43));
  add(parts, "trim", box(0.3, 0.28, 0.26, 0, 0.56, 0.6));
  add(parts, "trim", box(0.5, 0.35, 0.06, 0, 1.0, 0.71));
  add(parts, "trim", box(0.12, 0.06, 0.78, -0.46, 0.22, -0.42));
  add(parts, "trim", box(0.12, 0.06, 0.78, 0.46, 0.22, -0.42));
  add(parts, "trim", box(0.9, 0.06, 0.16, 0, 0.23, -0.79));
  add(parts, "accent", box(0.1, 0.04, 1.2, -0.47, 0.59, -0.02));
  add(parts, "accent", box(0.1, 0.04, 1.2, 0.47, 0.59, -0.02));
  add(parts, "accent", box(0.03, 0.18, 0.8, -0.49, 0.95, 0.05));
  add(parts, "accent", box(0.03, 0.18, 0.8, 0.49, 0.95, 0.05));
  add(parts, "accent", cylinder(0.09, 0.04, 0.53, 0.82, 0.42, "x"));
  add(parts, "marker", box(0.18, 0.035, 0.03, 0.5, 1.22, 0.4));
  add(parts, "taillight", box(0.2, 0.05, 0.03, 0, 0.54, 0.78));

  // Driver: seated, safety helmet, hands forward on the controls.
  add(parts, "suit", box(0.42, 0.5, 0.28, 0, 1.1, 0.25, -0.08));
  add(parts, "suit", box(0.36, 0.18, 0.45, 0, 0.86, 0.02));
  add(parts, "suit", box(0.14, 0.16, 0.5, -0.17, 0.76, -0.35));
  add(parts, "suit", box(0.14, 0.16, 0.5, 0.17, 0.76, -0.35));
  add(parts, "suit", box(0.12, 0.38, 0.1, -0.18, 1.17, -0.16, -0.75));
  add(parts, "suit", box(0.12, 0.38, 0.1, 0.18, 1.17, -0.16, -0.75));
  add(parts, "shoe", box(0.16, 0.14, 0.32, -0.17, 0.5, -0.58));
  add(parts, "shoe", box(0.16, 0.14, 0.32, 0.17, 0.5, -0.58));
  add(parts, "skin", sphere(0.16, 0, 1.49, 0.24, 1, 1, 0.92, 10));
  add(parts, "secondary", sphere(0.2, 0, 1.53, 0.24, 1.05, 1.05, 0.95, 12));
  add(parts, "glass", box(0.3, 0.09, 0.05, 0, 1.52, 0.07));
  add(parts, "skin", sphere(0.055, -0.2, 1.02, -0.52, 1, 1, 1, 8));
  add(parts, "skin", sphere(0.055, 0.2, 1.02, -0.52, 1, 1, 1, 8));
  add(parts, "trim", box(0.08, 0.07, 0.36, 0.53, 0.88, 0.38));
  add(parts, "accent", box(0.035, 0.035, 0.2, 0.53, 0.92, 0.28));
  add(parts, "accentGlow", box(0.03, 0.03, 0.3, 0, 1.3, 0.42));

  anchors.length = 1.8;
  anchors.width = 1.2;
  anchors.side = 0.52;
  anchors.topY = 0.92;
  anchors.bodyY = 0.66;
  anchors.hoodY = 0.78;
  anchors.hoodZ = -0.3;
  anchors.roofZ = 0.2;
  return [
    { x: -0.58, z: 0.08, radius: 0.48, width: 0.11, name: "rearL" },
    { x: 0.58, z: 0.08, radius: 0.48, width: 0.11, name: "rearR" },
    { x: -0.3, z: -0.72, radius: 0.15, width: 0.08, name: "frontL" },
    { x: 0.3, z: -0.72, radius: 0.15, width: 0.08, name: "frontR" },
  ];
}

const BUILDERS = {
  supercar: buildSupercar,
  motorcycle: buildMotorcycle,
  truck: buildTruck,
  duck: buildDuck,
  wheelchair: buildWheelchair,
};

// ---------------------------------------------------------------------------
// Fallback under-car glow
// ---------------------------------------------------------------------------
let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.3)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------
export function createPlayerVehicle(vehicleId, wrapInput, rimId = "stock") {
  const def = VEHICLES[vehicleId] || VEHICLES.supercar;
  const wrap = wrapInput || WRAPS_BY_ID[DEFAULT_WRAP_ID];
  const materials = createMaterials();
  const parts = emptyParts();
  const anchors = {};
  const wheelDefs = BUILDERS[def.id](parts, anchors);
  const group = new THREE.Group();
  group.name = `player-${def.id}`;

  const body = mergeRoleParts(parts, materials);
  group.add(body);

  const patternParts = buildPatternParts(anchors);
  const patternGroups = {};
  for (const [patternName, roles] of Object.entries(patternParts)) {
    const patternGroup = mergeRoleParts(roles, materials, true);
    patternGroup.visible = false;
    patternGroup.name = `livery-${patternName}`;
    group.add(patternGroup);
    patternGroups[patternName] = patternGroup;
  }

  const wheels = wheelDefs.map((wheel) => {
    const built = createWheel(wheel, materials);
    group.add(built.group);
    return built;
  });

  const underglowMaterial = new THREE.MeshBasicMaterial({
    map: getGlowTexture(),
    color: wrap.colors?.accent || "#22e6ff",
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry((anchors.width || 2) * 1.35, (anchors.length || 4) * 1.4),
    underglowMaterial
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.02;
  group.add(underglow);

  const paintMaterials = [
    materials.primary,
    materials.secondary,
    materials.accent,
    materials.accent2,
  ];

  let currentWrap = null;
  let hueOffset = 0;

  const applyFinish = (finish) => {
    let roughness = 0.3;
    let metalness = 0.4;
    if (finish === "metallic") {
      roughness = 0.16;
      metalness = 0.82;
    } else if (finish === "matte") {
      roughness = 0.72;
      metalness = 0.14;
    } else if (finish === "iridescent") {
      roughness = 0.13;
      metalness = 0.92;
    } else if (finish === "gloss") {
      roughness = 0.25;
      metalness = 0.42;
    }
    for (const material of paintMaterials) {
      material.roughness = roughness;
      material.metalness = metalness;
      material.needsUpdate = true;
    }
  };

  const model = {
    group,
    vehicleId: def.id,
    spec: def,
    materials,
    wheels,
    wheelRadius: wheelDefs[0]?.radius || 0.35,
    anchors,
    patternGroups,
    underglow,
    currentWrap: wrap,
    rimId,
    setWrap(nextWrap) {
      const active = nextWrap || WRAPS_BY_ID[DEFAULT_WRAP_ID];
      currentWrap = active;
      hueOffset = 0;
      const colors = active.colors || def.fallbackColors;
      materials.primary.color.set(colors.primary);
      materials.secondary.color.set(colors.secondary);
      materials.accent.color.set(colors.accent);
      materials.accent2.color.set(colors.accent2);
      materials.accentGlow.color.set(colors.accent);
      materials.rimGlow.color.set(colors.accent);
      underglowMaterial.color.set(colors.accent);
      underglowMaterial.opacity = active.rarity === "mythic" || active.animated ? 0.42 : 0.23;
      applyFinish(active.finish);
      for (const [name, patternGroup] of Object.entries(patternGroups)) {
        patternGroup.visible = name === active.pattern;
      }
      this.currentWrap = active;
    },
    setRim(nextRimId) {
      const rim = RIMS_BY_ID[nextRimId] ? nextRimId : "stock";
      rimId = rim;
      this.rimId = rim;
      for (const wheel of wheels) {
        for (const [style, variant] of Object.entries(wheel.variants)) {
          variant.visible = style === rim;
        }
      }
    },
    update(time, dt = 0) {
      if (currentWrap?.animated) {
        hueOffset += dt * 0.16;
        const primary = new THREE.Color(currentWrap.colors.primary);
        const accent = new THREE.Color(currentWrap.colors.accent);
        primary.offsetHSL(Math.sin(hueOffset) * 0.18 + hueOffset * 0.02, 0.1, 0);
        accent.offsetHSL(Math.sin(hueOffset + 1.7) * 0.2, 0.05, 0);
        materials.primary.color.copy(primary);
        materials.accent.color.copy(accent);
        materials.accentGlow.color.copy(accent);
        underglowMaterial.color.copy(accent);
      }
    },
    setUnderglowIntensity(value) {
      underglowMaterial.opacity = Math.max(0, Math.min(1, value));
    },
    dispose() {
      group.removeFromParent();
      const geometries = new Set();
      const uniqueMaterials = new Set();
      group.traverse((child) => {
        if (child.geometry) geometries.add(child.geometry);
        if (child.material) uniqueMaterials.add(child.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of uniqueMaterials) material.dispose();
      // The glow texture is shared by every car and intentionally kept alive.
    },
  };

  model.setRim(rimId);
  model.setWrap(wrap);
  return model;
}
