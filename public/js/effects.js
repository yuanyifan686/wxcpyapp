// effects.js - Particle system and visual effects
export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shockwaves = [];
    this.typeBursts = [];
    this.maxParticles = 140;
    this.maxTypeBursts = 3;
  }

  trimParticles() {
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
    if (this.typeBursts.length > this.maxTypeBursts) {
      this.typeBursts.splice(0, this.typeBursts.length - this.maxTypeBursts);
    }
  }

  update(delta) {
    // Update particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0.1;
      p.life -= delta;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= p.decay || 0.98;
      return p.life > 0 && p.alpha > 0;
    });

    // Update shockwaves
    this.shockwaves = this.shockwaves.filter(sw => {
      sw.radius += sw.speed;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      return sw.alpha > 0;
    });

    this.typeBursts = this.typeBursts.filter(burst => {
      burst.life -= delta;
      burst.progress = 1 - Math.max(0, burst.life / burst.maxLife);
      burst.alpha = Math.max(0, burst.life / burst.maxLife);
      burst.rotation += burst.spin;
      return burst.life > 0;
    });
  }

  draw() {
    this.drawTypeBursts();

    // Draw particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;

      if (p.type === 'spark') {
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.type === 'shard') {
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.type === 'text') {
        this.ctx.font = `bold ${p.size}px monospace`;
        this.ctx.fillStyle = p.color;
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 15;
        this.ctx.fillText(p.text, p.x, p.y);
      }

      this.ctx.restore();
    });

    // Draw shockwaves
    this.shockwaves.forEach(sw => {
      this.ctx.save();
      this.ctx.globalAlpha = sw.alpha * 0.5;
      this.ctx.strokeStyle = sw.color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    });
  }

  drawTypeBursts() {
    this.typeBursts.forEach(burst => {
      const ease = 1 - Math.pow(1 - burst.progress, 3);
      const radius = burst.radius + ease * burst.spread;
      const rows = burst.rows;
      const wobble = Math.sin(burst.progress * Math.PI) * burst.warp;

      this.ctx.save();
      this.ctx.translate(burst.x, burst.y);
      this.ctx.rotate(burst.rotation);
      this.ctx.globalAlpha = burst.alpha * 0.82;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `900 ${burst.size}px Arial, sans-serif`;
      this.ctx.shadowColor = burst.color;
      this.ctx.shadowBlur = 8;

      for (let row = 0; row < rows; row++) {
        const rowRadius = radius + row * burst.rowGap;
        const count = Math.min(18, Math.max(6, Math.floor((Math.PI * 2 * rowRadius) / (burst.size * 5.2))));
        const rowAlpha = Math.max(0, 1 - row / rows) * burst.alpha;
        this.ctx.globalAlpha = rowAlpha * 0.7;

        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          const ripple = Math.sin(angle * burst.freq + burst.progress * Math.PI * 4) * wobble;
          const x = Math.cos(angle) * (rowRadius + ripple);
          const y = Math.sin(angle) * (rowRadius - ripple * 0.35);
          const scaleX = 1 + Math.sin(angle + burst.progress * 5) * 0.22;
          const scaleY = 1 + Math.cos(angle * 2 - burst.progress * 4) * 0.18;

          this.ctx.save();
          this.ctx.translate(x, y);
          this.ctx.rotate(angle + Math.PI / 2 + ripple * 0.01);
          this.ctx.scale(scaleX, scaleY);
          this.ctx.fillStyle = i % 2 ? burst.color : '#FFFFFF';
          this.ctx.fillText(burst.words[i % burst.words.length], 0, 0);
          this.ctx.restore();
        }
      }

      this.ctx.restore();
    });
  }

  emitBreaking(x, y, color, count = 20) {
    count = Math.min(count, 16);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 6;
      const size = 2 + Math.random() * 4;

      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size,
        color,
        alpha: 1,
        life: 500 + Math.random() * 500,
        maxLife: 1000,
        gravity: 0.15,
        decay: 0.96
      });
    }
    this.trimParticles();
  }

  emitShards(x, y, color, count = 15) {
    count = Math.min(count, 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;

      this.particles.push({
        type: 'shard',
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 4 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        color,
        alpha: 1,
        life: 800 + Math.random() * 400,
        maxLife: 1200,
        gravity: 0.2,
        decay: 0.97
      });
    }
    this.trimParticles();
  }

  emitScorePopup(x, y, score, color = '#FFD700') {
    this.particles.push({
      type: 'text',
      x,
      y,
      vx: 0,
      vy: -2,
      text: `+${score}`,
      size: 24,
      color,
      alpha: 1,
      life: 1000,
      maxLife: 1000,
      gravity: 0,
      decay: 1
    });
    this.trimParticles();
  }

  addShockwave(x, y, color = '#22D3EE', maxRadius = 150) {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      speed: Math.max(8, maxRadius / 18),
      color,
      alpha: 1
    });
    if (this.shockwaves.length > 8) this.shockwaves.splice(0, this.shockwaves.length - 8);
  }

  emitPressureText(x, y, text, color = '#22D3EE', size = 18) {
    this.particles.push({
      type: 'text',
      x,
      y,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -2.2,
      text,
      size,
      color,
      alpha: 1,
      life: 760,
      maxLife: 760,
      gravity: 0,
      decay: 1
    });
    this.trimParticles();
  }

  emitCombo(x, y, combo) {
    const colors = ['#FFD700', '#22D3EE', '#A855F7', '#FF3366'];
    const color = colors[Math.min(combo - 1, colors.length - 1)];

    this.particles.push({
      type: 'text',
      x: x + (Math.random() - 0.5) * 60,
      y: y - 20,
      vx: (Math.random() - 0.5) * 2,
      vy: -3,
      text: `x${combo} COMBO!`,
      size: 18 + combo * 2,
      color,
      alpha: 1,
      life: 1200,
      maxLife: 1200,
      gravity: 0.05,
      decay: 0.99
    });
    this.trimParticles();
  }

  emitTypographyBurst(x, y, options = {}) {
    if (this.particles.length > 105 || this.typeBursts.length >= this.maxTypeBursts) return;
    this.typeBursts.push({
      x,
      y,
      words: options.words || ['释放', 'RELAX', 'SMASH', '清空'],
      color: options.color || '#22D3EE',
      radius: options.radius || 18,
      spread: options.spread || 180,
      rows: options.rows || 4,
      rowGap: options.rowGap || 20,
      size: options.size || 13,
      warp: options.warp || 22,
      freq: options.freq || 5,
      rotation: options.rotation || Math.random() * Math.PI,
      spin: options.spin || (Math.random() - 0.5) * 0.035,
      life: options.life || 760,
      maxLife: options.life || 760,
      alpha: 1,
      progress: 0
    });
    this.trimParticles();
  }
}
