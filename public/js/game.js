// game.js - stress release mode
import { PhysicsEngine } from './physics.js';
import { ParticleSystem } from './effects.js';
import { SoundEngine } from './sound.js';

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
    this.comboTimer = null;
    this.lastHitTime = 0;
    this.smashedCount = 0;
    this.levelSmashed = 0;
    this.levelClearing = false;
    this.hitCooldown = new WeakMap();
    this.lastUiUpdate = 0;
    this.uiCache = { level: '', score: '', smashed: '', left: '' };

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
      power: 18,
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

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupEventListeners();
    this.spawnLevel(this.level);
    this.updateUI();
    this.loop();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.width = rect.width;
    this.height = rect.height;
    this.physics.setBounds(this.width, this.height);
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
      this.sound.startBgm?.();
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

    this.pet.body?.addEventListener('click', () => {
      this.petSay('我在，压力块一个都别想跑');
      this.setPetMood('happy', 900);
      this.sound.playClick();
    });

    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('mouseleave', () => this.onPointerUp());

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onPointerDown(e.touches[0]);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.onPointerMove(e.touches[0]);
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.onPointerUp();
    }, { passive: false });
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
    if (moved > 12 && this.isCharging) this.cancelCharge();
    if (this.isCharging) this.updateChargeUi(pos, performance.now() - this.chargeStart);

    // Swipe trail + continuous smash (still one mode)
    this.effects.particles.push({
      type: 'spark',
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: 3,
      color: '#22D3EE',
      alpha: 0.6,
      life: 200,
      maxLife: 200,
      gravity: 0,
      decay: 0.95
    });

    this.tryHit(pos.x, pos.y, false, 0.68);
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
    const bodies = this.physics.getBodiesAtPoint(x, y);
    if (!bodies.length) {
      if (force) {
        this.effects.emitBreaking(x, y, '#6C63FF', 5);
        this.sound.playClick();
      }
      return;
    }

    const body = bodies.find(b => b.cyberData && b.cyberData.type !== 'fragment') || bodies[0];
    if (!body?.cyberData || body.cyberData.type === 'fragment') return;

    // Throttle per-body hits during swipe so one swipe doesn't one-shot too fast
    const now = performance.now();
    const last = this.hitCooldown.get(body) || 0;
    if (!force && now - last < 90) return;
    this.hitCooldown.set(body, now);

    this.damageBody(body, 50 * powerScale, { x, y, impulse: force ? 0.026 : 0.014 });
  }

  damageBody(body, amount = 50, hit = null) {
    const { cyberData, position } = body;
    if (!cyberData || cyberData.type === 'fragment') return;
    const beat = this.sound.getBeatAccuracy ? this.sound.getBeatAccuracy() : { label: '', accuracy: 0 };

    const hitPower = amount;
    cyberData.health -= hitPower;
    cyberData.hitFlash = 1;
    cyberData.hitJolt = 1;
    if (hit) this.physics.applyHitImpulse(body, hit.x, hit.y, hit.impulse || 0.018);

    if (cyberData.health <= 0) {
      const wasBomb = cyberData.role === 'bomb';
      const blastRadius = cyberData.blastRadius || 0;
      this.physics.fragmentBody(body);
      this.effects.emitBreaking(position.x, position.y, cyberData.color, 25);
      this.effects.emitShards(position.x, position.y, cyberData.color, 12);
      this.effects.addShockwave(position.x, position.y, cyberData.color);
      this.effects.emitTypographyBurst(position.x, position.y, {
        words: cyberData.role === 'bomb' ? ['BOOM', '释放', 'BOOM'] : ['碎', 'SMASH', '裂开'],
        color: cyberData.color,
        spread: cyberData.role === 'bomb' ? 210 : 120,
        rows: cyberData.role === 'bomb' ? 4 : 2,
        size: cyberData.role === 'bomb' ? 14 : 11,
        warp: cyberData.role === 'bomb' ? 28 : 16,
        life: cyberData.role === 'bomb' ? 780 : 520
      });
      this.sound.playShatter(cyberData.type === 'neon' || cyberData.role === 'heavy' ? 1.35 : 1);
      if (beat.accuracy > 0.48) this.sound.playRhythmHit(0.72, beat.accuracy);
      this.vibrate(cyberData.role === 'bomb' ? [12, 18, 28] : 18);

      this.updateCombo();
      const points = this.calculatePoints(cyberData.type);
      this.score += points;
      this.smashedCount++;
      this.levelSmashed++;

      this.effects.emitScorePopup(position.x, position.y - 20, points, cyberData.color);
      if (beat.label) {
        this.effects.emitPressureText(
          position.x,
          position.y - 46,
          beat.label,
          beat.label === 'PERFECT' ? '#FFD700' : '#22D3EE',
          beat.label === 'PERFECT' ? 24 : 18
        );
      }
      this.feedPet(cyberData.role === 'bomb' ? 18 : 8);
      if (this.combo >= 4) this.petSay(`连击 x${this.combo}，压力在融化`);
      else if (wasBomb) this.petSay('漂亮，压力连锁坍塌');
      else this.petSay('吞掉一块压力');
      this.addScreenShake();
      this.updateUI();
      if (wasBomb) {
        this.chainBlast(position.x, position.y, blastRadius);
      }
      this.checkLevelClear();
    } else {
      this.effects.emitBreaking(position.x, position.y, cyberData.color, 10);
      this.effects.emitPressureText(position.x, position.y - 12, '裂开', cyberData.color, 14);
      if (Math.random() > 0.48) {
        this.effects.emitTypographyBurst(position.x, position.y, {
          words: ['裂', 'HIT'],
          color: cyberData.color,
          spread: 70,
          rows: 1,
          size: 10,
          warp: 10,
          life: 360
        });
      }
      this.sound.playCrack(0.75 + (1 - cyberData.health / cyberData.maxHealth) * 0.65);
      this.sound.playRhythmHit(0.45, beat.accuracy);
      this.vibrate(8);
      if (beat.label) {
        this.effects.emitPressureText(
          position.x,
          position.y - 34,
          beat.label,
          beat.label === 'PERFECT' ? '#FFD700' : '#22D3EE',
          beat.label === 'PERFECT' ? 20 : 15
        );
      }
      this.feedPet(2);
      if (Math.random() > 0.68) this.petSay('裂了，再来一下');
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

  calculatePoints(type) {
    const base = type === 'neon' ? 150 : type === 'sphere' ? 100 : 80;
    const levelMul = 1 + (this.level - 1) * 0.08;
    return Math.floor(base * levelMul * (1 + this.combo * 0.2));
  }

  updateCombo() {
    const now = Date.now();
    if (now - this.lastHitTime < 1000) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastHitTime = now;

    if (this.combo >= 2) {
      this.effects.emitCombo(this.lastMousePos.x, this.lastMousePos.y, this.combo);
      this.sound.playCombo(this.combo);
      this.showCombo();
    }

    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      this.combo = 0;
      this.hideCombo();
    }, 1500);
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
    this.score += bonus;

    document.getElementById('level-clear-title').textContent = `第 ${this.level} 波释放完成`;
    document.getElementById('level-bonus-text').textContent = `情绪缓存 -${bonus.toLocaleString()}`;
    document.getElementById('level-screen').style.display = 'flex';
    document.getElementById('pause-screen').style.display = 'none';

    this.sound.playCombo(Math.min(this.combo + 3, 8));
    this.feedPet(30, '这一波压力清空了');
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

  petSay(text) {
    if (!this.pet.bubble) return;
    this.pet.bubble.textContent = text;
    this.pet.bubble.style.animation = 'none';
    this.pet.bubble.offsetHeight;
    this.pet.bubble.style.animation = 'comboPulse 0.24s ease-out';
    clearTimeout(this.pet.lineTimer);
    this.pet.lineTimer = setTimeout(() => {
      const idleLines = [
        '继续砸，我负责吞压力',
        '不要内耗，直接敲碎',
        '今天的烦躁正在降解',
        '压力值可视化，很科学'
      ];
      this.pet.bubble.textContent = idleLines[Math.floor(Math.random() * idleLines.length)];
    }, 2200);
  }

  feedPet(amount, line = '') {
    this.pet.power = Math.min(100, this.pet.power + amount);
    if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;
    if (this.pet.power >= 100) {
      this.pet.power = 30;
      if (this.pet.energy) this.pet.energy.style.width = '100%';
      this.petSay(line || '能量满了，来个大的');
      this.setPetMood('burst', 1200);
      setTimeout(() => {
        if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;
      }, 260);
    } else if (line) {
      this.petSay(line);
    } else {
      this.setPetMood('happy', 520);
      if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;
    }
  }

  resetPet() {
    this.pet.power = 18;
    if (this.pet.energy) this.pet.energy.style.width = `${this.pet.power}%`;
    this.petSay('今天的压力，交给我吞掉');
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
    return {
      ...base,
      cols: Math.min(base.cols + Math.floor(extra / 3), 6),
      rows: Math.min(base.rows + Math.floor(extra / 4), 4),
      bombCount: Math.min(base.bombCount + Math.ceil(extra / 2), 7),
      heavyCount: Math.min(base.heavyCount + Math.floor(extra / 3), 4),
      healthMul: base.healthMul + extra * 0.06,
      clearBonus: base.clearBonus + extra * 420
    };
  }

  spawnLevel(level) {
    const cfg = this.getLevelConfig(level);
    const padding = 50;
    const usableW = Math.max(120, this.width - padding * 2);
    const usableH = Math.max(120, this.height - padding * 2 - 20);
    const cellW = usableW / cfg.cols;
    const cellH = usableH / cfg.rows;

    for (let i = 0; i < cfg.cols; i++) {
      for (let j = 0; j < cfg.rows; j++) {
        const x = padding + cellW * (i + 0.5) + (Math.random() - 0.5) * 14;
        const y = padding + cellH * (j + 0.5) + (Math.random() - 0.5) * 14;
        const roll = Math.random();
        let body;
        if (roll > 0.78) {
          body = this.physics.createCyberTriangle(x, y);
        } else if (roll > 0.58) {
          body = this.physics.createCyberCapsule(x, y);
        } else if (roll > 0.38) {
          body = this.physics.createCyberSphere(x, y);
        } else if (roll > 0.16) {
          body = this.physics.createCyberBlock(x, y);
        } else {
          body = this.physics.createNeonTube(x, y, (Math.random() - 0.5) * 0.5);
        }
        this.applyLevelHealth(body, cfg.healthMul);
      }
    }

    for (let i = 0; i < cfg.bombCount; i++) {
      const x = padding + Math.random() * usableW;
      const y = padding + 40 + Math.random() * Math.max(80, usableH - 80);
      const body = this.physics.createPressureBomb(x, y);
      this.applyLevelHealth(body, Math.max(0.75, cfg.healthMul * 0.85));
    }

    for (let i = 0; i < cfg.heavyCount; i++) {
      const x = padding + Math.random() * usableW;
      const y = padding + 40 + Math.random() * (usableH - 80);
      const body = this.physics.createCyberSphere(x, y, {
        isStatic: true,
        radius: 18 + Math.random() * 16
      });
      this.applyLevelHealth(body, cfg.healthMul * 1.15);
      body.cyberData.role = 'heavy';
      body.cyberData.color = '#FFD700';
    }
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
    this.hitCooldown = new WeakMap();
    this.levelClearing = false;
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
    this.smashedCount = 0;
    this.levelSmashed = 0;
    this.hideCombo();
    this.clearScene();
    this.spawnLevel(this.level);
    this.updateUI();
    this.resetPet();
  }

  startGame() {
    this.hideOverlays();
    this.state = 'playing';
    this.sound.startBgm?.();
    this.resetCampaign();
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
      this.sound.startBgm?.();
      document.getElementById('pause-screen').style.display = 'none';
    }
  }

  bindBeatVisuals() {
    if (this.sound.onBeat) return;
    this.sound.onBeat = () => {
      const main = document.querySelector('.game-main');
      main?.classList.add('beat-pulse');
      setTimeout(() => main?.classList.remove('beat-pulse'), 120);
    };
  }

  updateUI() {
    const level = String(this.level);
    const score = this.score.toLocaleString();
    const smashed = String(this.smashedCount);
    const left = String(this.countTargets());

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
  }

  drawBody(body) {
    const { position, angle, cyberData } = body;
    if (!cyberData) return;

    const { type, color, width, height, radius, health, maxHealth } = cyberData;
    const damage = 1 - health / maxHealth;
    const flash = cyberData.hitFlash || 0;
    const jolt = cyberData.hitJolt || 0;

    this.ctx.save();
    this.ctx.translate(position.x, position.y);
    this.ctx.rotate(angle + (Math.random() - 0.5) * jolt * 0.08);

    const crowded = this.physics.bodies.length > 24;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = crowded ? 2 + damage * 5 : 15 + damage * 20;

    if (type === 'sphere') {
      const gradient = this.ctx.createRadialGradient(
        -radius * 0.3, -radius * 0.3, 0,
        0, 0, radius
      );
      gradient.addColorStop(0, this.lightenColor(color, 40));
      gradient.addColorStop(0.7, color);
      gradient.addColorStop(1, this.darkenColor(color, 40));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (type === 'neon') {
      const gradient = this.ctx.createLinearGradient(0, -height / 2, 0, height / 2);
      gradient.addColorStop(0, this.lightenColor(color, 30));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 30));

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(-width / 2, -height / 2, width, height);

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.fillRect(-width / 2 + 2, -height / 4, width - 4, height / 2);
    } else if (type === 'triangle') {
      const r = radius || Math.max(width, height) / 2;
      const gradient = this.ctx.createLinearGradient(-r, -r, r, r);
      gradient.addColorStop(0, this.lightenColor(color, 30));
      gradient.addColorStop(1, this.darkenColor(color, 28));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) this.ctx.moveTo(px, py);
        else this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.globalAlpha = 0.85;
      this.ctx.lineWidth = 1.4;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    } else if (type === 'capsule') {
      const rr = height / 2;
      const gradient = this.ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
      gradient.addColorStop(0, this.lightenColor(color, 25));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 32));

      this.ctx.fillStyle = gradient;
      this.roundRect(-width / 2, -height / 2, width, height, rr);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();
      this.ctx.fillStyle = 'rgba(255,255,255,0.28)';
      this.roundRect(-width / 2 + 8, -height / 4, width * 0.38, height / 3, height / 6);
      this.ctx.fill();
    } else {
      const gradient = this.ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
      gradient.addColorStop(0, this.lightenColor(color, 20));
      gradient.addColorStop(1, this.darkenColor(color, 30));

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(-width / 2, -height / 2, width, height);

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-width / 2, -height / 2, width, height);

      const cornerSize = 8;
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(-width / 2, -height / 2 + cornerSize);
      this.ctx.lineTo(-width / 2, -height / 2);
      this.ctx.lineTo(-width / 2 + cornerSize, -height / 2);
      this.ctx.stroke();
    }

    if (damage > 0.3) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.globalAlpha = damage;

      const size = type === 'sphere' ? radius : Math.max(width, height) / 2;
      const seed = cyberData.crackSeed || body.id || 1;
      const crackCount = Math.floor(damage * 5);
      for (let i = 0; i < crackCount; i++) {
        const r1 = this.seededRandom(seed, i * 2);
        const r2 = this.seededRandom(seed, i * 2 + 1);
        const startAngle = (Math.PI * 2 * i) / Math.max(crackCount, 1) + r1 * 0.4;
        const len = size * 0.3 + r2 * size * 0.3;

        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(
          Math.cos(startAngle) * len + (r1 - 0.5) * 10,
          Math.sin(startAngle) * len + (r2 - 0.5) * 10
        );
        this.ctx.stroke();
      }
    }

    if (cyberData.role === 'bomb') {
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 3;
      this.ctx.globalAlpha = 0.85;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, (radius || Math.max(width, height) / 2) + 7, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = 'bold 14px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('BOOM', 0, 5);
    }

    if (flash > 0) {
      this.ctx.globalAlpha = flash * 0.55;
      this.ctx.fillStyle = '#fff';
      if (type === 'sphere') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(-width / 2, -height / 2, width, height);
      }
    }

    this.ctx.restore();
  }

  drawFragment(fragment) {
    this.ctx.save();
    this.ctx.globalAlpha = fragment.opacity;
    this.ctx.translate(fragment.x, fragment.y);
    this.ctx.rotate(fragment.angle);

    this.ctx.fillStyle = fragment.color;
    if (this.physics.fragments.length < 28) {
      this.ctx.shadowColor = fragment.color;
      this.ctx.shadowBlur = 6;
    }

    const w = fragment.width;
    const h = fragment.height;
    this.ctx.fillRect(-w / 2, -h / 2, w, h);

    this.ctx.restore();
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

  loop() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.state === 'playing') {
      this.physics.update();
      this.effects.update(16);
      const now = performance.now();
      if (now - this.lastUiUpdate > 100) {
        this.lastUiUpdate = now;
        this.updateUI();
      }
    } else if (this.state === 'levelclear' || this.state === 'menu' || this.state === 'paused') {
      // Still animate particles a bit on overlays
      this.effects.update(16);
    }

    this.physics.bodies.forEach(body => {
      if (body.cyberData?.type === 'fragment') return;
      if (body.cyberData) {
        body.cyberData.hitFlash = Math.max(0, (body.cyberData.hitFlash || 0) - 0.12);
        body.cyberData.hitJolt = Math.max(0, (body.cyberData.hitJolt || 0) - 0.16);
      }
      this.drawBody(body);
    });
    this.physics.fragments.forEach(f => this.drawFragment(f));
    this.effects.draw();

    requestAnimationFrame(() => this.loop());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
