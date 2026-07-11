// physics.js - Matter.js wrapper with cyberpunk physics
const Matter = window.Matter;
const { Engine, World, Bodies, Body, Mouse, MouseConstraint, Events, Query, Vector } = Matter;

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

  createWorld() {
    this.engine = Engine.create({
      enableSleeping: true,
      gravity: { x: 0, y: 0.45 }
    });
    this.engine.positionIterations = 4;
    this.engine.velocityIterations = 3;
    this.engine.constraintIterations = 1;
    this.world = this.engine.world;
    this.bodies = [];
    this.fragments = [];
    this.walls = [];

    this.setupMouse(this.canvas);
    this.setupCollisionEvents();

    if (this.width > 0 && this.height > 0) {
      this.setBounds(this.width, this.height);
    }
  }

  setupMouse(canvas) {
    if (!canvas) return;

    // Drop previous mouse listeners if recreating world
    if (this.mouse && this.mouse.element) {
      try {
        this.mouse.element.removeEventListener('mousewheel', this.mouse.mousewheel);
        this.mouse.element.removeEventListener('DOMMouseScroll', this.mouse.mousewheel);
      } catch (_) {
        /* ignore */
      }
    }

    const mouse = Mouse.create(canvas);
    this.mouseConstraint = MouseConstraint.create(this.engine, {
      mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false }
      }
    });
    World.add(this.world, this.mouseConstraint);
    this.mouse = mouse;
  }

  setupCollisionEvents() {
    Events.on(this.engine, 'collisionStart', (event) => {
      event.pairs.forEach(pair => {
        if (pair.bodyA.onCollision) pair.bodyA.onCollision(pair.bodyB);
        if (pair.bodyB.onCollision) pair.bodyB.onCollision(pair.bodyA);
      });
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
    this.enforceBounceBounds();

    // Visual-only fragments: cheap canvas particles, not Matter bodies.
    this.fragments = this.fragments.filter(f => {
      f.life -= delta;
      f.opacity = Math.max(0, f.life / f.maxLife);
      f.x += f.vx * (delta / 16.67);
      f.y += f.vy * (delta / 16.67);
      f.vy += f.gravity * (delta / 16.67);
      f.angle += f.angularVelocity * (delta / 16.67);
      return f.life > 0;
    });
  }

  enforceBounceBounds() {
    const pad = 6;
    this.bodies.forEach(body => {
      if (!body || body.isStatic || !body.cyberData) return;
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
        Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.08);
      }
    });
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

    Body.applyForce(body, { x, y }, {
      x: nx * power,
      y: ny * power - power * 0.35
    });
    Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.35);
  }

  createCyberBlock(x, y, options = {}) {
    const width = options.width || 60 + Math.random() * 40;
    const height = options.height || 60 + Math.random() * 40;
    const colorIndex = Math.floor(Math.random() * 4);
    const colors = ['#6C63FF', '#A855F7', '#22D3EE', '#FFD700'];
    const color = colors[colorIndex];

    const body = Bodies.rectangle(x, y, width, height, {
      restitution: 0.92,
      friction: 0.08,
      frictionAir: 0.012,
      density: 0.001,
      ...options
    });

    body.cyberData = {
      type: 'block',
      role: options.role || 'pressure',
      color,
      width,
      height,
      health: 100,
      maxHealth: 100,
      crackSeed: Math.random() * 1000
    };

    body.onCollision = (other) => {
      if (!other || other.label === 'wall' || !body.cyberData) return;
      const impact = Math.abs(Vector.magnitude(Vector.sub(body.velocity, other.velocity)));
      if (impact > 5) {
        body.cyberData.health -= impact * 2;
      }
    };

    return this.addBody(body);
  }

  createCyberSphere(x, y, options = {}) {
    const radius = options.radius || 25 + Math.random() * 25;
    const colors = ['#FF3366', '#10B981', '#F59E0B', '#EC4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const body = Bodies.circle(x, y, radius, {
      restitution: 1.02,
      friction: 0.04,
      frictionAir: 0.01,
      density: 0.0005,
      ...options
    });

    body.cyberData = {
      type: 'sphere',
      role: options.role || 'pressure',
      color,
      radius,
      health: 80,
      maxHealth: 80,
      crackSeed: Math.random() * 1000
    };

    return this.addBody(body);
  }

  createNeonTube(x, y, angle = 0) {
    const width = 120 + Math.random() * 80;
    const height = 12;
    const colors = ['#22D3EE', '#A855F7', '#FF3366'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const body = Bodies.rectangle(x, y, width, height, {
      angle,
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
      crackSeed: Math.random() * 1000
    };

    return this.addBody(body);
  }

  createCyberTriangle(x, y, options = {}) {
    const radius = options.radius || 28 + Math.random() * 18;
    const colors = ['#8B5CF6', '#22D3EE', '#FF8BD1'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const body = Bodies.polygon(x, y, 3, radius, {
      angle: Math.random() * Math.PI,
      restitution: 1.05,
      friction: 0.04,
      frictionAir: 0.012,
      density: 0.00065,
      ...options
    });

    body.cyberData = {
      type: 'triangle',
      role: options.role || 'pressure',
      color,
      radius,
      width: radius * 1.8,
      height: radius * 1.8,
      health: 70,
      maxHealth: 70,
      crackSeed: Math.random() * 1000
    };

    return this.addBody(body);
  }

  createCyberCapsule(x, y, options = {}) {
    const width = options.width || 82 + Math.random() * 46;
    const height = options.height || 26 + Math.random() * 12;
    const colors = ['#10B981', '#22D3EE', '#FFD700'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const body = Bodies.rectangle(x, y, width, height, {
      chamfer: { radius: height / 2 },
      angle: Math.random() * Math.PI,
      restitution: 0.98,
      friction: 0.05,
      frictionAir: 0.012,
      density: 0.0012,
      ...options
    });

    body.cyberData = {
      type: 'capsule',
      role: options.role || 'pressure',
      color,
      width,
      height,
      health: 90,
      maxHealth: 90,
      crackSeed: Math.random() * 1000
    };

    return this.addBody(body);
  }

  createPressureBomb(x, y, options = {}) {
    const body = this.createCyberSphere(x, y, {
      radius: options.radius || 24 + Math.random() * 12,
      restitution: 0.95,
      friction: 0.05,
      density: 0.00045,
      role: 'bomb'
    });
    body.cyberData.color = '#FF3366';
    body.cyberData.health = options.health || 45;
    body.cyberData.maxHealth = body.cyberData.health;
    body.cyberData.blastRadius = options.blastRadius || 180;
    return body;
  }

  fragmentBody(body) {
    const { position, cyberData } = body;
    if (!cyberData) return;

    const count = cyberData.role === 'bomb' ? 5 : 4 + Math.floor(Math.random() * 3);

    this.removeBody(body);

    for (let i = 0; i < count; i++) {
      const size = 5 + Math.random() * 15;
      const fragH = size * (0.5 + Math.random());
      this.fragments.push({
        x: position.x + (Math.random() - 0.5) * 40,
        y: position.y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 9,
        vy: -2 - Math.random() * 7,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.24,
        color: cyberData.color,
        width: size,
        height: fragH,
        life: 1000 + Math.random() * 700,
        maxLife: 1700,
        opacity: 1,
        gravity: 0.22
      });
    }

    const maxFragments = 55;
    if (this.fragments.length > maxFragments) {
      this.fragments.splice(0, this.fragments.length - maxFragments);
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
  }
}
