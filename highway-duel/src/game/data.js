import { START_CREDITS } from "./config.js";

const mph = (metresPerSecond) => Math.round(metresPerSecond * 2.236936);

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
export const VEHICLE_ORDER = ["motorcycle", "supercar", "truck", "duck", "wheelchair"];

export const VEHICLES = {
  motorcycle: {
    id: "motorcycle",
    name: "APEX 900",
    category: "MOTORCYCLE",
    subtitle: "LIGHTWEIGHT · AGILE",
    price: 900,
    blurb:
      "A featherweight sport bike built for slicing through traffic. The quickest feet in the garage, with the smallest footprint and the most to lose.",
    perk: "Near-miss bonuses +25%",
    physics: {
      maxSpeed: 84,
      accel: 25,
      brake: 36,
      coastDrag: 2.2,
      speedDrag: 0.045,
      lateralBase: 8.2,
      lateralGain: 4.6,
      steerResponse: 11,
      halfWidth: 0.54,
      halfLength: 1.25,
      crashKeep: 0.26,
      invulnSeconds: 1.1,
      earnMultiplier: 1.02,
      nearMissMultiplier: 1.25,
    },
    camera: { back: 7.6, height: 3.35, lookAhead: 25, fov: 68, lean: 0.075 },
    stats: {
      topSpeed: mph(84),
      acceleration: 9.5,
      handling: 10,
      braking: 8,
      weight: 2,
    },
    fallbackColors: { primary: "#dfe8f2", secondary: "#151b26", accent: "#22e6ff", accent2: "#ff3d9a" },
  },
  supercar: {
    id: "supercar",
    name: "VANTAGE GT",
    category: "SUPERCAR",
    subtitle: "BALANCED · FAST",
    price: 0,
    blurb:
      "A road-going apex hunter with a broad power band and planted chassis. Fast everywhere, forgiving enough to learn the highway on.",
    perk: "Balanced performance",
    physics: {
      maxSpeed: 78,
      accel: 23,
      brake: 43,
      coastDrag: 2,
      speedDrag: 0.05,
      lateralBase: 5.4,
      lateralGain: 4.5,
      steerResponse: 8.4,
      halfWidth: 0.98,
      halfLength: 2.2,
      crashKeep: 0.3,
      invulnSeconds: 1.25,
      earnMultiplier: 1,
      nearMissMultiplier: 1,
    },
    camera: { back: 11.8, height: 4.95, lookAhead: 27, fov: 67, lean: 0.012 },
    stats: {
      topSpeed: mph(78),
      acceleration: 8.6,
      handling: 8,
      braking: 9.5,
      weight: 5,
    },
    fallbackColors: { primary: "#d7dee9", secondary: "#1b2533", accent: "#22e6ff", accent2: "#ff3d9a" },
  },
  truck: {
    id: "truck",
    name: "HAULER 44",
    category: "TRUCK",
    subtitle: "HEAVY · STEADY",
    price: 2100,
    blurb:
      "Three axles, a long nose and no interest in subtlety. It takes a while to get moving and even longer to stop, but it shrugs off contact and earns a working vehicle's wage.",
    perk: "Collisions slow you less · +12% distance pay",
    physics: {
      maxSpeed: 50,
      accel: 11,
      brake: 24,
      coastDrag: 2.5,
      speedDrag: 0.036,
      lateralBase: 3.3,
      lateralGain: 2.3,
      steerResponse: 4.4,
      halfWidth: 1.36,
      halfLength: 4.34,
      crashKeep: 0.5,
      invulnSeconds: 1.4,
      earnMultiplier: 1.12,
      nearMissMultiplier: 0.9,
    },
    camera: { back: 18.2, height: 7.6, lookAhead: 35, fov: 64, lean: 0.006 },
    stats: {
      topSpeed: mph(50),
      acceleration: 3.8,
      handling: 3.2,
      braking: 4.6,
      weight: 10,
    },
    fallbackColors: { primary: "#3d6d9d", secondary: "#161d27", accent: "#ffad4d", accent2: "#d6e3ec" },
  },
  duck: {
    id: "duck",
    name: "QUACKER",
    category: "DUCK CAR",
    subtitle: "SILLY · SURPRISINGLY QUICK",
    price: 1300,
    blurb:
      "An affectionate little hatchback with a very large duck on the roof. Underneath the nonsense is a competent chassis and a driver who refuses to be overtaken by a truck.",
    perk: "Near-miss bonuses +10% · +6% distance pay",
    physics: {
      maxSpeed: 65,
      accel: 19,
      brake: 32,
      coastDrag: 2.1,
      speedDrag: 0.046,
      lateralBase: 5.8,
      lateralGain: 4.1,
      steerResponse: 8.6,
      halfWidth: 1.02,
      halfLength: 2.05,
      crashKeep: 0.34,
      invulnSeconds: 1.2,
      earnMultiplier: 1.06,
      nearMissMultiplier: 1.1,
    },
    camera: { back: 10.6, height: 4.35, lookAhead: 25, fov: 68, lean: 0.02 },
    stats: {
      topSpeed: mph(65),
      acceleration: 7.4,
      handling: 7,
      braking: 7.2,
      weight: 4,
    },
    fallbackColors: { primary: "#ffd23f", secondary: "#f5f0e0", accent: "#ff7a1a", accent2: "#4cc9d8" },
  },
  wheelchair: {
    id: "wheelchair",
    name: "APEX RACER",
    category: "WHEELCHAIR RACER",
    subtitle: "PRECISE · LOW PROFILE",
    price: 1700,
    blurb:
      "A purpose-built motorized racing wheelchair: lightweight frame, big rear wheels, fingertip controls and a low centre of gravity. Tiny target, huge heart.",
    perk: "Near-miss bonuses +20% · +8% distance pay",
    physics: {
      maxSpeed: 60,
      accel: 22,
      brake: 35,
      coastDrag: 2,
      speedDrag: 0.048,
      lateralBase: 7.1,
      lateralGain: 4.9,
      steerResponse: 10.4,
      halfWidth: 0.66,
      halfLength: 1.4,
      crashKeep: 0.28,
      invulnSeconds: 1.15,
      earnMultiplier: 1.08,
      nearMissMultiplier: 1.2,
    },
    camera: { back: 8.2, height: 3.2, lookAhead: 22, fov: 69, lean: 0.03 },
    stats: {
      topSpeed: mph(60),
      acceleration: 8.8,
      handling: 9.4,
      braking: 8.4,
      weight: 3,
    },
    fallbackColors: { primary: "#f3f4f6", secondary: "#151a24", accent: "#ffad4d", accent2: "#22e6ff" },
  },
};

// ---------------------------------------------------------------------------
// Wraps
// ---------------------------------------------------------------------------
export const RARITIES = {
  common: { label: "COMMON", color: "#aab4c4", refund: 25, order: 0 },
  uncommon: { label: "UNCOMMON", color: "#4bd88f", refund: 60, order: 1 },
  rare: { label: "RARE", color: "#48a9ff", refund: 120, order: 2 },
  epic: { label: "EPIC", color: "#b17cff", refund: 220, order: 3 },
  legendary: { label: "LEGENDARY", color: "#ffb53d", refund: 400, order: 4 },
  mythic: { label: "MYTHIC", color: "#ff4d9d", refund: 800, order: 5 },
};

export const WRAPS = [
  {
    id: "factory",
    name: "Factory Silver",
    rarity: "common",
    price: 0,
    caseOnly: false,
    pattern: "solid",
    finish: "gloss",
    colors: { primary: "#c8d3e2", secondary: "#1b2331", accent: "#22e6ff", accent2: "#ff3d9a" },
    description: "Clean factory silver with a cool cyan detail line.",
  },
  {
    id: "cobalt",
    name: "Cobalt Club",
    rarity: "common",
    price: 70,
    caseOnly: false,
    pattern: "solid",
    finish: "gloss",
    colors: { primary: "#2858c9", secondary: "#0b1730", accent: "#7fdcff", accent2: "#ffd166" },
    description: "Deep competition blue. A classic for a reason.",
  },
  {
    id: "ember",
    name: "Ember",
    rarity: "common",
    price: 70,
    caseOnly: false,
    pattern: "solid",
    finish: "gloss",
    colors: { primary: "#d9512d", secondary: "#2a120d", accent: "#ffd166", accent2: "#fff1d0" },
    description: "Warm burnt orange that reads clearly in any light.",
  },
  {
    id: "forestpaint",
    name: "Forest Green",
    rarity: "common",
    price: 80,
    caseOnly: false,
    pattern: "solid",
    finish: "matte",
    colors: { primary: "#27644e", secondary: "#0c211a", accent: "#d7ff7a", accent2: "#f4efe0" },
    description: "A quiet matte green with a sharp lime pinstripe.",
  },
  {
    id: "ivory",
    name: "Ivory",
    rarity: "common",
    price: 80,
    caseOnly: false,
    pattern: "solid",
    finish: "gloss",
    colors: { primary: "#e8e1d2", secondary: "#302d28", accent: "#ff5a3c", accent2: "#2d3a4e" },
    description: "Warm off-white with a tomato-red accent.",
  },
  {
    id: "blackout",
    name: "Blackout",
    rarity: "uncommon",
    price: 130,
    caseOnly: false,
    pattern: "solid",
    finish: "metallic",
    colors: { primary: "#161b24", secondary: "#080b10", accent: "#22e6ff", accent2: "#ff3d9a" },
    description: "Satin black with a cold metallic flake and neon edge.",
  },
  {
    id: "splitway",
    name: "Split Decision",
    rarity: "uncommon",
    price: 160,
    caseOnly: false,
    pattern: "twoTone",
    finish: "gloss",
    colors: { primary: "#f0b43a", secondary: "#192231", accent: "#ff5a3c", accent2: "#f5efe0" },
    description: "Two-tone amber and charcoal with a bright cut line.",
  },
  {
    id: "nightshift",
    name: "Night Shift",
    rarity: "uncommon",
    price: 170,
    caseOnly: false,
    pattern: "twoTone",
    finish: "metallic",
    colors: { primary: "#5b4bff", secondary: "#0b0d18", accent: "#ff3d9a", accent2: "#22e6ff" },
    description: "Midnight violet over black, with magenta signal strips.",
  },
  {
    id: "rustline",
    name: "Rust Line",
    rarity: "uncommon",
    price: 140,
    caseOnly: false,
    pattern: "stripe",
    finish: "matte",
    colors: { primary: "#8a5a3c", secondary: "#2c1a12", accent: "#e0c7a1", accent2: "#ffad4d" },
    description: "Weathered brown with pale hand-painted stripes.",
  },
  {
    id: "trackline",
    name: "Trackline",
    rarity: "rare",
    price: 260,
    caseOnly: false,
    pattern: "stripe",
    finish: "gloss",
    colors: { primary: "#f2ede1", secondary: "#1b2230", accent: "#ff3d5e", accent2: "#222a3a" },
    description: "White body, twin racing stripes and a red nose accent.",
  },
  {
    id: "carbonedge",
    name: "Carbon Edge",
    rarity: "rare",
    price: 280,
    caseOnly: false,
    pattern: "stripe",
    finish: "matte",
    colors: { primary: "#252a33", secondary: "#101319", accent: "#c8ff3d", accent2: "#6e7b8d" },
    description: "Graphite panels with an acid-green centre stripe.",
  },
  {
    id: "gridlock",
    name: "Gridlock",
    rarity: "rare",
    price: 320,
    caseOnly: false,
    pattern: "geometric",
    finish: "gloss",
    colors: { primary: "#1a2b4d", secondary: "#0a1020", accent: "#ff3d9a", accent2: "#22e6ff" },
    description: "Navy geometric panels cut with pink and cyan light.",
  },
  {
    id: "digitaldune",
    name: "Digital Dune",
    rarity: "rare",
    price: 330,
    caseOnly: false,
    pattern: "geometric",
    finish: "matte",
    colors: { primary: "#d9a441", secondary: "#2a1d12", accent: "#28e6c0", accent2: "#f8e7c2" },
    description: "Desert sand with glitched mint blocks.",
  },
  {
    id: "midnightflare",
    name: "Midnight Flare",
    rarity: "rare",
    price: null,
    caseOnly: true,
    pattern: "theme",
    finish: "metallic",
    colors: { primary: "#0b1020", secondary: "#05070d", accent: "#ff8a2a", accent2: "#ff3d6e" },
    description: "Case exclusive. Black metal with a burning orange flare.",
  },
  {
    id: "outrun87",
    name: "Outrun '87",
    rarity: "epic",
    price: 480,
    caseOnly: false,
    pattern: "retro",
    finish: "gloss",
    colors: { primary: "#f7f2ff", secondary: "#1a1030", accent: "#ff3d9a", accent2: "#2ce8ff" },
    description: "White wedge, magenta blade and cyan horizon lines.",
  },
  {
    id: "sunsetcruiser",
    name: "Sunset Cruiser",
    rarity: "epic",
    price: 500,
    caseOnly: false,
    pattern: "retro",
    finish: "metallic",
    colors: { primary: "#ffcf86", secondary: "#4a1832", accent: "#ff6a4a", accent2: "#ffd166" },
    description: "Warm peach over deep plum. Pure coastal evening.",
  },
  {
    id: "duckfeathers",
    name: "Duck Feathers",
    rarity: "epic",
    price: null,
    caseOnly: true,
    pattern: "theme",
    finish: "gloss",
    colors: { primary: "#ffd93b", secondary: "#f6f1de", accent: "#ff7a00", accent2: "#7fe7ff" },
    description: "Case exclusive. Feather-white panels and a bright bill-orange wing.",
  },
  {
    id: "chromeliquid",
    name: "Liquid Chrome",
    rarity: "legendary",
    price: 700,
    caseOnly: false,
    pattern: "solid",
    finish: "metallic",
    colors: { primary: "#b9cadc", secondary: "#28313d", accent: "#8ff4ff", accent2: "#ff3d9a" },
    description: "Liquid mirror finish with an icy reflection line.",
  },
  {
    id: "goldrush",
    name: "Gold Rush",
    rarity: "legendary",
    price: 750,
    caseOnly: false,
    pattern: "stripe",
    finish: "metallic",
    colors: { primary: "#d7a43b", secondary: "#2b1d07", accent: "#fff2a8", accent2: "#ff8a2a" },
    description: "Deep gold with cream pinstripes and a warm edge.",
  },
  {
    id: "neonronin",
    name: "Neon Ronin",
    rarity: "legendary",
    price: null,
    caseOnly: true,
    pattern: "theme",
    finish: "metallic",
    colors: { primary: "#101018", secondary: "#07070b", accent: "#ff2f8e", accent2: "#22e6ff" },
    description: "Case exclusive. Ink-black armour with duelling neon blades.",
  },
  {
    id: "prism",
    name: "Prism Protocol",
    rarity: "mythic",
    price: null,
    caseOnly: true,
    pattern: "theme",
    finish: "iridescent",
    colors: { primary: "#e8e8ff", secondary: "#141426", accent: "#ff5cf6", accent2: "#63f7ff" },
    description: "Case exclusive. A shifting iridescent shell that refuses to sit still.",
    animated: true,
  },
];

export const WRAPS_BY_ID = Object.fromEntries(WRAPS.map((wrap) => [wrap.id, wrap]));
export const WRAP_GROUPS = Object.keys(RARITIES).map((rarity) => ({
  rarity,
  ...RARITIES[rarity],
  wraps: WRAPS.filter((wrap) => wrap.rarity === rarity),
}));
export const DEFAULT_WRAP_ID = "factory";

// ---------------------------------------------------------------------------
// Rims
// ---------------------------------------------------------------------------
export const RIMS = [
  {
    id: "stock",
    name: "Factory Alloy",
    price: 0,
    style: "stock",
    color: "#c6cfdb",
    glow: false,
    description: "The wheels it left the factory on.",
  },
  {
    id: "aero",
    name: "Aero Disc",
    price: 180,
    style: "aero",
    color: "#697789",
    glow: false,
    description: "Smooth covers for a calmer wheel face.",
  },
  {
    id: "neon",
    name: "Neon Halo",
    price: 420,
    style: "neon",
    color: "#22e6ff",
    glow: true,
    description: "A ring of cold light around every rim.",
  },
  {
    id: "gold",
    name: "Gold Split",
    price: 560,
    style: "split",
    color: "#f0c45c",
    glow: false,
    description: "Forged split spokes in warm gold.",
  },
];
export const RIMS_BY_ID = Object.fromEntries(RIMS.map((rim) => [rim.id, rim]));

// ---------------------------------------------------------------------------
// Cases. Percentages shown to the player are the same values used to roll.
// ---------------------------------------------------------------------------
export const CASES = [
  {
    id: "street",
    name: "Street Crate",
    price: 150,
    accent: "#e88a3c",
    tag: "STANDARD",
    blurb: "Everyday paint and hardware from the boulevard. A cheap way to grow the collection.",
    odds: { common: 55, uncommon: 27, rare: 12, epic: 4, legendary: 1.8, mythic: 0.2 },
  },
  {
    id: "neon",
    name: "Neon Crate",
    price: 320,
    accent: "#79c7bd",
    tag: "STREET SERIES",
    blurb: "Loud, brighter, rarer. Better odds at the upper end of the spectrum.",
    odds: { common: 35, uncommon: 30, rare: 20, epic: 9, legendary: 4, mythic: 2 },
  },
  {
    id: "gold",
    name: "Gold Crate",
    price: 650,
    accent: "#f0c36a",
    tag: "PREMIUM",
    blurb: "The serious collector's crate. High risk to your wallet, best chance at a mythic.",
    odds: { common: 15, uncommon: 25, rare: 25, epic: 20, legendary: 10, mythic: 5 },
  },
];
export const CASES_BY_ID = Object.fromEntries(CASES.map((entry) => [entry.id, entry]));

export function wrapsOfRarity(rarity) {
  return WRAPS.filter((wrap) => wrap.rarity === rarity);
}

export function caseOddsTable(caseDef) {
  return Object.keys(RARITIES).map((rarity) => {
    const chance = caseDef.odds[rarity] || 0;
    const items = wrapsOfRarity(rarity);
    return {
      rarity,
      ...RARITIES[rarity],
      chance,
      items,
      itemChance: items.length ? chance / items.length : 0,
    };
  });
}

function weightedRarity(odds, random) {
  const roll = random() * 100;
  let cursor = 0;
  for (const rarity of Object.keys(RARITIES)) {
    cursor += odds[rarity] || 0;
    if (roll < cursor) return rarity;
  }
  return "common";
}

export function rollCase(caseDef, random = Math.random) {
  const rarity = weightedRarity(caseDef.odds, random);
  const pool = wrapsOfRarity(rarity);
  return pool[Math.floor(random() * pool.length)] || WRAPS_BY_ID[DEFAULT_WRAP_ID];
}

export function buildReel(caseDef, winner, length = 32, random = Math.random) {
  const pool = WRAPS.filter((wrap) => caseDef.odds[wrap.rarity] > 0);
  const items = [];
  for (let i = 0; i < length; i++) {
    items.push(pool[Math.floor(random() * pool.length)]);
  }
  // Keep the winner deep enough into the reel for a proper spin, with a few
  // tiles still visible to its right once the needle settles.
  const winnerIndex = Math.max(8, length - 8);
  items[winnerIndex] = winner;
  return { items, winnerIndex };
}

// ---------------------------------------------------------------------------
// Environments and time
// ---------------------------------------------------------------------------
export const ENVIRONMENTS = [
  {
    id: "city",
    name: "NEON CITY",
    subtitle: "MODERN CITY HIGHWAY",
    accent: "#22e6ff",
    skyline: "Elevated roads cut between glass towers, billboards and sodium lamps.",
    background: "linear-gradient(145deg, #0a0d1c 0%, #18273f 52%, #3a1939 100%)",
  },
  {
    id: "country",
    name: "COUNTRY HIGHWAY",
    subtitle: "OPEN FARMLAND",
    accent: "#ffcf6a",
    skyline: "Long fields, fence lines, barns and slow wind turbines under a broad sky.",
    background: "linear-gradient(145deg, #0a1712 0%, #1d382d 55%, #716039 100%)",
  },
  {
    id: "desert",
    name: "DESERT HIGHWAY",
    subtitle: "SUN-BAKED MESAS",
    accent: "#ff9b52",
    skyline: "Saguaro, red rock and heat haze with power lines running to the horizon.",
    background: "linear-gradient(145deg, #1b0f11 0%, #46251b 52%, #a55c2e 100%)",
  },
  {
    id: "mountain",
    name: "MOUNTAIN PASS",
    subtitle: "ALPINE HIGHWAY",
    accent: "#9fd8ff",
    skyline: "Snow-capped ridges, cold pine forest and stone barriers above the valley.",
    background: "linear-gradient(145deg, #070d18 0%, #1c3045 52%, #667a8c 100%)",
  },
  {
    id: "forest",
    name: "FOREST ROAD",
    subtitle: "CLOSED CANOPY",
    accent: "#8fe36d",
    skyline: "Dense pine, mossy verges and lantern-lit cabins tucked into the trees.",
    background: "linear-gradient(145deg, #06110d 0%, #132a20 52%, #3f5a30 100%)",
  },
];
export const ENVIRONMENTS_BY_ID = Object.fromEntries(ENVIRONMENTS.map((env) => [env.id, env]));
export const ENV_ORDER = ENVIRONMENTS.map((env) => env.id);

export const TIMES = [
  {
    id: "morning",
    name: "MORNING",
    subtitle: "CLEAR LIGHT, LONG SHADOWS",
    clock: "07:30",
    t: 0.31,
    accent: "#ffd0a1",
  },
  {
    id: "afternoon",
    name: "AFTERNOON",
    subtitle: "HARD LIGHT, HIGH VISIBILITY",
    clock: "14:00",
    t: 0.58,
    accent: "#bfe6ff",
  },
  {
    id: "sunset",
    name: "SUNSET",
    subtitle: "WARM HAZE, NEON STARTS TO BLOOM",
    clock: "19:10",
    t: 0.8,
    accent: "#ff7d5c",
  },
  {
    id: "night",
    name: "NIGHT",
    subtitle: "HEADLIGHTS AND ROADSIDE GLOW",
    clock: "23:00",
    t: 0.96,
    accent: "#8fa9ff",
  },
  {
    id: "auto",
    name: "24H AUTO",
    subtitle: "A FULL DAY IN FOUR MINUTES",
    clock: "08:00",
    t: 0.34,
    accent: "#ffcf6a",
  },
];
export const TIMES_BY_ID = Object.fromEntries(TIMES.map((time) => [time.id, time]));
export const TIME_ORDER = TIMES.map((time) => time.id);

// ---------------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------------
export const SAVE_KEY = "highway-traffic.save.v1";
export const SAVE_VERSION = 1;

export function createDefaultSave() {
  const equippedWrap = {};
  for (const id of VEHICLE_ORDER) equippedWrap[id] = DEFAULT_WRAP_ID;
  return {
    version: SAVE_VERSION,
    credits: START_CREDITS,
    totalMiles: 0,
    lifetimeEarned: 0,
    bestDistanceMiles: 0,
    bestRunCredits: 0,
    runs: 0,
    casesOpened: 0,
    selectedVehicle: "supercar",
    ownedVehicles: ["supercar"],
    ownedWraps: [DEFAULT_WRAP_ID],
    equippedWrap,
    ownedRims: ["stock"],
    equippedRim: "stock",
    environment: "city",
    timeOfDay: "sunset",
    autoCycle: false,
    lifetime: { overtakes: 0, nearMisses: 0, crashes: 0 },
    lastRun: null,
    audio: { master: 0.45, music: 0.24, sfx: 0.55, muted: false },
  };
}

function asNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeSave(raw) {
  const base = createDefaultSave();
  if (!raw || typeof raw !== "object") return base;

  const save = { ...base };
  save.credits = Math.floor(asNumber(raw.credits, base.credits, 0));
  save.totalMiles = asNumber(raw.totalMiles, 0, 0);
  save.lifetimeEarned = Math.floor(asNumber(raw.lifetimeEarned, 0, 0));
  save.bestDistanceMiles = asNumber(raw.bestDistanceMiles, 0, 0);
  save.bestRunCredits = Math.floor(asNumber(raw.bestRunCredits, 0, 0));
  save.runs = Math.floor(asNumber(raw.runs, 0, 0));
  save.casesOpened = Math.floor(asNumber(raw.casesOpened, 0, 0));
  save.autoCycle = !!raw.autoCycle;

  const ownedVehicles = Array.isArray(raw.ownedVehicles)
    ? raw.ownedVehicles.filter((id) => VEHICLES[id])
    : [];
  if (!ownedVehicles.includes("supercar")) ownedVehicles.push("supercar");
  save.ownedVehicles = [...new Set(ownedVehicles)];

  save.selectedVehicle = VEHICLES[raw.selectedVehicle]
    ? raw.selectedVehicle
    : "supercar";
  if (!save.ownedVehicles.includes(save.selectedVehicle)) {
    save.selectedVehicle = "supercar";
  }

  save.ownedWraps = Array.isArray(raw.ownedWraps)
    ? raw.ownedWraps.filter((id) => WRAPS_BY_ID[id])
    : [];
  if (!save.ownedWraps.includes(DEFAULT_WRAP_ID)) save.ownedWraps.push(DEFAULT_WRAP_ID);
  save.ownedWraps = [...new Set(save.ownedWraps)];

  save.equippedWrap = {};
  for (const vehicleId of VEHICLE_ORDER) {
    const requested = raw?.equippedWrap?.[vehicleId];
    save.equippedWrap[vehicleId] =
      requested && save.ownedWraps.includes(requested) ? requested : DEFAULT_WRAP_ID;
  }

  save.ownedRims = Array.isArray(raw.ownedRims)
    ? raw.ownedRims.filter((id) => RIMS_BY_ID[id])
    : [];
  if (!save.ownedRims.includes("stock")) save.ownedRims.push("stock");
  save.ownedRims = [...new Set(save.ownedRims)];
  save.equippedRim =
    raw.equippedRim && save.ownedRims.includes(raw.equippedRim)
      ? raw.equippedRim
      : "stock";

  save.environment = ENVIRONMENTS_BY_ID[raw.environment] ? raw.environment : "city";
  save.timeOfDay = TIMES_BY_ID[raw.timeOfDay] ? raw.timeOfDay : "sunset";
  save.autoCycle = save.timeOfDay === "auto" ? true : save.autoCycle;

  save.lifetime = {
    overtakes: Math.floor(asNumber(raw?.lifetime?.overtakes, 0, 0)),
    nearMisses: Math.floor(asNumber(raw?.lifetime?.nearMisses, 0, 0)),
    crashes: Math.floor(asNumber(raw?.lifetime?.crashes, 0, 0)),
  };

  save.lastRun =
    raw.lastRun && typeof raw.lastRun === "object" ? raw.lastRun : null;

  save.audio = {
    master: asNumber(raw?.audio?.master, base.audio.master, 0, 1),
    music: asNumber(raw?.audio?.music, base.audio.music, 0, 1),
    sfx: asNumber(raw?.audio?.sfx, base.audio.sfx, 0, 1),
    muted: !!raw?.audio?.muted,
  };

  return save;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();
    return normalizeSave(JSON.parse(raw));
  } catch {
    return createDefaultSave();
  }
}

export function persistSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------
export function metresToMiles(metres) {
  return metres / 1609.344;
}

export function formatMiles(metres, decimals = 2) {
  return metresToMiles(metres).toFixed(decimals);
}

export function formatCredits(amount) {
  return Math.max(0, Math.floor(amount)).toLocaleString("en-US");
}

export function rarityRank(rarity) {
  return RARITIES[rarity]?.order ?? 0;
}

export function getEquippedWrap(save, vehicleId = save.selectedVehicle) {
  const wrapId = save.equippedWrap?.[vehicleId] || DEFAULT_WRAP_ID;
  return WRAPS_BY_ID[wrapId] || WRAPS_BY_ID[DEFAULT_WRAP_ID];
}

export function getRim(rimId) {
  return RIMS_BY_ID[rimId] || RIMS_BY_ID.stock;
}

export function wrapOwned(save, wrapId) {
  return save.ownedWraps.includes(wrapId);
}

export function vehicleOwned(save, vehicleId) {
  return save.ownedVehicles.includes(vehicleId);
}

export function rimOwned(save, rimId) {
  return save.ownedRims.includes(rimId);
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
