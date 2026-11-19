/* ============================================================
   stations.js — سکوهای ستاره هشت‌پر و اشیای نمادین هر ایستگاه
   همه چیز procedural است: بدون دانلود هیچ مدل یا تصویری.
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { STATIONS, PALETTE, PROJECT_FRAMES, qualityTier } from './data.js';

/* ---------- بافت‌های رویه‌ای (Canvas) ---------- */

/** هالهٔ نور شعاعی برای اسپرایت‌ها */
export function radialGlowTexture(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = new THREE.Color(hex);
  const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.35, `rgba(${rgb},0.28)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** تکرارشوندهٔ الگوی گِرِه (ستاره هشت‌پر) */
function girihTexture(hex) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;

  ctx.fillStyle = 'rgba(20,31,26,0.92)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = `rgba(${rgb},0.55)`;
  ctx.lineWidth = 2.2;

  const drawStar = (cx, cy, R) => {
    const r = R * 0.55;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI / 2) + (i * Math.PI) / 8;
      const rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(ang) * rad;
      const y = cy - Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    // مربع داخلی چرخیده
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-R * 0.34, -R * 0.34, R * 0.68, R * 0.68);
    ctx.restore();
  };

  drawStar(S / 2, S / 2, S * 0.3);
  // ستاره‌های چهارگوشه (تکرار با آفست نصف)
  drawStar(0, 0, S * 0.3);
  drawStar(S, 0, S * 0.3);
  drawStar(0, S, S * 0.3);
  drawStar(S, S, S * 0.3);

  ctx.strokeStyle = `rgba(${rgb},0.2)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.6);
  return tex;
}

/** «نمای صفحه‌ی» پروژه برای قاب‌های شناور */
function projectFrameTexture(p) {
  const W = 512, H = 320;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#182a23');
  bg.addColorStop(1, '#0d1713');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // خطوط گیرهٔ کم‌رنگ
  ctx.strokeStyle = 'rgba(242,235,220,0.07)';
  ctx.lineWidth = 1;
  for (let x = 40; x < W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 40; y < H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // ستارهٔ کوچک گوشه
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.save();
  ctx.translate(56, 56);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const ang = Math.PI / 2 + (i * Math.PI) / 8;
    const rad = i % 2 === 0 ? 26 : 14;
    const x = Math.cos(ang) * rad, y = -Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f2ebdc';
  ctx.font = '700 44px Vazirmatn, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.title, W / 2, H / 2 - 6);

  ctx.fillStyle = p.accent;
  ctx.font = '500 24px Vazirmatn, sans-serif';
  ctx.fillText(p.sub, W / 2, H / 2 + 38);

  ctx.fillStyle = 'rgba(242,235,220,0.4)';
  ctx.font = '600 18px Vazirmatn, sans-serif';
  ctx.fillText('.NET', W / 2, H - 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- هندسهٔ ستاره ---------- */
export function starShape(R, r = R * 0.55) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const ang = Math.PI / 2 + (i * Math.PI) / 8;
    const rad = i % 2 === 0 ? R : r;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function extrudedStar(R, { depth = 0.14, bevel = 0.02 } = {}) {
  const geo = new THREE.ExtrudeGeometry(starShape(R, R * 0.55), {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/* ---------- سکو ---------- */
function makePlatform(cfg, quality) {
  const group = new THREE.Group();
  const R = cfg.id === 'home' ? 2.35 : 1.85;

  // بدنهٔ ستاره‌ای
  const bodyGeo = extrudedStar(R, { depth: 0.5, bevel: 0.05 });
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: PALETTE.slate, roughness: 0.92, metalness: 0.05, flatShading: true,
  }));
  body.position.y = -0.5;
  body.userData.stationId = cfg.id;
  group.add(body);

  // کلاهک الگوی گیره
  const capGeo = new THREE.ShapeGeometry(starShape(R - 0.06, (R - 0.06) * 0.55));
  capGeo.rotateX(-Math.PI / 2);
  const uv = capGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + R) / (2 * R), (uv.getY(i) + R) / (2 * R));
  }
  const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({
    map: girihTexture(cfg.color), transparent: true, opacity: 0.95,
  }));
  cap.position.y = 0.012;
  cap.userData.stationId = cfg.id;
  group.add(cap);

  // خط تأکیدی لبه
  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(capGeo, 8),
    new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.8 })
  );
  rim.position.y = 0.03;
  group.add(rim);

  // هالهٔ زیر سکو (حس معلق بودن)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTexture(cfg.color), transparent: true, opacity: 0.17,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(R * 4.6, R * 4.6, 1);
  glow.position.y = -0.75;
  group.add(glow);

  group.userData = { id: cfg.id, hoverT: 0, rim, glow, baseGlow: 0.17 };
  return group;
}

/* ---------- اشیای نمادین ایستگاه‌ها ---------- */

function makeHomeObject() {
  const g = new THREE.Group();
  const solid = new THREE.Mesh(
    extrudedStar(1.0, { depth: 0.14 }),
    new THREE.MeshStandardMaterial({
      color: 0x175247, roughness: 0.35, metalness: 0.2,
      emissive: PALETTE.teal, emissiveIntensity: 0.35, flatShading: true,
    })
  );
  g.add(solid);

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(extrudedStar(1.32, { depth: 0.03, bevel: 0 }), 1),
    new THREE.LineBasicMaterial({ color: PALETTE.tealBright, transparent: true, opacity: 0.6 })
  );
  g.add(wire);

  const orbit = new THREE.Group();
  const miniGeo = extrudedStar(0.13, { depth: 0.04, bevel: 0 });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(miniGeo, new THREE.MeshBasicMaterial({ color: PALETTE.saffron }));
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * 1.75, Math.sin(a * 2) * 0.12, Math.sin(a) * 1.75);
    orbit.add(m);
  }
  g.add(orbit);

  return {
    group: g, mountY: 1.75,
    tick(t) {
      solid.rotation.y = t * 0.4;
      wire.rotation.y = -t * 0.26;
      wire.rotation.x = 0.18;
      orbit.rotation.y = t * 0.55;
      g.position.y = this.mountY + Math.sin(t * 0.9) * 0.12;
    },
  };
}

function makeExperienceObject() {
  const g = new THREE.Group();
  const monolith = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 2.5, 0.72),
    new THREE.MeshStandardMaterial({
      color: 0x24392f, roughness: 0.45, metalness: 0.15,
      emissive: PALETTE.saffron, emissiveIntensity: 0.16,
    })
  );
  g.add(monolith);

  const capStar = new THREE.Mesh(
    extrudedStar(0.24, { depth: 0.05 }),
    new THREE.MeshBasicMaterial({ color: PALETTE.saffron })
  );
  capStar.position.y = 1.45;
  g.add(capStar);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.018, 8, 72),
    new THREE.MeshBasicMaterial({ color: PALETTE.saffron, transparent: true, opacity: 0.45 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.55;
  g.add(ring);

  const orbit = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.teal, emissive: PALETTE.teal, emissiveIntensity: 0.4, roughness: 0.4,
  });
  for (let i = 0; i < 11; i++) {
    const m = new THREE.Mesh(cubeGeo, cubeMat);
    const a = (i / 11) * Math.PI * 2;
    const high = i % 2 === 0;
    m.position.set(Math.cos(a) * 1.5, high ? 1.75 : -0.65, Math.sin(a) * 1.5);
    m.rotation.set(a, a * 1.3, 0);
    orbit.add(m);
  }
  g.add(orbit);

  return {
    group: g, mountY: 1.35,
    tick(t) {
      orbit.rotation.y = t * 0.32;
      capStar.rotation.y = -t * 0.8;
      ring.rotation.z = t * 0.15;
      ring.material.opacity = 0.35 + Math.sin(t * 1.4) * 0.14;
    },
  };
}

function makeSkillsObject() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.5),
    new THREE.MeshStandardMaterial({
      color: 0x1c4a40, roughness: 0.3, metalness: 0.25,
      emissive: PALETTE.teal, emissiveIntensity: 0.3, flatShading: true,
    })
  );
  g.add(core);
  const wire = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.68),
    new THREE.MeshBasicMaterial({ color: PALETTE.tealBright, wireframe: true, transparent: true, opacity: 0.35 })
  );
  g.add(wire);

  const rings = [
    { r: 1.2, tilt: 0.5, speed: 0.55, count: 4, size: 0.17, color: PALETTE.tealBright },
    { r: 1.62, tilt: -0.38, speed: -0.42, count: 5, size: 0.15, color: PALETTE.cream },
    { r: 2.02, tilt: 0.9, speed: 0.3, count: 6, size: 0.125, color: PALETTE.rose },
  ].map((cfg, idx) => {
    const ringG = new THREE.Group();
    ringG.rotation.x = cfg.tilt;
    ringG.rotation.z = idx * 0.6;

    const guide = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.r, 0.011, 6, 64),
      new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.16 })
    );
    guide.rotation.x = Math.PI / 2;
    ringG.add(guide);

    const pivot = new THREE.Group();
    const shardGeo = new THREE.OctahedronGeometry(cfg.size);
    for (let i = 0; i < cfg.count; i++) {
      const s = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({
        color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.5, roughness: 0.3, flatShading: true,
      }));
      const a = (i / cfg.count) * Math.PI * 2;
      s.position.set(Math.cos(a) * cfg.r, 0, Math.sin(a) * cfg.r);
      s.userData.spin = 0.5 + i * 0.13;
      pivot.add(s);
    }
    ringG.add(pivot);
    g.add(ringG);
    return { pivot, speed: cfg.speed, shards: pivot.children };
  });

  return {
    group: g, mountY: 2.0,
    tick(t, dt) {
      core.rotation.y = t * 0.25;
      core.rotation.x = Math.sin(t * 0.3) * 0.2;
      wire.rotation.y = -t * 0.18;
      for (const r of rings) {
        r.pivot.rotation.y = t * r.speed;
        for (const s of r.shards) {
          s.rotation.y += dt * s.userData.spin;
          s.rotation.x += dt * s.userData.spin * 0.6;
        }
      }
      g.position.y = this.mountY + Math.sin(t * 0.8) * 0.1;
    },
  };
}

function makeProjectsObject(quality) {
  const g = new THREE.Group();
  const frames = PROJECT_FRAMES.map((p, i) => {
    const fg = new THREE.Group();
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.89),
      new THREE.MeshBasicMaterial({ map: projectFrameTexture(p) })
    );
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.54, 1.0, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x0e1a15, roughness: 0.55, metalness: 0.1 })
    );
    frame.position.z = -0.05;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(frame.geometry),
      new THREE.LineBasicMaterial({ color: p.accent, transparent: true, opacity: 0.75 })
    );
    edges.position.z = -0.05;
    fg.add(frame, screen, edges);
    fg.userData.idx = i;
    g.add(fg);
    return fg;
  });

  return {
    group: g, mountY: 1.55,
    /** جهت‌گیری قاب‌ها به سمت دوربینِ ایستگاه */
    faceToward(camPos) {
      const target = new THREE.Vector3(...camPos);
      const dir = target.sub(g.getWorldPosition(new THREE.Vector3()));
      const yaw = Math.atan2(dir.x, dir.z);
      const layout = [
        { a: 0, y: 0.32, s: 1.12 },   // قاب میانی، بزرگ‌تر و بالاتر
        { a: 0.62, y: -0.18, s: 0.94 },
        { a: -0.62, y: -0.14, s: 0.94 },
      ];
      frames.forEach((f, i) => {
        f.rotation.y = yaw + layout[i].a;
        f.userData.baseY = layout[i].y;
        f.userData.s = layout[i].s;
        f.scale.setScalar(layout[i].s);
      });
    },
    tick(t) {
      frames.forEach((f, i) => {
        f.position.y = (f.userData.baseY || 0) + Math.sin(t * 0.9 + i * 1.7) * 0.07;
        f.rotation.y += Math.sin(t * 0.5 + i) * 0.0009;
      });
      g.rotation.y = Math.sin(t * 0.22) * 0.06;
    },
  };
}

function makeEducationObject() {
  const g = new THREE.Group();
  const bookColors = [0x8a5a33, 0x0e7a63, 0xa4641c, 0x2c4a3a];
  const books = [];
  for (let i = 0; i < 4; i++) {
    const w = 1.0 - i * 0.08, h = 0.15, d = 0.66 - i * 0.04;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.7, flatShading: true })
    );
    b.position.y = 0.08 + i * (h + 0.015);
    b.rotation.y = (i % 2 ? -1 : 1) * (0.09 + i * 0.05);
    g.add(b);
    books.push(b);
  }
  const topStar = new THREE.Mesh(
    extrudedStar(0.2, { depth: 0.05 }),
    new THREE.MeshBasicMaterial({ color: PALETTE.cream })
  );
  topStar.position.y = 0.78;
  g.add(topStar);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 2.0, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.slateDark, roughness: 0.6, flatShading: true })
  );
  column.position.set(0.85, 1.0, 0.1);
  g.add(column);

  const rings = [0.42, 0.56, 0.7].map((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.02, 8, 48),
      new THREE.MeshBasicMaterial({
        color: [PALETTE.tealBright, PALETTE.amber, PALETTE.cream][i], transparent: true, opacity: 0.6,
      })
    );
    ring.rotation.x = Math.PI / 2 + 0.12;
    ring.position.set(0.85, 0.5 + i * 0.55, 0.1);
    g.add(ring);
    return ring;
  });

  return {
    group: g, mountY: 0.62,
    tick(t) {
      topStar.rotation.y = t * 0.7;
      rings.forEach((r, i) => {
        r.rotation.z = t * (0.2 + i * 0.1) * (i % 2 ? -1 : 1);
        r.position.y = 0.5 + i * 0.55 + Math.sin(t * 0.9 + i) * 0.04;
      });
    },
  };
}

function makeContactObject() {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.42, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.slateDark, roughness: 0.6, flatShading: true })
  );
  pedestal.position.y = 0.2;
  g.add(pedestal);

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.cream })
  );
  orb.position.y = 0.62;
  g.add(orb);
  const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTexture(PALETTE.cream), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  orbGlow.scale.set(1.6, 1.6, 1);
  orbGlow.position.y = 0.62;
  g.add(orbGlow);

  // هواپیمای کاغذی
  const plane = (() => {
    const V = [
      [0.72, 0, 0],       // nose
      [-0.42, 0.14, 0],   // tail top
      [-0.42, 0, 0.3],    // tail left
      [-0.42, 0, -0.3],   // tail right
      [-0.42, -0.12, 0],  // keel
    ];
    const F = [[0, 1, 3], [0, 2, 1], [0, 4, 2], [0, 3, 4]];
    const pos = [];
    for (const f of F) for (const vi of f) pos.push(...V[vi]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: PALETTE.cream, emissive: PALETTE.cream, emissiveIntensity: 0.25,
      side: THREE.DoubleSide, flatShading: true, roughness: 0.5,
    }));
  })();
  const orbit = new THREE.Group();
  orbit.add(plane);
  g.add(orbit);

  // حلقه‌های سیگنال
  const sigRings = [0, 1, 2].map((i) => {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.014, 8, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.tealBright, transparent: true, opacity: 0.5 })
    );
    r.rotation.x = Math.PI / 2;
    r.position.y = 0.62;
    g.add(r);
    return r;
  });

  return {
    group: g, mountY: 0.55,
    tick(t) {
      orbit.rotation.y = t * 0.65;
      plane.position.set(1.35, 0.75 + Math.sin(t * 1.3) * 0.14, 0);
      plane.rotation.set(0.1, -Math.PI / 2 - t * 0.65, Math.sin(t * 2.1) * 0.22);
      orbGlow.material.opacity = 0.4 + Math.sin(t * 2) * 0.15;
      sigRings.forEach((r, i) => {
        const p = ((t * 0.42 + i / 3) % 1);
        r.scale.setScalar(0.6 + p * 3.2);
        r.material.opacity = (1 - p) * 0.45;
      });
    },
  };
}

/* ---------- ساخت همهٔ ایستگاه‌ها ---------- */
export function buildStations(scene, { quality }) {
  const makers = {
    home: makeHomeObject,
    experience: makeExperienceObject,
    skills: makeSkillsObject,
    projects: () => makeProjectsObject(quality),
    education: makeEducationObject,
    contact: makeContactObject,
  };

  const platforms = [];
  const interactables = [];
  const stationTicks = [];

  for (const cfg of STATIONS) {
    const platform = makePlatform(cfg, quality);
    platform.position.set(...cfg.position);
    scene.add(platform);
    platforms.push(platform);
    interactables.push(platform.children[0], platform.children[1]);

    const obj = makers[cfg.id]();
    obj.group.position.set(cfg.position[0], cfg.position[1] + 0.6 + obj.mountY, cfg.position[2]);
    scene.add(obj.group);
    if (obj.faceToward) obj.faceToward(cfg.view.cam);
    stationTicks.push(obj.tick.bind(obj));
  }

  return {
    platforms,
    interactables,
    tick(t, dt, elapsed) {
      const bob = quality.reducedMotion ? 0 : Math.sin(elapsed * 0.6) * 0.13;
      for (const p of platforms) {
        const cfg = STATIONS.find((s) => s.id === p.userData.id);
        p.position.y = cfg.position[1] + (quality.reducedMotion ? 0 : Math.sin(elapsed * 0.6 + cfg.position[0]) * 0.1);
        // هاور
        p.userData.hoverT += ((p.userData.hovered ? 1 : 0) - p.userData.hoverT) * 0.12;
        const h = p.userData.hoverT;
        p.scale.setScalar(1 + h * 0.035);
        p.userData.rim.material.opacity = 0.8 + h * 0.2;
        p.userData.glow.material.opacity = p.userData.baseGlow + h * 0.16;
      }
      for (const fn of stationTicks) fn(t, dt);
      return bob;
    },
  };
}
