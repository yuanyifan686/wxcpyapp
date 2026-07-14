// effects.js - Particle system (performance-tuned)
export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shockwaves = [];
    this.typeBursts = [];
    // Tight caps — shadows/text were the main FPS killers
    this.maxParticles = 72;
    this.maxTypeBursts = 1;
    this.maxShockwaves = 4;
    /** 0=low 1=medium 2=high */
    this.quality = 2;
  }

  setQuality(q) {
    this.quality = Math.max(0, Math.min(2, q | 0));
    if (this.quality === 0) {
      this.maxParticles = 36;
      this.maxTypeBursts = 0;
      this.maxShockwaves = 2;
    } else if (this.quality === 1) {
      this.maxParticles = 56;
      this.maxTypeBursts = 1;
      this.maxShockwaves = 3;
    } else {
      this.maxParticles = 72;
      this.maxTypeBursts = 1;
      this.maxShockwaves = 4;
    }
    this.trimParticles();
  }

  trimParticles() {
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
    if (this.typeBursts.length > this.maxTypeBursts) {
      this.typeBursts.splice(0, this.typeBursts.length - this.maxTypeBursts);
    }
    if (this.shockwaves.length > this.maxShockwaves) {
      this.shockwaves.splice(0, this.shockwaves.length - this.maxShockwaves);
    }
  }

  update(delta) {
    // In-place filter without allocating when mostly alive
    let w = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0.1;
      p.life -= delta;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= p.decay || 0.98;
      if (p.life > 0 && p.alpha > 0.02) this.particles[w++] = p;
    }
    this.particles.length = w;

    w = 0;
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.alpha > 0.02) this.shockwaves[w++] = sw;
    }
    this.shockwaves.length = w;

    w = 0;
    for (let i = 0; i < this.typeBursts.length; i++) {
      const burst = this.typeBursts[i];
      burst.life -= delta;
      burst.progress = 1 - Math.max(0, burst.life / burst.maxLife);
      burst.alpha = Math.max(0, burst.life / burst.maxLife);
      burst.rotation += burst.spin;
      if (burst.life > 0) this.typeBursts[w++] = burst;
    }
    this.typeBursts.length = w;
  }

  draw() {
    const ctx = this.ctx;
    // No shadowBlur anywhere — major GPU cost on Windows/Chrome
    if (this.quality > 0) this.drawTypeBursts();

    const particles = this.particles;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.globalAlpha = p.alpha;

      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      } else if (p.type === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.type === 'text') {
        // Skip most floating text on low quality
        if (this.quality === 0 && i % 2 === 1) continue;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      ctx.globalAlpha = sw.alpha * 0.45;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = this.quality === 0 ? 2 : 2.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawTypeBursts() {
    if (!this.typeBursts.length || this.quality === 0) return;
    const ctx = this.ctx;

    for (let b = 0; b < this.typeBursts.length; b++) {
      const burst = this.typeBursts[b];
      const ease = 1 - Math.pow(1 - burst.progress, 3);
      const radius = burst.radius + ease * burst.spread;
      // Cheap: 1 row, few glyphs (was multi-row × 18 fills = disaster)
      const rows = this.quality >= 2 ? Math.min(2, burst.rows || 1) : 1;
      const count = this.quality >= 2 ? 8 : 6;

      ctx.save();
      ctx.translate(burst.x, burst.y);
      ctx.rotate(burst.rotation);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${burst.size}px sans-serif`;

      for (let row = 0; row < rows; row++) {
        const rowRadius = radius + row * (burst.rowGap || 18);
        ctx.globalAlpha = Math.max(0, 1 - row / Math.max(rows, 1)) * burst.alpha * 0.75;
        ctx.fillStyle = burst.color;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          const x = Math.cos(angle) * rowRadius;
          const y = Math.sin(angle) * rowRadius;
          ctx.fillText(burst.words[i % burst.words.length], x, y);
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  emitBreaking(x, y, color, count = 20) {
    const cap = this.quality === 0 ? 5 : this.quality === 1 ? 8 : 10;
    count = Math.min(count, cap);
    if (this.particles.length > this.maxParticles - 2) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 5;
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life: 320 + Math.random() * 280,
        maxLife: 600,
        gravity: 0.15,
        decay: 0.95
      });
    }
    this.trimParticles();
  }

  emitShards(x, y, color, count = 15) {
    const cap = this.quality === 0 ? 2 : this.quality === 1 ? 4 : 6;
    count = Math.min(count, cap);
    if (this.particles.length > this.maxParticles - 2) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        type: 'shard',
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        size: 3 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        color,
        alpha: 1,
        life: 500 + Math.random() * 300,
        maxLife: 800,
        gravity: 0.2,
        decay: 0.96
      });
    }
    this.trimParticles();
  }

  emitScorePopup(x, y, score, color = '#FFD700') {
    if (this.quality === 0 && this.particles.length > 20) return;
    this.particles.push({
      type: 'text',
      x,
      y,
      vx: 0,
      vy: -2,
      text: `+${score}`,
      size: 20,
      color,
      alpha: 1,
      life: 700,
      maxLife: 700,
      gravity: 0,
      decay: 1
    });
    this.trimParticles();
  }

  addShockwave(x, y, color = '#22D3EE', maxRadius = 150) {
    if (this.quality === 0 && this.shockwaves.length >= 1) {
      // replace oldest
      this.shockwaves[0] = {
        x, y, radius: 10, maxRadius, speed: Math.max(10, maxRadius / 14), color, alpha: 1
      };
      return;
    }
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      speed: Math.max(10, maxRadius / 16),
      color,
      alpha: 1
    });
    this.trimParticles();
  }

  emitPressureText(x, y, text, color = '#22D3EE', size = 18) {
    if (this.quality === 0) return;
    if (this.particles.length > this.maxParticles - 4) return;
    this.particles.push({
      type: 'text',
      x,
      y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -2,
      text,
      size: Math.min(size, 20),
      color,
      alpha: 1,
      life: 520,
      maxLife: 520,
      gravity: 0,
      decay: 1
    });
    this.trimParticles();
  }

  emitCombo(x, y, combo) {
    if (this.quality === 0) return;
    const colors = ['#FFD700', '#22D3EE', '#A855F7', '#FF3366'];
    const color = colors[Math.min(combo - 1, colors.length - 1)];
    this.particles.push({
      type: 'text',
      x: x + (Math.random() - 0.5) * 40,
      y: y - 20,
      vx: 0,
      vy: -2.5,
      text: `x${combo} COMBO!`,
      size: 16 + Math.min(combo, 8),
      color,
      alpha: 1,
      life: 800,
      maxLife: 800,
      gravity: 0.04,
      decay: 0.99
    });
    this.trimParticles();
  }

  emitTypographyBurst(x, y, options = {}) {
    if (this.quality === 0 || this.maxTypeBursts <= 0) return;
    if (this.typeBursts.length >= this.maxTypeBursts) return;
    if (this.particles.length > this.maxParticles * 0.85) return;

    this.typeBursts.push({
      x,
      y,
      words: options.words || ['碎', 'SMASH'],
      color: options.color || '#22D3EE',
      radius: options.radius || 14,
      spread: Math.min(options.spread || 100, 140),
      rows: 1,
      rowGap: 16,
      size: Math.min(options.size || 12, 14),
      warp: 0,
      freq: 1,
      rotation: options.rotation || Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.02,
      life: Math.min(options.life || 480, 520),
      maxLife: Math.min(options.life || 480, 520),
      alpha: 1,
      progress: 0
    });
  }

  emitTrail(x, y, color = '#22D3EE') {
    if (this.quality === 0) return;
    if (this.particles.length > this.maxParticles - 6) return;
    this.particles.push({
      type: 'spark',
      x,
      y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: 2 + Math.random(),
      color,
      alpha: 0.5,
      life: 120,
      maxLife: 120,
      gravity: 0,
      decay: 0.93
    });
  }
}
