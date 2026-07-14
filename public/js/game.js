// game.js - stress release mode
import { PhysicsEngine } from './physics.js';
import { ParticleSystem } from './effects.js';
import { SoundEngine } from './sound.js';

const STORAGE_KEY = 'cyber_stress_stats_v1';
const MUTE_KEY = 'cyber_stress_muted';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.physics = new PhysicsEngine(this.canvas);
    this.effects = new ParticleSystem(this.canvas);
    this.sound = new SoundEngine();

    // menu | playing | paused | levelclear
    this.state = 'menu';
    this.level = 1;
    this.score = 0;
    this.combo = 0;
    this.maxComboRun = 0;
    this.comboTimer = null;
    this.lastHitTime = 0;
    this.smashedCount = 0;
    this.levelSmashed = 0;
    this.levelTargetTotal = 0;
    this.levelClearing = false;
    this.hitCooldown = new WeakMap();
    this.lastUiUpdate = 0;
    this.uiCache = { level: '', score: '', smashed: '', left: '', progress: '' };
    this.lastFrameTime = 0;
    this.lastTrailAt = 0;
    this.stats = this.loadStats();
    // Adaptive render quality: 2 high · 1 mid · 0 low
    this.quality = 2;
    this._fpsEma = 60;
    this._qualityCooldownAt = 0;
    this._colorCache = new Map();

    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.pointerDownAt = 0;
    this.pointerDownPos = { x: 0, y: 0 };
    this.chargeTimer = null;
    this.chargeRaf = null;
    this.isCharging = false;
    this.chargeStart = 0;
    this.pet = {
      el: document.getElementById('cyber-pet'),
      body: document.getElementById('pet-body'),
      bubble: document.getElementById('pet-bubble'),
      energy: document.getElementById('pet-energy-fill'),
      badge: document.getElementById('pet-stage-badge'),
      power: 18,
      stage: 1,
      superReady: false,
      moodTimer: null,
      lineTimer: null
    };
    this.chargeUi = {
      el: document.getElementById('charge-indicator'),
      fill: document.getElementById('charge-fill'),
      label: document.getElementById('charge-label'),
      bar: document.getElementById('charge-bar-fill'),
      ready: document.getElementById('charge-ready')
    };

    // Init quality before first frame
    this.effects.setQuality?.(this.quality);
    this.physics.setQuality?.(this.quality);
    this.init();
    // Tiny hatchling on load (menu preview)
    this.updatePetSize(1, false);
  }

  loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { bestScore: 0, bestCombo: 0, bestLevel: 1, totalSmashed: 0 };
      const data = JSON.parse(raw);
      return {
        bestScore: Number(data.bestScore) || 0,
        bestCombo: Number(data.bestCombo) || 0,
        bestLevel: Number(data.bestLevel) || 1,
        totalSmashed: Number(data.totalSmashed) || 0
      };
    } catch (_) {
      return { bestScore: 0, bestCombo: 0, bestLevel: 1, totalSmashed: 0 };
    }
  }

  saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (_) {
      /* ignore quota */
    }
  }

  persistProgress() {
    let dirty = false;
    if (this.score > this.stats.bestScore) {
      this.stats.bestScore = this.score;
      dirty = true;
    }
    if (this.maxComboRun > this.stats.bestCombo) {
      this.stats.bestCombo = this.maxComboRun;
      dirty = true;
    }
    if (this.level > this.stats.bestLevel) {
      this.stats.bestLevel = this.level;
      dirty = true;
    }
    // Always flush smashed total occasionally via dirty or forced write
    dirty = true;
    if (dirty) {
      this.saveStats();
      this.refreshBestUI();
    }
  }

  refreshBestUI() {
    const bestScoreEl = document.getElementById('best-score');
    const bestComboEl = document.getElementById('best-combo');
    const bestLevelEl = document.getElementById('best-level');
    if (bestScoreEl) bestScoreEl.textContent = this.stats.bestScore.toLocaleString();
    if (bestComboEl) bestComboEl.textContent = `x${this.stats.bestCombo || 0}`;
    if (bestLevelEl) bestLevelEl.textContent = String(this.stats.bestLevel || 1);
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupEventListeners();
    this.applyMuteFromStorage();
    this.spawnLevel(this.level);
    this.refreshBestUI();
    this.updateUI();
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  applyMuteFromStorage() {
    try {
      const muted = localStorage.getItem(MUTE_KEY) === '1';
      this.sound.setMuted(muted);
      this.syncMuteButton(muted);
    } catch (_) {
      /* ignore */
    }
  }

  syncMuteButton(muted) {
    const btn = document.getElementById('btn-mute');
    if (!btn) return;
    btn.classList.toggle('is-muted', muted);
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.title = muted ? '取消静音' : '静音';
    const iconOn = btn.querySelector('.icon-sound-on');
    const iconOff = btn.querySelector('.icon-sound-off');
    if (iconOn) iconOn.style.display = muted ? 'none' : 'block';
    if (iconOff) iconOff.style.display = muted ? 'block' : 'none';
  }

  toggleMute() {
    this.sound.init();
    const muted = this.sound.toggleMute();
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
    this.syncMuteButton(muted);
    if (!muted && this.state === 'playing') this.sound.startBgm?.(this.level);
    this.sound.playClick();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    // Cap DPR — 3x retina + many blobs = heavy fill-rate
    const dprCap = this.quality === 0 ? 1 : this.quality === 1 ? 1.25 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Faster compositing path
    this.ctx.imageSmoothingEnabled = this.quality > 0;

    this.width = rect.width;
    this.height = rect.height;
    this.physics.setBounds(this.width, this.height);
  }

  setQuality(q) {
    const next = Math.max(0, Math.min(2, q | 0));
    if (next === this.quality) return;
    this.quality = next;
    this.effects.setQuality?.(next);
    this.physics.setQuality?.(next);
    // Rebind canvas resolution for new dpr cap
    this.resize();
  }

  updateAdaptiveQuality(rawDelta) {
    const fps = 1000 / Math.max(rawDelta, 1);
    this._fpsEma = this._fpsEma * 0.9 + fps * 0.1;
    const now = performance.now();
    if (now - this._qualityCheckAt < 800) return;
    this._qualityCheckAt = now;

    if (this._fpsEma < 38 && this.quality > 0) {
      this.setQuality(this.quality - 1);
    } else if (this._fpsEma > 55 && this.quality < 2) {
      // Only climb back if scene is light
      if (this.physics.bodies.length < 16 && this.effects.particles.length < 30) {
        this.setQuality(this.quality + 1);
      }
    }
  }

  cachedShade(hex, percent, mode) {
    const key = `${hex}|${percent}|${mode}`;
    let v = this._colorCache.get(key);
    if (v) return v;
    v = mode === 'light' ? this.lightenColor(hex, percent) : this.darkenColor(hex, percent);
    this._colorCache.set(key, v);
    return v;
  }

  setupEventListeners() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.sound.init();
      this.bindBeatVisuals();
      this.startGame();
    });

    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.hideOverlays();
      this.resetCampaign();
      this.state = 'playing';
      this.sound.startBgm?.(this.level);
    });

    document.getElementById('btn-restart-level').addEventListener('click', () => {
      if (this.state !== 'playing' && this.state !== 'paused') return;
      this.hideOverlays();
      this.state = 'playing';
      this.reloadLevel();
    });

    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.advanceLevel();
    });

    document.getElementById('btn-home').addEventListener('click', () => {
      window.location.href = '/';
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => this.toggleMute());

    // Pet body: only chatter — never full clear (avoids mis-taps wiping the board)
    this.pet.body?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound.init();
      if (this.pet.superReady) {
        this.petSay('能量已满！点金色「超级清扫」或按 Q');
      } else {
        this.petSay('我是小星星，点我就发光～');
      }
      this.setPetMood('happy', 900);
      this.sound.playClick();
    });

    document.getElementById('btn-pet-super')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound.init();
      this.releasePetSuper();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
      } else if (e.code === 'KeyM') {
        this.toggleMute();
      } else if (e.code === 'KeyQ' && this.state === 'playing' && this.pet.superReady) {
        this.releasePetSuper();
      }
    });

    // Pointer events cover mouse + touch more cleanly
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.onPointerDown(e);
    });
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', () => this.onPointerUp());
    this.canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.onPointerUp();
    });

    // Prevent page scroll while smashing on touch devices
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX || e.pageX) - rect.left,
      y: (e.clientY || e.pageY) - rect.top
    };
  }

  onPointerDown(e) {
    if (this.state !== 'playing') return;
    const pos = this.getCanvasPos(e);
    this.isDragging = true;
    this.pointerDownAt = performance.now();
    this.pointerDownPos = pos;
    this.lastMousePos = pos;
    this.startCharge(pos);
    this.tryHit(pos.x, pos.y, true, 1);
  }

  onPointerMove(e) {
    if (this.state !== 'playing' || !this.isDragging) return;
    const pos = this.getCanvasPos(e);
    const moved = Math.hypot(pos.x - this.pointerDownPos.x, pos.y - this.pointerDownPos.y);
    // Allow slight finger jitter while charging; cancel only on real swipe
    if (moved > 22 && this.isCharging) this.cancelCharge();
    if (this.isCharging) this.updateChargeUi(pos, performance.now() - this.chargeStart);

    const now = performance.now();
    if (now - this.lastTrailAt > 28) {
      this.lastTrailAt = now;
      this.effects.emitTrail(pos.x, pos.y, this.isCharging ? '#FFD700' : '#22D3EE');
    }

    // Swipe damage scales slightly with travel speed
    const dist = Math.hypot(pos.x - this.lastMousePos.x, pos.y - this.lastMousePos.y);
    const power = Math.min(1.05, 0.58 + dist * 0.018);
    this.tryHit(pos.x, pos.y, false, power);
    this.lastMousePos = pos;
  }

  onPointerUp() {
    if (this.state === 'playing' && this.isCharging) {
      const held = performance.now() - this.chargeStart;
      this.releaseCharge(this.lastMousePos.x, this.lastMousePos.y, held);
    }
    clearTimeout(this.chargeTimer);
    this.isCharging = false;
    this.isDragging = false;
  }

  startCharge(pos) {
    clearTimeout(this.chargeTimer);
    this.isCharging = false;
    this.chargeTimer = setTimeout(() => {
      if (!this.isDragging || this.state !== 'playing') return;
      this.isCharging = true;
      this.chargeStart = performance.now();
      this.showChargeUi(pos, 0);
      this.tickChargeUi();
      this.effects.emitPressureText(pos.x, pos.y - 26, '蓄力中', '#22D3EE');
      this.petSay('能量蓄满，准备清空');
      this.setPetMood('hyped', 1200);
      this.sound.playCharge(1);
    }, 280);
  }

  cancelCharge() {
    clearTimeout(this.chargeTimer);
    cancelAnimationFrame(this.chargeRaf);
    this.isCharging = false;
    this.hideChargeUi();
  }

  releaseCharge(x, y, held) {
    const charge = Math.min(1, Math.max(0.35, held / 1100));
    const radius = 120 + charge * 150;
    const damage = 70 + charge * 100;
    cancelAnimationFrame(this.chargeRaf);
    this.hideChargeUi();

    this.physics.applyExplosion(x, y, 0.045 + charge * 0.045, radius);
    this.effects.addShockwave(x, y, '#FFD700', radius);
    this.effects.emitBreaking(x, y, '#FFD700', 35);
    this.effects.emitPressureText(x, y - 36, '情绪爆破', '#FFD700');
    this.effects.emitTypographyBurst(x, y, {
      words: ['爆破', 'RELEASE', '清空', 'BOOM'],
      color: '#FFD700',
      spread: radius,
      rows: 5,
      size: 15,
      warp: 34,
      life: 920
    });
    this.sound.playExplosion();
    this.vibrate([18, 25, 42]);
    this.feedPet(16, '这一下很解压');
    this.setPetMood('burst', 1300);
    this.addScreenShake(480);

    this.physics.getBodiesInRadius(x, y, radius).forEach((body) => {
      if (!body.cyberData || body.cyberData.type === 'fragment') return;
      this.damageBody(body, damage, { x, y, impulse: 0.035, fromBlast: true });
    });
  }

  showChargeUi(pos, held) {
    if (!this.chargeUi.el) return;
    this.chargeUi.el.classList.add('active');
    this.updateChargeUi(pos, held);
  }

  updateChargeUi(pos, held) {
    if (!this.chargeUi.el) return;
    const pct = Math.min(1, Math.max(0, held / 1100));
    this.chargeUi.el.style.left = `${pos.x}px`;
    this.chargeUi.el.style.top = `${pos.y - 44}px`;
    this.chargeUi.el.style.setProperty('--charge', `${Math.round(pct * 360)}deg`);
    if (this.chargeUi.bar) this.chargeUi.bar.style.height = `${Math.round(pct * 100)}%`;
    this.chargeUi.el.classList.toggle('ready', pct >= 0.96);
    if (this.chargeUi.label) this.chargeUi.label.textContent = pct >= 0.96 ? '松开释放' : '蓄力中';
  }

  tickChargeUi() {
    if (!this.isCharging) return;
    this.updateChargeUi(this.lastMousePos, performance.now() - this.chargeStart);
    this.chargeRaf = requestAnimationFrame(() => this.tickChargeUi());
  }

  hideChargeUi() {
    this.chargeUi.el?.classList.remove('active', 'ready');
    if (this.chargeUi.bar) this.chargeUi.bar.style.height = '0%';
  }

  tryHit(x, y, force = false, powerScale = 1) {
    // Slightly larger hit radius for finger-friendly smash
    let bodies = this.physics.getBodiesAtPoint(x, y);
    if (!bodies.length) {
      bodies = this.physics.getBodiesInRadius(x, y, force ? 28 : 18);
    }
    if (!bodies.length) {
      if (force) {
        this.effects.emitBreaking(x, y, '#6C63FF', 5);
        this.sound.playClick();
        this.showHitRing(x, y, this.sound.getBeatAccuracy?.() || {}, false);
      }
      return;
    }

    const body = bodies.find(b => b.cyberData && b.cyberData.type !== 'fragment') || bodies[0];
    if (!body?.cyberData || body.cyberData.type === 'fragment') return;

    // Throttle per-body hits during swipe so one swipe doesn't one-shot too fast
    const now = performance.now();
    const last = this.hitCooldown.get(body) || 0;
    if (!force && now - last < 78) return;
    this.hitCooldown.set(body, now);

    // Combo edge: higher combo chips a bit harder
    const comboBoost = 1 + Math.min(0.35, this.combo * 0.03);
    // On-beat hits deal more damage (rhythm master feel)
    const beat = this.sound.getBeatAccuracy?.() || { accuracy: 0 };
    const beatMul = 1 + (beat.accuracy || 0) * 0.55;
    this.damageBody(body, 52 * powerScale * comboBoost * beatMul, {
      x,
      y,
      impulse: force ? 0.032 : 0.017,
      forceTap: force
    });
  }

  showHitRing(x, y, beat = {}, smashed = false) {
    const perfect = beat.label === 'PERFECT';
    const good = beat.label === 'GOOD';
    const color = perfect ? '#FFD700' : good ? '#22D3EE' : '#A855F7';
    this.effects.addShockwave(x, y, color, perfect ? 90 : good ? 70 : 48);
    if (perfect || good) {
      this.effects.emitBreaking(x, y, color, perfect ? 14 : 8);
    }
    // DOM judgment flash (big 节奏大师 style text)
    this.flashJudgment(beat.label || (smashed ? 'HIT' : ''), perfect ? 'perfect' : good ? 'good' : 'hit');
  }

  flashJudgment(text, kind = 'hit') {
    const el = document.getElementById('judgment-flash');
    if (!el || !text) return;
    el.textContent = text;
    el.className = `judgment-flash show ${kind}`;
    clearTimeout(this._judgmentTimer);
    this._judgmentTimer = setTimeout(() => {
      el.classList.remove('show');
    }, kind === 'perfect' ? 420 : 320);
  }

  damageBody(body, amount = 50, hit = null) {
    const { cyberData, position } = body;
    if (!cyberData || cyberData.type === 'fragment') return;
    const beat = this.sound.getBeatAccuracy ? this.sound.getBeatAccuracy() : { label: '', accuracy: 0 };
    const forceTap = !!(hit && hit.forceTap);

    // Beat-synced extra chip damage
    let hitPower = amount;
    if (beat.label === 'PERFECT') hitPower *= 1.2;
    else if (beat.label === 'GOOD') hitPower *= 1.08;

    cyberData.health -= hitPower;
    cyberData.hitFlash = beat.label === 'PERFECT' ? 1.2 : 1;
    cyberData.hitJolt = 1;
    if (hit) {
      const impulseBoost = beat.label === 'PERFECT' ? 1.35 : beat.label === 'GOOD' ? 1.15 : 1;
      this.physics.applyHitImpulse(body, hit.x, hit.y, (hit.impulse || 0.018) * impulseBoost);
    }

    const willSmash = cyberData.health <= 0;

    // Single layered rhythm hit — no double-play of crack+rhythm
    // Throttle full SFX on fast swipes so it stays punchy, not muddy
    const nowSfx = performance.now();
    const sfxGap = forceTap || willSmash ? 0 : 55;
    const playSfx = !this._lastRhythmSfxAt || (nowSfx - this._lastRhythmSfxAt) >= sfxGap;
    if (playSfx) {
      this._lastRhythmSfxAt = nowSfx;
      const intensity = willSmash
        ? (cyberData.role === 'heavy' || cyberData.type === 'neon' ? 1.45 : 1.2)
        : (0.75 + (1 - Math.max(0, cyberData.health) / cyberData.maxHealth) * 0.45);
      this.sound.playRhythmHit(
        intensity * (forceTap ? 1.15 : 0.9),
        beat.accuracy || 0,
        Math.max(1, this.combo),
        willSmash
      );
    }

    if (willSmash) {
      const wasBomb = cyberData.role === 'bomb';
      const blastRadius = cyberData.blastRadius || 0;
      this.physics.fragmentBody(body);
      this.effects.emitBreaking(position.x, position.y, cyberData.color, 25);
      this.effects.emitShards(position.x, position.y, cyberData.color, 12);
      this.effects.addShockwave(position.x, position.y, cyberData.color, beat.label === 'PERFECT' ? 160 : 120);
      this.effects.emitTypographyBurst(position.x, position.y, {
        words: cyberData.role === 'bomb' ? ['BOOM', '释放', 'BOOM'] : ['碎', 'SMASH', '裂开'],
        color: beat.label === 'PERFECT' ? '#FFD700' : cyberData.color,
        spread: cyberData.role === 'bomb' ? 210 : 120,
        rows: cyberData.role === 'bomb' ? 4 : 2,
        size: cyberData.role === 'bomb' ? 14 : 11,
        warp: cyberData.role === 'bomb' ? 28 : 16,
        life: cyberData.role === 'bomb' ? 780 : 520
      });
      this.vibrate(cyberData.role === 'bomb' ? [12, 18, 28] : beat.label === 'PERFECT' ? [10, 16, 10] : 14);
      this.showHitRing(position.x, position.y, beat, true);

      this.updateCombo();
      let points = this.calculatePoints(cyberData.type, cyberData.role);
      if (beat.label === 'PERFECT') points = Math.floor(points * 1.5);
      else if (beat.label === 'GOOD') points = Math.floor(points * 1.2);
      this.score += points;
      this.smashedCount++;
      this.levelSmashed++;
      this.stats.totalSmashed = (this.stats.totalSmashed || 0) + 1;
      this.persistProgress();

      this.effects.emitScorePopup(position.x, position.y - 20, points, beat.label === 'PERFECT' ? '#FFD700' : cyberData.color);
      if (cyberData.label && cyberData.role !== 'bomb') {
        this.effects.emitPressureText(position.x, position.y + 8, `-${cyberData.label}`, cyberData.color, 13);
      }
      if (beat.label) {
        this.effects.emitPressureText(
          position.x,
          position.y - 52,
          beat.label,
          beat.label === 'PERFECT' ? '#FFD700' : '#22D3EE',
          beat.label === 'PERFECT' ? 28 : 20
        );
      }
      this.feedPet(cyberData.role === 'bomb' ? 18 : cyberData.role === 'heavy' ? 14 : 8);
      if (beat.label === 'PERFECT') this.petSay('卡点完美！');
      else if (this.combo >= 4) this.petSay(`连击 x${this.combo}，压力在融化`);
      else if (wasBomb) this.petSay('漂亮，压力连锁坍塌');
      else this.petSay('吞掉一块压力');
      this.addScreenShake(cyberData.role === 'bomb' ? 420 : beat.label === 'PERFECT' ? 340 : 240);
      if (beat.label === 'PERFECT') this.pulseBeatFrame('perfect');
      this.updateUI();
      if (wasBomb) {
        this.chainBlast(position.x, position.y, blastRadius);
      }
      this.checkLevelClear();
    } else {
      this.effects.emitBreaking(position.x, position.y, cyberData.color, 10);
      const crackText = beat.label || (cyberData.label && Math.random() > 0.55 ? cyberData.label : 'HIT');
      this.effects.emitPressureText(
        position.x,
        position.y - 14,
        crackText,
        beat.label === 'PERFECT' ? '#FFD700' : beat.label === 'GOOD' ? '#22D3EE' : cyberData.color,
        beat.label === 'PERFECT' ? 22 : 15
      );
      if (beat.label === 'PERFECT' || Math.random() > 0.55) {
        this.effects.emitTypographyBurst(position.x, position.y, {
          words: beat.label === 'PERFECT' ? ['PERFECT', '卡点'] : ['裂', 'HIT'],
          color: beat.label === 'PERFECT' ? '#FFD700' : cyberData.color,
          spread: beat.label === 'PERFECT' ? 100 : 70,
          rows: 1,
          size: beat.label === 'PERFECT' ? 13 : 10,
          warp: 10,
          life: 360
        });
      }
      this.vibrate(beat.label === 'PERFECT' ? [8, 12, 8] : 8);
      this.showHitRing(position.x, position.y, beat, false);
      if (beat.label === 'PERFECT') this.pulseBeatFrame('perfect');
      this.feedPet(beat.label === 'PERFECT' ? 4 : 2);
      if (Math.random() > 0.72) this.petSay(beat.label === 'PERFECT' ? '这拍打得漂亮' : '裂了，再来一下');
      this.updateUI();
    }
  }

  chainBlast(x, y, radius) {
    this.physics.applyExplosion(x, y, 0.08, radius);
    this.effects.addShockwave(x, y, '#FF3366', radius);
    this.effects.emitBreaking(x, y, '#FF3366', 45);
    this.effects.emitPressureText(x, y - 42, '连锁释放', '#FF3366', 24);
    this.effects.emitTypographyBurst(x, y, {
      words: ['连锁', 'BOOM', '释放', 'BOOM'],
      color: '#FF3366',
      spread: radius + 40,
      rows: 5,
      size: 14,
      warp: 36,
      life: 880,
      spin: 0.04
    });
    this.sound.playExplosion();
    this.vibrate([16, 20, 36]);
    this.feedPet(22, '连锁释放，好爽');
    this.setPetMood('burst', 1400);
    this.addScreenShake(520);

    this.physics.getBodiesInRadius(x, y, radius).forEach((body) => {
      if (!body.cyberData || body.cyberData.type === 'fragment') return;
      this.damageBody(body, 90, { x, y, impulse: 0.045, fromBlast: true });
    });
  }

  calculatePoints(type, role = 'pressure') {
    let base = 80;
    if (type === 'neon') base = 150;
    else if (type === 'sphere') base = 100;
    else if (type === 'triangle') base = 110;
    else if (type === 'capsule') base = 95;
    if (role === 'bomb') base = 180;
    if (role === 'heavy') base = 220;
    const levelMul = 1 + (this.level - 1) * 0.09;
    return Math.floor(base * levelMul * (1 + this.combo * 0.22));
  }

  updateCombo() {
    const now = Date.now();
    if (now - this.lastHitTime < 1200) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastHitTime = now;
    if (this.combo > this.maxComboRun) this.maxComboRun = this.combo;

    if (this.combo >= 2) {
      this.effects.emitCombo(this.lastMousePos.x, this.lastMousePos.y, this.combo);
      this.sound.playCombo(this.combo);
      this.showCombo();
    }

    // Milestone: small pulse damage + score spice every 5 combo
    if (!this._comboPulseLock && this.combo > 0 && this.combo % 5 === 0) {
      this.triggerComboPulse(this.combo);
    }

    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      this.combo = 0;
      this.hideCombo();
    }, 1800);
  }

  triggerComboPulse(combo) {
    if (this._comboPulseLock) return;
    this._comboPulseLock = true;
    const x = this.lastMousePos.x;
    const y = this.lastMousePos.y;
    const radius = 90 + Math.min(combo, 15) * 6;
    this.effects.addShockwave(x, y, '#A855F7', radius);
    this.effects.emitPressureText(x, y - 50, `连击 x${combo}`, '#A855F7', 18);
    this.feedPet(6, combo >= 10 ? '连击狂魔！' : '');
    this.physics.applyExplosion(x, y, 0.012 + combo * 0.001, radius);
    try {
      this.physics.getBodiesInRadius(x, y, radius * 0.75).forEach((body) => {
        if (!body.cyberData || body.cyberData.type === 'fragment') return;
        this.damageBody(body, 18 + combo * 2, { x, y, impulse: 0.012, fromBlast: true });
      });
    } finally {
      this._comboPulseLock = false;
    }
  }

  showCombo() {
    const container = document.getElementById('combo-container');
    const comboEl = document.getElementById('combo');
    container.style.display = 'flex';
    comboEl.textContent = `x${this.combo}`;
    comboEl.style.animation = 'none';
    comboEl.offsetHeight;
    comboEl.style.animation = 'comboPulse 0.3s ease-out';
  }

  hideCombo() {
    document.getElementById('combo-container').style.display = 'none';
  }

  addScreenShake(duration = 300) {
    const frame = document.querySelector('.game-main');
    frame.classList.add('shake');
    setTimeout(() => frame.classList.remove('shake'), duration);
  }

  vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  countTargets() {
    return this.physics.bodies.filter(
      b => b.cyberData && b.cyberData.type !== 'fragment'
    ).length;
  }

  checkLevelClear() {
    if (this.levelClearing || this.state !== 'playing') return;
    if (this.countTargets() > 0) return;

    this.levelClearing = true;
    this.state = 'levelclear';

    const bonus = this.getLevelConfig(this.level).clearBonus;
    const comboBonus = Math.floor(this.maxComboRun * 40);
    this.score += bonus + comboBonus;
    this.persistProgress();

    document.getElementById('level-clear-title').textContent = `第 ${this.level} 波释放完成`;
    const bonusEl = document.getElementById('level-bonus-text');
    if (bonusEl) {
      const grow = ` · 宠物成长 Lv.${this.level + 1}`;
      bonusEl.textContent = comboBonus > 0
        ? `情绪缓存 -${bonus.toLocaleString()} · 连击 +${comboBonus}${grow}`
        : `情绪缓存 -${bonus.toLocaleString()}${grow}`;
    }
    document.getElementById('level-screen').style.display = 'flex';
    document.getElementById('pause-screen').style.display = 'none';

    this.sound.playCombo(Math.min(this.combo + 3, 8));
    // Grow pet after each clear (stage = next level)
    this.updatePetSize(this.level + 1, true);
    this.feedPet(30, `长大了！Lv.${this.level + 1}`);
    this.setPetMood('hyped', 1800);
    this.updateUI();
  }

  setPetMood(mood, duration = 800) {
    if (!this.pet.el) return;
    this.pet.el.classList.remove('happy', 'hyped', 'burst');
    if (mood) this.pet.el.classList.add(mood);
    clearTimeout(this.pet.moodTimer);
    this.pet.moodTimer = setTimeout(() => {
      this.pet.el?.classList.remove('happy', 'hyped', 'burst');
    }, duration);
  }

  /**
   * Pet growth: starts tiny (stage 1), grows each cleared wave.
   * scale ≈ 0.40 → 1.22 over stages (soft cap).
   */
  getPetScale(stage = 1) {
    const s = Math.max(1, stage | 0);
    return Math.min(1.22, 0.40 + (s - 1) * 0.09);
  }

  updatePetSize(stage = 1, animate = false) {
    const s = Math.max(1, stage | 0);
    this.pet.stage = s;
    const scale = this.getPetScale(s);
    const el = this.pet.el;
    if (!el) return;
    el.style.setProperty('--pet-scale', String(scale));
    el.dataset.stage = String(Math.min(s, 8));
    if (this.pet.badge) this.pet.badge.textContent = `Lv.${s}`;
    if (animate) {
      el.classList.remove('growing');
      // eslint-disable-next-line no-unused-expressions
      el.offsetWidth;
      el.classList.add('growing');
      clearTimeout(this._petGrowTimer);
      this._petGrowTimer = setTimeout(() => el.classList.remove('growing'), 750);
      // sparkle near pet
      const px = this.width - 50;
      const py = 60;
      this.effects?.emitBreaking?.(px, py, '#FFD700', 8);
      this.effects?.emitPressureText?.(px - 20, py + 20, '成长!', '#FFD700', 14);
    }
  }

  petSay(text) {
    if (!this.pet.bubble) return;
    this.pet.bubble.textContent = text;
    this.pet.bubble.style.animation = 'none';
    this.pet.bubble.offsetHeight;
    this.pet.bubble.style.animation = 'comboPulse 0.24s ease-out';
    clearTimeout(this.pet.lineTimer);
    this.pet.lineTimer = setTimeout(() => {
      const idleLines = [
        '继续砸，星光替你扛',
        '不要内耗，直接敲碎',
        '闪一下，压力退散',
        '赛博小星星，在线解压'
      ];
      this.pet.bubble.textContent = idleLines[Math.floor(Math.random() * idleLines.length)];
    }, 2200);
  }

  setPetSuperUi(ready) {
    const btn = document.getElementById('btn-pet-super');
    if (btn) btn.hidden = !ready;
    this.pet.el?.classList.toggle('super-ready', !!ready);
  }

  feedPet(amount, line = '') {
    if (this.pet.superReady) {
      if (line) this.petSay(line);
      return;
    }
    // Slightly slower charge so super isn't always one mis-tap away
    this.pet.power = Math.min(100, this.pet.power + amount * 0.72);
    if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;
    if (this.pet.power >= 100) {
      this.pet.superReady = true;
      this.setPetSuperUi(true);
      this.petSay(line || '能量满了！点金色按钮释放超级清扫');
      this.setPetMood('burst', 1600);
      this.effects.emitPressureText(this.width - 70, 90, 'SUPER READY', '#FFD700', 16);
      this.sound.playCombo(6);
    } else if (line) {
      this.petSay(line);
    } else {
      this.setPetMood('happy', 520);
    }
  }

  /** Full-screen CSS cinematic for pet super clear. */
  playPetSuperFx() {
    const fx = document.getElementById('pet-super-fx');
    const pet = this.pet.el;
    if (fx) {
      fx.classList.remove('active');
      // reflow restart
      // eslint-disable-next-line no-unused-expressions
      fx.offsetWidth;
      fx.classList.add('active');
      clearTimeout(this._superFxTimer);
      this._superFxTimer = setTimeout(() => fx.classList.remove('active'), 1000);
    }
    if (pet) {
      pet.classList.add('casting');
      clearTimeout(this._petCastTimer);
      this._petCastTimer = setTimeout(() => pet.classList.remove('casting'), 900);
    }
  }

  releasePetSuper() {
    if (!this.pet.superReady || this.state !== 'playing') return;
    this.pet.superReady = false;
    this.pet.power = 12;
    this.setPetSuperUi(false);
    if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.max(this.width, this.height) * 0.62;
    // Pet sits top-right — blast originates there then fills center
    const petX = this.width - 56;
    const petY = 70;

    // 1) Cinematic overlay (DOM)
    this.playPetSuperFx();
    this.flashJudgment('SUPER', 'perfect');
    this.pulseBeatFrame('perfect', { intensity: 1.5 });

    // 2) Audio wind-up + boom
    this.sound.playCharge?.(1.2);
    setTimeout(() => this.sound.playExplosion?.(), 90);
    this.vibrate([18, 24, 36, 20, 55, 30]);
    this.addScreenShake(640);
    this.setPetMood('burst', 1800);
    this.petSay('全部吞掉！压力清扫完成');

    // 3) Canvas waves from pet → center (staggered)
    this.effects.addShockwave(petX, petY, '#FFD700', radius * 0.55);
    this.effects.emitBreaking(petX, petY, '#FFD700', 14);
    this.effects.emitPressureText(petX - 40, petY + 30, '释放', '#FFD700', 18);

    setTimeout(() => {
      this.physics.applyExplosion(cx, cy, 0.1, radius);
      this.effects.addShockwave(cx, cy, '#FF8BD1', radius);
      this.effects.addShockwave(cx, cy, '#22D3EE', radius * 0.75);
      this.effects.addShockwave(cx, cy, '#FFD700', radius * 0.45);
      this.effects.emitBreaking(cx, cy, '#FFD700', 18);
      this.effects.emitShards(cx, cy, '#FF8BD1', 8);
      this.effects.emitTypographyBurst(cx, cy, {
        words: ['清扫', 'SUPER', '释放', 'BYE'],
        color: '#FFD700',
        spread: Math.min(radius * 0.45, 140),
        rows: 1,
        size: 14,
        life: 620
      });
      this.effects.emitPressureText(cx, cy - 48, '宠物超级清扫', '#FFD700', 26);
      this.effects.emitScorePopup(cx, cy - 10, 0, '#FF8BD1');
      const popup = this.effects.particles[this.effects.particles.length - 1];
      if (popup) {
        popup.text = 'PRESSURE ZERO';
        popup.size = 22;
        popup.vy = -1.4;
        popup.life = 900;
        popup.maxLife = 900;
      }
    }, 120);

    // 4) Damage pulse in two ticks for a “wave clear” feel
    const hitAll = (power, impulse) => {
      [...this.physics.bodies].forEach((body) => {
        if (!body.cyberData || body.cyberData.type === 'fragment') return;
        this.damageBody(body, power, { x: cx, y: cy, impulse, fromBlast: true });
      });
    };
    setTimeout(() => hitAll(90, 0.04), 140);
    setTimeout(() => hitAll(100, 0.055), 280);
  }

  resetPet() {
    this.pet.power = 18;
    this.pet.superReady = false;
    this.setPetSuperUi(false);
    if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;
    this.updatePetSize(1, false);
    this.petSay('小星星报到，压力归我');
    this.setPetMood('', 0);
  }

  getLevelConfig(level) {
    const waves = [
      { cols: 3, rows: 3, healthMul: 0.52, bombCount: 0, heavyCount: 0, clearBonus: 500 },
      { cols: 4, rows: 3, healthMul: 0.64, bombCount: 1, heavyCount: 0, clearBonus: 750 },
      { cols: 4, rows: 3, healthMul: 0.72, bombCount: 2, heavyCount: 1, clearBonus: 1000 },
      { cols: 5, rows: 3, healthMul: 0.8, bombCount: 3, heavyCount: 1, clearBonus: 1300 },
      { cols: 5, rows: 4, healthMul: 0.82, bombCount: 4, heavyCount: 1, clearBonus: 1800 },
    ];
    const base = waves[Math.min(level - 1, waves.length - 1)];
    const extra = Math.max(0, level - waves.length);
    // Cap density so late levels don't melt the GPU/CPU
    return {
      ...base,
      cols: Math.min(base.cols + Math.floor(extra / 3), 5),
      rows: Math.min(base.rows + Math.floor(extra / 4), 4),
      bombCount: Math.min(base.bombCount + Math.ceil(extra / 2), 5),
      heavyCount: Math.min(base.heavyCount + Math.floor(extra / 3), 3),
      healthMul: base.healthMul + extra * 0.06,
      clearBonus: base.clearBonus + extra * 420
    };
  }

  spawnLevel(level) {
    const cfg = this.getLevelConfig(level);
    // Keep blocks away from pet corner (top-right); more pad as pet grows
    const padding = 46;
    const petScale = this.getPetScale(this.pet?.stage || level);
    const rightPad = Math.round(70 + petScale * 90);
    const usableW = Math.max(120, this.width - padding - rightPad);
    const usableH = Math.max(120, this.height - padding * 2 - 16);
    const cellW = usableW / cfg.cols;
    const cellH = usableH / cfg.rows;

    for (let i = 0; i < cfg.cols; i++) {
      for (let j = 0; j < cfg.rows; j++) {
        const x = padding + cellW * (i + 0.5) + (Math.random() - 0.5) * 16;
        const y = padding + cellH * (j + 0.5) + (Math.random() - 0.5) * 16;
        // Fully random shape / color / icon each spawn
        const body = this.physics.createRandomPressure(x, y);
        this.applyLevelHealth(body, cfg.healthMul);
      }
    }

    for (let i = 0; i < cfg.bombCount; i++) {
      const x = padding + Math.random() * usableW;
      const y = padding + 40 + Math.random() * Math.max(80, usableH - 80);
      const body = this.physics.createPressureBomb(x, y);
      this.physics.decorate?.(body, { icon: '💣', pattern: 'glow' });
      this.applyLevelHealth(body, Math.max(0.75, cfg.healthMul * 0.85));
    }

    for (let i = 0; i < cfg.heavyCount; i++) {
      const x = padding + Math.random() * usableW;
      const y = padding + 40 + Math.random() * Math.max(60, usableH - 80);
      // Heavy cores: random tough shape
      const heavyType = ['hex', 'star', 'chip', 'diamond', 'cross'][Math.floor(Math.random() * 5)];
      const body = this.physics.createRandomPressure(x, y, {
        type: heavyType,
        density: 0.004,
        frictionAir: 0.04,
        restitution: 0.55
      });
      this.applyLevelHealth(body, cfg.healthMul * 1.35);
      if (body?.cyberData) {
        body.cyberData.role = 'heavy';
        body.cyberData.color = '#FFD700';
        body.cyberData.label = '硬核';
        body.cyberData.icon = body.cyberData.icon || '🧱';
        body.cyberData.showLabel = true;
        body.cyberData.pattern = 'glow';
      }
    }

    this.levelTargetTotal = this.countTargets();
  }

  applyLevelHealth(body, mul) {
    if (!body?.cyberData) return;
    const max = Math.round(body.cyberData.maxHealth * mul);
    body.cyberData.maxHealth = max;
    body.cyberData.health = max;
  }

  clearScene() {
    this.physics.clear();
    this.effects.particles = [];
    this.effects.shockwaves = [];
    this.effects.typeBursts = [];
    this.hitCooldown = new WeakMap();
    this.levelClearing = false;
    this._comboPulseLock = false;
    this.cancelCharge();
  }

  reloadLevel() {
    this.clearScene();
    this.levelSmashed = 0;
    this.combo = 0;
    this.hideCombo();
    this.spawnLevel(this.level);
    this.updateUI();
  }

  resetCampaign() {
    this.level = 1;
    this.score = 0;
    this.combo = 0;
    this.maxComboRun = 0;
    this.smashedCount = 0;
    this.levelSmashed = 0;
    this.hideCombo();
    this.clearScene();
    this.spawnLevel(this.level);
    this.updateUI();
    this.resetPet(); // includes tiny start size
  }

  startGame() {
    this.hideOverlays();
    this.state = 'playing';
    this.resetCampaign();
    this.sound.startBgm?.(this.level);
  }

  advanceLevel() {
    this.level += 1;
    this.hideOverlays();
    this.state = 'playing';
    this.clearScene();
    this.levelSmashed = 0;
    this.combo = 0;
    this.hideCombo();
    this.spawnLevel(this.level);
    this.updateUI();
    // New wave → new music vibe
    this.sound.setTrackForLevel?.(this.level, 'level');

    // Brief banner particle
    this.effects.emitScorePopup(this.width / 2, this.height * 0.35, 0, '#22D3EE');
    const popup = this.effects.particles[this.effects.particles.length - 1];
    if (popup) {
      popup.text = `第 ${this.level} 波`;
      popup.size = 28;
      popup.vy = -1.2;
      popup.life = 1400;
      popup.maxLife = 1400;
    }
  }

  hideOverlays() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('level-screen').style.display = 'none';
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.sound.stopBgm?.();
      document.getElementById('pause-screen').style.display = 'flex';
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.sound.startBgm?.(this.level);
      document.getElementById('pause-screen').style.display = 'none';
    }
  }

  bindBeatVisuals() {
    if (this._beatBound) return;
    this._beatBound = true;

    this.sound.onBeat = (step, meta = {}) => {
      const kind = meta.kind === 'downbeat'
        ? 'downbeat'
        : meta.kind === 'snare'
          ? 'snare'
          : 'beat';
      this.pulseBeatFrame(kind, meta);
      this.applyBeatColors(meta.colors, meta.intensity);

      const guide = document.getElementById('beat-guide');
      if (guide) {
        guide.classList.remove('tick');
        // eslint-disable-next-line no-unused-expressions
        guide.offsetWidth;
        guide.classList.add('tick');
        if (kind === 'downbeat') guide.classList.add('downbeat');
        else guide.classList.remove('downbeat');
      }
    };

    this.sound.onStyleChange = (style, reason) => {
      this.applyBeatColors(style.colors, style.intensity);
      this.showTrackBadge(style, reason);
      if (reason === 'auto' || reason === 'level') {
        this.petSay?.(`BGM · ${style.name}`);
      }
    };

    // Seed colors for current style
    const cur = this.sound.getCurrentStyle?.();
    if (cur) this.applyBeatColors(cur.colors, cur.intensity);
  }

  applyBeatColors(colors, intensity = 1) {
    if (!colors) return;
    const a = colors.a || '#22D3EE';
    const b = colors.b || '#A855F7';
    const c = colors.c || '#FF8BD1';
    const inten = String(Math.max(0.5, Math.min(1.6, intensity || 1)));
    const targets = [
      document.getElementById('beat-sides'),
      document.querySelector('.game-main'),
      document.getElementById('track-badge')
    ];
    targets.forEach((root) => {
      if (!root) return;
      root.style.setProperty('--beat-a', a);
      root.style.setProperty('--beat-b', b);
      root.style.setProperty('--beat-c', c);
      root.style.setProperty('--beat-intensity', inten);
    });
  }

  showTrackBadge(style, reason = '') {
    const el = document.getElementById('track-badge');
    if (!el || !style) return;
    const bpm = style.bpm ? ` · ${style.bpm} BPM` : '';
    el.textContent = reason === 'auto' ? `♫ ${style.name}${bpm}` : `♫ ${style.name}${bpm}`;
    el.classList.add('show');
    clearTimeout(this._trackBadgeTimer);
    this._trackBadgeTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  pulseBeatFrame(kind = 'beat', meta = {}) {
    const main = document.querySelector('.game-main');
    const sides = document.getElementById('beat-sides');
    if (!main) return;

    main.classList.remove('beat-pulse', 'beat-pulse-strong', 'beat-pulse-perfect', 'beat-pulse-snare');
    sides?.classList.remove('pulse', 'pulse-strong', 'pulse-perfect', 'pulse-snare');
    // reflow so animation restarts
    // eslint-disable-next-line no-unused-expressions
    main.offsetWidth;
    if (sides) {
      // eslint-disable-next-line no-unused-expressions
      sides.offsetWidth;
    }

    // Scale side force by track intensity
    const inten = meta.intensity || this.sound.getCurrentStyle?.()?.intensity || 1;
    sides?.style.setProperty('--pulse-boost', String(0.85 + inten * 0.35));

    if (kind === 'perfect') {
      main.classList.add('beat-pulse-perfect');
      sides?.classList.add('pulse-perfect');
    } else if (kind === 'downbeat') {
      main.classList.add('beat-pulse-strong');
      sides?.classList.add('pulse-strong');
    } else if (kind === 'snare') {
      main.classList.add('beat-pulse-snare');
      sides?.classList.add('pulse-snare');
    } else {
      main.classList.add('beat-pulse');
      sides?.classList.add('pulse');
    }

    clearTimeout(this._beatPulseTimer);
    const hold = kind === 'perfect' ? 320 : kind === 'downbeat' ? 280 : kind === 'snare' ? 180 : 200;
    this._beatPulseTimer = setTimeout(() => {
      main.classList.remove('beat-pulse', 'beat-pulse-strong', 'beat-pulse-perfect', 'beat-pulse-snare');
      sides?.classList.remove('pulse', 'pulse-strong', 'pulse-perfect', 'pulse-snare');
    }, hold);
  }

  updateUI() {
    const level = String(this.level);
    const score = this.score.toLocaleString();
    const smashed = String(this.smashedCount);
    const leftCount = this.countTargets();
    const left = String(leftCount);
    const total = Math.max(this.levelTargetTotal, leftCount, 1);
    const cleared = Math.max(0, total - leftCount);
    const pct = Math.round((cleared / total) * 100);
    const progress = String(pct);

    if (this.uiCache.level !== level) {
      document.getElementById('level').textContent = level;
      this.uiCache.level = level;
    }
    if (this.uiCache.score !== score) {
      document.getElementById('score').textContent = score;
      this.uiCache.score = score;
    }
    if (this.uiCache.smashed !== smashed) {
      document.getElementById('stat-smashed').textContent = smashed;
      this.uiCache.smashed = smashed;
    }
    if (this.uiCache.left !== left) {
      document.getElementById('stat-left').textContent = left;
      this.uiCache.left = left;
    }
    if (this.uiCache.progress !== progress) {
      const bar = document.getElementById('level-progress-fill');
      const label = document.getElementById('level-progress-label');
      if (bar) bar.style.width = `${pct}%`;
      if (label) label.textContent = `${cleared}/${total}`;
      this.uiCache.progress = progress;
    }
  }

  /** Draw regular n-gon path centered at 0,0 */
  pathPolygon(sides, r, startAngle = -Math.PI / 2) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = startAngle + (i * Math.PI * 2) / sides;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  pathStar(points, outerR, innerR) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawShapePattern(cyberData, bounds) {
    const { pattern, color } = cyberData;
    const q = this.quality;
    if (!pattern || pattern === 'solid' || q === 0) return;
    const ctx = this.ctx;
    const { w, h, r } = bounds;

    if (pattern === 'stripe') {
      ctx.save();
      ctx.beginPath();
      if (r) ctx.arc(0, 0, r, 0, Math.PI * 2);
      else ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 3;
      for (let i = -w; i < w; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, -h);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
      ctx.restore();
    } else if (pattern === 'dots' && q >= 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const step = 10;
      for (let y = -h / 2 + 6; y < h / 2; y += step) {
        for (let x = -w / 2 + 6; x < w / 2; x += step) {
          if (r && x * x + y * y > r * r) continue;
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === 'ring' || pattern === 'glow') {
      ctx.strokeStyle = this.cachedShade(color, 30, 'light');
      ctx.lineWidth = pattern === 'glow' ? 2.5 : 1.5;
      ctx.globalAlpha = 0.55;
      if (r) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(-w * 0.3, -h * 0.3, w * 0.6, h * 0.6);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawBody(body) {
    const { position, angle, cyberData } = body;
    if (!cyberData) return;

    const { type, color, width, height, radius, health, maxHealth } = cyberData;
    const damage = 1 - health / maxHealth;
    const flash = cyberData.hitFlash || 0;
    const jolt = cyberData.hitJolt || 0;
    const q = this.quality;
    const crowded = this.physics.bodies.length > 16 || q === 0;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle + (jolt ? jolt * 0.04 : 0));

    const fill = damage > 0.35 ? this.cachedShade(color, 18, 'dark') : color;
    ctx.fillStyle = fill;
    ctx.strokeStyle = this.cachedShade(color, 25, 'light');
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 1;

    const r = radius || Math.max(width || 0, height || 0) / 2 || 24;
    const w = width || r * 2;
    const h = height || r * 2;
    let bounds = { w, h, r: null };

    if (type === 'sphere') {
      bounds.r = r;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (q > 0) {
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.28, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'ring') {
      bounds.r = r;
      // evenodd donut — no destination-out (would erase other bodies)
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      if (q > 0) {
        ctx.strokeStyle = this.cachedShade(color, 25, 'light');
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (type === 'neon') {
      ctx.fillRect(-w / 2, -h / 2, w, h);
      if (q > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-w / 2 + 2, -h / 4, w - 4, h / 2);
      }
    } else if (type === 'triangle' || type === 'arrow') {
      bounds.r = r;
      this.pathPolygon(3, r, type === 'arrow' ? 0 : -Math.PI / 2);
      ctx.fill();
      if (q > 0) ctx.stroke();
      if (type === 'arrow' && q > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-r * 0.15, -r * 0.1, r * 0.55, r * 0.2);
      }
    } else if (type === 'hex' || type === 'pentagon') {
      const sides = type === 'hex' ? 6 : 5;
      bounds.r = r;
      this.pathPolygon(sides, r);
      ctx.fill();
      if (q > 0) ctx.stroke();
    } else if (type === 'star') {
      bounds.r = r;
      this.pathStar(5, r, r * 0.45);
      ctx.fill();
      if (q > 0) ctx.stroke();
    } else if (type === 'diamond') {
      // already rotated in physics; draw as diamond path for clarity
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fill();
      if (q > 0) ctx.stroke();
    } else if (type === 'cross') {
      const thick = cyberData.thick || Math.min(w, h) * 0.32;
      ctx.fillRect(-w / 2, -thick / 2, w, thick);
      ctx.fillRect(-thick / 2, -h / 2, thick, h);
      if (q > 0) {
        ctx.strokeRect(-w / 2, -thick / 2, w, thick);
        ctx.strokeRect(-thick / 2, -h / 2, thick, h);
      }
    } else if (type === 'cloud') {
      // puffy blob: main capsule + two bumps
      this.roundRect(-w / 2, -h / 4, w, h * 0.65, h * 0.3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-w * 0.22, -h * 0.12, h * 0.38, 0, Math.PI * 2);
      ctx.arc(w * 0.08, -h * 0.22, h * 0.42, 0, Math.PI * 2);
      ctx.arc(w * 0.28, -h * 0.05, h * 0.32, 0, Math.PI * 2);
      ctx.fill();
      if (q > 0) {
        ctx.strokeStyle = this.cachedShade(color, 20, 'light');
        ctx.beginPath();
        ctx.arc(-w * 0.22, -h * 0.12, h * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (type === 'chip') {
      ctx.fillRect(-w / 2, -h / 2, w, h);
      if (q > 0) {
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        // pin legs
        ctx.fillStyle = this.cachedShade(color, 30, 'light');
        const pins = 4;
        for (let i = 0; i < pins; i++) {
          const t = -w / 2 + ((i + 0.5) / pins) * w;
          ctx.fillRect(t - 1.5, -h / 2 - 5, 3, 5);
          ctx.fillRect(t - 1.5, h / 2, 3, 5);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(-w * 0.2, -h * 0.2, w * 0.4, h * 0.4);
      }
    } else if (type === 'capsule') {
      this.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      if (q > 0) ctx.stroke();
    } else {
      // block default
      ctx.fillRect(-w / 2, -h / 2, w, h);
      if (q > 0) {
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        const cornerSize = 7;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + cornerSize);
        ctx.lineTo(-w / 2, -h / 2);
        ctx.lineTo(-w / 2 + cornerSize, -h / 2);
        ctx.stroke();
      }
    }

    // Pattern overlays
    if (q > 0) this.drawShapePattern(cyberData, { w, h, r: bounds.r || r });

    // Cracks
    if (damage > 0.4 && q > 0) {
      const size = bounds.r || Math.max(w, h) / 2;
      const seed = cyberData.crackSeed || body.id || 1;
      const crackCount = q >= 2 ? 2 : 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.globalAlpha = damage * 0.85;
      for (let i = 0; i < crackCount; i++) {
        const r1 = this.seededRandom(seed, i * 2);
        const startAngle = (Math.PI * 2 * i) / crackCount + r1;
        const len = size * (0.35 + r1 * 0.3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(startAngle) * len, Math.sin(startAngle) * len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (cyberData.role === 'bomb') {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, (radius || 24) + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (cyberData.role === 'heavy' && q > 0) {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, (bounds.r || Math.max(w, h) / 2) + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Icon (emoji) — main variety cue
    if (cyberData.icon && q > 0 && !crowded) {
      const iconSize = Math.max(14, Math.min(28, (bounds.r || Math.min(w, h) / 2) * 0.85));
      ctx.font = `${iconSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.95;
      ctx.fillText(cyberData.icon, 0, cyberData.showLabel && cyberData.label ? -4 : 1);
      ctx.globalAlpha = 1;
    }

    // Tiny label under icon
    if (cyberData.label && cyberData.showLabel !== false && q >= 2 && !crowded && type !== 'neon') {
      const size = bounds.r || Math.min(w, h) / 2;
      if (size > 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = '700 10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const y = cyberData.icon ? size * 0.42 : 1;
        ctx.fillText(cyberData.label, 0, y);
      }
    }

    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.55, flash * 0.5);
      ctx.fillStyle = '#fff';
      if (bounds.r || type === 'sphere' || type === 'ring' || type === 'star' || type === 'hex' || type === 'pentagon' || type === 'triangle' || type === 'arrow') {
        ctx.beginPath();
        ctx.arc(0, 0, bounds.r || r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  drawFragment(fragment) {
    const ctx = this.ctx;
    ctx.globalAlpha = fragment.opacity;
    // Skip rotate when low quality
    if (this.quality === 0) {
      ctx.fillStyle = fragment.color;
      ctx.fillRect(fragment.x - fragment.width / 2, fragment.y - fragment.height / 2, fragment.width, fragment.height);
    } else {
      ctx.save();
      ctx.translate(fragment.x, fragment.y);
      ctx.rotate(fragment.angle);
      ctx.fillStyle = fragment.color;
      ctx.fillRect(-fragment.width / 2, -fragment.height / 2, fragment.width, fragment.height);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + w - radius, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.ctx.lineTo(x + w, y + h - radius);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.ctx.lineTo(x + radius, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  seededRandom(seed, i) {
    const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return `rgb(${r}, ${g}, ${b})`;
  }

  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
    const b = Math.max(0, (num & 0x0000FF) - percent);
    return `rgb(${r}, ${g}, ${b})`;
  }

  loop(timestamp = performance.now()) {
    const rawDelta = timestamp - (this.lastFrameTime || timestamp);
    this.lastFrameTime = timestamp;
    // Clamp delta for tab-switch / lag spikes
    const delta = Math.min(34, Math.max(8, rawDelta || 16.67));
    this.updateAdaptiveQuality(rawDelta);

    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.state === 'playing') {
      this.physics.update(delta);
      this.effects.update(delta);
      if (timestamp - this.lastUiUpdate > 120) {
        this.lastUiUpdate = timestamp;
        this.updateUI();
      }
    } else if (this.state === 'levelclear' || this.state === 'menu' || this.state === 'paused') {
      this.effects.update(delta);
    }

    const flashStep = 0.14 * (delta / 16.67);
    const joltStep = 0.18 * (delta / 16.67);
    const bodies = this.physics.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body.cyberData || body.cyberData.type === 'fragment') continue;
      const cd = body.cyberData;
      if (cd.hitFlash) cd.hitFlash = Math.max(0, cd.hitFlash - flashStep);
      if (cd.hitJolt) cd.hitJolt = Math.max(0, cd.hitJolt - joltStep);
      this.drawBody(body);
    }

    const frags = this.physics.fragments;
    for (let i = 0; i < frags.length; i++) this.drawFragment(frags[i]);
    this.effects.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
