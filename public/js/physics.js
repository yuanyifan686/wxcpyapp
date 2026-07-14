// physics.js - Matter.js wrapper with cyberpunk physics
const Matter = window.Matter;
const { Engine, World, Bodies, Body, Mouse, MouseConstraint, Events, Query, Vector } = Matter;

const STRESS_LABELS = [
  '加班', '内耗', '焦虑', 'deadline', '甩锅', '开会',
  'KPI', '摸鱼?', '通宵', '画饼', '催更', '群消息',
  'PPT', '周报', '焦虑', '压力', '内卷', '甩锅王',
  '凌晨', '回消息', '改需求', '延期', '复盘', '汇报'
];

const STRESS_ICONS = [
  '😤', '💀', '📱', '💻', '☕', '📊', '📈', '🫠',
  '😵', '🔥', '💣', '🧱', '⚡', '🥲', '📦', '🗓️',
  '✉️', '🔔', '🧠', '💸', '⏰', '🥶', '😈', '🗯️'
];

const COLOR_PALETTE = [
  '#6C63FF', '#A855F7', '#22D3EE', '#FFD700', '#FF3366',
  '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#2DD4BF',
  '#F472B6', '#60A5FA', '#FB7185', '#A3E635', '#C084FC'
];

const SHAPE_TYPES = [
  'block', 'sphere', 'triangle', 'capsule', 'neon',
  'hex', 'pentagon', 'star', 'diamond', 'cross',
  'ring', 'cloud', 'chip', 'arrow'
];

export class PhysicsEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = null;
    this.world = null;
    this.bodies = [];
    this.fragments = [];
    this.walls = [];
    this.mouse = null;
    this.mouseConstraint = null;
    this.width = 0;
    this.height = 0;

    this.createWorld();
  }

  pickLabel() {
    return STRESS_LABELS[Math.floor(Math.random() * STRESS_LABELS.length)];
  }

  pickIcon() {
    return STRESS_ICONS[Math.floor(Math.random() * STRESS_ICONS.length)];
  }

  pickColor() {
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  }

  pickPattern() {
    const patterns = ['solid', 'stripe', 'dots', 'ring', 'glow'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  /** Attach shared visual randomness on any cyber body. */
  decorate(body, extra = {}) {
    if (!body?.cyberData) return body;
    const d = body.cyberData;
    d.icon = extra.icon ?? (Math.random() > 0.28 ? this.pickIcon() : '');
    d.pattern = extra.pattern ?? this.pickPattern();
    d.spinBias = (Math.random() - 0.5) * 0.04;
    d.hueShift = Math.floor(Math.random() * 40) - 20;
    if (!d.label) d.label = this.pickLabel();
    // Sometimes pure icon mode (no text label clutter)
    if (d.icon && Math.random() > 0.55) d.showLabel = false;
    else d.showLabel = Math.random() > 0.35;
    return body;
  }

  /**
   * Fully random pressure entity — shape + size + color + icon.
   */
  createRandomPressure(x, y, options = {}) {
    const type = options.type || SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
    let body;
    switch (type) {
      case 'sphere':
        body = this.createCyberSphere(x, y, options);
        break;
      case 'triangle':
        body = this.createCyberTriangle(x, y, options);
        break;
      case 'capsule':
        body = this.createCyberCapsule(x, y, options);
        break;
      case 'neon':
        body = this.createNeonTube(x, y, (Math.random() - 0.5) * Math.PI);
        break;
      case 'hex':
        body = this.createPolygonShape(x, y, 6, options);
        break;
      case 'pentagon':
        body = this.createPolygonShape(x, y, 5, options);
        break;
      case 'star':
        body = this.createStarShape(x, y, options);
        break;
      case 'diamond':
        body = this.createDiamond(x, y, options);
        break;
      case 'cross':
        body = this.createCross(x, y, options);
        break;
      case 'ring':
        body = this.createRing(x, y, options);
        break;
      case 'cloud':
        body = this.createCloud(x, y, options);
        break;
      case 'chip':
        body = this.createChip(x, y, options);
        break;
      case 'arrow':
        body = this.createArrow(x, y, options);
        break;
      case 'block':
      default:
        body = this.createCyberBlock(x, y, options);
        break;
    }
    return this.decorate(body, options);
  }

  /** Small random kick so board doesn't look frozen on spawn. */
  nudge(body, scale = 1) {
    if (!body || body.isStatic) return body;
    Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 2.4 * scale,
      y: (Math.random() - 0.5) * 1.6 * scale - 0.4
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06 * scale);
    return body;
  }

  createWorld() {
    this.engine = Engine.create({
      enableSleeping: true,
      gravity: { x: 0, y: 0.45 }
    });
    // Lower iterations = less CPU when many bodies collide
    this.engine.positionIterations = 3;
    this.engine.velocityIterations = 2;
    this.engine.constraintIterations = 1;
    this.world = this.engine.world;
    this.bodies = [];
    this.fragments = [];
    this.walls = [];
    this.quality = 2;

    // MouseConstraint is expensive and unused for smash gameplay — skip it
    this.setupCollisionEvents();

    if (this.width > 0 && this.height > 0) {
      this.setBounds(this.width, this.height);
    }
  }

  setQuality(q) {
    this.quality = Math.max(0, Math.min(2, q | 0));
    if (!this.engine) return;
    if (this.quality === 0) {
      this.engine.positionIterations = 2;
      this.engine.velocityIterations = 2;
    } else if (this.quality === 1) {
      this.engine.positionIterations = 3;
      this.engine.velocityIterations = 2;
    } else {
      this.engine.positionIterations = 3;
      this.engine.velocityIterations = 2;
    }
  }

  setupCollisionEvents() {
    // Only process collisions when not overloaded; collision damage is secondary to clicks
    Events.on(this.engine, 'collisionStart', (event) => {
      if (this.quality === 0 && this.bodies.length > 18) return;
      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.bodyA.onCollision) pair.bodyA.onCollision(pair.bodyB);
        if (pair.bodyB.onCollision) pair.bodyB.onCollision(pair.bodyA);
      }
    });
  }

  /**
   * Create / replace static floor + side walls + ceiling so bodies stay in view.
   * Coordinates are CSS pixel space (same as game drawing after dpr scale).
   */
  setBounds(width, height) {
    if (!width || !height || !this.world) return;

    this.width = width;
    this.height = height;

    if (this.walls.length) {
      World.remove(this.world, this.walls);
      this.walls = [];
    }

    const t = 80;
    const opts = {
      isStatic: true,
      friction: 0,
      frictionStatic: 0,
      restitution: 1.08,
      label: 'wall',
      render: { visible: false }
    };

    // Top surface of floor sits at y = height
    const floor = Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, opts);
    const ceiling = Bodies.rectangle(width / 2, -t / 2, width + t * 2, t, opts);
    const left = Bodies.rectangle(-t / 2, height / 2, t, height + t * 2, opts);
    const right = Bodies.rectangle(width + t / 2, height / 2, t, height + t * 2, opts);

    this.walls = [floor, left, right, ceiling];
    World.add(this.world, this.walls);
  }

  update(delta = 1000 / 60) {
    delta = Math.min(delta, 1000 / 45);
    Engine.update(this.engine, delta);
    // Soft walls every other frame when crowded
    if (this.quality > 0 || (this._boundTick = (this._boundTick || 0) + 1) % 2 === 0) {
      this.enforceBounceBounds();
    }

    // Visual-only fragments: cheap canvas particles, not Matter bodies.
    const maxFrag = this.quality === 0 ? 18 : this.quality === 1 ? 28 : 40;
    const dt = delta / 16.67;
    let w = 0;
    for (let i = 0; i < this.fragments.length; i++) {
      const f = this.fragments[i];
      f.life -= delta;
      f.opacity = Math.max(0, f.life / f.maxLife);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += f.gravity * dt;
      f.angle += f.angularVelocity * dt;
      if (f.life > 0) this.fragments[w++] = f;
    }
    this.fragments.length = w;
    if (this.fragments.length > maxFrag) {
      this.fragments.splice(0, this.fragments.length - maxFrag);
    }
  }

  enforceBounceBounds() {
    const pad = 6;
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body || body.isStatic || !body.cyberData) continue;
      const data = body.cyberData;
      const halfW = data.radius || (data.width || 30) / 2;
      const halfH = data.radius || (data.height || 30) / 2;
      let bounced = false;
      let x = body.position.x;
      let y = body.position.y;
      let vx = body.velocity.x;
      let vy = body.velocity.y;

      if (x - halfW < pad) {
        x = halfW + pad;
        vx = Math.abs(vx) * 1.02 + 0.4;
        bounced = true;
      } else if (x + halfW > this.width - pad) {
        x = this.width - halfW - pad;
        vx = -Math.abs(vx) * 1.02 - 0.4;
        bounced = true;
      }

      if (y - halfH < pad) {
        y = halfH + pad;
        vy = Math.abs(vy) * 1.02 + 0.4;
        bounced = true;
      } else if (y + halfH > this.height - pad) {
        y = this.height - halfH - pad;
        vy = -Math.abs(vy) * 1.02 - 0.4;
        bounced = true;
      }

      if (bounced) {
        Body.setPosition(body, { x, y });
        Body.setVelocity(body, {
          x: Math.max(-22, Math.min(22, vx)),
          y: Math.max(-22, Math.min(22, vy))
        });
      }
    }
  }

  addBody(body) {
    World.add(this.world, body);
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    if (!body) return;
    World.remove(this.world, body);
    this.bodies = this.bodies.filter(b => b !== body);
  }

  getBodiesAtPoint(x, y) {
    // Only interactive game bodies (walls are not in this.bodies)
    return Query.point(this.bodies, { x, y });
  }

  applyHitImpulse(body, x, y, power = 0.018) {
    if (!body || body.isStatic) return;
    const dx = body.position.x - x;
    const dy = body.position.y - y;
    const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));
    const nx = dx / dist;
    const ny = dy / dist;

    // Prefer velocity kick over pure force — more consistent smash feel
    const kick = power * 420;
    Body.setVelocity(body, {
      x: Math.max(-24, Math.min(24, body.velocity.x + nx * kick * 0.55)),
      y: Math.max(-24, Math.min(24, body.velocity.y + ny * kick * 0.55 - kick * 0.22))
    });
    Body.applyForce(body, { x, y }, {
      x: nx * power,
      y: ny * power - power * 0.35
    });
    Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.4);
  }

  /** Keep only Matter.js-safe physics keys from options. */
  physicsOpts(options = {}, defaults = {}) {
    const allow = [
      'isStatic', 'restitution', 'friction', 'frictionAir', 'frictionStatic',
      'density', 'angle', 'chamfer', 'slop', 'collisionFilter', 'mass', 'inertia'
    ];
    const out = { ...defaults };
    for (let i = 0; i < allow.length; i++) {
      const k = allow[i];
      if (options[k] !== undefined) out[k] = options[k];
    }
    return out;
  }

  _baseRectOpts(options = {}) {
    return this.physicsOpts(options, {
      restitution: 0.92,
      friction: 0.08,
      frictionAir: 0.012,
      density: 0.001
    });
  }

  createCyberBlock(x, y, options = {}) {
    const width = options.width || 48 + Math.random() * 44;
    const height = options.height || 48 + Math.random() * 44;
    const color = options.color || this.pickColor();

    const body = Bodies.rectangle(x, y, width, height, this._baseRectOpts(options));

    body.cyberData = {
      type: 'block',
      role: options.role || 'pressure',
      color,
      width,
      height,
      health: 100,
      maxHealth: 100,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };

    body.onCollision = (other) => {
      if (!other || other.label === 'wall' || !body.cyberData) return;
      const impact = Math.abs(Vector.magnitude(Vector.sub(body.velocity, other.velocity)));
      if (impact > 5) body.cyberData.health -= impact * 2;
    };

    return this.nudge(this.addBody(body));
  }

  createCyberSphere(x, y, options = {}) {
    const radius = options.radius || 22 + Math.random() * 28;
    const color = options.color || this.pickColor();

    const body = Bodies.circle(x, y, radius, this.physicsOpts(options, {
      restitution: 1.02,
      friction: 0.04,
      frictionAir: 0.01,
      density: 0.0005
    }));

    body.cyberData = {
      type: 'sphere',
      role: options.role || 'pressure',
      color,
      radius,
      health: 80,
      maxHealth: 80,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };

    return this.nudge(this.addBody(body), body.isStatic ? 0 : 1);
  }

  createNeonTube(x, y, angle = 0) {
    const width = 90 + Math.random() * 90;
    const height = 10 + Math.random() * 8;
    const color = this.pickColor();

    const body = Bodies.rectangle(x, y, width, height, {
      angle: angle || (Math.random() - 0.5) * Math.PI,
      restitution: 0.86,
      friction: 0.08,
      frictionAir: 0.012,
      density: 0.002
    });

    body.cyberData = {
      type: 'neon',
      role: 'pressure',
      color,
      width,
      height,
      health: 60,
      maxHealth: 60,
      crackSeed: Math.random() * 1000,
      label: this.pickLabel()
    };

    return this.nudge(this.addBody(body), 0.7);
  }

  createCyberTriangle(x, y, options = {}) {
    const radius = options.radius || 26 + Math.random() * 20;
    const color = options.color || this.pickColor();
    const body = Bodies.polygon(x, y, 3, radius, this.physicsOpts(options, {
      angle: Math.random() * Math.PI,
      restitution: 1.05,
      friction: 0.04,
      frictionAir: 0.012,
      density: 0.00065
    }));

    body.cyberData = {
      type: 'triangle',
      role: options.role || 'pressure',
      color,
      radius,
      width: radius * 1.8,
      height: radius * 1.8,
      health: 70,
      maxHealth: 70,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };

    return this.nudge(this.addBody(body));
  }

  createCyberCapsule(x, y, options = {}) {
    const width = options.width || 70 + Math.random() * 50;
    const height = options.height || 22 + Math.random() * 16;
    const color = options.color || this.pickColor();
    const body = Bodies.rectangle(x, y, width, height, this.physicsOpts(options, {
      chamfer: { radius: height / 2 },
      angle: Math.random() * Math.PI,
      restitution: 0.98,
      friction: 0.05,
      frictionAir: 0.012,
      density: 0.0012
    }));

    body.cyberData = {
      type: 'capsule',
      role: options.role || 'pressure',
      color,
      width,
      height,
      health: 90,
      maxHealth: 90,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };

    return this.nudge(this.addBody(body));
  }

  createPolygonShape(x, y, sides = 6, options = {}) {
    const radius = options.radius || 26 + Math.random() * 20;
    const color = options.color || this.pickColor();
    const type = sides === 5 ? 'pentagon' : sides === 6 ? 'hex' : `poly${sides}`;
    const body = Bodies.polygon(x, y, sides, radius, this.physicsOpts(options, {
      angle: Math.random() * Math.PI,
      restitution: 0.98,
      friction: 0.05,
      frictionAir: 0.012,
      density: 0.0008
    }));
    body.cyberData = {
      type,
      role: options.role || 'pressure',
      color,
      radius,
      sides,
      width: radius * 1.9,
      height: radius * 1.9,
      health: 75 + sides * 2,
      maxHealth: 75 + sides * 2,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createStarShape(x, y, options = {}) {
    // Physics: pentagon; visual: star (keeps collisions cheap)
    const radius = options.radius || 28 + Math.random() * 16;
    const color = options.color || this.pickColor();
    const body = Bodies.polygon(x, y, 5, radius, this.physicsOpts(options, {
      angle: Math.random() * Math.PI,
      restitution: 1.05,
      friction: 0.04,
      frictionAir: 0.012,
      density: 0.0007
    }));
    body.cyberData = {
      type: 'star',
      role: options.role || 'pressure',
      color,
      radius,
      width: radius * 2,
      height: radius * 2,
      health: 85,
      maxHealth: 85,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createDiamond(x, y, options = {}) {
    const size = options.size || 40 + Math.random() * 30;
    const color = options.color || this.pickColor();
    const body = Bodies.rectangle(x, y, size, size, this.physicsOpts(options, {
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      restitution: 1.0,
      friction: 0.05,
      frictionAir: 0.012,
      density: 0.0009
    }));
    body.cyberData = {
      type: 'diamond',
      role: options.role || 'pressure',
      color,
      width: size,
      height: size,
      health: 88,
      maxHealth: 88,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createCross(x, y, options = {}) {
    const arm = options.arm || 50 + Math.random() * 24;
    const thick = options.thick || 16 + Math.random() * 10;
    const color = options.color || this.pickColor();
    // Single rectangle hitbox for perf; draw as cross
    const body = Bodies.rectangle(x, y, arm, arm, this.physicsOpts(options, {
      angle: Math.random() * Math.PI,
      restitution: 0.94,
      friction: 0.06,
      frictionAir: 0.012,
      density: 0.001
    }));
    body.cyberData = {
      type: 'cross',
      role: options.role || 'pressure',
      color,
      width: arm,
      height: arm,
      thick,
      health: 95,
      maxHealth: 95,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createRing(x, y, options = {}) {
    const radius = options.radius || 24 + Math.random() * 20;
    const color = options.color || this.pickColor();
    const body = Bodies.circle(x, y, radius, this.physicsOpts(options, {
      restitution: 1.08,
      friction: 0.03,
      frictionAir: 0.01,
      density: 0.00045
    }));
    body.cyberData = {
      type: 'ring',
      role: options.role || 'pressure',
      color,
      radius,
      health: 70,
      maxHealth: 70,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createCloud(x, y, options = {}) {
    const width = options.width || 70 + Math.random() * 40;
    const height = options.height || 40 + Math.random() * 20;
    const color = options.color || this.pickColor();
    const body = Bodies.rectangle(x, y, width, height, this.physicsOpts(options, {
      chamfer: { radius: 16 },
      angle: (Math.random() - 0.5) * 0.4,
      restitution: 0.9,
      friction: 0.06,
      frictionAir: 0.014,
      density: 0.0007
    }));
    body.cyberData = {
      type: 'cloud',
      role: options.role || 'pressure',
      color,
      width,
      height,
      health: 78,
      maxHealth: 78,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createChip(x, y, options = {}) {
    // Small "CPU chip" square with random size
    const size = options.size || 28 + Math.random() * 22;
    const color = options.color || this.pickColor();
    const body = Bodies.rectangle(x, y, size, size, this.physicsOpts(options, {
      angle: Math.random() * Math.PI * 0.5,
      restitution: 0.96,
      friction: 0.05,
      frictionAir: 0.01,
      density: 0.0011
    }));
    body.cyberData = {
      type: 'chip',
      role: options.role || 'pressure',
      color,
      width: size,
      height: size,
      health: 110,
      maxHealth: 110,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createArrow(x, y, options = {}) {
    const radius = options.radius || 28 + Math.random() * 16;
    const color = options.color || this.pickColor();
    const body = Bodies.polygon(x, y, 3, radius, this.physicsOpts(options, {
      angle: Math.random() * Math.PI * 2,
      restitution: 1.04,
      friction: 0.04,
      frictionAir: 0.011,
      density: 0.0007
    }));
    body.cyberData = {
      type: 'arrow',
      role: options.role || 'pressure',
      color,
      radius,
      width: radius * 1.8,
      height: radius * 1.8,
      health: 72,
      maxHealth: 72,
      crackSeed: Math.random() * 1000,
      label: options.label || this.pickLabel()
    };
    return this.nudge(this.addBody(body));
  }

  createPressureBomb(x, y, options = {}) {
    const body = this.createCyberSphere(x, y, {
      radius: options.radius || 24 + Math.random() * 12,
      restitution: 0.95,
      friction: 0.05,
      density: 0.00045,
      role: 'bomb',
      label: 'BOOM',
      color: '#FF3366'
    });
    body.cyberData.color = '#FF3366';
    body.cyberData.health = options.health || 45;
    body.cyberData.maxHealth = body.cyberData.health;
    body.cyberData.blastRadius = options.blastRadius || 180;
    body.cyberData.label = 'BOOM';
    body.cyberData.icon = '💣';
    body.cyberData.pattern = 'glow';
    body.cyberData.showLabel = true;
    return body;
  }

  fragmentBody(body) {
    const { position, cyberData } = body;
    if (!cyberData) return;

    const count = this.quality === 0
      ? 2
      : cyberData.role === 'bomb' ? 4 : 3;

    this.removeBody(body);

    for (let i = 0; i < count; i++) {
      const size = 5 + Math.random() * 12;
      const fragH = size * (0.5 + Math.random());
      this.fragments.push({
        x: position.x + (Math.random() - 0.5) * 32,
        y: position.y + (Math.random() - 0.5) * 32,
        vx: (Math.random() - 0.5) * 8,
        vy: -2 - Math.random() * 6,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.2,
        color: cyberData.color,
        width: size,
        height: fragH,
        life: 520 + Math.random() * 400,
        maxLife: 920,
        opacity: 1,
        gravity: 0.22
      });
    }
  }

  applyExplosion(x, y, force = 0.05, radius = 200) {
    this.bodies.forEach(body => {
      if (body.isStatic) return;
      const dx = body.position.x - x;
      const dy = body.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && dist > 0) {
        const strength = (1 - dist / radius) * force;
        const angle = Math.atan2(dy, dx);
        Body.applyForce(body, body.position, {
          x: Math.cos(angle) * strength,
          y: Math.sin(angle) * strength - strength * 0.5
        });
      }
    });
  }

  getBodiesInRadius(x, y, radius = 180) {
    return this.bodies.filter(body => {
      if (!body.cyberData || body.cyberData.type === 'fragment') return false;
      const dx = body.position.x - x;
      const dy = body.position.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /** Pull nearby bodies toward (x, y) - true squeeze. */
  applySqueeze(x, y, strength = 0.01) {
    this.bodies.forEach(body => {
      if (body.isStatic) return;
      const dx = body.position.x - x;
      const dy = body.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150 && dist > 1) {
        const factor = (1 - dist / 150) * strength;
        // Negative direction = toward cursor
        Body.applyForce(body, body.position, {
          x: -dx * factor * 0.02,
          y: -dy * factor * 0.02
        });
      }
    });
  }

  clear() {
    const q = this.quality ?? 2;
    if (this.engine) {
      try {
        Events.off(this.engine);
      } catch (_) {
        /* ignore */
      }
    }

    this.bodies = [];
    this.fragments = [];
    this.walls = [];
    this.mouseConstraint = null;
    this.mouse = null;

    this.createWorld();
    this.setQuality(q);
  }
}
