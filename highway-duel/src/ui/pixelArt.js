import { mulberry32 } from "../game/rng.js";

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(
    ca[1] + (cb[1] - ca[1]) * t
  )},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`;
}

function disc(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  for (let y = -radius; y <= radius; y += 1) {
    const span = Math.floor(Math.sqrt(radius * radius - y * y));
    ctx.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1);
  }
}

function lineRect(ctx, x1, y1, x2, y2, color, thickness = 1) {
  ctx.fillStyle = color;
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    ctx.fillRect(
      Math.round(x1 + (x2 - x1) * t),
      Math.round(y1 + (y2 - y1) * t),
      thickness,
      thickness
    );
  }
}

// ---------------------------------------------------------------------------
// Main menu: a small animated night highway.
// ---------------------------------------------------------------------------
export class MenuArt {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.active = true;
    this.time = 0;
    this.last = performance.now();
    this.w = 340;
    this.h = 220;
    this.stars = [];
    this.cars = [
      { z: 0.18, lane: -0.55, speed: 0.035, tone: "#25201a" },
      { z: 0.52, lane: 0.25, speed: 0.06, tone: "#2a241d" },
      { z: 0.78, lane: -0.2, speed: 0.085, tone: "#1b1b17" },
      { z: 0.34, lane: 0.72, speed: 0.045, tone: "#221e1a" },
    ];
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    this.w = 340;
    this.h = Math.max(160, Math.round((this.w * height) / Math.max(1, width)));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
    this.buildStars();
    this.draw(0);
  }

  buildStars() {
    const random = mulberry32(1993);
    this.stars = [];
    for (let i = 0; i < 78; i++) {
      this.stars.push({
        x: Math.floor(random() * this.w),
        y: Math.floor(random() * this.h * 0.45),
        phase: random() * Math.PI * 2,
        big: random() < 0.12,
      });
    }
  }

  setActive(active) {
    this.active = active;
    if (active) {
      this.resize();
      this.last = performance.now();
    }
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (!this.active) return;
    this.time += dt;
    for (const car of this.cars) {
      car.z += dt * car.speed;
      if (car.z > 1.06) {
        car.z = 0.08 + Math.random() * 0.18;
        car.lane = [-0.62, -0.22, 0.22, 0.62][Math.floor(Math.random() * 4)];
      }
    }
    this.draw(this.time);
  }

  draw(time) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const horizon = Math.floor(h * 0.56);
    const vp = Math.floor(w * 0.5);
    const roadBottom = Math.round(w * 0.7);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = reduceMotion ? 0 : time;

    // Sky, stepped in deliberate horizontal bands.
    for (let y = 0; y < horizon; y += 2) {
      const ratio = y / horizon;
      let color;
      if (ratio < 0.55) color = mix("#060c0a", "#14231d", ratio / 0.55);
      else color = mix("#14231d", "#75522f", (ratio - 0.55) / 0.45);
      ctx.fillStyle = color;
      ctx.fillRect(0, y, w, 2);
    }

    // A warm horizon shelf, dither fringe and low light bloom.
    ctx.fillStyle = "#b4864c";
    ctx.fillRect(0, horizon - 4, w, 1);
    ctx.fillStyle = "#8a6338";
    ctx.fillRect(0, horizon - 3, w, 1);
    ctx.fillStyle = "#3b2d20";
    for (let x = 2; x < w; x += 7) {
      ctx.fillRect(x, horizon - 8, 3, 1);
      ctx.fillRect(x + 3, horizon - 6, 2, 1);
    }
    ctx.fillStyle = "#c79b60";
    for (let x = -3; x < w; x += 9) ctx.fillRect(x + ((x * 7) % 4), horizon - 1, 4, 1);

    // Stars.
    for (const star of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.4 + star.phase);
      if (twinkle < 0.35) continue;
      ctx.fillStyle = twinkle > 0.82 ? "#f2e8cd" : "#8d8e7a";
      ctx.fillRect(star.x, star.y, star.big && twinkle > 0.7 ? 2 : 1, 1);
    }

    // Moon with a couple of carved craters.
    const moonX = Math.round(w * 0.82);
    const moonY = Math.round(h * 0.18);
    disc(ctx, moonX, moonY, Math.max(7, Math.round(w * 0.028)), "#e6dcc2");
    ctx.fillStyle = "#b9ae96";
    ctx.fillRect(moonX - 4, moonY - 3, 2, 2);
    ctx.fillRect(moonX + 3, moonY + 2, 2, 1);
    ctx.fillRect(moonX - 1, moonY + 5, 2, 1);
    disc(ctx, moonX - Math.max(4, Math.round(w * 0.017)), moonY - 2, Math.max(5, Math.round(w * 0.022)), "#09100e");

    // Long low cloud shelves.
    ctx.fillStyle = "#17201d";
    for (const [cy, cw] of [
      [Math.round(h * 0.27), Math.round(w * 0.28)],
      [Math.round(h * 0.36), Math.round(w * 0.16)],
    ]) {
      ctx.fillRect(Math.round(w * 0.08), cy, cw, 1);
      ctx.fillRect(Math.round(w * 0.1), cy + 2, cw - 18, 1);
    }

    // Distant industrial skyline on the left.
    const random = mulberry32(771);
    let bx = 0;
    while (bx < w * 0.38) {
      const bw = 5 + Math.floor(random() * 11);
      const bh = 4 + Math.floor(random() * (horizon * 0.24));
      ctx.fillStyle = "#0a100e";
      ctx.fillRect(bx, horizon - bh, bw, bh);
      ctx.fillStyle = "#27342a";
      ctx.fillRect(bx, horizon - bh, bw, 1);
      ctx.fillStyle = "#b88f4f";
      for (let wy = horizon - bh + 3; wy < horizon - 2; wy += 4) {
        if (random() < 0.3) ctx.fillRect(bx + 2 + Math.floor(random() * Math.max(1, bw - 4)), wy, 1, 1);
      }
      if (random() < 0.6) {
        ctx.fillStyle = "#ddb36e";
        ctx.fillRect(bx + Math.floor(bw / 2), horizon - bh - 2, 1, 2);
      }
      bx += bw + 2 + Math.floor(random() * 4);
    }

    // Trees and hills on the right.
    ctx.fillStyle = "#0a1310";
    for (let x = Math.round(w * 0.66); x < w; x += 4) {
      const height = 4 + Math.floor(random() * 12);
      ctx.fillRect(x, horizon - height, 3, height);
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.round(w * 0.55) + i * 7;
      const y = horizon - 3 - ((i * 5) % 9);
      ctx.fillStyle = i % 2 ? "#0d1410" : "#0a100d";
      ctx.fillRect(x, y, 9, 5);
    }

    // Ground fields either side of the road.
    ctx.fillStyle = "#101811";
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.fillStyle = "#172217";
    for (let y = horizon + 2; y < h; y += 5) {
      const step = 8 + Math.round(((y - horizon) / (h - horizon)) * 22);
      for (let x = 0; x < w; x += step) {
        ctx.fillRect(x + (y % 3), y, 3, 1);
      }
    }

    // Road silhouette.
    for (let y = horizon; y < h; y += 1) {
      const ratio = (y - horizon) / Math.max(1, h - horizon);
      const half = 4 + ratio * ratio * roadBottom;
      const left = Math.round(vp - half);
      const width = Math.round(half * 2);
      ctx.fillStyle = y % 4 < 2 ? "#24251f" : "#20211c";
      ctx.fillRect(left, y, width, 1);
      if (y % 9 === 0) {
        ctx.fillStyle = "#2d2e26";
        ctx.fillRect(left + 3, y, Math.max(1, width - 6), 1);
      }
    }

    // Shoulders and continuous edge lines.
    for (const side of [-1, 1]) {
      for (let y = horizon; y < h; y += 2) {
        const ratio = (y - horizon) / Math.max(1, h - horizon);
        const half = 4 + ratio * ratio * roadBottom;
        const x = Math.round(vp + side * half);
        ctx.fillStyle = "#b8b49e";
        ctx.fillRect(x, y, 1, 2);
        ctx.fillStyle = "#6d634d";
        ctx.fillRect(x + side * 2, y, 1, 2);
      }
    }

    // Dashed lane separators in perspective.
    const laneRatios = [-0.5, 0, 0.5];
    for (let band = 0; band < 15; band++) {
      const depth = (band + ((t * 0.55) % 1)) / 15;
      const ratio = 0.04 + depth * depth * 0.96;
      const y = horizon + ratio * (h - horizon);
      const half = 4 + ratio * ratio * roadBottom;
      const dashHeight = Math.max(1, Math.round(ratio * 8));
      for (const lane of laneRatios) {
        const x = Math.round(vp + lane * half * 1.58);
        ctx.fillStyle = lane === 0 ? "#e2dac0" : "#b8b29b";
        ctx.fillRect(x, Math.round(y), 1, dashHeight);
      }
    }

    // Reflection studs.
    for (const side of [-1, 1]) {
      for (let band = 1; band < 8; band++) {
        const depth = band / 8;
        const ratio = depth * depth;
        const y = Math.round(horizon + ratio * (h - horizon));
        const half = 4 + ratio * ratio * roadBottom;
        ctx.fillStyle = "#c09552";
        ctx.fillRect(Math.round(vp + side * half) + side * 3, y, 1, 1);
      }
    }

    // Utility poles and wires on the left verge.
    const poleBaseY = Math.round(h * 0.79);
    const poleX = Math.round(w * 0.185);
    ctx.fillStyle = "#090d0b";
    ctx.fillRect(poleX, poleBaseY - 52, 2, 52);
    ctx.fillRect(poleX - 9, poleBaseY - 48, 20, 1);
    ctx.fillRect(poleX - 6, poleBaseY - 44, 14, 1);
    ctx.fillStyle = "#d9a35e";
    ctx.fillRect(poleX + 1, poleBaseY - 49, 1, 1);
    for (let i = 1; i < 5; i++) {
      lineRect(ctx, poleX - 9, poleBaseY - 48 + i * 2, poleX - 40, poleBaseY - 39 + i * 2, "#1a211b", 1);
    }

    // Roadside lamp with a stepped pool of sodium light.
    const lampX = Math.round(w * 0.1);
    const lampY = Math.round(h * 0.7);
    ctx.fillStyle = "#080c09";
    ctx.fillRect(lampX, lampY - 48, 2, 48);
    ctx.fillRect(lampX, lampY - 50, 20, 2);
    ctx.fillStyle = "#d6a05b";
    ctx.fillRect(lampX + 18, lampY - 48, 4, 2);
    ctx.fillStyle = "rgba(214,160,91,0.09)";
    ctx.fillRect(lampX + 8, lampY - 46, 28, 10);
    ctx.fillRect(lampX + 2, lampY - 36, 46, 18);
    ctx.fillRect(lampX - 8, lampY - 18, 66, 30);

    // Guardrail posts on the near verge.
    for (const side of [-1, 1]) {
      for (let band = 3; band < 9; band++) {
        const ratio = band / 9;
        const y = Math.round(horizon + ratio * (h - horizon));
        const half = 4 + ratio * ratio * roadBottom;
        const x = Math.round(vp + side * (half + 5));
        ctx.fillStyle = "#111711";
        ctx.fillRect(x, y - 2, 1, Math.max(2, Math.round(ratio * 7)));
        ctx.fillStyle = "#c1bca6";
        ctx.fillRect(x, y - 2, 1, 1);
      }
    }

    // A pair of headlights far down the road.
    ctx.fillStyle = "#f0c36a";
    ctx.fillRect(vp - 2, horizon + 3, 1, 1);
    ctx.fillRect(vp + 2, horizon + 3, 1, 1);

    // Traffic, drawn rear-on so the tail lights read.
    for (const car of this.cars) {
      const ratio = car.z * car.z;
      const y = horizon + ratio * (h - horizon) * 0.82;
      const half = 4 + ratio * ratio * roadBottom;
      const x = vp + car.lane * half * 1.2;
      const scale = 1 + ratio * 4.2;
      this.drawCar(ctx, x, y, scale, car);
    }

    // Foreground grain and the dark bottom edge.
    ctx.fillStyle = "#060a08";
    for (let x = 0; x < w; x += 3) {
      const depth = 2 + ((x * 13) % 7);
      ctx.fillRect(x, h - depth, 2, depth);
    }
    const vignette = ctx.createLinearGradient(0, h * 0.7, 0, h);
    vignette.addColorStop(0, "rgba(4,7,6,0)");
    vignette.addColorStop(1, "rgba(4,7,6,0.85)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    // A little blinking beacon on the horizon.
    if (!reduceMotion && Math.sin(t * 2.3) > 0.72) {
      ctx.fillStyle = "#d86a43";
      ctx.fillRect(Math.round(w * 0.11), horizon - 32, 2, 2);
    }
  }

  drawCar(ctx, x, y, scale, car) {
    const w = Math.max(3, Math.round(5 * scale));
    const h = Math.max(2, Math.round(3 * scale));
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y) + 1, w, h);
    ctx.fillStyle = car.tone;
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h);
    ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y - h - 1), Math.max(1, w - 2), 1);
    ctx.fillStyle = "#b44b34";
    const light = Math.max(1, Math.round(scale * 0.55));
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), light, 1);
    ctx.fillRect(Math.round(x + w / 2) - light, Math.round(y - 1), light, 1);
  }

  dispose() {
    window.removeEventListener("resize", this.onResize);
  }
}

// ---------------------------------------------------------------------------
// Pixel scenery thumbnails for the route select screen.
// ---------------------------------------------------------------------------
const TIME_PALETTE = {
  morning: { top: "#46534a", mid: "#827057", horizon: "#d19e63", glow: "#f0cb8b", ground: "#26331f", sun: "#f2daa0" },
  afternoon: { top: "#54655b", mid: "#8b8266", horizon: "#d8b67c", glow: "#f3dfa8", ground: "#2c3a22", sun: "#f8e5ae" },
  sunset: { top: "#1c1716", mid: "#5b382b", horizon: "#c56a41", glow: "#ffc27d", ground: "#211b14", sun: "#ffd08a" },
  night: { top: "#050809", mid: "#0b1415", horizon: "#1b2928", glow: "#7a8f87", ground: "#0a100d", sun: "#e8e3ce" },
  auto: { top: "#3c4943", mid: "#756956", horizon: "#bc9764", glow: "#e5c17f", ground: "#23301d", sun: "#f1d79a" },
};

function rectLine(ctx, x, y, width, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), 1);
}

export function drawSceneryThumb(canvas, environmentId, timeId) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const palette = TIME_PALETTE[timeId === "auto" ? "auto" : timeId] || TIME_PALETTE.sunset;
  const horizon = Math.round(h * 0.64);
  const vp = Math.round(w * 0.5);
  const random = mulberry32(environmentId.length * 97 + 311);
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < horizon; y += 2) {
    const ratio = y / horizon;
    const color =
      ratio < 0.6
        ? mix(palette.top, palette.mid, ratio / 0.6)
        : mix(palette.mid, palette.horizon, (ratio - 0.6) / 0.4);
    ctx.fillStyle = color;
    ctx.fillRect(0, y, w, 2);
  }

  // Sun or moon.
  const isNight = timeId === "night";
  const sunX = Math.round(w * 0.74);
  const sunY = Math.round(h * (timeId === "morning" ? 0.35 : 0.28));
  if (isNight) {
    disc(ctx, sunX, sunY, Math.max(3, Math.round(w * 0.017)), palette.sun);
    disc(ctx, sunX - 2, sunY - 1, Math.max(2, Math.round(w * 0.014)), palette.top);
  } else {
    disc(ctx, sunX, sunY, Math.max(4, Math.round(w * 0.028)), palette.sun);
  }

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Far hills.
  ctx.fillStyle = mix(palette.top, palette.ground, 0.45);
  for (let x = 0; x < w; x += 4) {
    const height = 4 + Math.floor(random() * 9);
    ctx.fillRect(x, horizon - height, 4, height);
  }

  if (environmentId === "city") {
    ctx.fillStyle = "#0b1110";
    let x = 2;
    while (x < w * 0.44) {
      const bw = 5 + Math.floor(random() * 9);
      const bh = 6 + Math.floor(random() * 28);
      ctx.fillRect(x, horizon - bh, bw, bh);
      ctx.fillStyle = "#d0a45f";
      if (random() < 0.8) ctx.fillRect(x + 2, horizon - bh + 4, 1, 1);
      if (random() < 0.7) ctx.fillRect(x + bw - 3, horizon - bh + 9, 1, 1);
      ctx.fillStyle = "#0b1110";
      x += bw + 2;
    }
    ctx.fillStyle = "#111815";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(w * 0.52 + i * 9, horizon - 8 - i * 3, 7, 8 + i * 3);
    }
  } else if (environmentId === "country") {
    // Barn and silo.
    ctx.fillStyle = "#3c2119";
    ctx.fillRect(Math.round(w * 0.14), horizon - 13, 24, 13);
    ctx.fillStyle = "#151612";
    ctx.fillRect(Math.round(w * 0.13), horizon - 17, 27, 4);
    ctx.fillStyle = "#776c58";
    ctx.fillRect(Math.round(w * 0.29), horizon - 20, 6, 20);
    ctx.fillStyle = "#484a3f";
    ctx.fillRect(Math.round(w * 0.28), horizon - 23, 8, 3);
    // Wind turbine.
    ctx.fillStyle = "#3d463c";
    ctx.fillRect(Math.round(w * 0.79), horizon - 26, 1, 26);
    ctx.fillRect(Math.round(w * 0.78), horizon - 27, 5, 1);
    ctx.fillRect(Math.round(w * 0.79), horizon - 30, 1, 3);
    // Fence.
    for (let x = 6; x < w * 0.4; x += 7) {
      ctx.fillStyle = "#3c3325";
      ctx.fillRect(x, horizon - 4, 1, 4);
    }
    rectLine(ctx, 0, horizon - 3, w * 0.42, "#3c3325");
  } else if (environmentId === "desert") {
    // Mesas.
    for (let i = 0; i < 4; i++) {
      const x = w * 0.06 + i * w * 0.23;
      const height = 12 + (i % 3) * 7;
      ctx.fillStyle = "#5b2c1d";
      ctx.fillRect(Math.round(x), horizon - height, Math.round(w * 0.16), height);
      ctx.fillStyle = "#7a3a24";
      ctx.fillRect(Math.round(x), horizon - height, Math.round(w * 0.16), 2);
      ctx.fillStyle = "#482317";
      ctx.fillRect(Math.round(x) + 2, horizon - height + 4, Math.round(w * 0.12), 1);
    }
    // Cacti.
    for (let i = 0; i < 4; i++) {
      const x = Math.round(w * 0.12 + i * w * 0.2);
      ctx.fillStyle = "#2d3b25";
      ctx.fillRect(x, horizon - 10, 2, 10);
      ctx.fillRect(x - 3, horizon - 8, 3, 2);
      ctx.fillRect(x - 3, horizon - 8, 2, 4);
      ctx.fillRect(x + 2, horizon - 6, 3, 2);
      ctx.fillRect(x + 3, horizon - 6, 2, 4);
    }
  } else if (environmentId === "mountain") {
    // Snow-capped peaks.
    for (let i = 0; i < 5; i++) {
      const x = w * 0.05 + i * w * 0.2;
      const height = 18 + (i % 3) * 9;
      ctx.fillStyle = "#34413d";
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(x + w * 0.11, horizon - height);
      ctx.lineTo(x + w * 0.22, horizon);
      ctx.fill();
      ctx.fillStyle = "#d7d4c1";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.075, horizon - height * 0.65);
      ctx.lineTo(x + w * 0.11, horizon - height);
      ctx.lineTo(x + w * 0.15, horizon - height * 0.65);
      ctx.fill();
    }
    ctx.fillStyle = "#111a16";
    for (let x = 0; x < w; x += 5) {
      const height = 4 + Math.floor(random() * 8);
      ctx.fillRect(x, horizon - height, 3, height);
    }
  } else if (environmentId === "forest") {
    // Dense conifers.
    for (let i = 0; i < 28; i++) {
      const x = Math.round(random() * w);
      const height = 8 + Math.floor(random() * 24);
      ctx.fillStyle = i % 3 === 0 ? "#101d16" : "#0b1711";
      for (let layer = 0; layer < 3; layer++) {
        const lw = Math.max(2, Math.round((height / 2) * (1 - layer * 0.22)));
        ctx.fillRect(x - Math.round(lw / 2), horizon - height + layer * Math.round(height * 0.24), lw, Math.round(height * 0.28));
      }
      ctx.fillRect(x, horizon - 4, 1, 4);
    }
  }

  // Verge and road.
  ctx.fillStyle = mix(palette.ground, "#171b16", 0.35);
  ctx.fillRect(0, horizon + 2, w, h - horizon);
  const bottomHalf = Math.round(w * 0.34);
  for (let y = horizon + 2; y < h; y += 2) {
    const ratio = (y - horizon) / (h - horizon);
    const half = 2 + ratio * ratio * bottomHalf;
    ctx.fillStyle = "#181a17";
    ctx.fillRect(Math.round(vp - half), y, Math.round(half * 2), 2);
  }
  for (let y = horizon + 3; y < h; y += 2) {
    const ratio = (y - horizon) / (h - horizon);
    const half = 2 + ratio * ratio * bottomHalf;
    ctx.fillStyle = "#c1bca6";
    ctx.fillRect(Math.round(vp - half), y, 1, 1);
    ctx.fillRect(Math.round(vp + half), y, 1, 1);
  }
  for (let i = 0; i < 7; i++) {
    const ratio = (i + 1) / 8;
    const y = Math.round(horizon + ratio * ratio * (h - horizon));
    const half = 2 + ratio * ratio * bottomHalf;
    ctx.fillStyle = "#b7b199";
    ctx.fillRect(vp, y, 1, Math.max(1, Math.round(ratio * 4)));
    ctx.fillRect(Math.round(vp + half * 0.5), y, 1, Math.max(1, Math.round(ratio * 3)));
    ctx.fillRect(Math.round(vp - half * 0.5), y, 1, Math.max(1, Math.round(ratio * 3)));
  }

  // A tiny route marker.
  ctx.fillStyle = "#d8c89e";
  ctx.fillRect(5, h - 19, 22, 13);
  ctx.fillStyle = "#0b0d0a";
  ctx.fillRect(7, h - 17, 18, 9);
  ctx.fillStyle = palette.horizon;
  ctx.fillRect(9, h - 15, 12, 1);
  ctx.fillRect(9, h - 12, 8, 1);
}

// ---------------------------------------------------------------------------
// Garage roster plates: a 96x40 side-profile of each machine.
// ---------------------------------------------------------------------------
function drawWheel(ctx, scale, cx, cy, r, rim) {
  ctx.fillStyle = "#050706";
  ctx.fillRect(Math.round((cx - r) * scale), Math.round((cy - r + 1) * scale), Math.round(r * 2 * scale), Math.round((r * 2 - 2) * scale));
  ctx.fillRect(Math.round((cx - r + 1) * scale), Math.round((cy - r) * scale), Math.round((r * 2 - 2) * scale), Math.round(r * 2 * scale));
  ctx.fillStyle = rim;
  ctx.fillRect(Math.round((cx - 1.5) * scale), Math.round((cy - 1.5) * scale), Math.round(3 * scale), Math.round(3 * scale));
  ctx.fillStyle = "#0a0e0b";
  ctx.fillRect(Math.round((cx - 0.5) * scale), Math.round((cy - 0.5) * scale), scale, scale);
}

export function drawVehicleBadge(canvas, vehicleId, wrap) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const scale = 2;
  const colors = wrap?.colors || {};
  const primary = colors.primary || "#c8d3e2";
  const secondary = colors.secondary || "#1b2331";
  const accent = colors.accent || "#e88a3c";
  const ink = "#060907";
  const glass = "#0c1210";
  const p = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale));
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  p(0, 0, 48, 20, "#090d0a");
  p(0, 15, 48, 5, "#0c110d");
  p(0, 15, 48, 1, "#1d251c");
  for (let x = 2; x < 47; x += 5) {
    p(x, 17, 2, 1, "#141b14");
    p(x + 1, 18, 2, 1, "#111711");
  }

  if (vehicleId === "motorcycle") {
    drawWheel(ctx, scale, 10, 15, 4, accent);
    drawWheel(ctx, scale, 37, 15, 4, accent);
    // Fork and frame.
    p(10, 12, 2, 3, "#596257");
    p(36, 8, 2, 7, "#596257");
    p(12, 11, 14, 2, primary);
    p(24, 9, 10, 2, primary);
    p(32, 8, 6, 2, primary);
    p(18, 8, 9, 3, primary);
    p(16, 7, 5, 2, ink);
    // Rider.
    p(20, 3, 5, 5, ink);
    p(21, 2, 4, 2, accent);
    p(19, 6, 3, 3, ink);
    p(18, 8, 3, 2, ink);
    p(23, 7, 5, 2, ink);
    p(25, 12, 4, 1, "#596257");
    // Headlight and tail.
    p(41, 9, 1, 2, "#f0c36a");
    p(8, 9, 1, 2, "#c8563e");
    p(12, 6, 5, 1, "#596257");
  } else if (vehicleId === "supercar") {
    drawWheel(ctx, scale, 14, 15, 4, "#aeb6ac");
    drawWheel(ctx, scale, 36, 15, 4, "#aeb6ac");
    p(7, 11, 36, 4, ink);
    p(8, 10, 34, 3, primary);
    p(6, 9, 10, 2, primary);
    p(30, 9, 10, 2, primary);
    p(38, 10, 4, 2, primary);
    p(9, 8, 6, 2, primary);
    p(15, 8, 15, 2, primary);
    p(17, 6, 11, 2, glass);
    p(18, 5, 9, 2, secondary);
    p(16, 7, 2, 2, glass);
    p(27, 7, 3, 2, glass);
    p(29, 6, 1, 2, glass);
    p(5, 4, 10, 1, secondary);
    p(6, 5, 2, 3, secondary);
    p(12, 5, 2, 3, secondary);
    p(31, 9, 7, 1, accent);
    p(8, 11, 3, 1, "#c8563e");
    p(9, 10, 2, 1, "#c8563e");
    p(41, 10, 2, 1, "#f0c36a");
    p(42, 11, 1, 1, "#f0c36a");
    p(16, 13, 12, 1, secondary);
  } else if (vehicleId === "truck") {
    drawWheel(ctx, scale, 12, 15, 4, "#9aa394");
    drawWheel(ctx, scale, 33, 15, 4, "#9aa394");
    drawWheel(ctx, scale, 39, 15, 4, "#9aa394");
    p(4, 4, 26, 11, ink);
    p(5, 3, 24, 12, secondary);
    p(7, 5, 19, 2, "#ffffff22");
    p(7, 9, 17, 1, "#ffffff14");
    p(29, 7, 12, 8, primary);
    p(30, 3, 9, 5, primary);
    p(31, 4, 7, 3, glass);
    p(30, 10, 11, 1, accent);
    p(40, 9, 2, 2, "#f0c36a");
    p(4, 9, 1, 4, "#c8563e");
    p(5, 15, 23, 1, ink);
  } else if (vehicleId === "duck") {
    drawWheel(ctx, scale, 12, 15, 4, "#c99c2e");
    drawWheel(ctx, scale, 36, 15, 4, "#c99c2e");
    p(6, 11, 34, 4, ink);
    p(7, 10, 31, 4, primary);
    p(13, 8, 15, 3, primary);
    p(15, 8, 10, 2, glass);
    p(16, 7, 8, 1, primary);
    // The oversized duck head rides on the roof.
    p(25, 3, 10, 7, ink);
    p(26, 2, 8, 8, primary);
    p(27, 1, 6, 2, primary);
    p(33, 6, 6, 2, "#e88a3c");
    p(34, 8, 4, 2, "#e88a3c");
    p(30, 5, 1, 1, ink);
    p(27, 4, 2, 1, "#f5e7b8");
    // Tail feather and tail lights.
    p(5, 6, 3, 4, primary);
    p(6, 5, 2, 2, primary);
    p(7, 11, 2, 1, accent);
    p(31, 11, 2, 1, "#c8563e");
  } else {
    // Purpose-built racing wheelchair, seen side-on.
    drawWheel(ctx, scale, 13, 13, 5, "#c6cfdb");
    drawWheel(ctx, scale, 40, 16, 2, "#c6cfdb");
    // Frame, seat and footplate.
    p(12, 11, 20, 1, primary);
    p(16, 7, 6, 2, primary);
    p(17, 9, 2, 3, primary);
    p(22, 10, 14, 2, secondary);
    p(31, 13, 8, 1, primary);
    p(38, 14, 2, 3, primary);
    p(32, 9, 6, 1, secondary);
    p(30, 8, 2, 2, accent);
    // Athlete: helmet, torso, forward arms.
    p(22, 2, 4, 3, "#d8b48a");
    p(21, 1, 6, 1, accent);
    p(20, 5, 8, 5, ink);
    p(19, 6, 3, 1, ink);
    p(27, 5, 9, 2, ink);
    p(32, 6, 4, 1, "#d8b48a");
    p(37, 7, 2, 1, "#d8b48a");
    p(22, 10, 4, 2, ink);
    p(27, 12, 4, 1, ink);
    // Frame flashes and number board.
    p(14, 10, 6, 1, accent);
    p(8, 12, 3, 1, accent);
    p(9, 11, 1, 3, accent);
  }
}

// The studio mark: a tiny dusk highway inside a 24x24 tile.
export function paintLogo(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 24, 24);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#080c09";
  ctx.fillRect(0, 0, 24, 24);

  for (let y = 2; y < 15; y += 2) {
    ctx.fillStyle = y < 8 ? "#111a16" : "#3b3020";
    ctx.fillRect(1, y, 22, 2);
  }
  ctx.fillStyle = "#141c16";
  ctx.fillRect(1, 1, 22, 1);

  // Low sun and horizon.
  ctx.fillStyle = "#e88a3c";
  ctx.fillRect(4, 9, 2, 2);
  ctx.fillRect(3, 10, 4, 1);
  ctx.fillStyle = "#8a6a3e";
  ctx.fillRect(1, 15, 22, 1);

  // Road with a vanishing point.
  ctx.fillStyle = "#11130f";
  for (let y = 15; y < 24; y++) {
    const half = 2 + (y - 15) * 1.1;
    ctx.fillRect(Math.round(12 - half), y, Math.round(half * 2), 1);
  }
  ctx.fillStyle = "#d8cfae";
  ctx.fillRect(11, 16, 1, 2);
  ctx.fillRect(10, 20, 1, 3);

  // A tiny car from behind, tail lights lit.
  ctx.fillStyle = "#d8cfae";
  ctx.fillRect(8, 18, 8, 4);
  ctx.fillStyle = "#1b1f18";
  ctx.fillRect(9, 19, 6, 2);
  ctx.fillStyle = "#c8563e";
  ctx.fillRect(9, 21, 1, 1);
  ctx.fillRect(14, 21, 1, 1);

  // Corner pin marks.
  ctx.fillStyle = "#e88a3c";
  ctx.fillRect(0, 0, 3, 1);
  ctx.fillRect(0, 0, 1, 3);
  ctx.fillRect(21, 23, 3, 1);
  ctx.fillRect(23, 21, 1, 3);
}
