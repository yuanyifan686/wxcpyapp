// sound.js - Multi-style BGM + punchy hit feedback
// Frequencies in Hz. Patterns are 16-step (8th notes) loops.

/** @typedef {{ id:string, name:string, bpm:number, intensity:number, colors:{a:string,b:string,c:string}, kicks:number[], snares:number[], ghostSnares:number[], hats:'drive'|'busy'|'sparse', bass:number[], lead:number[], chords:number[], leadGain:number, bassGain:number, padGain:number }} BgmStyle */

/** @type {BgmStyle[]} */
const BGM_STYLES = [
  {
    id: 'neon-pulse',
    name: '霓虹脉冲',
    bpm: 128,
    intensity: 1,
    colors: { a: '#22D3EE', b: '#A855F7', c: '#FF8BD1' },
    kicks: [0, 4, 8, 12],
    snares: [4, 12],
    ghostSnares: [6, 14],
    hats: 'drive',
    bass: [55, 55, 65.41, 55, 73.42, 65.41, 82.41, 55],
    lead: [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 880, 783.99],
    chords: [130.81, 196, 261.63],
    leadGain: 0.045,
    bassGain: 0.07,
    padGain: 0.026
  },
  {
    id: 'deep-chill',
    name: '深空解压',
    bpm: 96,
    intensity: 0.75,
    colors: { a: '#38BDF8', b: '#6366F1', c: '#A78BFA' },
    kicks: [0, 8],
    snares: [8],
    ghostSnares: [12],
    hats: 'sparse',
    bass: [41.2, 41.2, 49, 41.2, 55, 49, 61.74, 41.2],
    lead: [392, 440, 493.88, 440, 349.23, 392, 523.25, 440],
    chords: [98, 146.83, 196],
    leadGain: 0.038,
    bassGain: 0.08,
    padGain: 0.04
  },
  {
    id: 'cyber-break',
    name: '赛博碎拍',
    bpm: 138,
    intensity: 1.2,
    colors: { a: '#F472B6', b: '#A855F7', c: '#22D3EE' },
    kicks: [0, 3, 6, 10, 12],
    snares: [4, 11, 14],
    ghostSnares: [7],
    hats: 'busy',
    bass: [61.74, 61.74, 73.42, 55, 82.41, 73.42, 98, 61.74],
    lead: [659.25, 783.99, 880, 1046.5, 783.99, 659.25, 987.77, 880],
    chords: [123.47, 185, 246.94],
    leadGain: 0.05,
    bassGain: 0.075,
    padGain: 0.02
  },
  {
    id: 'voltage-rush',
    name: '电压狂飙',
    bpm: 150,
    intensity: 1.35,
    colors: { a: '#FBBF24', b: '#F43F5E', c: '#22D3EE' },
    kicks: [0, 4, 8, 10, 12],
    snares: [4, 12],
    ghostSnares: [6, 14, 15],
    hats: 'busy',
    bass: [73.42, 73.42, 82.41, 73.42, 98, 87.31, 110, 73.42],
    lead: [740, 880, 987.77, 880, 659.25, 783.99, 1174.66, 987.77],
    chords: [146.83, 220, 293.66],
    leadGain: 0.055,
    bassGain: 0.072,
    padGain: 0.018
  },
  {
    id: 'lofi-glow',
    name: '微光 Lo-fi',
    bpm: 84,
    intensity: 0.65,
    colors: { a: '#34D399', b: '#60A5FA', c: '#F9A8D4' },
    kicks: [0, 7, 10],
    snares: [8],
    ghostSnares: [12, 14],
    hats: 'sparse',
    bass: [36.71, 36.71, 41.2, 36.71, 46.25, 41.2, 55, 36.71],
    lead: [329.63, 349.23, 392, 349.23, 293.66, 329.63, 440, 392],
    chords: [87.31, 130.81, 174.61],
    leadGain: 0.032,
    bassGain: 0.085,
    padGain: 0.045
  },
  {
    id: 'glitch-wave',
    name: '故障波',
    bpm: 118,
    intensity: 1.1,
    colors: { a: '#2DD4BF', b: '#E879F9', c: '#FDE047' },
    kicks: [0, 5, 8, 13],
    snares: [4, 12, 15],
    ghostSnares: [2, 10],
    hats: 'drive',
    bass: [51.91, 55, 51.91, 61.74, 55, 69.3, 61.74, 51.91],
    lead: [554.37, 659.25, 739.99, 830.61, 659.25, 554.37, 987.77, 739.99],
    chords: [103.83, 155.56, 207.65],
    leadGain: 0.048,
    bassGain: 0.068,
    padGain: 0.024
  }
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmBus = null;
    this.bgmDuck = null;
    this.compressor = null;
    this.volume = 0.72;
    this.muted = false;
    this.bgmGain = null;
    this.bgmTimer = null;
    this.nextStepTime = 0;
    this.lookahead = 0.12;
    this.scheduleAhead = 0.25;
    this.styles = BGM_STYLES;
    this.styleIndex = 0;
    this.style = BGM_STYLES[0];
    this.bpm = this.style.bpm;
    this.step = 0;
    this.barCount = 0;
    this.barsPerStyle = 8; // auto-switch every 8 bars (~16–30s depending on BPM)
    this.bgmStartTime = 0;
    this.onBeat = null;
    /** @type {null | ((style: BgmStyle, reason: string) => void)} */
    this.onStyleChange = null;
    this.hitCount = 0;
    // C major pentatonic-ish ladder for combo notes (节奏大师式音阶)
    this.noteScale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.12;
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // SFX bus — always punchy and slightly louder than bed
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.15;
      this.sfxGain.connect(this.masterGain);

      // BGM with ducking node for sidechain-like punch
      this.bgmDuck = this.ctx.createGain();
      this.bgmDuck.gain.value = 1;
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.42;
      this.bgmBus = this.ctx.createGain();
      this.bgmBus.gain.value = 1;
      this.bgmGain.connect(this.bgmDuck);
      this.bgmDuck.connect(this.bgmBus);
      this.bgmBus.connect(this.masterGain);

      this.initialized = true;
      this.wake();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    if (this.muted) this.stopBgm();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  wake() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = vol;
    }
  }

  get stepSec() {
    return 60 / this.bpm / 2; // 8th notes at BPM
  }

  get beatSec() {
    return 60 / this.bpm;
  }

  /** Duck BGM briefly so hits feel louder (sidechain). */
  duckBgm(amount = 0.45, attack = 0.02, release = 0.16) {
    if (!this.bgmDuck || this.muted) return;
    const now = this.ctx.currentTime;
    const g = this.bgmDuck.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.max(0.25, 1 - amount), now + attack);
    g.linearRampToValueAtTime(1, now + attack + release);
  }

  playTone(freq, duration = 0.1, type = 'square', gainValue = 0.28, dest = null) {
    if (!this.initialized || this.muted) return;
    this.wake();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(dest || this.sfxGain || this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  makeTone(freq, duration, type, gainValue, destination = null, startOffset = 0) {
    if (!this.initialized || this.muted) return;
    this.wake();
    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(destination || this.sfxGain || this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Soft pad chord tone for BGM atmosphere. */
  makePad(freq, duration, gainValue, startOffset = 0) {
    if (!this.initialized || this.muted || !this.bgmGain) return;
    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  getCurrentStyle() {
    return this.style || this.styles[0];
  }

  /**
   * Pick BGM by campaign level (and reshuffle later styles).
   * Level 1 → style 0, level 2 → style 1, ... wraps around.
   */
  setTrackForLevel(level = 1, reason = 'level') {
    const idx = Math.max(0, (level - 1) % this.styles.length);
    this.applyStyle(idx, reason);
  }

  /** Jump to next style (auto-rotate or manual). */
  nextTrack(reason = 'rotate') {
    const idx = (this.styleIndex + 1) % this.styles.length;
    this.applyStyle(idx, reason);
  }

  applyStyle(index, reason = 'set') {
    const idx = ((index % this.styles.length) + this.styles.length) % this.styles.length;
    const prev = this.style?.id;
    this.styleIndex = idx;
    this.style = this.styles[idx];
    this.bpm = this.style.bpm;
    this.barCount = 0;

    // Soft transition blip when already playing
    if (this.initialized && !this.muted && prev && prev !== this.style.id && this.bgmTimer) {
      this.playStyleTransition();
    }

    try {
      this.onStyleChange?.(this.style, reason);
    } catch (_) {
      /* ignore UI errors */
    }
  }

  playStyleTransition() {
    if (!this.initialized || this.muted) return;
    const now = this.ctx.currentTime;
    // Sweep up + down whoosh so style change is audible
    this.makeToneAt(now, 220, 0.12, 'sawtooth', 0.06, this.bgmGain);
    this.makeToneAt(now + 0.04, 440, 0.1, 'triangle', 0.05, this.bgmGain);
    this.makeToneAt(now + 0.08, 660, 0.12, 'sine', 0.04, this.bgmGain);
    this.noiseBurstAt(now, 0.1, 0.12, 'bandpass', 1800, 1, this.bgmGain);
  }

  startBgm(level = 1) {
    if (!this.initialized || this.muted) return;
    this.wake();
    this.stopBgm();
    this.setTrackForLevel(level, 'start');
    this.step = 0;
    this.barCount = 0;
    this.bgmStartTime = this.ctx.currentTime + 0.05;
    this.nextStepTime = this.bgmStartTime;
    this.schedulerTick();
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /** Lookahead scheduler — tighter than setInterval, less drift. */
  schedulerTick() {
    if (!this.initialized || this.muted || !this.bgmGain) return;
    const now = this.ctx.currentTime;
    while (this.nextStepTime < now + this.scheduleAhead) {
      this.scheduleBgmStepAt(this.nextStepTime, this.step);
      // stepSec uses live BPM so style changes take effect immediately
      this.nextStepTime += this.stepSec;
      this.step += 1;
    }
    this.bgmTimer = setTimeout(() => this.schedulerTick(), this.lookahead * 1000);
  }

  scheduleBgmStepAt(time, stepIndex) {
    if (!this.initialized || !this.bgmGain) return;
    const st = this.style || this.styles[0];
    const s = stepIndex % 16;
    const intensity = st.intensity || 1;

    // Auto-rotate style every N bars (on bar boundary)
    if (s === 0 && stepIndex > 0) {
      this.barCount += 1;
      if (this.barCount >= this.barsPerStyle) {
        this.nextTrack('auto');
      }
    }

    const isKick = st.kicks.includes(s);
    const isSnare = st.snares.includes(s);
    const isGhost = st.ghostSnares.includes(s);
    const isDownbeat = s === 0;

    if (isKick) {
      const kickPow = isDownbeat ? 1 * intensity : 0.82 * intensity;
      this.playKickAt(time, kickPow);
      this.emitBeatVisual(time, s, {
        kind: isDownbeat ? 'downbeat' : 'beat',
        intensity: kickPow,
        isKick: true,
        isSnare: false
      });
    }

    if (isSnare) this.playSnareAt(time, 0.95 * intensity);
    if (isGhost) this.playSnareAt(time, 0.26 * intensity);

    // Snare-only visual tick (lighter) when no kick same step
    if (isSnare && !isKick) {
      this.emitBeatVisual(time, s, {
        kind: 'snare',
        intensity: 0.7 * intensity,
        isKick: false,
        isSnare: true
      });
    }

    // Hats by style
    if (st.hats === 'busy') {
      this.playHatAt(time, s % 2 === 0 ? 0.14 : 0.09);
    } else if (st.hats === 'sparse') {
      if (s % 4 === 2) this.playHatAt(time, 0.1);
      if (s === 14) this.playHatAt(time, 0.12);
    } else {
      // drive
      if (s % 2 === 0) this.playHatAt(time, s % 4 === 0 ? 0.1 : 0.16);
      else this.playHatAt(time, 0.07);
    }

    // Bass pulse
    if (s % 2 === 0 && st.bass?.length) {
      const note = st.bass[(s / 2) % st.bass.length];
      this.makeToneAt(time, note, 0.2, 'sawtooth', st.bassGain * intensity, this.bgmGain);
      this.makeToneAt(time, note * 2, 0.11, 'square', st.bassGain * 0.28 * intensity, this.bgmGain);
    }

    // Lead arp
    if (s % 2 === 0 && st.lead?.length) {
      const n = st.lead[(s / 2) % st.lead.length];
      this.makeToneAt(time, n, 0.09, 'triangle', st.leadGain * intensity, this.bgmGain);
      this.makeToneAt(time + 0.025, n * 1.5, 0.05, 'sine', st.leadGain * 0.4 * intensity, this.bgmGain);
    }

    // Chord / pad on bar
    if (s === 0 && st.chords?.length) {
      const g = st.padGain * intensity;
      st.chords.forEach((f, i) => this.makePad(f, 0.55 + i * 0.04, g * (1 - i * 0.2)));
    }
  }

  emitBeatVisual(time, step, extra = {}) {
    const st = this.style || this.styles[0];
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    const payload = {
      step,
      kind: extra.kind || 'beat',
      intensity: extra.intensity ?? st.intensity,
      isKick: !!extra.isKick,
      isSnare: !!extra.isSnare,
      styleId: st.id,
      styleName: st.name,
      bpm: st.bpm,
      colors: st.colors
    };
    setTimeout(() => {
      try {
        this.onBeat?.(step, payload);
      } catch (_) {
        /* ignore */
      }
    }, delayMs);
  }

  makeToneAt(time, freq, duration, type, gainValue, destination) {
    if (!this.initialized || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(destination || this.bgmGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  playKickAt(time, intensity = 1) {
    if (!this.initialized || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 * intensity, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(0.55 * intensity, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + 0.22);

    // Kick click transient
    click.type = 'square';
    click.frequency.setValueAtTime(180, time);
    click.frequency.exponentialRampToValueAtTime(60, time + 0.03);
    clickGain.gain.setValueAtTime(0.12 * intensity, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    click.connect(clickGain);
    clickGain.connect(this.bgmGain);
    click.start(time);
    click.stop(time + 0.05);
  }

  playKick(intensity = 1) {
    if (!this.initialized) return;
    this.playKickAt(this.ctx.currentTime, intensity);
  }

  playSnareAt(time, intensity = 1) {
    this.noiseBurstAt(time, 0.09, 0.22 * intensity, 'bandpass', 2100, 1.2, this.bgmGain);
    this.makeToneAt(time, 200, 0.06, 'triangle', 0.08 * intensity, this.bgmGain);
  }

  playSnare() {
    this.playSnareAt(this.ctx.currentTime, 1);
  }

  playHatAt(time, gainValue = 0.12) {
    this.noiseBurstAt(time, 0.03, gainValue, 'highpass', 7000, 0.7, this.bgmGain);
  }

  playHat(gain = 0.12) {
    this.playHatAt(this.ctx.currentTime, gain);
  }

  noiseBurst(duration, gainValue, filterType, frequency, q = 1, destination = null) {
    if (!this.initialized || this.muted) return;
    this.noiseBurstAt(this.ctx.currentTime, duration, gainValue, filterType, frequency, q, destination);
  }

  noiseBurstAt(time, duration, gainValue, filterType, frequency, q = 1, destination = null) {
    if (!this.initialized || this.muted) return;
    this.wake();
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination || this.sfxGain || this.masterGain);
    noise.start(time);
    noise.stop(time + duration + 0.01);
  }

  /**
   * Layered body hit — 节奏大师 style:
   * sub thump + mid snap + pitch ladder note + perfect chime
   */
  playRhythmHit(intensity = 1, accuracy = 0, combo = 1, smashed = false) {
    if (!this.initialized || this.muted) return;
    this.wake();
    const now = this.ctx.currentTime;
    const strength = Math.max(0.4, Math.min(1.8, intensity));
    const perfect = accuracy > 0.82;
    const good = accuracy > 0.48;
    const dest = this.sfxGain || this.masterGain;

    // Sidechain duck so hit sits on top of BGM
    this.duckBgm(perfect ? 0.62 : good ? 0.48 : 0.35, 0.012, perfect ? 0.2 : 0.14);

    // 1) Sub bass punch (the "咚")
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(perfect ? 95 : 78, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    subG.gain.setValueAtTime(0.72 * strength * (perfect ? 1.25 : 1), now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    sub.connect(subG);
    subG.connect(dest);
    sub.start(now);
    sub.stop(now + 0.18);

    // 2) Mid body (the "啪")
    const mid = this.ctx.createOscillator();
    const midG = this.ctx.createGain();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(180 + strength * 40, now);
    mid.frequency.exponentialRampToValueAtTime(90, now + 0.08);
    midG.gain.setValueAtTime(0.38 * strength, now);
    midG.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    mid.connect(midG);
    midG.connect(dest);
    mid.start(now);
    mid.stop(now + 0.1);

    // 3) Transient click / noise snap
    this.noiseBurstAt(now, 0.045, 0.42 * strength, 'highpass', 2800, 0.8, dest);
    this.noiseBurstAt(now, 0.06, 0.22 * strength, 'bandpass', 900, 2.2, dest);

    // 4) Musical pitch — climbs with combo like 节奏大师
    const noteIdx = Math.min(this.noteScale.length - 1, Math.max(0, (combo || 1) - 1));
    const note = this.noteScale[noteIdx] * (perfect ? 1 : good ? 1 : 0.75);
    const noteGain = (perfect ? 0.28 : good ? 0.2 : 0.12) * strength;
    this.makeTone(note, perfect ? 0.14 : 0.08, 'sine', noteGain, dest);
    this.makeTone(note * 2, 0.06, 'triangle', noteGain * 0.45, dest);

    // 5) Perfect / Good extras
    if (perfect) {
      // Bright chime stack
      this.makeTone(note * 1.5, 0.18, 'sine', 0.16, dest);
      this.makeTone(note * 2.5, 0.12, 'triangle', 0.1, dest);
      // Echo for "judgment" sparkle
      this.makeToneAt(now + 0.08, note * 2, 0.1, 'sine', 0.08, dest);
      this.makeToneAt(now + 0.14, note * 3, 0.08, 'sine', 0.05, dest);
      // Soft shaker
      this.noiseBurstAt(now, 0.08, 0.18, 'highpass', 6000, 0.5, dest);
    } else if (good) {
      this.makeTone(note * 1.33, 0.1, 'sine', 0.1, dest);
      this.makeToneAt(now + 0.05, note * 2, 0.06, 'triangle', 0.05, dest);
    }

    // 6) Smash shatter layer
    if (smashed) {
      this.noiseBurstAt(now + 0.01, 0.16, 0.38 * strength, 'highpass', 2200, 0.7, dest);
      this.noiseBurstAt(now + 0.02, 0.12, 0.28 * strength, 'bandpass', 4800, 4, dest);
      for (let i = 0; i < 4; i++) {
        this.makeToneAt(
          now + 0.015 * i,
          900 + Math.random() * 1400 + noteIdx * 40,
          0.04,
          i % 2 ? 'triangle' : 'sine',
          0.08 * strength,
          dest
        );
      }
    }

    this.hitCount += 1;
  }

  playImpact(intensity = 1) {
    this.playRhythmHit(intensity, 0.3, 1, false);
  }

  playCrack(intensity = 1) {
    if (!this.initialized || this.muted) return;
    const strength = Math.max(0.4, Math.min(1.5, intensity));
    this.duckBgm(0.28, 0.01, 0.1);
    this.noiseBurst(0.08, 0.36 * strength, 'bandpass', 1400 + Math.random() * 800, 3.5);
    this.playTone(240 + Math.random() * 60, 0.04, 'triangle', 0.22);
    this.playTone(520 + Math.random() * 120, 0.035, 'square', 0.12);
  }

  playShatter(intensity = 1) {
    if (!this.initialized || this.muted) return;
    this.playRhythmHit(1.1 * intensity, 0.6, 3, true);
  }

  /**
   * Beat judgment window.
   * Checks nearest 8th-note (step) for snappier "on-grid" feel.
   */
  getBeatAccuracy() {
    if (!this.initialized || !this.bgmStartTime || !this.bgmTimer) {
      return { label: '', accuracy: 0, offset: 1 };
    }
    const elapsed = this.ctx.currentTime - this.bgmStartTime;
    if (elapsed < 0) return { label: '', accuracy: 0, offset: 1 };

    // Snap to 8th notes (step grid)
    const step = this.stepSec;
    const phase = elapsed % step;
    const distance = Math.min(phase, step - phase);

    // Windows: PERFECT ~ ±45ms, GOOD ~ ±95ms
    const perfectWin = 0.045;
    const goodWin = 0.095;
    let accuracy = 0;
    let label = '';

    if (distance <= perfectWin) {
      accuracy = 1 - (distance / perfectWin) * 0.15;
      label = 'PERFECT';
    } else if (distance <= goodWin) {
      accuracy = 0.55 + (1 - distance / goodWin) * 0.25;
      label = 'GOOD';
    } else {
      accuracy = Math.max(0, 1 - distance / 0.18) * 0.4;
      label = '';
    }

    // Quarter-note downbeats feel even better
    const beatPhase = elapsed % this.beatSec;
    const onDownbeat = Math.min(beatPhase, this.beatSec - beatPhase) < 0.05;
    if (label === 'PERFECT' && onDownbeat) accuracy = Math.min(1, accuracy + 0.08);

    return { label, accuracy, offset: distance };
  }

  playCharge(power = 1) {
    if (!this.initialized || this.muted) return;
    this.wake();
    const now = this.ctx.currentTime;
    const duration = 0.48;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(420 + power * 260, now + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + duration);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain || this.masterGain);
    osc.start(now);
    osc.stop(now + duration);

    // Rising blips like a rhythm charge meter
    for (let i = 0; i < 5; i++) {
      this.makeToneAt(now + i * 0.08, 400 + i * 120, 0.04, 'square', 0.04 + i * 0.01, this.sfxGain);
    }
  }

  playBreak(size = 'medium') {
    if (!this.initialized) return;
    if (size === 'large') {
      this.playShatter(1.35);
      return;
    }
    if (size === 'medium') {
      this.playShatter(1);
      return;
    }
    this.playCrack(0.75);
  }

  playCombo(combo) {
    if (!this.initialized || this.muted) return;
    const idx = Math.min(this.noteScale.length - 1, Math.max(0, combo - 1));
    const base = this.noteScale[idx];
    this.duckBgm(0.3, 0.01, 0.12);
    this.playTone(base, 0.09, 'sine', 0.22);
    this.playTone(base * 1.25, 0.08, 'triangle', 0.14);
    if (combo >= 5) {
      this.makeToneAt(this.ctx.currentTime + 0.05, base * 1.5, 0.1, 'sine', 0.12, this.sfxGain);
    }
    if (combo >= 10) {
      this.makeToneAt(this.ctx.currentTime + 0.09, base * 2, 0.12, 'sine', 0.1, this.sfxGain);
      this.noiseBurst(0.06, 0.15, 'highpass', 5000, 0.5);
    }
  }

  playExplosion() {
    if (!this.initialized || this.muted) return;
    this.wake();
    const now = this.ctx.currentTime;
    this.duckBgm(0.75, 0.01, 0.35);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.35);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);

    this.noiseBurstAt(now, 0.32, 0.58, 'lowpass', 700, 0.8, this.sfxGain);
    this.noiseBurstAt(now + 0.04, 0.22, 0.35, 'highpass', 1600, 0.7, this.sfxGain);
    this.playRhythmHit(1.4, 0.9, 6, true);
  }

  playSqueeze() {
    if (!this.initialized || this.muted) return;
    this.wake();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain || this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  /** Empty-air tap — still rhythmic so every click feels intentional. */
  playClick() {
    if (!this.initialized || this.muted) return;
    this.wake();
    const beat = this.getBeatAccuracy();
    this.duckBgm(0.22, 0.008, 0.08);
    this.noiseBurst(0.03, 0.2, 'highpass', 3500, 0.8);
    this.playTone(beat.label === 'PERFECT' ? 880 : 620, 0.03, 'square', 0.14);
    if (beat.label) {
      this.playTone(beat.label === 'PERFECT' ? 1320 : 990, 0.04, 'sine', 0.1);
    }
  }
}
