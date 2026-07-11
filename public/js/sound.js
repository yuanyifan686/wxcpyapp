// sound.js - Web Audio API sound effects
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.masterGain = null;
    this.compressor = null;
    this.volume = 0.48;
    this.bgmGain = null;
    this.bgmTimer = null;
    this.bpm = 132;
    this.step = 0;
    this.bgmStartTime = 0;
    this.onBeat = null;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.22;
      this.bgmGain.connect(this.masterGain);
      this.initialized = true;
      this.wake();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  wake() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain) {
      this.masterGain.gain.value = vol;
    }
  }

  playTone(freq, duration = 0.1, type = 'square') {
    if (!this.initialized) return;
    this.wake();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  makeTone(freq, duration, type, gainValue, destination = this.masterGain, startOffset = 0) {
    if (!this.initialized) return;
    this.wake();
    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  startBgm() {
    if (!this.initialized) return;
    this.wake();
    this.stopBgm();
    this.step = 0;
    this.bgmStartTime = this.ctx.currentTime;
    const stepMs = (60 / this.bpm / 2) * 1000;
    this.scheduleBgmStep();
    this.bgmTimer = setInterval(() => this.scheduleBgmStep(), stepMs);
  }

  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  scheduleBgmStep() {
    if (!this.initialized || !this.bgmGain) return;
    const s = this.step % 16;
    const bass = [55, 55, 65.41, 55, 82.41, 73.42, 65.41, 55];

    if (s % 4 === 0) {
      this.playKick(0.78);
      this.onBeat?.(s);
    }
    if (s === 4 || s === 12) this.playSnare();
    if (s % 2 === 0) this.playHat(s % 4 === 0 ? 0.18 : 0.12);
    if (s % 2 === 0) this.makeTone(bass[(s / 2) % bass.length], 0.18, 'sawtooth', 0.055, this.bgmGain);
    if ([3, 7, 11, 15].includes(s)) {
      const note = [440, 523.25, 659.25, 587.33][Math.floor(s / 4)];
      this.makeTone(note, 0.08, 'triangle', 0.035, this.bgmGain);
    }

    this.step += 1;
  }

  playKick(intensity = 1) {
    if (!this.initialized || !this.bgmGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.13);
    gain.gain.setValueAtTime(0.32 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playSnare() {
    this.noiseBurst(0.08, 0.11, 'bandpass', 1900, 1.4, this.bgmGain);
  }

  playHat(gain = 0.12) {
    this.noiseBurst(0.035, gain, 'highpass', 5500, 0.8, this.bgmGain);
  }

  noiseBurst(duration, gainValue, filterType, frequency, q = 1, destination = this.masterGain) {
    if (!this.initialized) return;
    this.wake();
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start();
    noise.stop(this.ctx.currentTime + duration);
  }

  playImpact(intensity = 1) {
    if (!this.initialized) return;
    this.wake();
    const now = this.ctx.currentTime;
    const strength = Math.max(0.35, Math.min(1.6, intensity));

    const thump = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(92 * strength, now);
    thump.frequency.exponentialRampToValueAtTime(38, now + 0.16);
    gain.gain.setValueAtTime(0.34 * strength, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    thump.connect(gain);
    gain.connect(this.masterGain);
    thump.start(now);
    thump.stop(now + 0.18);

    this.noiseBurst(0.09, 0.18 * strength, 'lowpass', 520, 0.8);
  }

  playCrack(intensity = 1) {
    if (!this.initialized) return;
    const strength = Math.max(0.4, Math.min(1.4, intensity));
    this.noiseBurst(0.12, 0.22 * strength, 'bandpass', 1300 + Math.random() * 900, 4);
    this.playTone(220 + Math.random() * 80, 0.055, 'triangle');
    setTimeout(() => this.playTone(480 + Math.random() * 160, 0.04, 'square'), 28);
  }

  playShatter(intensity = 1) {
    if (!this.initialized) return;
    const strength = Math.max(0.7, Math.min(1.8, intensity));
    this.playImpact(1.05 * strength);
    this.noiseBurst(0.22, 0.34 * strength, 'highpass', 1800, 0.7);
    this.noiseBurst(0.16, 0.24 * strength, 'bandpass', 4200, 5);

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playTone(900 + Math.random() * 1800, 0.035 + Math.random() * 0.035, i % 2 ? 'triangle' : 'sine');
      }, i * 18);
    }
  }

  getBeatAccuracy() {
    if (!this.initialized || !this.bgmTimer || !this.bgmStartTime) {
      return { label: '', accuracy: 0 };
    }
    const beat = 60 / this.bpm;
    const elapsed = this.ctx.currentTime - this.bgmStartTime;
    const phase = elapsed % beat;
    const distance = Math.min(phase, beat - phase);
    const normalized = Math.max(0, 1 - distance / 0.16);
    if (normalized > 0.82) return { label: 'PERFECT', accuracy: normalized };
    if (normalized > 0.48) return { label: 'GOOD', accuracy: normalized };
    return { label: '', accuracy: normalized };
  }

  playRhythmHit(intensity = 1, accuracy = 0) {
    const boost = 1 + accuracy * 0.45;
    this.playImpact(intensity * boost);
    if (accuracy > 0.5) {
      this.makeTone(660 + accuracy * 220, 0.055, 'triangle', 0.08 * boost);
      setTimeout(() => this.makeTone(990 + accuracy * 280, 0.04, 'sine', 0.055 * boost), 34);
    }
  }

  playCharge(power = 1) {
    if (!this.initialized) return;
    this.wake();
    const now = this.ctx.currentTime;
    const duration = 0.42;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(360 + power * 240, now + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + duration);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
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
    if (!this.initialized) return;

    // Rising pitch for combo
    const baseFreq = 400 + combo * 50;
    this.playTone(baseFreq, 0.1, 'sine');
    setTimeout(() => this.playTone(baseFreq * 1.25, 0.1, 'sine'), 50);
  }

  playExplosion() {
    if (!this.initialized) return;
    this.wake();

    // Low boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 60;
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);
    gain.gain.value = 0.68;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);

    // Noise
    this.noiseBurst(0.34, 0.52, 'lowpass', 760, 0.8);
    setTimeout(() => this.noiseBurst(0.24, 0.3, 'highpass', 1800, 0.7), 45);
    setTimeout(() => this.playShatter(1.45), 70);
  }

  playSqueeze() {
    if (!this.initialized) return;
    this.wake();

    // Squishy sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 200;
    osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.15);
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playClick() {
    if (!this.initialized) return;
    this.playImpact(0.45);
    this.playTone(620, 0.035, 'square');
  }
}
