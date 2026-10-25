import "./styles.css";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import * as THREE from "three";
import { GameAudio } from "./game/audio.js";
import { DrivingWorld } from "./game/drivingWorld.js";
import { Showroom } from "./game/showroom.js";
import {
  VEHICLES,
  VEHICLE_ORDER,
  WRAPS,
  WRAPS_BY_ID,
  WRAP_GROUPS,
  RARITIES,
  RIMS,
  RIMS_BY_ID,
  CASES,
  CASES_BY_ID,
  ENVIRONMENTS,
  ENVIRONMENTS_BY_ID,
  TIMES,
  TIMES_BY_ID,
  DEFAULT_WRAP_ID,
  loadSave,
  persistSave,
  formatCredits,
  caseOddsTable,
  rollCase,
  buildReel,
  vehicleOwned,
  wrapOwned,
  rimOwned,
  getEquippedWrap,
} from "./game/data.js";
import { RUN_SECONDS } from "./game/config.js";
import { MenuArt, drawSceneryThumb, drawVehicleBadge, paintLogo } from "./ui/pixelArt.js";
import { hydrateIcons } from "./ui/icons.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const save = loadSave();
const audio = new GameAudio(save.audio);
const showroom = new Showroom($("#showroom-canvas"));
showroom.setActive(false);
const driveCanvas = $("#drive-canvas");
const menuArt = new MenuArt($("#menu-art"));
const pageArt = new MenuArt($("#page-art"));
pageArt.setActive(false);
paintLogo($("#menu-logo"));
hydrateIcons();

const state = {
  view: "menu",
  driving: false,
  paused: false,
  finishing: false,
  world: null,
  previewVehicle: save.selectedVehicle,
  previewWrapId: getEquippedWrap(save, save.selectedVehicle).id,
  previewRimId: save.equippedRim,
  selectedCase: "street",
  caseOpening: false,
  caseTimers: [],
  caseSpin: 0,
  lastResult: null,
  audioLoading: false,
  hudTimer: 0,
  lastFrame: performance.now(),
  keys: new Set(),
};

let driveRenderer = null;
let toastTimer = null;
let countdownTimeout = null;
let pausedFromBlur = false;

const pageNames = ["menu", "garage", "customize", "cases", "scenery", "stats", "settings", "credits"];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[character];
  });
}

function miles(value) {
  return Number(value || 0).toFixed(2);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function percent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function rarityStyle(rarity) {
  return RARITIES[rarity]?.color || "#aab4c4";
}

function wrapStyle(wrap) {
  const colors = wrap.colors;
  return `--rarity-color:${rarityStyle(wrap.rarity)};--wrap-primary:${colors.primary};--wrap-secondary:${colors.secondary};--wrap-accent:${colors.accent};--wrap-accent2:${colors.accent2};`;
}

function equippedWrapFor(vehicleId) {
  const id = save.equippedWrap?.[vehicleId] || DEFAULT_WRAP_ID;
  return WRAPS_BY_ID[id] || WRAPS_BY_ID[DEFAULT_WRAP_ID];
}

// Locked machines are shown in their signature paint rather than the
// factory silver every car would otherwise share in the showroom.
function displayWrapFor(vehicleId) {
  if (vehicleOwned(save, vehicleId)) return equippedWrapFor(vehicleId);
  const vehicle = VEHICLES[vehicleId] || VEHICLES.supercar;
  return {
    ...WRAPS_BY_ID[DEFAULT_WRAP_ID],
    id: `signature-${vehicleId}`,
    name: "Signature paint",
    colors: vehicle.fallbackColors,
  };
}

// ---------------------------------------------------------------------------
// Wallet / shared UI
// ---------------------------------------------------------------------------
function updateWallet() {
  $$('[data-credits]').forEach((element) => {
    element.textContent = formatCredits(save.credits);
  });
}

function syncMuteUI() {
  const muted = !!save.audio.muted;
  const soundLabel = muted ? "SOUND OFF" : "SOUND ON";
  const audioButton = $("#audio-mute");
  if (audioButton) {
    audioButton.textContent = soundLabel;
    audioButton.classList.toggle("is-on", !muted);
    audioButton.classList.toggle("is-off", muted);
    audioButton.setAttribute("aria-pressed", String(!muted));
  }
  const pauseMute = $("#pause-mute");
  if (pauseMute) pauseMute.textContent = soundLabel;
  const hudMute = $("#hud-mute");
  if (hudMute) {
    hudMute.classList.toggle("is-muted", muted);
    hudMute.setAttribute("aria-label", muted ? "Unmute audio" : "Mute audio");
    hudMute.setAttribute("title", muted ? "Unmute (M)" : "Mute (M)");
  }
}

function updateMenuSummary() {
  const vehicle = VEHICLES[save.selectedVehicle] || VEHICLES.supercar;
  const wrap = equippedWrapFor(save.selectedVehicle);
  const environment = ENVIRONMENTS_BY_ID[save.environment] || ENVIRONMENTS_BY_ID.city;
  const time = TIMES_BY_ID[save.timeOfDay] || TIMES_BY_ID.sunset;
  $("#menu-vehicle-name").textContent = vehicle.name;
  $("#menu-vehicle-category").textContent = vehicle.category;
  $("#menu-total-miles").textContent = miles(save.totalMiles);
  $("#menu-current-wrap").textContent = wrap.name.toUpperCase();
  $("#menu-environment").textContent = environment.name;
  $("#menu-time").textContent = time.name;
}

function showToast(title, detail = "", error = false) {
  const toast = $("#toast");
  $("#toast-title").textContent = title;
  $("#toast-detail").textContent = detail;
  toast.classList.toggle("is-error", error);
  toast.classList.remove("is-hidden");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.add("is-hidden");
  }, 2800);
}

function showHudToast(title, detail, kind = "") {
  const feed = $("#hud-feed");
  if (!feed) return;
  const item = document.createElement("div");
  item.className = `hud-toast ${kind}`.trim();
  const bold = document.createElement("b");
  bold.textContent = title;
  const span = document.createElement("span");
  span.textContent = detail;
  item.append(bold, span);
  feed.appendChild(item);
  while (feed.children.length > 3) feed.removeChild(feed.firstElementChild);
  window.setTimeout(() => item.remove(), 1600);
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
async function ensureAudio() {
  if (state.audioLoading) return;
  if (audio.ready) {
    if (audio.ctx?.state === "suspended") {
      try {
        await audio.ctx.resume();
      } catch {
        /* user gesture needed */
      }
    }
    if (!state.driving) {
      audio.setMode("menu");
      audio.startMusic();
    }
    return;
  }
  state.audioLoading = true;
  const ready = await audio.init();
  state.audioLoading = false;
  if (!ready) return;
  audio.setSettings(save.audio);
  if (state.driving) {
    activateDriveAudio();
  } else {
    audio.setMode("menu");
    audio.startMusic();
  }
  syncMuteUI();
}

function activateDriveAudio() {
  if (!audio.ready) {
    ensureAudio();
    return;
  }
  audio.setMode("drive");
  audio.startEngine(save.selectedVehicle);
  audio.startAmbience(save.environment, save.timeOfDay);
  audio.updateEngine(0, false, false);
  syncMuteUI();
}

function toggleMute() {
  save.audio.muted = !save.audio.muted;
  persistSave(save);
  audio.setSettings(save.audio);
  syncMuteUI();
  if (!save.audio.muted) {
    ensureAudio();
    audio.uiClick();
  }
  renderAudioSettings();
}

// ---------------------------------------------------------------------------
// Screen management
// ---------------------------------------------------------------------------
function hideAllPages() {
  for (const name of pageNames) {
    $(`#screen-${name}`)?.classList.add("is-hidden");
  }
}

function showPage(name) {
  hideAllPages();
  $(`#screen-${name}`).classList.remove("is-hidden");
  const screen = $(`#screen-${name}`);
  screen.scrollTop = 0;
  driveCanvas.classList.add("is-hidden");
  state.view = name;
  showroom.setActive(false);
  menuArt.setActive(name === "menu");
  pageArt.setActive(name !== "menu");
  $("#page-art").classList.toggle("is-hidden", name === "menu");
  hydrateIcons(screen);
}

function openPage(name) {
  if (state.driving || state.finishing) return;
  $("#screen-results").classList.add("is-hidden");
  $("#screen-pause").classList.add("is-hidden");
  $("#hud").classList.add("is-hidden");
  showPage(name);

  if (name === "garage") {
    state.previewVehicle = save.selectedVehicle;
    state.previewWrapId = equippedWrapFor(save.selectedVehicle).id;
    state.previewRimId = save.equippedRim;
    setupShowroom("garage-stage");
    renderGarage();
    setShowroomVehicle();
  } else if (name === "customize") {
    state.previewVehicle = save.selectedVehicle;
    state.previewWrapId = equippedWrapFor(save.selectedVehicle).id;
    state.previewRimId = save.equippedRim;
    setupShowroom("customize-stage");
    renderCustomize();
    setShowroomVehicle();
  } else if (name === "cases") {
    if (!CASES_BY_ID[state.selectedCase]) state.selectedCase = CASES[0].id;
    renderCases();
  } else if (name === "scenery") {
    renderScenery();
  } else if (name === "stats") {
    renderStats();
  } else if (name === "settings") {
    renderAudioSettings();
  } else if (name === "credits") {
    renderCredits();
  }
  if (!state.driving) {
    audio.setMode("menu");
    audio.startMusic();
  }
}

function setupShowroom(stageId) {
  const stage = $(`#${stageId}`);
  const environment = ENVIRONMENTS_BY_ID[save.environment] || ENVIRONMENTS_BY_ID.city;
  stage.style.setProperty("--stage-accent", environment.accent);
  stage.style.background = `radial-gradient(circle at 50% 44%, ${environment.accent}1c, transparent 48%), linear-gradient(180deg, #0b110e 0%, #070b08 58%, #050806 100%)`;
  showroom.attach(stage);
  showroom.setActive(true);
  showroom.setEnvironment(save.environment, save.timeOfDay);
  window.setTimeout(() => showroom.resize(), 40);
}

function backToMenu() {
  if (state.caseOpening) return;
  hideAllPages();
  $("#screen-menu").classList.remove("is-hidden");
  $("#screen-pause").classList.add("is-hidden");
  $("#screen-results").classList.add("is-hidden");
  $("#hud").classList.add("is-hidden");
  driveCanvas.classList.add("is-hidden");
  state.view = "menu";
  showroom.setActive(false);
  menuArt.setActive(true);
  pageArt.setActive(false);
  $("#page-art").classList.add("is-hidden");
  hydrateIcons($("#screen-menu"));
  updateMenuSummary();
  updateWallet();
  audio.setMode("menu");
  audio.startMusic();
}

function updateAllUI() {
  updateWallet();
  updateMenuSummary();
  syncMuteUI();
  if (state.view === "garage") renderGarage();
  if (state.view === "customize") renderCustomize();
  if (state.view === "cases") renderCases();
  if (state.view === "scenery") renderScenery();
  if (state.view === "stats") renderStats();
  if (state.view === "settings") renderAudioSettings();
}

// ---------------------------------------------------------------------------
// Showroom / garage
// ---------------------------------------------------------------------------
function setShowroomVehicle() {
  const wrap =
    state.view === "customize"
      ? WRAPS_BY_ID[state.previewWrapId] || equippedWrapFor(state.previewVehicle)
      : displayWrapFor(state.previewVehicle);
  showroom.setVehicle(state.previewVehicle, wrap, state.previewRimId);
  const vehicle = VEHICLES[state.previewVehicle];
  const garageName = $("#garage-caption-name");
  if (garageName) garageName.textContent = vehicle.name;
  const garageCategory = $("#garage-caption-category");
  if (garageCategory) garageCategory.textContent = vehicle.category;
  const customizeName = $("#customize-caption-name");
  if (customizeName) customizeName.textContent = vehicle.name;
}

function renderGarage() {
  const list = $("#vehicle-list");
  list.innerHTML = VEHICLE_ORDER.map((vehicleId, index) => {
    const vehicle = VEHICLES[vehicleId];
    const owned = vehicleOwned(save, vehicleId);
    const selected = save.selectedVehicle === vehicleId;
    const preview = state.previewVehicle === vehicleId;
    const wrap = displayWrapFor(vehicleId);
    return `
      <button class="vehicle-card ${selected ? "is-selected" : ""} ${!owned ? "is-locked" : ""} ${preview ? "is-preview" : ""}" type="button" data-vehicle-preview="${vehicleId}">
        <span class="vehicle-card-head">
          <span class="vehicle-index">0${index + 1}</span>
          <span class="vehicle-card-body">
            <b>${esc(vehicle.name)}</b>
            <small>${esc(vehicle.category)}</small>
          </span>
          <span class="vehicle-status ${selected ? "is-selected" : owned ? "is-owned" : ""}">${selected ? "ACTIVE" : owned ? "OWNED" : "LOCKED"}</span>
        </span>
        <canvas class="vehicle-badge" width="96" height="40" data-vehicle-badge="${vehicleId}" aria-hidden="true"></canvas>
        <span class="vehicle-card-foot">
          <span>${owned ? esc(wrap.name) : "STREET SPEC"}</span>
          <span class="vehicle-price">${owned ? "IN GARAGE" : `${formatCredits(vehicle.price)} CR`}</span>
        </span>
      </button>`;
  }).join("");

  list.querySelectorAll("[data-vehicle-badge]").forEach((canvas) => {
    const id = canvas.dataset.vehicleBadge;
    drawVehicleBadge(canvas, id, displayWrapFor(id));
  });

  renderGarageInfo();
}

function statRow(label, value, display) {
  return `
    <div class="spec-row">
      <span>${label}</span>
      <div class="spec-bar"><i style="width:${clamp(value, 0, 100)}%"></i></div>
      <b>${display}</b>
    </div>`;
}

function renderGarageInfo() {
  const vehicle = VEHICLES[state.previewVehicle];
  const owned = vehicleOwned(save, vehicle.id);
  const selected = save.selectedVehicle === vehicle.id;
  const equipped = equippedWrapFor(vehicle.id);
  const actionLabel = selected
    ? "SELECTED"
    : owned
      ? "SELECT THIS MACHINE"
      : "BUY &amp; SELECT";
  const priceLine = owned
    ? `<span>STATUS</span><b>OWNED</b>`
    : `<span>PRICE</span><b>${formatCredits(vehicle.price)} CR</b>`;

  $("#vehicle-info").innerHTML = `
    <p class="info-category">${esc(vehicle.category)}</p>
    <h3 class="info-title">${esc(vehicle.name)}</h3>
    <p class="info-subtitle">${esc(vehicle.subtitle)}</p>
    <p class="info-blurb">${esc(vehicle.blurb)}</p>
    <canvas class="info-badge" width="96" height="40" data-info-badge="${vehicle.id}" aria-hidden="true"></canvas>
    <div class="info-rule"></div>
    <div class="spec-list">
      ${statRow("TOP SPEED", (vehicle.stats.topSpeed / 215) * 100, `${vehicle.stats.topSpeed} MPH`)}
      ${statRow("ACCELERATION", vehicle.stats.acceleration * 10, `${vehicle.stats.acceleration}`)}
      ${statRow("HANDLING", vehicle.stats.handling * 10, `${vehicle.stats.handling}`)}
      ${statRow("BRAKING", vehicle.stats.braking * 10, `${vehicle.stats.braking}`)}
      ${statRow("WEIGHT", vehicle.stats.weight * 10, `${vehicle.stats.weight}`)}
    </div>
    <div class="perk-box"><b>VEHICLE CHARACTER</b>${esc(vehicle.perk)}</div>
    <div class="info-footer">
      <div class="price-row">${priceLine}</div>
      <button id="vehicle-action" class="primary-button" type="button" ${selected ? "disabled" : ""}>${actionLabel}</button>
      <p class="info-note">${owned ? `Equipped wrap · ${esc(equipped.name)}` : "Buying this machine unlocks it permanently in your garage."}</p>
    </div>`;

  const badge = $("#vehicle-info [data-info-badge]");
  if (badge) drawVehicleBadge(badge, vehicle.id, displayWrapFor(vehicle.id));
}

function previewVehicle(vehicleId) {
  if (!VEHICLES[vehicleId]) return;
  state.previewVehicle = vehicleId;
  state.previewWrapId = equippedWrapFor(vehicleId).id;
  state.previewRimId = save.equippedRim;
  renderGarage();
  setShowroomVehicle();
}

function handleVehicleAction() {
  const vehicle = VEHICLES[state.previewVehicle];
  const owned = vehicleOwned(save, vehicle.id);
  if (!owned) {
    if (save.credits < vehicle.price) {
      showToast("NOT ENOUGH CREDITS", `You need ${formatCredits(vehicle.price - save.credits)} more. Drive more miles.`, true);
      audio.error();
      return;
    }
    save.credits -= vehicle.price;
    save.ownedVehicles.push(vehicle.id);
    save.ownedVehicles = [...new Set(save.ownedVehicles)];
    save.selectedVehicle = vehicle.id;
    save.equippedWrap[vehicle.id] = save.equippedWrap[vehicle.id] || DEFAULT_WRAP_ID;
    persistSave(save);
    audio.purchase();
    showToast("MACHINE ACQUIRED", `${vehicle.name} is now in your garage.`);
  } else {
    if (save.selectedVehicle === vehicle.id) return;
    save.selectedVehicle = vehicle.id;
    persistSave(save);
    audio.upgrade();
    showToast("MACHINE SELECTED", `${vehicle.name} will be waiting on the highway.`);
  }
  state.previewVehicle = save.selectedVehicle;
  state.previewWrapId = equippedWrapFor(save.selectedVehicle).id;
  setShowroomVehicle();
  updateAllUI();
}

// ---------------------------------------------------------------------------
// Customize
// ---------------------------------------------------------------------------
function renderCustomize() {
  const vehicle = VEHICLES[state.previewVehicle];
  const equippedWrapId = save.equippedWrap?.[state.previewVehicle] || DEFAULT_WRAP_ID;
  const ownedCount = WRAPS.filter((wrap) => wrapOwned(save, wrap.id)).length;
  $("#wrap-count").textContent = `${ownedCount} / ${WRAPS.length}`;

  $("#wrap-grid").innerHTML = WRAP_GROUPS.map((group) => {
    const cards = group.wraps
      .map((wrap) => {
        const owned = wrapOwned(save, wrap.id);
        const equipped = equippedWrapId === wrap.id;
        const selected = state.previewWrapId === wrap.id;
        const price = wrap.price == null ? "CASE" : `CR ${formatCredits(wrap.price)}`;
        return `
          <button class="wrap-card ${selected ? "is-selected" : ""} ${equipped ? "is-equipped" : ""}" type="button" data-wrap-preview="${wrap.id}" style="${wrapStyle(wrap)}">
            <span class="wrap-swatch pattern-${wrap.pattern}"></span>
            <span class="wrap-name">${esc(wrap.name)}</span>
            <span class="wrap-meta">
              <span class="${owned ? "owned" : "locked"}">${owned ? "OWNED" : price}</span>
              <span>${esc(group.label)}</span>
            </span>
          </button>`;
      })
      .join("");
    return `<div class="wrap-group-title" style="--rarity-color:${group.color}"><span>${esc(group.label)}</span></div>${cards}`;
  }).join("");

  $("#rim-grid").innerHTML = RIMS.map((rim) => {
    const owned = rimOwned(save, rim.id);
    const equipped = save.equippedRim === rim.id;
    const selected = state.previewRimId === rim.id;
    return `
      <button class="rim-card ${selected ? "is-selected" : ""}" type="button" data-rim-preview="${rim.id}" style="--rim-color:${rim.color}">
        <span class="rim-visual ${rim.glow ? "glow" : ""}"></span>
        <span class="rim-card-body">
          <b>${esc(rim.name)}</b>
          <span class="${owned ? "owned" : ""}">${equipped ? "EQUIPPED" : owned ? "OWNED" : `CR ${formatCredits(rim.price)}`}</span>
        </span>
      </button>`;
  }).join("");

  const caption = $("#customize-caption-name");
  if (caption) caption.textContent = vehicle.name;
  renderCustomizeInfo();
}

function renderCustomizeInfo() {
  const vehicle = VEHICLES[state.previewVehicle];
  const wrap = WRAPS_BY_ID[state.previewWrapId] || equippedWrapFor(state.previewVehicle);
  const rim = RIMS_BY_ID[state.previewRimId] || RIMS_BY_ID.stock;
  const wrapOwnedNow = wrapOwned(save, wrap.id);
  const wrapEquipped = (save.equippedWrap?.[state.previewVehicle] || DEFAULT_WRAP_ID) === wrap.id;
  const rimOwnedNow = rimOwned(save, rim.id);
  const rimEquipped = save.equippedRim === rim.id;
  const rarity = RARITIES[wrap.rarity];

  let wrapAction;
  if (wrapEquipped) {
    wrapAction = `<button id="wrap-action" class="primary-button" type="button" disabled>EQUIPPED</button>`;
  } else if (wrapOwnedNow) {
    wrapAction = `<button id="wrap-action" class="primary-button" type="button">EQUIP WRAP</button>`;
  } else if (wrap.price == null) {
    wrapAction = `<button id="wrap-action" class="primary-button" type="button" disabled>CASE EXCLUSIVE</button>`;
  } else {
    wrapAction = `<button id="wrap-action" class="primary-button" type="button">BUY &amp; EQUIP · ${formatCredits(wrap.price)} CR</button>`;
  }

  let rimAction;
  if (rimEquipped) {
    rimAction = `<button id="rim-action" class="ghost-button" type="button" disabled>RIMS EQUIPPED</button>`;
  } else if (rimOwnedNow) {
    rimAction = `<button id="rim-action" class="ghost-button" type="button">EQUIP RIMS</button>`;
  } else {
    rimAction = `<button id="rim-action" class="ghost-button" type="button">BUY &amp; EQUIP · ${formatCredits(rim.price)} CR</button>`;
  }

  $("#customize-info").innerHTML = `
    <p class="info-category" style="color:${rarityStyle(wrap.rarity)}">${esc(rarity.label)} WRAP</p>
    <h3 class="info-title">${esc(wrap.name)}</h3>
    <p class="wrap-rarity" style="--rarity-color:${rarityStyle(wrap.rarity)}">${esc(rarity.label)} · ${wrapOwnedNow ? "OWNED" : wrap.price == null ? "CASE EXCLUSIVE" : `${formatCredits(wrap.price)} CR`}</p>
    <div class="info-rule"></div>
    <div class="wrap-preview-large pattern-${wrap.pattern}" style="${wrapStyle(wrap)}"></div>
    <p class="wrap-detail-description">${esc(wrap.description)}</p>
    <div class="paint-facts">
      <div><span>FINISH</span><b>${esc(wrap.finish)}</b></div>
      <div><span>PATTERN</span><b>${esc(wrap.pattern)}</b></div>
      <div><span>STATUS</span><b>${wrapOwnedNow ? "OWNED" : wrap.price == null ? "CRATE ONLY" : "LOCKED"}</b></div>
    </div>
    <p class="credit-small">${wrap.animated ? "Iridescent finish · colour shifts while driving." : `${wrap.finish.toUpperCase()} finish · ${wrap.pattern === "twoTone" ? "two-tone" : wrap.pattern === "solid" ? "solid paint" : `${wrap.pattern} livery`}.`}</p>
    <div class="customize-vehicle-line">EDITING <b>${esc(vehicle.name)}</b><br />Actual 3D preview · drag the model to inspect every angle.</div>
    <div class="info-footer">
      ${wrapAction}
      <p class="info-note">${wrapOwnedNow ? "This wrap is permanently owned." : wrap.price == null ? "This wrap drops only from cosmetic crates." : "Buying adds this wrap to your permanent collection."}</p>
      <div class="info-rule"></div>
      <p class="info-category">WHEEL SET · ${esc(rim.name)}</p>
      <p class="credit-small">${esc(rim.description)}</p>
      ${rimAction}
    </div>`;
}

function previewWrap(wrapId) {
  if (!WRAPS_BY_ID[wrapId]) return;
  state.previewWrapId = wrapId;
  showroom.setWrap(WRAPS_BY_ID[wrapId]);
  renderCustomize();
}

function previewRim(rimId) {
  if (!RIMS_BY_ID[rimId]) return;
  state.previewRimId = rimId;
  showroom.setRim(rimId);
  renderCustomize();
}

function handleWrapAction() {
  const wrap = WRAPS_BY_ID[state.previewWrapId];
  const vehicleId = state.previewVehicle;
  if (!wrap) return;
  if (!wrapOwned(save, wrap.id)) {
    if (wrap.price == null) {
      showToast("CASE EXCLUSIVE", "This wrap can only be found inside a cosmetic crate.", true);
      audio.error();
      return;
    }
    if (save.credits < wrap.price) {
      showToast("NOT ENOUGH CREDITS", `You need ${formatCredits(wrap.price - save.credits)} more for this wrap.`, true);
      audio.error();
      return;
    }
    save.credits -= wrap.price;
    save.ownedWraps.push(wrap.id);
    save.ownedWraps = [...new Set(save.ownedWraps)];
    audio.purchase();
    showToast("WRAP ACQUIRED", `${wrap.name} added to your collection.`);
  } else {
    audio.upgrade();
    showToast("WRAP EQUIPPED", `${wrap.name} is now on the ${VEHICLES[vehicleId].name}.`);
  }
  save.equippedWrap[vehicleId] = wrap.id;
  persistSave(save);
  renderCustomize();
  updateWallet();
}

function handleRimAction() {
  const rim = RIMS_BY_ID[state.previewRimId];
  if (!rim) return;
  if (!rimOwned(save, rim.id)) {
    if (save.credits < rim.price) {
      showToast("NOT ENOUGH CREDITS", `You need ${formatCredits(rim.price - save.credits)} more for these rims.`, true);
      audio.error();
      return;
    }
    save.credits -= rim.price;
    save.ownedRims.push(rim.id);
    save.ownedRims = [...new Set(save.ownedRims)];
    audio.purchase();
    showToast("RIMS ACQUIRED", `${rim.name} added to your garage.`);
  } else {
    audio.upgrade();
    showToast("RIMS EQUIPPED", `${rim.name} fitted.`);
  }
  save.equippedRim = rim.id;
  persistSave(save);
  renderCustomize();
  updateWallet();
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
function renderCases() {
  const selected = CASES_BY_ID[state.selectedCase] || CASES[0];
  state.selectedCase = selected.id;

  $("#case-cards").innerHTML = CASES.map((caseDef) => {
    const previewRarities = ["mythic", "legendary", "epic"];
    return `
      <article class="case-card ${selected.id === caseDef.id ? "is-selected" : ""}" data-case-select="${caseDef.id}" style="--case-accent:${caseDef.accent}">
        <div class="case-card-head">
          <span class="case-tag">${esc(caseDef.tag)}</span>
          <span class="case-price-small">${formatCredits(caseDef.price)} CR</span>
        </div>
        <div class="crate-visual" data-label="${caseDef.id === "street" ? "ST" : caseDef.id === "neon" ? "NE" : "GD"}" aria-hidden="true">
          <span class="crate-bar"></span><span class="crate-bar bottom"></span>
        </div>
        <h3>${esc(caseDef.name)}</h3>
        <p class="case-blurb">${esc(caseDef.blurb)}</p>
        <div class="case-odds-preview">
          ${previewRarities
            .map(
              (rarity) =>
                `<span style="--rarity-color:${rarityStyle(rarity)}"><b>${RARITIES[rarity].label}</b> ${percent(caseDef.odds[rarity])}</span>`
            )
            .join("")}
        </div>
        <button class="case-select-button" type="button" data-case-select="${caseDef.id}">${selected.id === caseDef.id ? "VIEWING ODDS" : "VIEW CRATE"}</button>
      </article>`;
  }).join("");

  $("#case-detail-name").textContent = selected.name;
  $("#case-detail-price").textContent = `${formatCredits(selected.price)} CR`;
  $("#case-open-price").textContent = `${formatCredits(selected.price)} CR`;
  $("#case-open-label").textContent = `OPENING ${selected.name.toUpperCase()}`;

  $("#case-detail").innerHTML = caseOddsTable(selected)
    .map((row) => {
      const items = row.items
        .map((wrap) => `${esc(wrap.name)} <span class="odds-chance">${percent(row.itemChance)}</span>`)
        .join("<br />");
      return `
        <div class="odds-row" style="--rarity-color:${rarityStyle(row.rarity)}">
          <span class="odds-rarity">${esc(row.label)}</span>
          <span class="odds-chance">${percent(row.chance)}</span>
          <span class="odds-items">${items}</span>
        </div>`;
    })
    .join("") +
    `<div class="odds-row"><span class="odds-rarity" style="--rarity-color:var(--muted)">TOTAL</span><span class="odds-chance">100%</span><span class="odds-items">Exact roll table · ${WRAPS.filter((wrap) => selected.odds[wrap.rarity] > 0).length} possible wraps</span></div>`;

  const wall = $("#case-wall-grid");
  if (wall) {
    wall.innerHTML = WRAPS.map((wrap) => {
      const owned = wrapOwned(save, wrap.id);
      return `<span class="wall-tile ${owned ? "is-owned" : ""}" style="${wrapStyle(wrap)}" title="${esc(wrap.name)} · ${esc(RARITIES[wrap.rarity].label)}${owned ? " · owned" : ""}">
        <i class="wall-swatch pattern-${wrap.pattern}"></i>
        <span class="wall-name">${esc(wrap.name)}</span>
        <small>${esc(RARITIES[wrap.rarity].label)}</small>
      </span>`;
    }).join("");
    const count = WRAPS.filter((wrap) => wrapOwned(save, wrap.id)).length;
    $("#case-wall-count").textContent = `${count} / ${WRAPS.length}`;
  }
}

// The spin is deliberately brisk: a two-second rattle, one beat of silence,
// then the reveal. Ticks decelerate so the stop reads like a crate reel.
const CASE_SPIN_MS = 2150;
const CASE_REVEAL_DELAY = 250;

function withAlpha(hex, alpha) {
  const clean = String(hex).replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = Number.parseInt(full, 16) || 0;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function selectCase(caseId) {
  if (state.caseOpening || !CASES_BY_ID[caseId]) return;
  state.selectedCase = caseId;
  renderCases();
}

function openCase(caseId) {
  if (state.caseOpening) return;
  const caseDef = CASES_BY_ID[caseId] || CASES_BY_ID[state.selectedCase] || CASES[0];
  state.selectedCase = caseDef.id;

  if (save.credits < caseDef.price) {
    showToast("NOT ENOUGH CREDITS", `The ${caseDef.name} costs ${formatCredits(caseDef.price)} CR. Drive more miles first.`, true);
    audio.error();
    return;
  }

  save.credits -= caseDef.price;
  const winner = rollCase(caseDef);
  const wasOwned = wrapOwned(save, winner.id);
  let refund = 0;
  if (wasOwned) {
    refund = RARITIES[winner.rarity].refund;
    save.credits += refund;
  } else {
    save.ownedWraps.push(winner.id);
    save.ownedWraps = [...new Set(save.ownedWraps)];
  }
  save.casesOpened += 1;
  persistSave(save);
  updateWallet();
  updateMenuSummary();

  state.caseOpening = true;
  if (state.caseSpin) window.clearInterval(state.caseSpin);
  state.caseSpin = 0;
  state.caseTimers.forEach((timer) => window.clearTimeout(timer));
  state.caseTimers = [];

  const overlay = $("#case-overlay");
  const result = $("#case-result");
  const close = $("#case-close");
  const track = $("#case-reel-track");
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
  result.classList.add("is-hidden");
  close.classList.add("is-hidden");
  const rarityColor = rarityStyle(winner.rarity);
  overlay.style.setProperty("--rarity-color", rarityColor);
  overlay.style.setProperty("--rarity-glow", withAlpha(rarityColor, 0.2));
  result.style.setProperty("--rarity-color", rarityColor);
  result.style.setProperty("--rarity-glow", withAlpha(rarityColor, 0.22));
  $("#case-result-rarity").textContent = RARITIES[winner.rarity].label;
  const resultPreview = $("#case-result-preview");
  resultPreview.className = `case-result-preview pattern-${winner.pattern}`;
  resultPreview.setAttribute("style", wrapStyle(winner));
  drawVehicleBadge($("#case-result-car"), save.selectedVehicle, winner);
  $("#case-result-name").textContent = winner.name;
  $("#case-result-note").textContent = wasOwned
    ? `DUPLICATE · ${formatCredits(refund)} CR REFUNDED`
    : "NEW WRAP · ADDED PERMANENTLY TO YOUR COLLECTION";
  $("#case-open-label").textContent = `OPENING ${caseDef.name.toUpperCase()}`;
  $("#case-another-price").textContent = `${formatCredits(caseDef.price)} CR`;

  const reel = buildReel(caseDef, winner, 38);
  track.classList.remove("is-settled");
  track.innerHTML = reel.items
    .map((wrap, index) => {
      const colors = wrap.colors;
      return `
        <div class="reel-item" data-winner="${index === reel.winnerIndex ? "true" : "false"}" style="--rarity-color:${rarityStyle(wrap.rarity)};--wrap-primary:${colors.primary};--wrap-secondary:${colors.secondary};--wrap-accent:${colors.accent};--wrap-accent2:${colors.accent2}">
          <span class="reel-item-swatch pattern-${wrap.pattern}"></span>
          <span class="reel-item-plate">
            <span class="reel-item-name">${esc(wrap.name)}</span>
            <span class="reel-item-rarity">${RARITIES[wrap.rarity].label}</span>
          </span>
        </div>`;
    })
    .join("");
  track.style.transition = "none";
  track.style.transform = "translate3d(0,0,0)";
  // Force a layout pass before the reel is measured and moved.
  void track.offsetWidth;

  const windowElement = track.parentElement;
  const winnerElement = track.children[reel.winnerIndex];
  const trackRect = track.getBoundingClientRect();
  const winnerRect = winnerElement.getBoundingClientRect();
  const winnerCenter = winnerRect.left - trackRect.left + winnerRect.width / 2;
  const center = windowElement.clientWidth / 2;
  const shift = center - winnerCenter;
  const pitch = winnerRect.width + 8;
  const startMarker = Math.floor((center - winnerRect.width / 2) / pitch);

  // The reel advances on a short timer and clacks once per tile crossing the
  // needle, so the rattle always matches the artwork instead of a fixed beat.
  const spinStart = window.performance.now();
  let marker = startMarker;
  const spin = window.setInterval(() => {
    const t = Math.min(1, (window.performance.now() - spinStart) / CASE_SPIN_MS);
    const eased = 1 - Math.pow(1 - t, 1.8);
    track.style.transform = `translate3d(${shift * eased}px, 0, 0)`;
    const crossed = Math.floor((center - shift * eased - winnerRect.width / 2) / pitch);
    if (crossed > marker) {
      marker = crossed;
      const span = Math.max(1, reel.winnerIndex - startMarker);
      audio.caseTick(Math.min(1, (marker - startMarker) / span), marker >= reel.winnerIndex);
    }
    if (t >= 1) {
      track.style.transform = `translate3d(${shift}px, 0, 0)`;
      if (marker < reel.winnerIndex) audio.caseTick(1, true);
      window.clearInterval(spin);
      state.caseSpin = 0;
    }
  }, 16);
  state.caseSpin = spin;

  audio.caseOpen();

  const flash = $("#case-flash");
  const settleTimer = window.setTimeout(() => {
    track.classList.add("is-settled");
  }, CASE_SPIN_MS + 40);
  state.caseTimers.push(settleTimer);

  const revealTimer = window.setTimeout(() => {
    state.caseOpening = false;
    if (state.caseSpin) window.clearInterval(state.caseSpin);
    state.caseSpin = 0;
    // The payout lands with the impact: flash, stinger, panel, all at once.
    flash.classList.remove("is-live");
    void flash.offsetWidth;
    flash.classList.add("is-live");
    audio.caseReveal(winner.rarity);
    result.classList.remove("is-hidden");
    result.style.setProperty("--rarity-color", rarityColor);
    result.style.setProperty("--rarity-glow", withAlpha(rarityColor, 0.22));
    close.classList.remove("is-hidden");
    $("#case-result-name").textContent = winner.name;
    $("#case-result-note").textContent = wasOwned
      ? `DUPLICATE · ${formatCredits(refund)} CR REFUNDED`
      : "NEW WRAP · ADDED PERMANENTLY TO YOUR COLLECTION";
    state.caseTimers = state.caseTimers.filter((timer) => {
      if (typeof timer === "number") {
        window.clearInterval(timer);
        window.clearTimeout(timer);
      }
      return false;
    });
    updateAllUI();
  }, CASE_SPIN_MS + CASE_REVEAL_DELAY);
  state.caseTimers.push(revealTimer);
}

function closeCaseOverlay() {
  if (state.caseOpening) return;
  if (state.caseSpin) window.clearInterval(state.caseSpin);
  state.caseSpin = 0;
  state.caseTimers.forEach((timer) => {
    window.clearInterval(timer);
    window.clearTimeout(timer);
  });
  state.caseTimers = [];
  $("#case-overlay").classList.add("is-hidden");
  $("#case-overlay").setAttribute("aria-hidden", "true");
  $("#case-reel-track").style.transform = "translate3d(0,0,0)";
  updateAllUI();
}

function openAnotherCase() {
  const caseId = state.selectedCase;
  if (state.caseOpening) return;
  // Roll again in place: no flicker, no closing and reopening the overlay.
  openCase(caseId);
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------
function renderScenery() {
  const environment = ENVIRONMENTS_BY_ID[save.environment] || ENVIRONMENTS_BY_ID.city;
  const time = TIMES_BY_ID[save.timeOfDay] || TIMES_BY_ID.sunset;

  $("#environment-grid").innerHTML = ENVIRONMENTS.map(
    (entry, index) => `
      <button class="env-card ${entry.id === environment.id ? "is-selected" : ""}" type="button" data-env="${entry.id}">
        <canvas class="env-thumb" width="128" height="72" data-env-thumb="${entry.id}" aria-hidden="true"></canvas>
        <span class="env-body">
          <span class="env-index">0${index + 1} / ${esc(entry.subtitle)}</span>
          <b>${esc(entry.name)}</b>
          <small>${esc(entry.skyline)}</small>
        </span>
      </button>`
  ).join("");

  $("#time-grid").innerHTML = TIMES.map(
    (entry) => `
      <button class="time-card ${entry.id === time.id ? "is-selected" : ""}" type="button" data-time="${entry.id}">
        <span class="time-glyph ${entry.id}" aria-hidden="true"></span>
        <span class="time-body">
          <b>${esc(entry.name)}</b>
          <small>${entry.id === "auto" ? "24H CYCLE" : esc(entry.clock)}</small>
        </span>
      </button>`
  ).join("");

  $("#scenery-preview").innerHTML = `
    <span class="postcard-tag">ROUTE CARD / ${esc(environment.subtitle)}</span>
    <canvas id="scenery-big" class="env-big" width="300" height="168" aria-label="${esc(environment.name)} preview"></canvas>
    <h3>${esc(environment.name)}</h3>
    <p class="postcard-sub">${esc(time.name)} / ${time.id === "auto" ? "24-HOUR CYCLE" : esc(entryClock(time))}</p>
    <p class="postcard-copy">${esc(environment.skyline)}</p>
    <div class="preview-specs">
      <div><span>MACHINE</span><b>${esc(VEHICLES[save.selectedVehicle].name)}</b></div>
      <div><span>LIGHT</span><b>${esc(time.subtitle)}</b></div>
      <div><span>GARAGE SLOT</span><b>PERMANENT</b></div>
    </div>
    <button id="scenery-drive" class="primary-button" type="button">DRIVE THIS ROAD <span data-icon="arrow"></span></button>`;

  const previewCanvas = $("#scenery-big");
  if (previewCanvas) drawSceneryThumb(previewCanvas, environment.id, time.id);
  $$("[data-env-thumb]").forEach((canvas) => {
    drawSceneryThumb(canvas, canvas.dataset.envThumb, time.id);
  });
  hydrateIcons($("#scenery-preview"));
}

function entryClock(time) {
  return time.clock || "";
}

function selectEnvironment(environmentId) {
  if (!ENVIRONMENTS_BY_ID[environmentId] || save.environment === environmentId) return;
  save.environment = environmentId;
  persistSave(save);
  showroom.setEnvironment(save.environment, save.timeOfDay);
  renderScenery();
  updateMenuSummary();
}

function selectTime(timeId) {
  if (!TIMES_BY_ID[timeId] || save.timeOfDay === timeId) return;
  save.timeOfDay = timeId;
  save.autoCycle = timeId === "auto";
  persistSave(save);
  showroom.setEnvironment(save.environment, save.timeOfDay);
  renderScenery();
  updateMenuSummary();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function boardRow(label, value, note) {
  return `<div class="board-row"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
}

function renderStats() {
  const lastRun = save.lastRun;
  const vehicle = VEHICLES[save.selectedVehicle];
  const environment = ENVIRONMENTS_BY_ID[save.environment] || ENVIRONMENTS_BY_ID.city;
  const runs = Math.max(1, save.runs);
  const avgMiles = save.totalMiles / runs;
  const avgCredits = save.lifetimeEarned / runs;
  const avgOvertakes = save.lifetime.overtakes / runs;
  const avgCrashes = save.lifetime.crashes / runs;

  $("#stats-grid").innerHTML = `
    <div class="scoreboard">
      <div class="scoreboard-head"><span>ODOMETER TICKET / HT-07</span><b>${formatCredits(save.runs)} RUNS FILED</b></div>
      <div class="scoreboard-hero">
        <span>TOTAL DISTANCE</span>
        <b>${miles(save.totalMiles)}<em>MI</em></b>
        <small>${formatCredits(save.lifetime.overtakes)} clean passes · ${formatCredits(save.lifetime.nearMisses)} near misses · ${formatCredits(save.lifetime.crashes)} collisions</small>
      </div>
      ${boardRow("LIFETIME EARNED", `${formatCredits(save.lifetimeEarned)} CR`, "Every mile on the clock")}
      ${boardRow("BANK BALANCE", `${formatCredits(save.credits)} CR`, "Ready for the garage")}
      ${boardRow("BEST DISTANCE", `${miles(save.bestDistanceMiles)} MI`, "Longest single run")}
      ${boardRow("BEST PAYOUT", `${formatCredits(save.bestRunCredits)} CR`, "Highest single-run earnings")}
      ${boardRow("CASES OPENED", formatCredits(save.casesOpened), "Cosmetic crates only")}
      ${boardRow("CURRENT MACHINE", esc(vehicle.name), esc(vehicle.category))}
      ${boardRow("CURRENT ROAD", esc(environment.name), "Set in Scenery & Time")}
    </div>
    <div class="scoreboard">
      <div class="scoreboard-head"><span>AVERAGES / EVERY FILED RUN</span><b>NO RESETS</b></div>
      ${boardRow("DISTANCE PER RUN", `${avgMiles.toFixed(2)} MI`, "Banked on the odometer")}
      ${boardRow("CREDITS PER RUN", `${formatCredits(Math.round(avgCredits))} CR`, "Before garage spending")}
      ${boardRow("CLEAN PASSES PER RUN", avgOvertakes.toFixed(1), "Traffic passed without contact")}
      ${boardRow("HITS PER RUN", avgCrashes.toFixed(1), "Lower is better")}
    </div>
    <div class="mini-grid">
      <div class="mini-card"><span>MACHINES</span><b>${save.ownedVehicles.length} / ${VEHICLE_ORDER.length}</b></div>
      <div class="mini-card"><span>WRAPS</span><b>${save.ownedWraps.length} / ${WRAPS.length}</b></div>
      <div class="mini-card"><span>TOTAL RUNS</span><b>${formatCredits(save.runs)}</b></div>
    </div>`;

  const panel = $("#last-run-panel");
  if (!lastRun || !lastRun.miles) {
    panel.innerHTML = `<div class="column-head"><span>LAST RUN</span><b>NO DATA</b></div><p class="receipt-empty">The logbook is empty. Take a machine onto the highway and the receipt prints here.</p>`;
    return;
  }
  const runVehicle = VEHICLES[lastRun.vehicleId] || VEHICLES.supercar;
  const date = lastRun.at ? new Date(lastRun.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
  panel.innerHTML = `
    <div class="column-head"><span>LAST RUN</span><b>${esc(date)}</b></div>
    <div class="receipt">
      <div class="receipt-head"><span>TONY ARCADE / HIGHWAY DIV.</span><span>NO. 07</span></div>
      <p class="receipt-title">${esc(runVehicle.name)}</p>
      <p class="receipt-sub">${esc(runVehicle.category)} · ${esc(lastRun.environment || "CITY")} · ${esc(lastRun.timeOfDay || "SUNSET")}</p>
      <div class="receipt-row"><span>DISTANCE</span><b>${Number(lastRun.miles || 0).toFixed(2)} MI</b></div>
      <div class="receipt-row"><span>TOP SPEED</span><b>${formatCredits(lastRun.topSpeedMph || 0)} MPH</b></div>
      <div class="receipt-row"><span>OVERTAKES</span><b>${formatCredits(lastRun.overtakes || 0)}</b></div>
      <div class="receipt-row"><span>NEAR MISSES</span><b>${formatCredits(lastRun.nearMisses || 0)}</b></div>
      <div class="receipt-row"><span>COLLISIONS</span><b>${formatCredits(lastRun.crashes || 0)}</b></div>
      <div class="receipt-row"><span>FINISH</span><b>${lastRun.reason === "quit" ? "ENDED EARLY" : "TIME COMPLETE"}</b></div>
      <div class="receipt-total"><span>BANKED</span><b>${formatCredits(lastRun.earnings || 0)} CR</b></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------
function renderCredits() {
  const track = $("#credits-fleet");
  if (!track) return;
  track.innerHTML = VEHICLE_ORDER.map((vehicleId) => {
    const vehicle = VEHICLES[vehicleId];
    return `<figure class="lineup-item">
      <canvas width="96" height="40" data-fleet-badge="${vehicleId}" aria-hidden="true"></canvas>
      <figcaption><b>${esc(vehicle.name)}</b><small>${esc(vehicle.category)}</small></figcaption>
    </figure>`;
  }).join("");
  track.querySelectorAll("[data-fleet-badge]").forEach((canvas) => {
    const id = canvas.dataset.fleetBadge;
    const vehicle = VEHICLES[id];
    drawVehicleBadge(canvas, id, { colors: vehicle.fallbackColors });
  });
}

// ---------------------------------------------------------------------------
// Audio settings
// ---------------------------------------------------------------------------
function updateSliderFill(input) {
  input.style.setProperty("--fill", `${input.value}%`);
}

function renderAudioSettings() {
  const bindings = [
    ["master-volume", "master", "master-value"],
    ["music-volume", "music", "music-value"],
    ["sfx-volume", "sfx", "sfx-value"],
  ];
  for (const [inputId, key, valueId] of bindings) {
    const input = $(`#${inputId}`);
    const label = $(`#${valueId}`);
    const value = Math.round((save.audio[key] ?? 0) * 100);
    input.value = String(value);
    label.textContent = String(value);
    updateSliderFill(input);
  }
  syncMuteUI();
}

function bindAudioSliders() {
  const bindings = [
    ["master-volume", "master", "master-value"],
    ["music-volume", "music", "music-value"],
    ["sfx-volume", "sfx", "sfx-value"],
  ];
  for (const [inputId, key, valueId] of bindings) {
    const input = $(`#${inputId}`);
    input.addEventListener("input", () => {
      save.audio[key] = Number(input.value) / 100;
      $(`#${valueId}`).textContent = input.value;
      updateSliderFill(input);
      audio.setSettings(save.audio);
      persistSave(save);
      if (!audio.ready) ensureAudio();
    });
  }
}

// ---------------------------------------------------------------------------
// Drive lifecycle
// ---------------------------------------------------------------------------
function getDriveRenderer() {
  if (!driveRenderer) {
    driveRenderer = new THREE.WebGLRenderer({
      canvas: driveCanvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    driveRenderer.outputColorSpace = THREE.SRGBColorSpace;
    driveRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    driveRenderer.toneMappingExposure = 1.04;
    driveRenderer.shadowMap.enabled = true;
    driveRenderer.shadowMap.type = THREE.PCFShadowMap;
  }
  return driveRenderer;
}

function startDrive() {
  if (state.driving || state.finishing) return;
  if (state.caseOpening) return;

  state.keys.clear();
  hideAllPages();
  $("#screen-pause").classList.add("is-hidden");
  $("#screen-results").classList.add("is-hidden");
  $("#toast").classList.add("is-hidden");
  showroom.setActive(false);
  menuArt.setActive(false);
  pageArt.setActive(false);
  $("#page-art").classList.add("is-hidden");
  driveCanvas.classList.remove("is-hidden");
  $("#hud").classList.remove("is-hidden");
  $("#countdown-layer").classList.remove("is-hidden", "is-go");
  $("#countdown-kicker").textContent = "GET READY";
  $("#countdown-number").textContent = "3";
  $("#hud-feed").innerHTML = "";
  state.driving = true;
  state.paused = false;
  state.finishing = false;
  state.view = "drive";
  state.hudTimer = 0;

  const vehicle = VEHICLES[save.selectedVehicle];
  const environment = ENVIRONMENTS_BY_ID[save.environment] || ENVIRONMENTS_BY_ID.city;
  const time = TIMES_BY_ID[save.timeOfDay] || TIMES_BY_ID.sunset;

  $("#hud-vehicle").textContent = vehicle.name;
  $("#hud-vehicle-type").textContent = vehicle.category;
  $("#hud-time").textContent = formatTime(RUN_SECONDS);
  $("#hud-earnings").textContent = "0";
  $("#hud-miles").textContent = "0.00";
  $("#hud-speed").textContent = "0";
  $("#hud-top-speed").textContent = "0";
  $("#hud-near").textContent = "0";
  $("#hud-overtakes").textContent = "0";
  $("#hud-crashes").textContent = "0";
  const metres = $("#hud-distance-m");
  if (metres) metres.textContent = "0";
  $("#hud-progress").style.transform = "scaleX(1)";
  $("#hud-speed-fill").style.width = "0%";

  try {
    const renderer = getDriveRenderer();
    state.world = new DrivingWorld({
      renderer,
      canvas: driveCanvas,
      vehicleId: save.selectedVehicle,
      wrap: equippedWrapFor(save.selectedVehicle),
      rimId: save.equippedRim,
      environmentId: save.environment,
      timeId: save.timeOfDay,
      audio,
      onEvent: handleDriveEvent,
    });
    state.world.resize();
  } catch (error) {
    console.error("Could not start the drive", error);
    state.driving = false;
    state.world = null;
    driveCanvas.classList.add("is-hidden");
    $("#hud").classList.add("is-hidden");
    $("#countdown-layer").classList.add("is-hidden");
    backToMenu();
    showToast("RENDERER ERROR", "The 3D scene could not start in this browser.", true);
    return;
  }

  activateDriveAudio();
  updateHud(true);
  updateMenuSummary();
}

function handleDriveEvent(event) {
  if (!event) return;
  if (event.type === "countdown") {
    $("#countdown-layer").classList.remove("is-hidden", "is-go");
    $("#countdown-kicker").textContent = "GET READY";
    $("#countdown-number").textContent = String(event.value);
  } else if (event.type === "go") {
    window.clearTimeout(countdownTimeout);
    const layer = $("#countdown-layer");
    layer.classList.add("is-go");
    $("#countdown-kicker").textContent = "GO";
    $("#countdown-number").textContent = "GO";
    countdownTimeout = window.setTimeout(() => {
      layer.classList.add("is-hidden");
    }, 760);
  } else if (event.type === "nearMiss") {
    showHudToast(event.title, event.detail, "near");
  } else if (event.type === "crash") {
    showHudToast(event.title, event.detail, "crash");
  } else if (event.type === "finish") {
    finishRun(event);
  }
}

function updateHud(force = false) {
  if (!state.world || !state.driving) return;
  const snapshot = state.world.getSnapshot();
  $("#hud-time").textContent = formatTime(snapshot.timeLeft);
  $("#hud-earnings").textContent = formatCredits(snapshot.runCredits);
  $("#hud-miles").textContent = snapshot.distanceMiles.toFixed(2);
  const metres = $("#hud-distance-m");
  if (metres) metres.textContent = formatCredits(snapshot.distanceMetres);
  $("#hud-speed").textContent = String(snapshot.speedMph);
  $("#hud-speed-fill").style.width = `${snapshot.speedRatio * 100}%`;
  $("#hud-top-speed").textContent = String(snapshot.topSpeedMph);
  $("#hud-overtakes").textContent = formatCredits(snapshot.overtakes);
  $("#hud-near").textContent = formatCredits(snapshot.nearMisses);
  $("#hud-crashes").textContent = formatCredits(snapshot.crashes);
  $("#hud-progress").style.transform = `scaleX(${Math.max(
    0,
    Math.min(1, snapshot.timeLeft / RUN_SECONDS)
  )})`;
  $("#hud-earnings").classList.toggle("is-low", snapshot.timeLeft < 15);
}

function bankRun(result) {
  const previousBest = save.bestDistanceMiles;
  const isRecord = result.miles > previousBest + 0.0001;
  save.credits += result.earnings.total;
  save.totalMiles += result.miles;
  save.lifetimeEarned += result.earnings.total;
  save.bestDistanceMiles = Math.max(previousBest, result.miles);
  save.bestRunCredits = Math.max(save.bestRunCredits || 0, result.earnings.total);
  save.runs += 1;
  save.lifetime.overtakes += result.overtakes || 0;
  save.lifetime.nearMisses += result.nearMisses || 0;
  save.lifetime.crashes += result.crashes || 0;
  const vehicle = VEHICLES[result.vehicleId] || VEHICLES[save.selectedVehicle];
  save.lastRun = {
    vehicleId: result.vehicleId,
    environment: save.environment,
    timeOfDay: save.timeOfDay,
    reason: result.reason,
    miles: result.miles,
    earnings: result.earnings.total,
    topSpeedMph: result.topSpeedMph,
    overtakes: result.overtakes,
    nearMisses: result.nearMisses,
    crashes: result.crashes,
    at: Date.now(),
    vehicleName: vehicle.name,
  };
  persistSave(save);
  updateWallet();
  updateMenuSummary();
  return { isRecord, previousBest };
}

function finishRun(result) {
  if (state.finishing) return;
  state.finishing = true;
  state.paused = false;
  pageArt.setActive(false);
  $("#page-art").classList.add("is-hidden");
  audio.stopEngine();
  audio.stopAmbience();
  audio.setMode("menu");
  window.clearTimeout(countdownTimeout);
  $("#screen-pause").classList.add("is-hidden");
  $("#countdown-layer").classList.add("is-hidden");
  $("#hud").classList.add("is-hidden");
  state.keys.clear();
  if (state.world) state.world.setPaused(true);

  const meta = bankRun(result);
  const runResult = { ...result, meta };

  window.setTimeout(() => {
    const world = state.world;
    state.driving = false;
    state.world = null;
    if (world) world.dispose();
    driveCanvas.classList.add("is-hidden");
    $("#hud").classList.add("is-hidden");
    state.finishing = false;
    state.view = "results";
    showResults(runResult);
  }, 950);
}

function showResults(result) {
  hideAllPages();
  $("#screen-results").classList.remove("is-hidden");
  $("#screen-results").scrollTop = 0;
  const vehicle = VEHICLES[result.vehicleId] || VEHICLES.supercar;
  const environment = ENVIRONMENTS_BY_ID[save.environment] || ENVIRONMENTS_BY_ID.city;
  const time = TIMES_BY_ID[save.timeOfDay] || TIMES_BY_ID.sunset;
  const isRecord = !!result.meta?.isRecord;
  $("#results-kicker").textContent =
    result.reason === "quit"
      ? `RUN ENDED EARLY / ${formatTime(result.time)}`
      : `RUN COMPLETE / ${formatTime(RUN_SECONDS)}`;
  $("#results-title").textContent = result.reason === "quit" ? "RUN LOGGED" : "THE ROAD REMEMBERS";
  $("#results-sub").textContent = `${vehicle.name} · ${environment.name} · ${time.name}`;
  $("#results-stamp").textContent = isRecord ? "NEW BEST" : "RUN BANKED";
  $("#results-miles").textContent = result.miles.toFixed(2);
  $("#results-earned").textContent = formatCredits(result.earnings.total);
  $("#results-vehicle").textContent = vehicle.name;
  $("#results-total").textContent = `${formatCredits(result.earnings.total)} CR`;
  $("#results-best").textContent = isRecord
    ? "PERSONAL DISTANCE RECORD · THE ROAD IS YOURS"
    : `PERSONAL BEST · ${miles(save.bestDistanceMiles)} MI`;
  $("#results-best").classList.toggle("is-record", isRecord);

  const earnings = result.earnings;
  $("#results-breakdown").innerHTML = `
    <li><span>DISTANCE PAY</span><b>+${formatCredits(earnings.distancePay)} CR</b></li>
    <li><span>OVERTAKE BONUS</span><b>+${formatCredits(earnings.overtakePay)} CR</b></li>
    <li><span>NEAR-MISS BONUS</span><b>+${formatCredits(earnings.nearPay)} CR</b></li>
    <li><span>COMPLETION BONUS</span><b>+${formatCredits(earnings.completion)} CR</b></li>
    <li class="${earnings.penalties ? "negative" : ""}"><span>COLLISION PENALTIES</span><b>−${formatCredits(earnings.penalties)} CR</b></li>
    <li class="total"><span>TOTAL BANKED</span><b>${formatCredits(earnings.total)} CR</b></li>`;

  $("#results-stats").innerHTML = `
    <li><span>TOP SPEED</span><b>${formatCredits(result.topSpeedMph)} MPH</b></li>
    <li><span>OVERTAKES</span><b>${formatCredits(result.overtakes)}</b></li>
    <li><span>NEAR MISSES</span><b>${formatCredits(result.nearMisses)}</b></li>
    <li><span>COLLISIONS</span><b>${formatCredits(result.crashes)}</b></li>
    <li><span>TIME ON ROAD</span><b>${formatTime(result.time)}</b></li>
    <li><span>LIFETIME DISTANCE</span><b>${miles(save.totalMiles)} MI</b></li>`;
  updateWallet();
}

function pauseGame(show = true) {
  if (!state.driving || state.finishing || !state.world) return;
  if (state.world.phase === "finished") return;
  state.paused = show;
  state.keys.clear();
  syncDriveInput();
  state.world.setPaused(show);
  if (show) {
    const snapshot = state.world.getSnapshot();
    $("#pause-miles").textContent = snapshot.distanceMiles.toFixed(2);
    $("#pause-earned").textContent = formatCredits(snapshot.runCredits);
    $("#pause-time").textContent = formatTime(snapshot.timeLeft);
    $("#screen-pause").classList.remove("is-hidden");
    $("#hud").classList.add("is-hidden");
    audio.duckEngine(true);
  } else {
    $("#screen-pause").classList.add("is-hidden");
    $("#hud").classList.remove("is-hidden");
    audio.duckEngine(false);
    lastFrame = performance.now();
  }
}

function endRun() {
  if (!state.world || !state.driving) return;
  $("#screen-pause").classList.add("is-hidden");
  state.paused = false;
  state.world.quitToResults();
}

function syncDriveInput() {
  if (!state.world) return;
  const active = state.driving && !state.paused && !state.finishing;
  state.world.setInput({
    throttle: active && (state.keys.has("KeyW") || state.keys.has("ArrowUp")),
    brake: active && (state.keys.has("KeyS") || state.keys.has("ArrowDown")),
    left: active && (state.keys.has("KeyA") || state.keys.has("ArrowLeft")),
    right: active && (state.keys.has("KeyD") || state.keys.has("ArrowRight")),
  });
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function isTypingTarget(target) {
  return !!(target && target.nodeType === 1 && target.closest("input, textarea, select, [contenteditable='true']"));
}

function onKeyDown(event) {
  ensureAudio();
  const typing = isTypingTarget(event.target);

  if (event.code === "Escape") {
    if (!$("#case-overlay").classList.contains("is-hidden")) {
      if (!state.caseOpening) closeCaseOverlay();
      event.preventDefault();
      return;
    }
    if (state.paused) {
      pauseGame(false);
      event.preventDefault();
      return;
    }
    if (state.driving) {
      pauseGame(true);
      event.preventDefault();
      return;
    }
    if (state.view !== "menu") {
      backToMenu();
      event.preventDefault();
    }
    return;
  }

  if (event.code === "KeyM" && !typing) {
    toggleMute();
    return;
  }

  if (state.driving && !typing) {
    if (
      ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        event.code
      )
    ) {
      event.preventDefault();
    }
    if (event.code === "KeyP" && !state.paused) {
      pauseGame(true);
      return;
    }
    if (!state.paused && !state.finishing) {
      state.keys.add(event.code);
      syncDriveInput();
    }
    return;
  }

  if (event.code === "Enter" && !typing && event.target === document.body) {
    if (state.view === "menu") {
      startDrive();
      event.preventDefault();
    } else if (state.view === "results") {
      startDrive();
      event.preventDefault();
    }
  }
}

function onKeyUp(event) {
  state.keys.delete(event.code);
  syncDriveInput();
}

function clearKeys() {
  state.keys.clear();
  syncDriveInput();
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------
function bindEvents() {
  document.addEventListener("pointerdown", ensureAudio, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearKeys);

  document.addEventListener("click", (event) => {
    ensureAudio();
    const caseCard = event.target.closest("[data-case-select]");
    if (caseCard) {
      if (state.caseOpening) return;
      selectCase(caseCard.dataset.caseSelect);
      if (audio.ready) audio.uiClick();
      return;
    }

    const vehicleCard = event.target.closest("[data-vehicle-preview]");
    if (vehicleCard) {
      previewVehicle(vehicleCard.dataset.vehiclePreview);
      if (audio.ready) audio.uiClick();
      return;
    }

    const wrapCard = event.target.closest("[data-wrap-preview]");
    if (wrapCard) {
      previewWrap(wrapCard.dataset.wrapPreview);
      if (audio.ready) audio.uiClick();
      return;
    }

    const rimCard = event.target.closest("[data-rim-preview]");
    if (rimCard) {
      previewRim(rimCard.dataset.rimPreview);
      if (audio.ready) audio.uiClick();
      return;
    }

    const envCard = event.target.closest("[data-env]");
    if (envCard) {
      selectEnvironment(envCard.dataset.env);
      if (audio.ready) audio.uiClick();
      return;
    }

    const timeCard = event.target.closest("[data-time]");
    if (timeCard) {
      selectTime(timeCard.dataset.time);
      if (audio.ready) audio.uiClick();
      return;
    }

    const button = event.target.closest("button");
    if (!button) return;
    if (button.disabled) return;
    if (audio.ready) audio.uiClick();

    if (button.dataset.open) {
      openPage(button.dataset.open);
      return;
    }
    if (button.dataset.back) {
      backToMenu();
      return;
    }
    if (button.dataset.spin) {
      showroom.spin(Number(button.dataset.spin));
      return;
    }

    switch (button.id) {
      case "menu-drive":
        startDrive();
        break;
      case "vehicle-action":
        handleVehicleAction();
        break;
      case "wrap-action":
        handleWrapAction();
        break;
      case "rim-action":
        handleRimAction();
        break;
      case "scenery-drive":
        startDrive();
        break;
      case "case-open":
        openCase(state.selectedCase);
        break;
      case "case-close":
      case "case-continue":
        closeCaseOverlay();
        break;
      case "case-open-another":
        openAnotherCase();
        break;
      case "audio-mute":
      case "pause-mute":
        toggleMute();
        break;
      case "hud-mute":
        toggleMute();
        break;
      case "hud-pause":
        pauseGame(true);
        break;
      case "pause-resume":
        pauseGame(false);
        break;
      case "pause-end":
        endRun();
        break;
      case "results-again":
        startDrive();
        break;
      case "results-garage":
        openPage("garage");
        break;
      case "results-menu":
        backToMenu();
        break;
      case "audio-test":
        ensureAudio();
        window.setTimeout(() => {
          audio.upgrade();
        }, 30);
        break;
      default:
        break;
    }
  });

  // Showroom orbit and zoom.
  const canvas = $("#showroom-canvas");
  let drag = null;
  canvas.addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, id: event.pointerId };
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const delta = event.clientX - drag.x;
    drag.x = event.clientX;
    showroom.rotate(delta * 0.007);
  });
  const endDrag = (event) => {
    if (!drag) return;
    drag = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (state.view !== "garage" && state.view !== "customize") return;
      event.preventDefault();
      showroom.zoomBy(event.deltaY * 0.0007);
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    if (state.driving && state.world) state.world.resize();
    if (state.view === "garage" || state.view === "customize") showroom.resize();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.driving && !state.paused) {
      pausedFromBlur = true;
      pauseGame(true);
    }
  });

  bindAudioSliders();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.0001, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (state.driving && state.world) {
    state.world.update(dt);
    audio.tickAmbience(dt);
    state.hudTimer += dt;
    if (state.hudTimer > 0.07) {
      state.hudTimer = 0;
      updateHud();
    }
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  audio.setSettings(save.audio);
  syncMuteUI();
  updateWallet();
  updateMenuSummary();
  renderAudioSettings();
  bindEvents();
  $("#screen-menu").classList.remove("is-hidden");
  $("#hud").classList.add("is-hidden");
  driveCanvas.classList.add("is-hidden");
  requestAnimationFrame(loop);
}

boot();
