import { VEHICLES } from "./data.js";

const ENGINE_PROFILES = {
  motorcycle: { base: 92, range: 260, type: "sawtooth", cutoff: 1900, sub: 0.35, volume: 0.8 },
  supercar: { base: 62, range: 220, type: "sawtooth", cutoff: 1400, sub: 0.7, volume: 1 },
  truck: { base: 36, range: 86, type: "square", cutoff: 640, sub: 1, volume: 1.15 },
  duck: { base: 58, range: 180, type: "triangle", cutoff: 1000, sub: 0.55, volume: 0.75 },
  wheelchair: { base: 120, range: 520, type: "sine", cutoff: 2600, sub: 0.2, volume: 0.5 },
};

const AMBIENCE = {
  city: { cutoff: 320, gain: 0.018, q: 0.7, birds: false },
  country: { cutoff: 900, gain: 0.026, q: 0.5, birds: true },
  desert: { cutoff: 700, gain: 0.02, q: 0.4, birds: false },
  mountain: { cutoff: 620, gain: 0.028, q: 0.5, birds: false },
  forest: { cutoff: 1100, gain: 0.02, q: 0.7, birds: true },
};

const MENU_SCALE = [146.83, 174.61, 220.0, 261.63, 329.63, 440.0];
const DRIVE_SCALE = [110.0, 130.81, 164.81, 196.0, 246.94, 329.63];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export class GameAudio {
  constructor(settings = null) {
    this.ctx = null;
    this.ready = false;
    this.settings = {
      master: 0.45,
      music: 0.24,
      sfx: 0.55,
      muted: false,
      ...settings,
    };
    this.mode = "menu";
    this.musicStep = 0;
    this.engine = null;
    this.engineIdle = 0;
    this.ambienceId = null;
    this.ambience = null;
    this.lastOvertakeAt = 0;
    this.ducked = false;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch {
          /* the browser will retry on the next gesture */
        }
      }
      return this.ready;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    this.ctx = new AudioContextClass();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.25;
    this.master.connect(this.compressor).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.0001;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.0001;
    this.sfxBus.connect(this.master);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 0.0001;
    this.ambienceBus.connect(this.master);

    this.noiseBuffer = this.buildNoise(2.5);
    this.buildMusic();
    this.applyVolumes(true);

    this.ready = true;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this.applyVolumes(true);
    return true;
  }

  buildNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06;
      data[i] = last * 0.85 + white * 0.15;
    }
    return buffer;
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.applyVolumes();
  }

  applyVolumes(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const time = immediate ? 0.03 : 0.16;
    const { master, music, sfx, muted } = this.settings;
    const masterTarget = muted ? 0.0001 : 0.16 + Math.pow(clamp(master), 1.35) * 0.72;
    const musicTarget =
      muted ? 0.0001 : (0.12 + music * 0.38) * (this.mode === "drive" ? 0.55 : 1);
    const sfxTarget = muted ? 0.0001 : 0.18 + sfx * 0.55;

    this.master.gain.setTargetAtTime(Math.max(0.0001, masterTarget), now, time);
    this.musicBus.gain.setTargetAtTime(Math.max(0.0001, musicTarget), now, time);
    this.sfxBus.gain.setTargetAtTime(Math.max(0.0001, sfxTarget), now, time);
    this.ambienceBus.gain.setTargetAtTime(
      muted ? 0.0001 : 0.25 + clamp(master) * 0.5,
      now,
      time * 1.8
    );
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === "menu") this.startMusic();
    this.applyVolumes();
  }

  // -------------------------------------------------------------------------
  // Music
  // -------------------------------------------------------------------------
  buildMusic() {
    const ctx = this.ctx;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 900;
    this.musicFilter.Q.value = 0.6;
    this.musicFilter.connect(this.musicBus);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.05;
    this.padGain.connect(this.musicFilter);

    this.padOscA = ctx.createOscillator();
    this.padOscA.type = "triangle";
    this.padOscA.frequency.value = 73.42;
    this.padOscB = ctx.createOscillator();
    this.padOscB.type = "sine";
    this.padOscB.frequency.value = 110;
    this.padOscB.detune.value = 4;
    this.padOscA.connect(this.padGain);
    this.padOscB.connect(this.padGain);
    this.padOscA.start();
    this.padOscB.start();

    this.musicTimer = window.setInterval(() => {
      this.musicTick();
    }, 540);
  }

  startMusic() {
    if (!this.ready) return;
    this.musicOn = true;
  }

  musicTick() {
    if (!this.ready || !this.musicOn) return;
    const ctx = this.ctx;
    if (ctx.state !== "running") return;
    this.musicStep += 1;
    const scale = this.mode === "drive" ? DRIVE_SCALE : MENU_SCALE;
    const root = this.mode === "drive" ? 55 : 73.42;
    if (this.musicStep % 16 === 1) {
      const now = ctx.currentTime;
      this.padOscA.frequency.setTargetAtTime(root, now, 1.8);
      this.padOscB.frequency.setTargetAtTime(root * 1.5, now, 1.8);
    }
    if (this.musicStep % 2 === 0) {
      const note = scale[(this.musicStep * 3 + (this.musicStep % 5)) % scale.length];
      const delay = 0.02;
      this.sfxSchedule(
        "music",
        note * 2,
        0.9,
        {
          type: "sine",
          volume: this.mode === "drive" ? 0.018 : 0.026,
          attack: 0.12,
          release: 0.75,
          filter: 1800,
          delay,
        }
      );
      if (this.musicStep % 8 === 0) {
        this.sfxSchedule("music", note * 0.5, 1.6, {
          type: "triangle",
          volume: 0.017,
          attack: 0.2,
          release: 1.2,
          filter: 900,
          delay: 0.06,
        });
      }
    }
    if (this.musicStep % 16 === 8) {
      this.sfxSchedule("music", scale[0] * 2, 1.4, {
        type: "sine",
        volume: 0.012,
        attack: 0.3,
        release: 1.0,
        filter: 1400,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Engine
  // -------------------------------------------------------------------------
  startEngine(vehicleId) {
    if (!this.ready) return;
    this.stopEngine();
    const profile = ENGINE_PROFILES[vehicleId] || ENGINE_PROFILES.supercar;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.sfxBus);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = profile.cutoff;
    filter.Q.value = 1.2;
    filter.connect(out);

    const osc = ctx.createOscillator();
    osc.type = profile.type;
    osc.frequency.value = profile.base;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.4;
    osc.connect(oscGain).connect(filter);

    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.value = profile.base * 0.5;
    const subGain = ctx.createGain();
    subGain.gain.value = profile.sub * 0.4;
    sub.connect(subGain).connect(filter);

    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.value = 420;
    airFilter.Q.value = 0.8;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.02;
    air.connect(airFilter).connect(airGain).connect(out);

    osc.start();
    sub.start();
    air.start();

    this.engine = { profile, out, filter, osc, sub, air, airFilter, airGain };
    this.engine.volume = 0;
  }

  updateEngine(speedRatio = 0, throttle = false, active = true) {
    if (!this.engine || !this.ctx) return;
    const now = this.ctx.currentTime;
    const engine = this.engine;
    const profile = engine.profile;
    const ratio = clamp(speedRatio);
    const targetFreq = profile.base + profile.range * ratio + (throttle ? profile.range * 0.04 : 0);
    const targetGain = active
      ? (0.012 + ratio * 0.022 + (throttle ? 0.008 : 0)) * profile.volume
      : this.engineIdle;
    engine.osc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    engine.sub.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.08);
    engine.filter.frequency.setTargetAtTime(
      profile.cutoff * (0.55 + ratio * 0.75),
      now,
      0.12
    );
    engine.airFilter.frequency.setTargetAtTime(260 + ratio * 620, now, 0.15);
    engine.airGain.gain.setTargetAtTime(0.008 + ratio * 0.026, now, 0.16);
    engine.out.gain.setTargetAtTime(targetGain, now, 0.1);
  }

  duckEngine(ducked) {
    this.ducked = !!ducked;
    this.engineIdle = ducked ? 0.003 : 0;
    if (!this.engine) return;
    if (ducked) {
      this.engine.out.gain.setTargetAtTime(0.002, this.ctx.currentTime, 0.12);
    }
  }

  stopEngine() {
    if (!this.engine) return;
    const engine = this.engine;
    const now = this.ctx.currentTime;
    engine.out.gain.cancelScheduledValues(now);
    engine.out.gain.setTargetAtTime(0.0001, now, 0.08);
    this.engine = null;
    window.setTimeout(() => {
      try {
        engine.osc.stop();
        engine.sub.stop();
        engine.air.stop();
      } catch {
        /* already stopped */
      }
      engine.out.disconnect();
    }, 380);
  }

  // -------------------------------------------------------------------------
  // Ambience
  // -------------------------------------------------------------------------
  startAmbience(environmentId, timeId) {
    if (!this.ready) return;
    this.setAmbience(environmentId, timeId);
    if (this.ambience) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.ambienceBus);

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    source.connect(filter).connect(gain).connect(out);
    source.start();
    this.ambience = { source, filter, gain, out };
    this.ambienceId = environmentId;
    this.birdTimer = 0;
    out.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8);
  }

  setAmbience(environmentId, timeId) {
    this.ambienceEnvironment = environmentId;
    this.ambienceTime = timeId;
    if (!this.ambience || !this.ctx) return;
    const profile = AMBIENCE[environmentId] || AMBIENCE.city;
    const night = timeId === "night";
    const now = this.ctx.currentTime;
    this.ambience.filter.frequency.setTargetAtTime(
      profile.cutoff * (night ? 0.55 : 1),
      now,
      1.1
    );
    this.ambience.gain.gain.setTargetAtTime(profile.gain * (night ? 0.7 : 1), now, 1.2);
  }

  tickAmbience(dt) {
    if (!this.ready || !this.ambience || !this.ambienceEnvironment) return;
    const profile = AMBIENCE[this.ambienceEnvironment];
    this.birdTimer = (this.birdTimer || 0) + dt;
    const night = this.ambienceTime === "night" ? 1 : 0;
    const interval = night ? 7 : profile?.birds ? 5.5 : 12;
    if (this.birdTimer < interval) return;
    this.birdTimer = 0;
    if (this.settings.muted) return;
    if (night) {
      // A distant, soft night chirp.
      const base = 1500 + Math.random() * 400;
      for (let i = 0; i < 3; i++) {
        this.tone(base * (1 + i * 0.015), 0.045, {
          type: "sine",
          volume: 0.008,
          bus: "ambience",
          delay: i * 0.09,
          filter: 3000,
        });
      }
    } else if (profile?.birds) {
      const base = 1700 + Math.random() * 900;
      this.tone(base, 0.11, {
        type: "sine",
        volume: 0.012,
        bus: "ambience",
        glide: base * 1.35,
        delay: 0,
        filter: 3600,
      });
      this.tone(base * 1.28, 0.08, {
        type: "sine",
        volume: 0.009,
        bus: "ambience",
        glide: base * 1.6,
        delay: 0.14,
        filter: 3600,
      });
    }
  }

  stopAmbience() {
    if (!this.ambience) return;
    const ambience = this.ambience;
    this.ambience = null;
    try {
      ambience.source.stop();
    } catch {
      /* already stopped */
    }
    ambience.out.disconnect();
  }

  // -------------------------------------------------------------------------
  // Core note helpers
  // -------------------------------------------------------------------------
  bus(name) {
    if (name === "music") return this.musicBus;
    if (name === "ambience") return this.ambienceBus;
    return this.sfxBus;
  }

  tone(
    frequency,
    duration,
    {
      type = "sine",
      volume = 0.08,
      bus = "sfx",
      glide = null,
      delay = 0,
      attack = 0.006,
      release = null,
      filter = 2600,
      pan = 0,
    } = {}
  ) {
    if (!this.ctx || this.settings.muted) return;
    const ctx = this.ctx;
    const starts = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = filter;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, frequency), starts);
    if (glide != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, glide),
        starts + duration
      );
    }
    const tau = release ?? duration * 0.7;
    gain.gain.setValueAtTime(0.0001, starts);
    gain.gain.linearRampToValueAtTime(volume, starts + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, starts + Math.max(attack + 0.02, duration));
    osc.connect(lowpass).connect(gain);
    const destination = this.bus(bus);
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner).connect(destination);
    } else {
      gain.connect(destination);
    }
    osc.start(starts);
    osc.stop(starts + Math.max(0.08, duration) + 0.05);
  }

  noise(
    duration,
    {
      from = 900,
      to = 200,
      volume = 0.1,
      type = "lowpass",
      delay = 0,
      bus = "sfx",
      pan = 0,
      q = 0.8,
    } = {}
  ) {
    if (!this.ctx || this.settings.muted) return;
    const ctx = this.ctx;
    const starts = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(40, from), starts);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), starts + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, starts);
    gain.gain.linearRampToValueAtTime(volume, starts + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, starts + duration);
    source.connect(filter).connect(gain);
    const destination = this.bus(bus);
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner).connect(destination);
    } else {
      gain.connect(destination);
    }
    source.start(starts);
    source.stop(starts + duration + 0.04);
  }

  sfxSchedule(bus, frequency, duration, options) {
    this.tone(frequency, duration, { ...options, bus });
  }

  // -------------------------------------------------------------------------
  // Game sounds
  // -------------------------------------------------------------------------
  uiClick() {
    this.tone(760, 0.05, { type: "triangle", volume: 0.04, filter: 1800 });
    this.tone(1080, 0.045, { type: "sine", volume: 0.02, delay: 0.025, filter: 2200 });
  }

  uiBack() {
    this.tone(520, 0.07, { type: "triangle", volume: 0.035, filter: 1500 });
    this.tone(390, 0.09, { type: "sine", volume: 0.022, delay: 0.05, filter: 1300 });
  }

  error() {
    this.tone(190, 0.11, { type: "triangle", volume: 0.055, glide: 140, filter: 900 });
  }

  purchase() {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      this.tone(freq, 0.22, {
        type: "triangle",
        volume: 0.055,
        delay: i * 0.075,
        filter: 2600,
      });
    });
  }

  upgrade() {
    [440, 587.33, 880].forEach((freq, i) => {
      this.tone(freq, 0.3, {
        type: "sine",
        volume: 0.05,
        delay: i * 0.09,
        filter: 2800,
      });
    });
  }

  crash() {
    this.noise(0.5, { from: 1500, to: 120, volume: 0.24, q: 0.6 });
    this.tone(105, 0.36, { type: "sine", volume: 0.14, glide: 42, filter: 600 });
    this.tone(220, 0.14, { type: "triangle", volume: 0.035, glide: 80, delay: 0.02 });
    this.noise(0.2, { from: 3200, to: 800, volume: 0.05, type: "bandpass", delay: 0.02, q: 1.4 });
  }

  nearMiss() {
    this.noise(0.3, { from: 380, to: 1600, volume: 0.08, type: "bandpass", q: 1.2 });
    this.tone(880, 0.18, { type: "sine", volume: 0.035, glide: 1320, delay: 0.05, filter: 3200 });
  }

  overtake() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastOvertakeAt < 0.18) return;
    this.lastOvertakeAt = now;
    this.noise(0.12, { from: 600, to: 300, volume: 0.015, type: "bandpass" });
  }

  countdown() {
    this.tone(392, 0.12, { type: "triangle", volume: 0.075, filter: 1400 });
    this.tone(196, 0.16, { type: "sine", volume: 0.045, filter: 800 });
  }

  go() {
    this.tone(523.25, 0.12, { type: "triangle", volume: 0.08, filter: 2000 });
    this.tone(783.99, 0.35, { type: "triangle", volume: 0.07, delay: 0.07, filter: 2400 });
    this.tone(1046.5, 0.4, { type: "sine", volume: 0.05, delay: 0.1, filter: 3000 });
  }

  timeUp() {
    this.tone(392, 0.5, { type: "sine", volume: 0.07, glide: 196, filter: 1400 });
    this.tone(261.63, 0.8, { type: "triangle", volume: 0.05, delay: 0.1, filter: 1000 });
  }

  finish(reason) {
    if (reason === "time") {
      [392, 523.25, 659.25, 783.99].forEach((freq, i) => {
        this.tone(freq, 0.5, {
          type: "triangle",
          volume: 0.06,
          delay: i * 0.13,
          filter: 2200,
        });
      });
      this.tone(196, 1.0, { type: "sine", volume: 0.05, delay: 0.12, filter: 800 });
    } else {
      this.timeUp();
    }
  }

  // Case opening, in the spirit of the crate-spin classics: a latch, a rattle
  // of wooden ticks that slowly settles, then a bright stinger.
  caseOpen() {
    this.tone(196, 0.12, { type: "square", volume: 0.045, filter: 1800 });
    this.tone(392, 0.16, { type: "square", volume: 0.03, glide: 523.25, delay: 0.05, filter: 2200 });
    this.noise(0.24, { from: 700, to: 2600, volume: 0.028, type: "bandpass", q: 1.1, delay: 0.03 });
    this.noise(0.05, { from: 1800, to: 900, volume: 0.02, type: "bandpass", q: 1.6 });
  }

  caseTick(progress = 0, last = false) {
    if (!this.ctx) return;
    const p = clamp(progress);
    if (last) {
      this.tone(880, 0.09, { type: "square", volume: 0.035, filter: 3000 });
      this.tone(1318.5, 0.16, { type: "triangle", volume: 0.028, delay: 0.045, filter: 3400 });
      this.noise(0.12, { from: 4200, to: 1600, volume: 0.024, type: "bandpass", q: 1.5 });
      return;
    }
    // A short wooden clack rather than a piercing blip.
    const pitch = 520 + p * 240;
    this.tone(pitch, 0.032, {
      type: "square",
      volume: 0.014 + p * 0.008,
      glide: pitch * 0.6,
      filter: 1900,
    });
    this.noise(0.026, { from: 2200, to: 800, volume: 0.01, type: "bandpass", q: 1.4 });
  }

  caseReveal(rarity) {
    const chords = {
      common: [261.63, 329.63],
      uncommon: [293.66, 369.99, 440],
      rare: [349.23, 440, 523.25],
      epic: [392, 493.88, 587.33, 783.99],
      legendary: [440, 554.37, 659.25, 880],
      mythic: [523.25, 659.25, 783.99, 1046.5, 1318.5],
    };
    const notes = chords[rarity] || chords.common;
    // The stop: a low thud with a little dust, then the arcade fanfare.
    this.tone(130.81, 0.36, { type: "sine", volume: 0.07, glide: 55, filter: 500 });
    this.noise(0.34, { from: 2800, to: 260, volume: 0.05, type: "lowpass", q: 0.7 });
    notes.forEach((freq, i) => {
      this.tone(freq, 0.26, {
        type: "square",
        volume: 0.026,
        delay: 0.07 + i * 0.075,
        filter: 2400,
      });
      this.tone(freq / 2, 0.3, {
        type: "triangle",
        volume: 0.02,
        delay: 0.07 + i * 0.075,
        filter: 1100,
      });
    });
    if (rarity === "mythic" || rarity === "legendary") {
      for (let i = 0; i < 4; i++) {
        this.tone(1318.5 + i * 130, 0.24, {
          type: "sine",
          volume: 0.022,
          delay: 0.34 + i * 0.08,
          filter: 4200,
        });
      }
    }
  }

  duplicate() {
    this.tone(392, 0.25, { type: "triangle", volume: 0.045, filter: 1800 });
    this.tone(523.25, 0.3, { type: "sine", volume: 0.035, delay: 0.09, filter: 2200 });
  }
}
