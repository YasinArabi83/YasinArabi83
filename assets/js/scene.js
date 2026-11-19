/* ============================================================
   scene.js — صحنهٔ سه‌بعدی «میز کار برنامه‌نویس»
   یک اتاق ایزومتریک با میز کار کامل: مانیتور دوتایی (کد + داشبورد)،
   کیبورد مکانیکال، کیس با فن روشن، کتابخانه، چراغ، فنجان چای،
   مرغابی دیباگ و صندلی — همهٔ اجزا با هندسهٔ رویه‌ای ساخته می‌شوند.
   ============================================================ */

import * as THREE from 'three';
import { HOTSPOTS, PROJECT_FRAMES, qualityTier, clamp, lerp } from './data.js';

const DESK_Y = 0.8;
const FA_FONT = "'Vazirmatn', sans-serif";
const MONO_FONT = "'Cascadia Code', ui-monospace, Consolas, monospace";

/* ---------- ابزارهای کوچک ---------- */

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.04, ...opts });
}

function box(parent, w, h, d, x, y, z, material, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.cast) m.castShadow = true;
  if (opts.receive) m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent, rTop, rBot, h, x, y, z, material, seg = 18, opts = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
  m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.cast) m.castShadow = true;
  parent.add(m);
  return m;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- توکنایزر کد C# برای رنگ‌آمیزی صفحهٔ مانیتور ---------- */

const KEYWORDS = new Set([
  'public', 'sealed', 'class', 'private', 'readonly', 'void', 'if', 'new',
  'throw', 'string', 'var', 'return', 'this', 'get', 'set', 'using', 'namespace',
]);

const TOK_COLORS = {
  cmt: '#57606a', kw: '#ff7b72', type: '#ffa657', str: '#a5d6ff',
  num: '#79c0ff', fn: '#d2a8ff', pln: '#e6edf3', op: '#a3adbd',
};

function tokenizeLine(line) {
  if (line.trim().startsWith('//')) return [[line, 'cmt']];
  const tokens = [];
  const re = /("(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(\d+)|(\s+)|([^\s\w])/g;
  let m;
  const parts = [];
  while ((m = re.exec(line)) !== null) parts.push(m);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p[1]) tokens.push([p[1], 'str']);
    else if (p[2]) {
      const w = p[2];
      const next = parts[i + 1];
      if (KEYWORDS.has(w)) tokens.push([w, 'kw']);
      else if (/^[A-Z]/.test(w)) tokens.push([w, 'type']);
      else if (next && next[5] === '(') tokens.push([w, 'fn']);
      else tokens.push([w, 'pln']);
    } else if (p[3]) tokens.push([p[3], 'num']);
    else if (p[4]) tokens.push([p[4], 'pln']);
    else tokens.push([p[5], 'op']);
  }
  return tokens;
}

const CODE_LINES = [
  '// Domain/Assemblies/Assembly.cs',
  'public sealed class Assembly : AggregateRoot',
  '{',
  '    private readonly List<Session> _sessions = new();',
  '',
  '    public AssemblyId Id { get; }',
  '    public string Title { get; private set; }',
  '',
  '    public void Schedule(Session session)',
  '    {',
  '        if (_sessions.Any(s => s.Overlaps(session)))',
  '            throw new DomainException("برنامه هم‌پوشانی دارد");',
  '',
  '        _sessions.Add(session);',
  '        Raise(new SessionScheduled(session.Id));',
  '    }',
  '}',
].map((l) => ({ raw: l, tokens: tokenizeLine(l) }));

const TERM_SCRIPT = [
  { cmd: 'dotnet run --project ParsanERP' },
  { out: 'Building ParsanERP...', dim: true },
  { out: '✓ Build succeeded — 0 errors', ok: true },
  { cmd: 'git log --oneline -2' },
  { out: 'a3f9c2d (HEAD -> main) feat: assemblies v2', dim: true },
  { out: '8f21e04 init: hello, world', dim: true },
  { cmd: 'echo "open to work"' },
  { out: 'open to work', ok: true },
];

/* ---------- سازندهٔ صحنه ---------- */

export async function createScene(canvas, options = {}) {
  const { reducedMotion = false, onNavigate = () => {}, onReady = () => {}, onFail = () => {} } = options;

  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  const tier = qualityTier(isMobile);

  let renderer;
  try {
    if (!window.WebGLRenderingContext) throw new Error('no webgl');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    onFail();
    return null;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const wrap = canvas.parentElement;
  const hotspotLayer = document.getElementById('hotspots');

  /* ----- فونت فارسی برای بوم‌ها ----- */
  try {
    await Promise.race([
      Promise.all([document.fonts.load("700 30px 'Vazirmatn'"), document.fonts.load("400 16px 'Vazirmatn'")]),
      new Promise((res) => setTimeout(res, 1200)),
    ]);
  } catch { /* fallback */ }

  /* ===== دوربین ===== */
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  const camTarget = new THREE.Vector3(0.95, 1.02, -1.55);
  const CAM_R = 6.6;
  let az = 0.55, pol = 1.1, targetAz = az, targetPol = pol, restAz = az;
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  function applyCamera() {
    const a = az + parallax.x;
    const p = pol + parallax.y;
    camera.position.set(
      camTarget.x + CAM_R * Math.sin(p) * Math.sin(a),
      camTarget.y + CAM_R * Math.cos(p),
      camTarget.z + CAM_R * Math.sin(p) * Math.cos(a)
    );
    camera.lookAt(camTarget);
  }

  /* ===== نور ===== */
  scene.add(new THREE.AmbientLight(0x4a5568, 2.2));
  scene.add(new THREE.HemisphereLight(0x4a5666, 0x2e2620, 1.7));

  const dirLight = new THREE.DirectionalLight(0xb8c6d6, 5.5);
  dirLight.position.set(-4.2, 5.6, 0.6);
  if (tier.shadows) {
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    const sc = dirLight.shadow.camera;
    sc.left = -5.5; sc.right = 5.5; sc.top = 5.5; sc.bottom = -5.5;
    sc.near = 1; sc.far = 16;
    dirLight.shadow.bias = -0.0004;
  }
  scene.add(dirLight);

  // نور فیل ملایم از سمت دوربین (جلوگیری از سیاه‌شدن سطوح روبه‌رو)
  const fillLight = new THREE.DirectionalLight(0x96aabf, 2.0);
  fillLight.position.set(4.5, 3.2, 5);
  scene.add(fillLight);

  const lampLight = new THREE.PointLight(0xffb066, 12, 4.6, 2);
  lampLight.position.set(-1.32, 1.74, -2.45);
  scene.add(lampLight);

  const screenLight = new THREE.PointLight(0x9fe6b0, 5.5, 3.0, 2);
  screenLight.position.set(0.35, 1.3, -1.9);
  scene.add(screenLight);

  const dashLight = new THREE.PointLight(0x7ee787, 2.6, 2.2, 2);
  dashLight.position.set(-0.85, 1.2, -2.0);
  scene.add(dashLight);

  const windowLight = new THREE.PointLight(0x9fb9c9, 5.5, 6.5, 2);
  windowLight.position.set(-3.7, 2.1, -1.4);
  scene.add(windowLight);

  // نور سبز ملایم کنار کیس برای خوانا شدنش
  const pcLight = new THREE.PointLight(0x3fb950, 3, 2.2, 2);
  pcLight.position.set(1.7, 0.55, -2.3);
  scene.add(pcLight);

  /* ===== بافت‌های رویه‌ای ===== */

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, ctx: c.getContext('2d') };
  }

  /* — کف اتاق — */
  const { c: gc, ctx: gctx } = makeCanvas(256, 256);
  gctx.fillStyle = '#2a323e';
  gctx.fillRect(0, 0, 256, 256);
  gctx.strokeStyle = '#3a4655';
  gctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    gctx.beginPath(); gctx.moveTo(i, 0); gctx.lineTo(i, 256); gctx.stroke();
    gctx.beginPath(); gctx.moveTo(0, i); gctx.lineTo(256, i); gctx.stroke();
  }
  const gridTex = new THREE.CanvasTexture(gc);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(4, 4);
  gridTex.colorSpace = THREE.SRGBColorSpace;

  /* — پنجرهٔ شهری — */
  function makeWindowTexture() {
    const { c, ctx } = makeCanvas(256, 384);
    const grad = ctx.createLinearGradient(0, 0, 0, 384);
    grad.addColorStop(0, '#0a1120');
    grad.addColorStop(1, '#0d1524');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(220, 230, 240, 0.8)';
      ctx.fillRect(Math.random() * 256, Math.random() * 200, 1.6, 1.6);
    }
    ctx.fillStyle = '#dfe6ee';
    ctx.beginPath(); ctx.arc(196, 60, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(223, 230, 238, 0.12)';
    ctx.beginPath(); ctx.arc(196, 60, 30, 0, Math.PI * 2); ctx.fill();
    const towers = [[18, 210, 58, 174], [86, 250, 44, 134], [140, 190, 40, 194], [190, 240, 50, 144]];
    for (const [tx, ty, tw, th] of towers) {
      ctx.fillStyle = '#11161f';
      ctx.fillRect(tx, ty, tw, th);
      for (let wy = ty + 10; wy < ty + th - 8; wy += 16) {
        for (let wx = tx + 7; wx < tx + tw - 7; wx += 13) {
          const r = Math.random();
          if (r > 0.62) {
            ctx.fillStyle = r > 0.9 ? 'rgba(159, 230, 255, 0.85)' : 'rgba(255, 210, 122, 0.85)';
            ctx.fillRect(wx, wy, 5, 6);
          }
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* — پوسترها — */
  function makePosterCode() {
    const { c, ctx } = makeCanvas(340, 440);
    ctx.fillStyle = '#10151d';
    ctx.fillRect(0, 0, 340, 440);
    ctx.strokeStyle = '#232c3a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 320, 420);
    ctx.fillStyle = '#3fb950';
    ctx.font = `700 110px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('</>', 170, 170);
    ctx.fillStyle = '#e8eef6';
    ctx.font = `700 34px ${FA_FONT}`;
    ctx.fillText('کد تمیز،', 170, 265);
    ctx.fillText('ذهن تمیز', 170, 315);
    ctx.fillStyle = '#57606a';
    ctx.font = `400 17px ${MONO_FONT}`;
    ctx.fillText('#define BUG feature', 170, 395);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function makePosterGit() {
    const { c, ctx } = makeCanvas(320, 400);
    ctx.fillStyle = '#10151d';
    ctx.fillRect(0, 0, 320, 400);
    ctx.strokeStyle = '#232c3a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 300, 380);
    ctx.font = `400 19px ${MONO_FONT}`;
    ctx.textAlign = 'left';
    // main
    ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(60, 320); ctx.lineTo(60, 80); ctx.stroke();
    ctx.fillStyle = '#3fb950';
    [[60, 320], [60, 220], [60, 110]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); });
    // feature branch
    ctx.strokeStyle = '#e3b341';
    ctx.beginPath(); ctx.moveTo(60, 220); ctx.quadraticCurveTo(160, 220, 160, 150); ctx.lineTo(160, 130); ctx.stroke();
    ctx.fillStyle = '#e3b341';
    ctx.beginPath(); ctx.arc(160, 130, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ee787'; ctx.font = `400 17px ${MONO_FONT}`;
    ctx.fillText('HEAD', 92, 106);
    ctx.fillStyle = '#a3adbd';
    ctx.fillText('feat/erp', 185, 128);
    ctx.fillStyle = '#e8eef6'; ctx.font = `700 26px ${FA_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('هر روز یک کامیت', 160, 360);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* — صفحهٔ مانیتور اصلی: IDE با کد زنده — */
  const ide = makeCanvas(1024, 680);
  const ideTex = new THREE.CanvasTexture(ide.c);
  ideTex.colorSpace = THREE.SRGBColorSpace;
  const ideState = { chars: 0, blink: 0, pause: 0 };

  function totalCharsUpTo(lineIdx, partial) {
    let n = 0;
    for (let i = 0; i < lineIdx; i++) n += CODE_LINES[i].raw.length + 1;
    return n + partial;
  }

  function drawIDE() {
    const { ctx } = ide;
    const W = 1024, H = 680;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#11161f'; ctx.fillRect(0, 0, W, H);

    // نوار عنوان
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, 0, W, 44);
    [['#f85149', 24], ['#d29922', 46], ['#2ea043', 68]].forEach(([col, x]) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, 22, 6.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#6e7987'; ctx.font = `400 16px ${MONO_FONT}`; ctx.textAlign = 'center';
    ctx.fillText('ParsanERP — Assembly.cs — Visual Studio', W / 2, 28);

    // تب‌ها
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 44, W, 36);
    ctx.font = `400 16px ${MONO_FONT}`; ctx.textAlign = 'left';
    ctx.fillStyle = '#e6edf3'; ctx.fillText('  Assembly.cs', 30, 69);
    ctx.fillStyle = '#3fb950'; ctx.fillRect(22, 76, 116, 3);
    ctx.fillStyle = '#6e7987'; ctx.fillText('  SessionRepository.cs', 170, 69);
    ctx.fillText('  Global.asax', 400, 69);

    // خط شماره‌ها
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 80, 64, H - 80 - 30);
    ctx.fillStyle = '#1c2129'; ctx.fillRect(64, 80, 2, H - 80 - 30);

    // کد
    const lineH = 30;
    const full = CODE_LINES.reduce((a, l) => a + l.raw.length + 1, 0);
    const shown = Math.min(ideState.chars, full);
    let consumed = 0;
    ctx.font = `400 21px ${MONO_FONT}`; ctx.textAlign = 'left';
    for (let i = 0; i < CODE_LINES.length; i++) {
      const y = 80 + 24 + i * lineH;
      if (y > H - 40) break;
      ctx.fillStyle = '#3d444d'; ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), 54, y);
      ctx.textAlign = 'left';
      const lineLen = CODE_LINES[i].raw.length + 1;
      let visible = clamp(shown - consumed, 0, CODE_LINES[i].raw.length);
      consumed += lineLen;
      if (visible <= 0) break;
      let x = 84;
      let drawn = 0;
      for (const [text, kind] of CODE_LINES[i].tokens) {
        const take = clamp(visible - drawn, 0, text.length);
        if (take <= 0) break;
        const part = text.slice(0, take);
        ctx.fillStyle = TOK_COLORS[kind];
        ctx.fillText(part, x, y);
        x += ctx.measureText(part).width;
        drawn += take;
      }
      if (drawn >= visible && i < CODE_LINES.length - 1 && shown < full) {
        // مکان‌نما
        if (Math.floor(ideState.blink / 8) % 2 === 0) {
          ctx.fillStyle = '#7ee787';
          ctx.fillRect(x + 2, y - 18, 9, 21);
        }
      }
    }

    // مینی‌مَپ
    ctx.fillStyle = 'rgba(22, 27, 34, 0.6)'; ctx.fillRect(W - 52, 80, 52, H - 80 - 30);
    CODE_LINES.forEach((l, i) => {
      let x = W - 46;
      for (const [text, kind] of l.tokens) {
        if (kind === 'pln' && text.trim() === '') { x += 6; continue; }
        ctx.fillStyle = TOK_COLORS[kind];
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x, 88 + i * 28, Math.min(38, 5 + text.length * 2.1), 4);
        ctx.globalAlpha = 1;
        x += 6 + Math.min(20, text.length * 2.1);
        if (x > W - 10) break;
      }
    });

    // نوار وضعیت
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, H - 30, W, 30);
    ctx.font = `400 14px ${MONO_FONT}`;
    ctx.fillStyle = '#7ee787';
    ctx.beginPath(); ctx.arc(20, H - 15, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6e7987';
    ctx.fillText('main*', 32, H - 10);
    ctx.textAlign = 'right';
    ctx.fillText('UTF-8   C#   Ln 18, Col 1   0 Errors', W - 16, H - 10);
    ctx.textAlign = 'left';

    ideTex.needsUpdate = true;
  }

  /* — صفحهٔ ترمینال — */
  const term = makeCanvas(512, 640);
  const termTex = new THREE.CanvasTexture(term.c);
  termTex.colorSpace = THREE.SRGBColorSpace;
  const termState = { lines: [], step: 0, chars: 0, wait: 0, done: false };

  function drawTerm() {
    const { ctx } = term;
    ctx.fillStyle = '#0a0e13'; ctx.fillRect(0, 0, 512, 640);
    ctx.font = `400 21px ${MONO_FONT}`; ctx.textAlign = 'left';
    const lineH = 36;
    const start = Math.max(0, termState.lines.length - Math.floor((640 - 40) / lineH) + 1);
    let y = 40;
    for (let i = start; i < termState.lines.length; i++) {
      const l = termState.lines[i];
      if (l.cmd != null) {
        ctx.fillStyle = '#7ee787';
        ctx.fillText('$ ', 22, y);
        ctx.fillStyle = '#e6edf3';
        ctx.fillText(l.cmd, 44, y);
      } else {
        ctx.fillStyle = l.ok ? '#7ee787' : l.dim ? '#768390' : '#a3adbd';
        ctx.fillText(l.out, 44, y);
      }
      y += lineH;
    }
    if (termState.done && Math.floor(ideState.blink / 8) % 2 === 0) {
      ctx.fillStyle = '#7ee787';
      ctx.fillRect(44, y - 20, 11, 24);
    }
    termTex.needsUpdate = true;
  }

  function stepTerm() {
    if (termState.done) {
      if (--termState.wait <= 0) {
        termState.lines = []; termState.step = 0; termState.chars = 0; termState.done = false;
      }
      return;
    }
    if (termState.wait > 0) { termState.wait--; return; }
    const s = TERM_SCRIPT[termState.step];
    if (!s) { termState.done = true; termState.wait = 110; return; }
    if (s.cmd != null) {
      const last = termState.lines[termState.lines.length - 1];
      if (!last || last.typing !== true) termState.lines.push({ cmd: '', typing: true });
      const line = termState.lines[termState.lines.length - 1];
      termState.chars += 2;
      line.cmd = s.cmd.slice(0, termState.chars);
      if (termState.chars >= s.cmd.length) {
        line.typing = false;
        termState.chars = 0;
        termState.step++;
        termState.wait = 7;
      }
    } else {
      termState.lines.push({ out: s.out, ok: s.ok, dim: s.dim });
      termState.step++;
      termState.wait = 5;
    }
  }

  /* — داشبورد پروژه‌ها (مانیتور دوم) — */
  const dash = makeCanvas(512, 640);
  const dashTex = new THREE.CanvasTexture(dash.c);
  dashTex.colorSpace = THREE.SRGBColorSpace;

  function drawDash(t) {
    const { ctx } = dash;
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, 512, 640);
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#7ee787'; ctx.font = `400 18px ${MONO_FONT}`;
    ctx.fillText('~/projects', 480, 44);
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);
    ctx.fillStyle = `rgba(63, 185, 80, ${pulse})`;
    ctx.beginPath(); ctx.arc(30, 38, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8eef6'; ctx.font = `800 36px ${FA_FONT}`;
    ctx.fillText('پروژه‌های من', 480, 96);

    PROJECT_FRAMES.forEach((p, i) => {
      const y = 140 + i * 140;
      ctx.fillStyle = '#131923';
      rr(ctx, 28, y, 456, 116, 14); ctx.fill();
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
      rr(ctx, 28, y, 456, 116, 14); ctx.stroke();
      ctx.direction = 'ltr'; ctx.textAlign = 'left';
      ctx.fillStyle = '#e8eef6'; ctx.font = `700 22px ${MONO_FONT}`;
      ctx.fillText(p.title, 52, y + 44);
      ctx.fillStyle = '#8b949e'; ctx.font = `400 16px ${MONO_FONT}`;
      ctx.fillText(p.sub, 52, y + 76);
      ctx.fillStyle = '#3fb950'; ctx.font = `400 15px ${MONO_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('GitHub', 456, y + 76);
      ctx.direction = 'rtl';
    });

    ctx.fillStyle = '#161b22'; ctx.fillRect(0, 586, 512, 54);
    ctx.strokeStyle = '#232c3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 586); ctx.lineTo(512, 586); ctx.stroke();
    ctx.direction = 'ltr'; ctx.textAlign = 'left';
    ctx.fillStyle = '#7ee787'; ctx.font = `400 17px ${MONO_FONT}`;
    ctx.fillText('github.com/YasinArabi83', 28, 620);
    ctx.direction = 'rtl';
    dashTex.needsUpdate = true;
  }

  /* ===== اتاق ===== */

  const room = new THREE.Group();
  scene.add(room);

  const floorMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.95, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.14, 9.5), floorMat);
  floor.position.set(0, -0.07, 0);
  floor.receiveShadow = true;
  room.add(floor);

  const wallMat = stdMat(0x3b4351, { roughness: 0.96 });
  const backWall = box(room, 9.5, 3.9, 0.16, 0, 1.88, -3.62, wallMat, { receive: true });
  const leftWall = box(room, 0.16, 3.9, 9.5, -4.42, 1.88, 0, wallMat, { receive: true });
  const baseMat = stdMat(0x2a323f);
  box(room, 9.5, 0.16, 0.05, 0, 0.08, -3.52, baseMat);
  box(room, 0.05, 0.16, 9.5, -4.32, 0.08, 0, baseMat);

  // فرش
  const rugOuter = stdMat(0x63453f, { roughness: 1 });
  const rugInner = stdMat(0x503733, { roughness: 1 });
  const rug1 = box(room, 3.1, 0.024, 2.0, 0.3, 0.014, -1.45, rugOuter);
  rug1.receiveShadow = true;
  const rug2 = box(room, 2.7, 0.026, 1.6, 0.3, 0.015, -1.45, rugInner);
  rug2.receiveShadow = true;

  // پنجره (دیوار چپ)
  const winGroup = new THREE.Group();
  winGroup.position.set(-4.32, 2.0, -1.4);
  room.add(winGroup);
  const frameMat = stdMat(0x1a1f27);
  box(winGroup, 0.1, 1.62, 1.32, 0, 0, 0, frameMat, { cast: true });
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 1.46),
    new THREE.MeshBasicMaterial({ map: makeWindowTexture(), toneMapped: false })
  );
  pane.rotation.y = Math.PI / 2;
  pane.position.x = 0.06;
  winGroup.add(pane);
  box(winGroup, 0.12, 0.04, 1.16, 0.06, 0, 0, frameMat);
  box(winGroup, 0.12, 1.4, 0.04, 0.06, 0, 0, frameMat);

  // پوسترها
  const posterA = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 1.12),
    new THREE.MeshStandardMaterial({ map: makePosterCode(), roughness: 0.9 })
  );
  posterA.position.set(2.0, 2.05, -3.53);
  room.add(posterA);

  const posterB = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 1.0),
    new THREE.MeshStandardMaterial({ map: makePosterGit(), roughness: 0.9 })
  );
  posterB.rotation.y = Math.PI / 2;
  posterB.position.set(-4.33, 1.95, -0.2);
  room.add(posterB);

  // یادداشت‌های چسبان
  const stickyCols = [0xe3b341, 0xe86a5e, 0x7ee787];
  stickyCols.forEach((col, i) => {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.09),
      new THREE.MeshBasicMaterial({ color: col })
    );
    s.position.set(1.15 + i * 0.13, 2.5 + (i % 2) * 0.12, -3.53);
    s.rotation.z = (i - 1) * 0.12;
    room.add(s);
  });

  /* ===== میز کار ===== */

  const desk = new THREE.Group();
  desk.position.set(0.15, 0, -2.45);
  room.add(desk);

  const woodMat = stdMat(0x7a5230, { roughness: 0.62 });
  const metalMat = stdMat(0x39404d, { roughness: 0.4, metalness: 0.55 });
  const top = box(desk, 3.3, 0.09, 1.42, 0, 0.755, 0, woodMat, { cast: true, receive: true });
  box(desk, 3.3, 0.025, 0.05, 0, 0.7, 0.68, stdMat(0x5d3d23));
  const legXs = [-1.56, 1.56];
  const legZs = [-0.6, 0.6];
  for (const lx of legXs) for (const lz of legZs) {
    box(desk, 0.07, 0.71, 0.07, lx, 0.355, lz, metalMat, { cast: true });
  }
  box(desk, 3.05, 0.05, 0.05, 0, 0.3, -0.55, metalMat);

  /* — مانیتور اصلی — */
  const monitorMain = new THREE.Group();
  monitorMain.name = 'monitorMain';
  monitorMain.position.set(0.35, DESK_Y, -0.12);
  monitorMain.rotation.y = -0.12;
  desk.add(monitorMain);

  const bezelMat = stdMat(0x232a36, { roughness: 0.55, metalness: 0.25 });
  box(monitorMain, 0.56, 0.03, 0.34, 0, 0.015, 0.02, bezelMat, { cast: true });
  box(monitorMain, 0.09, 0.44, 0.06, 0, 0.24, -0.02, bezelMat, { cast: true });
  box(monitorMain, 1.08, 0.66, 0.055, 0, 0.62, -0.03, bezelMat, { cast: true });
  box(monitorMain, 1.08, 0.07, 0.04, 0, 0.31, -0.005, stdMat(0x0d1117));
  const mainScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.58),
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: ideTex,
      emissiveIntensity: 1.4,
      roughness: 1,
    })
  );
  mainScreen.position.set(0, 0.63, -0.0018);
  monitorMain.add(mainScreen);

  // یادداشت روی لبهٔ مانیتور
  const stickyMon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.075, 0.075),
    new THREE.MeshBasicMaterial({ color: 0xe3b341 })
  );
  stickyMon.position.set(0.47, 0.86, 0.005);
  stickyMon.rotation.z = -0.1;
  monitorMain.add(stickyMon);

  /* — مانیتور دوم: داشبورد پروژه‌ها — */
  const monitorDash = new THREE.Group();
  monitorDash.name = 'monitorDash';
  monitorDash.position.set(-1.08, DESK_Y, -0.14);
  monitorDash.rotation.y = 0.42;
  desk.add(monitorDash);

  box(monitorDash, 0.44, 0.03, 0.28, 0, 0.015, 0.02, bezelMat, { cast: true });
  box(monitorDash, 0.07, 0.36, 0.05, 0, 0.2, -0.02, bezelMat, { cast: true });
  box(monitorDash, 0.84, 0.54, 0.05, 0, 0.5, -0.03, bezelMat, { cast: true });
  const dashScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.77, 0.47),
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: dashTex,
      emissiveIntensity: 1.3,
      roughness: 1,
    })
  );
  dashScreen.position.set(0, 0.5, -0.0018);
  monitorDash.add(dashScreen);

  // صفحهٔ دوم همان مانیتور: ترمینال — به‌صورت متناوب با داشبورد نمایش داده می‌شود
  const termScreen = dashScreen.clone();
  termScreen.material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: termTex,
    emissiveIntensity: 1.3,
    roughness: 1,
  });
  termScreen.visible = false;
  monitorDash.add(termScreen);
  let swapTimer = 15;
  let showTerm = false;

  /* — کیبورد مکانیکال — */
  const keyboard = new THREE.Group();
  keyboard.name = 'keyboard';
  keyboard.position.set(0.3, DESK_Y + 0.028, 0.5);
  keyboard.rotation.y = -0.06;
  desk.add(keyboard);

  const kbBase = box(keyboard, 0.64, 0.05, 0.235, 0, 0, 0, stdMat(0x2e3642, { roughness: 0.6 }), { cast: true });
  // کلیدها به‌صورت InstancedMesh
  const keyGeo = new THREE.BoxGeometry(0.034, 0.02, 0.034);
  const keyMat = stdMat(0x333b49, { roughness: 0.55 });
  const rows = [14, 13, 12, 11];
  const keyPositions = [];
  for (let r = 0; r < rows.length; r++) {
    const n = rows[r];
    const w = 0.052;
    const startX = -((n - 1) * w) / 2;
    for (let k = 0; k < n; k++) {
      keyPositions.push([startX + k * w, 0.032, -0.075 + r * 0.049]);
    }
  }
  const keysIM = new THREE.InstancedMesh(keyGeo, keyMat, keyPositions.length);
  const dummy = new THREE.Object3D();
  keyPositions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.x = 0.06;
    dummy.updateMatrix();
    keysIM.setMatrixAt(i, dummy.matrix);
  });
  keysIM.castShadow = tier.shadows;
  keyboard.add(keysIM);
  // کلید فاصله
  box(keyboard, 0.24, 0.02, 0.034, 0, 0.032, -0.075 + 4 * 0.049, keyMat);
  // کلیدهای روشن (W-A-S-D باحال!)
  const glowKeyMat = stdMat(0x2a2f3a, { emissive: 0x3fb950, emissiveIntensity: 0.9, roughness: 0.5 });
  box(keyboard, 0.034, 0.022, 0.034, -0.104, 0.033, -0.026, glowKeyMat);
  box(keyboard, 0.034, 0.022, 0.034, -0.156, 0.033, 0.023, glowKeyMat);
  box(keyboard, 0.034, 0.022, 0.034, -0.104, 0.033, 0.023, glowKeyMat);
  box(keyboard, 0.034, 0.022, 0.034, -0.052, 0.033, 0.023, glowKeyMat);
  // نور زیر کیبورد
  box(keyboard, 0.6, 0.006, 0.012, 0, -0.022, 0.115, stdMat(0x101318, { emissive: 0x3fb950, emissiveIntensity: 2.2 }));

  /* — ماوس و پد — */
  box(desk, 0.36, 0.008, 0.28, 0.95, DESK_Y + 0.008, 0.42, stdMat(0x10141a, { roughness: 0.95 }));
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 14), stdMat(0x20242d, { roughness: 0.45 }));
  mouse.scale.set(0.85, 0.55, 1.3);
  mouse.position.set(0.95, DESK_Y + 0.03, 0.42);
  mouse.castShadow = tier.shadows;
  desk.add(mouse);

  /* — فنجان چای + بخار — */
  const mug = new THREE.Group();
  mug.name = 'mug';
  mug.position.set(-0.72, DESK_Y, 0.28);
  desk.add(mug);
  const mugMat = stdMat(0xa8503c, { roughness: 0.6 });
  const mugBody = cyl(mug, 0.055, 0.05, 0.12, 0, 0.06, 0, mugMat, 22, { cast: true });
  cyl(mug, 0.047, 0.047, 0.008, 0, 0.115, 0, stdMat(0x241a14), 22);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 10, 22), mugMat);
  handle.position.set(0.06, 0.06, 0);
  handle.rotation.y = Math.PI / 2;
  mug.add(handle);

  const steamMat = new THREE.MeshBasicMaterial({ color: 0xcfd8dc, transparent: true, opacity: 0.3, depthWrite: false });
  const steam = [0, 1, 2].map((i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), steamMat.clone());
    s.position.set(0, 0.16, 0);
    mug.add(s);
    return { mesh: s, offset: i / 3 };
  });

  /* — مرغابی دیباگ — */
  const duck = new THREE.Group();
  duck.position.set(1.28, DESK_Y, -0.28);
  desk.add(duck);
  const duckMat = stdMat(0xf0c93f, { roughness: 0.5 });
  const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 14), duckMat);
  duckBody.scale.set(1, 0.8, 1.25);
  duckBody.position.y = 0.05;
  duckBody.castShadow = tier.shadows;
  duck.add(duckBody);
  const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), duckMat);
  duckHead.position.set(0, 0.115, 0.035);
  duck.add(duckHead);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.035, 10), stdMat(0xe8842c, { roughness: 0.5 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.108, 0.082);
  duck.add(beak);
  [-0.018, 0.018].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), stdMat(0x14181d));
    eye.position.set(ex, 0.125, 0.062);
    duck.add(eye);
  });

  /* — چراغ مطالعه — */
  const lamp = new THREE.Group();
  lamp.position.set(-1.42, DESK_Y, -0.32);
  desk.add(lamp);
  cyl(lamp, 0.1, 0.12, 0.035, 0, 0.017, 0, stdMat(0x1c2129, { metalness: 0.4, roughness: 0.5 }), 20, {});
  const armMat = stdMat(0x2a3038, { metalness: 0.5, roughness: 0.45 });
  const arm1 = box(lamp, 0.035, 0.52, 0.035, 0.06, 0.28, 0, armMat, { rz: 0.28, cast: true });
  const arm2 = box(lamp, 0.035, 0.44, 0.035, 0.22, 0.62, 0, armMat, { rz: -0.9, cast: true });
  const lampHead = cyl(lamp, 0.055, 0.115, 0.13, 0.42, 0.78, 0, stdMat(0x1c2129, { metalness: 0.35, roughness: 0.5 }), 18, { rz: 0.7 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), stdMat(0xffca8a, { emissive: 0xffb066, emissiveIntensity: 2.2 }));
  bulb.position.set(0.36, 0.72, 0);
  lamp.add(bulb);

  /* — هدفون روی استند — */
  const hp = new THREE.Group();
  hp.position.set(1.45, DESK_Y, -0.42);
  desk.add(hp);
  cyl(hp, 0.045, 0.055, 0.02, 0, 0.01, 0, stdMat(0x20242d), 16);
  cyl(hp, 0.012, 0.012, 0.22, 0, 0.12, 0, stdMat(0x39404d, { metalness: 0.5, roughness: 0.4 }), 12);
  const hpBand = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 10, 24, Math.PI), stdMat(0x1c2129, { roughness: 0.6 }));
  hpBand.position.y = 0.24;
  hpBand.rotation.y = Math.PI / 2;
  hp.add(hpBand);
  [-0.075, 0.075].forEach((ex) => {
    const cup = cyl(hp, 0.045, 0.045, 0.03, ex, 0.24, 0, stdMat(0x14181d, { roughness: 0.7 }), 16, { rz: Math.PI / 2 });
    cup.castShadow = tier.shadows;
  });

  /* — کتابخانهٔ دیواری — */
  const bookshelf = new THREE.Group();
  bookshelf.name = 'bookshelf';
  bookshelf.position.set(0.45, 2.18, -3.38);
  room.add(bookshelf);

  const shelfMat = stdMat(0x5d3d23, { roughness: 0.7 });
  box(bookshelf, 1.8, 0.05, 0.26, 0, 0, 0, shelfMat, { cast: true });
  box(bookshelf, 1.8, 0.05, 0.26, 0, 0.5, 0, shelfMat, { cast: true });
  box(bookshelf, 0.05, 0.55, 0.26, -0.88, 0.25, 0, shelfMat, { cast: true });
  box(bookshelf, 0.05, 0.55, 0.26, 0.88, 0.25, 0, shelfMat, { cast: true });

  // کتاب‌ها
  const bookColors = [0xb3543f, 0x4f7a5a, 0xc99546, 0x8f6a4f, 0x3f6d75, 0xa8564f, 0x6d7f4a, 0x96524e];
  const bookGeo = new THREE.BoxGeometry(0.038, 0.24, 0.18);
  const bookMatBase = stdMat(0xffffff, { roughness: 0.85 });
  const shelfRows = [
    { y: 0.14, count: 13, x0: -0.78 },
    { y: 0.64, count: 10, x0: -0.62 },
  ];
  let totalBooks = 13 + 10;
  const booksIM = new THREE.InstancedMesh(bookGeo, bookMatBase, totalBooks);
  const bookColor = new THREE.Color();
  let bi = 0;
  for (const row of shelfRows) {
    for (let i = 0; i < row.count; i++) {
      const x = row.x0 + i * 0.055 + Math.random() * 0.008;
      dummy.position.set(x, row.y + 0.02 + Math.random() * 0.012, 0);
      dummy.scale.set(1, 0.85 + Math.random() * 0.3, 1);
      dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.05);
      dummy.updateMatrix();
      booksIM.setMatrixAt(bi, dummy.matrix);
      booksIM.setColorAt(bi, bookColor.setHex(bookColors[(bi + i) % bookColors.length]));
      bi++;
    }
  }
  booksIM.castShadow = tier.shadows;
  bookshelf.add(booksIM);
  dummy.scale.set(1, 1, 1);
  dummy.rotation.set(0, 0, 0);

  // ربات کوچک روی قفسه
  const robot = new THREE.Group();
  robot.position.set(0.62, 0.055, 0);
  bookshelf.add(robot);
  box(robot, 0.09, 0.1, 0.07, 0, 0.05, 0, stdMat(0x9aa4b2, { metalness: 0.6, roughness: 0.35 }));
  box(robot, 0.075, 0.07, 0.065, 0, 0.14, 0, stdMat(0x8791a0, { metalness: 0.6, roughness: 0.35 }));
  const eyeMat = stdMat(0x7ee787, { emissive: 0x3fb950, emissiveIntensity: 2.2 });
  box(robot, 0.04, 0.012, 0.005, 0, 0.15, 0.034, eyeMat);
  box(robot, 0.012, 0.04, 0.012, -0.05, 0.13, 0, stdMat(0x39404d, { metalness: 0.5 }));
  box(robot, 0.012, 0.04, 0.012, 0.05, 0.13, 0, stdMat(0x39404d, { metalness: 0.5 }));

  // قاب عکس کوچک
  const photoFrame = new THREE.Group();
  photoFrame.position.set(-0.62, 0.55, 0);
  photoFrame.rotation.y = 0.12;
  bookshelf.add(photoFrame);
  box(photoFrame, 0.16, 0.2, 0.012, 0, 0.1, 0, stdMat(0x1c2129));
  box(photoFrame, 0.13, 0.17, 0.005, 0, 0.1, 0.008, stdMat(0x2c3a2f, { emissive: 0x24361f, emissiveIntensity: 0.5 }));

  /* — کیس کامپیوتر — */
  const pcTower = new THREE.Group();
  pcTower.name = 'pcTower';
  pcTower.position.set(1.5, 0, -0.42);
  pcTower.rotation.y = -0.16;
  room.add(pcTower);

  const pcMat = stdMat(0x2b323f, { roughness: 0.5, metalness: 0.35 });
  box(pcTower, 0.44, 0.92, 0.8, 0, 0.46, 0, pcMat, { cast: true });
  // شیشهٔ سمت
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.78),
    new THREE.MeshStandardMaterial({ color: 0x1a2c33, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.4 })
  );
  glass.rotation.y = Math.PI / 2;
  glass.position.set(0.222, 0.48, 0);
  pcTower.add(glass);
  // قطعات داخلی
  box(pcTower, 0.3, 0.1, 0.42, -0.02, 0.52, 0, stdMat(0x14181f, { emissive: 0x3fb950, emissiveIntensity: 0.35 }));
  box(pcTower, 0.02, 0.6, 0.05, -0.16, 0.45, -0.2, stdMat(0x101318, { emissive: 0xe3b341, emissiveIntensity: 1.4 }));
  // فن
  const fan = new THREE.Group();
  fan.position.set(0.14, 0.45, 0.05);
  fan.rotation.y = Math.PI / 2;
  pcTower.add(fan);
  const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), stdMat(0x10141a));
  fan.add(fanRing);
  const fanBlades = new THREE.Group();
  fan.add(fanBlades);
  const bladeMat = stdMat(0x2a2f3a, { emissive: 0x3fb950, emissiveIntensity: 0.8 });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.085, 0.008), bladeMat);
    blade.position.y = 0.05;
    const holder = new THREE.Group();
    holder.add(blade);
    holder.rotation.z = (i / 5) * Math.PI * 2;
    fanBlades.add(holder);
  }
  // نور جلو
  box(pcTower, 0.015, 0.7, 0.03, 0.225, 0.46, 0.32, stdMat(0x101318, { emissive: 0x3fb950, emissiveIntensity: 2.6 }));

  /* — صندلی — */
  const chair = new THREE.Group();
  chair.position.set(0.35, 0, 1.28);
  chair.rotation.y = 0.18;
  room.add(chair);

  const chairMat = stdMat(0x3a4353, { roughness: 0.75 });
  const seat = box(chair, 0.54, 0.1, 0.52, 0, 0.55, 0, chairMat, { cast: true });
  const backrest = box(chair, 0.5, 0.78, 0.09, 0, 1.02, 0.26, chairMat, { rx: -0.08, cast: true });
  box(chair, 0.36, 0.06, 0.02, 0, 1.06, 0.315, stdMat(0x101318, { emissive: 0x3fb950, emissiveIntensity: 1.4 }));
  box(chair, 0.36, 0.06, 0.02, 0, 0.82, 0.29, stdMat(0x101318, { emissive: 0x3fb950, emissiveIntensity: 1.4 }));
  box(chair, 0.3, 0.16, 0.08, 0, 1.48, 0.32, stdMat(0x2a3140), { rx: -0.08 });
  cyl(chair, 0.035, 0.035, 0.36, 0, 0.36, 0, stdMat(0x39404d, { metalness: 0.6, roughness: 0.35 }), 12);
  for (let i = 0; i < 5; i++) {
    const spoke = box(chair, 0.055, 0.045, 0.34, 0, 0.1, 0, stdMat(0x2a2f3a), { ry: (i / 5) * Math.PI * 2 });
    spoke.geometry.translate(0, 0, 0.17);
    spoke.rotation.y = (i / 5) * Math.PI * 2;
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), stdMat(0x14181d));
    caster.position.set(Math.sin((i / 5) * Math.PI * 2) * 0.3, 0.05, Math.cos((i / 5) * Math.PI * 2) * 0.3);
    chair.add(caster);
  }

  /* — کابل‌ها — */
  function cable(points, color = 0x101318) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 24, 0.012, 8);
    const mesh = new THREE.Mesh(geo, stdMat(color, { roughness: 0.7 }));
    room.add(mesh);
    return mesh;
  }
  cable([
    new THREE.Vector3(0.32, 1.1, -2.62),
    new THREE.Vector3(0.5, 0.72, -2.66),
    new THREE.Vector3(1.2, 0.4, -2.7),
    new THREE.Vector3(1.5, 0.95, -2.86),
  ]);
  cable([
    new THREE.Vector3(-1.0, 1.0, -2.66),
    new THREE.Vector3(-0.6, 0.6, -2.72),
    new THREE.Vector3(0.6, 0.35, -2.78),
    new THREE.Vector3(1.45, 0.9, -2.88),
  ]);

  /* — ذرات غبار (فقط دسکتاپ) — */
  let dust = null;
  if (tier.dust) {
    const dustCount = 90;
    const positions = new Float32Array(dustCount * 3);
    const seeds = [];
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = -3.4 + Math.random() * 6.2;
      positions[i * 3 + 1] = 0.3 + Math.random() * 2.8;
      positions[i * 3 + 2] = -3 + Math.random() * 5;
      seeds.push(Math.random() * Math.PI * 2);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0x8a94a2, size: 0.017, transparent: true, opacity: 0.32, depthWrite: false })
    );
    dust.userData = { seeds };
    scene.add(dust);
  }

  /* — گلدان کف — */
  const plantBig = new THREE.Group();
  plantBig.position.set(2.35, 0, -3.0);
  room.add(plantBig);
  cyl(plantBig, 0.16, 0.21, 0.34, 0, 0.17, 0, stdMat(0x8f4f3a, { roughness: 0.8 }), 18, { cast: true });
  cyl(plantBig, 0.145, 0.145, 0.02, 0, 0.33, 0, stdMat(0x2c2018), 18);
  const leafMats = [stdMat(0x3f7a52, { flatShading: true }), stdMat(0x35684a, { flatShading: true })];
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + Math.random() * 0.06, 0), leafMats[i % 2]);
    leaf.position.set((Math.random() - 0.5) * 0.22, 0.48 + Math.random() * 0.35, (Math.random() - 0.5) * 0.22);
    leaf.scale.set(0.7, 1.6, 0.7);
    leaf.rotation.y = Math.random() * Math.PI;
    leaf.castShadow = tier.shadows;
    plantBig.add(leaf);
  }

  /* ===== نقاط داغ (Hotspot) ===== */

  const interactive = [];
  function registerInteractive(group) {
    interactive.push(group);
    group.traverse((o) => { o.userData.hsRoot = group; });
  }
  registerInteractive(monitorMain);
  registerInteractive(monitorDash);
  registerInteractive(keyboard);
  registerInteractive(pcTower);
  registerInteractive(bookshelf);
  registerInteractive(mug);

  const hotspotEls = [];
  if (hotspotLayer) {
    for (const h of HOTSPOTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot';
      btn.dataset.section = h.section;
      btn.setAttribute('aria-label', `${h.label} — رفتن به بخش ${h.label}`);
      btn.innerHTML = `<span class="hs-dot">${h.dot}</span><span class="hs-label">${h.label}</span>`;
      btn.addEventListener('click', () => onNavigate(h.section));
      hotspotLayer.appendChild(btn);
      hotspotEls.push({ el: btn, anchor: new THREE.Vector3(...h.anchor), id: h.id, target: h.target });
    }
  }

  /* ----- مناطق ممنوعه: نقاط داغ هرگز روی متن هیرو، نوار بالا
         یا کاشی‌های پایین صفحه نمی‌نشینند (رفع هم‌پوشانی موبایل) ----- */
  const keepOutEls = ['hero-copy', 'hero-legend', 'hero-hint', 'topbar']
    .map((id) => document.getElementById(id))
    .concat(Array.from(document.querySelectorAll('.scroll-cue')))
    .filter(Boolean);
  const keepOutPad = 26;
  let keepOutRects = [];
  let keepOutDirty = true;
  let keepOutFrame = 0;

  function refreshKeepOutRects() {
    const cRect = canvas.getBoundingClientRect();
    keepOutRects = [];
    for (const el of keepOutEls) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue; /* مخفی یا بدون عرض */
      keepOutRects.push({
        left: r.left - cRect.left - keepOutPad,
        top: r.top - cRect.top - keepOutPad,
        right: r.right - cRect.left + keepOutPad,
        bottom: r.bottom - cRect.top + keepOutPad,
      });
    }
    keepOutDirty = false;
  }

  const invalidateKeepOut = () => { keepOutDirty = true; };
  window.addEventListener('resize', invalidateKeepOut, { passive: true });
  window.addEventListener('scroll', invalidateKeepOut, { passive: true });

  const projV = new THREE.Vector3();
  function updateHotspots() {
    if (!hotspotLayer) return;
    keepOutFrame += 1;
    if (keepOutDirty || keepOutFrame > 150) {
      refreshKeepOutRects();
      keepOutFrame = 0;
    }
    const w = canvas.clientWidth || 1;
    const hgt = canvas.clientHeight || 1;
    for (const hs of hotspotEls) {
      projV.copy(hs.anchor).project(camera);
      if (projV.z > 1 || projV.z < -1) { hs.el.style.display = 'none'; continue; }
      const x = (projV.x * 0.5 + 0.5) * w;
      const y = (-projV.y * 0.5 + 0.5) * hgt;
      /* لبه‌های صفحه و مناطق ممنوعه (متن‌ها/نوار بالا/کاشی‌های پایین) */
      let covered = x < 16 || x > w - 16 || y < 10 || y > hgt - 10;
      if (!covered) {
        for (const r of keepOutRects) {
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { covered = true; break; }
        }
      }
      if (covered) { hs.el.style.display = 'none'; continue; }
      hs.el.style.display = '';
      hs.el.style.left = `${x}px`;
      hs.el.style.top = `${y}px`;
    }
  }

  /* ===== کنترل‌ها ===== */

  let dragging = false;
  let lastX = 0, lastY = 0, downX = 0, downY = 0;
  let idleTimer = 99;
  const ndc = new THREE.Vector2(-2, -2);
  const raycaster = new THREE.Raycaster();
  let hoverTarget = null;

  function setHover(group) {
    if (hoverTarget === group) return;
    if (hoverTarget) {
      hoverTarget.traverse((o) => {
        if (o.isMesh && o.userData.baseEmissive !== undefined) {
          o.material.emissiveIntensity = o.userData.baseEmissive;
          o.material.emissive.setHex(o.userData.baseEmissiveHex);
        }
      });
    }
    hoverTarget = group;
    canvas.classList.toggle('pointing', !!group);
    if (group) {
      group.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) {
          if (o.userData.baseEmissive === undefined) {
            o.userData.baseEmissive = o.material.emissiveIntensity;
            o.userData.baseEmissiveHex = o.material.emissive.getHex();
          }
          o.material.emissiveIntensity = Math.max(o.userData.baseEmissive, 0.3);
          if (o.userData.baseEmissiveHex === 0x000000) o.material.emissive.setHex(0x1e5f2e);
        }
      });
    }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    idleTimer = 0;
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    canvas.classList.add('grabbing');
    wrap && wrap.classList.add('dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    parallax.tx = ndc.x * 0.035;
    parallax.ty = ndc.y * 0.02;

    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      targetAz = clamp(targetAz - dx * 0.0045, -0.12, 1.08);
      targetPol = clamp(targetPol - dy * 0.0032, 1.0, 1.26);
    }
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('grabbing');
    wrap && wrap.classList.remove('dragging');
    restAz = targetAz;
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist < 7 && hoverTarget) {
      const hs = HOTSPOTS.find((h) => h.target === hoverTarget.name);
      if (hs) onNavigate(hs.section);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => { ndc.set(-2, -2); parallax.tx = 0; parallax.ty = 0; setHover(null); });

  function updateRaycast() {
    if (ndc.x < -1.5) { setHover(null); return; }
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(interactive, true);
    if (hits.length) setHover(hits[0].object.userData.hsRoot || null);
    else setHover(null);
  }

  /* ===== حلقهٔ انیمیشن ===== */

  const clock = new THREE.Clock();
  let rafId = 0;
  let active = true;
  let lastIde = 0, lastTerm = 0, lastDash = 0;

  drawIDE();
  drawTerm();
  drawDash(0);

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!active) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // حرکت نرم دوربین
    if (!dragging) idleTimer += dt;
    let azGoal = targetAz;
    if (!reducedMotion && idleTimer > 3.5) azGoal = restAz + Math.sin(t * 0.24) * 0.045;
    az = lerp(az, azGoal, 1 - Math.exp(-7 * dt));
    pol = lerp(pol, targetPol, 1 - Math.exp(-7 * dt));
    parallax.x = lerp(parallax.x, reducedMotion ? 0 : parallax.tx, 1 - Math.exp(-4 * dt));
    parallax.y = lerp(parallax.y, reducedMotion ? 0 : parallax.ty, 1 - Math.exp(-4 * dt));
    applyCamera();

    // صفحه‌ها
    ideState.blink += 1;
    if (!reducedMotion) {
      if (now - lastIde > 100) {
        lastIde = now;
        const full = CODE_LINES.reduce((a, l) => a + l.raw.length + 1, 0);
        if (ideState.pause > 0) {
          ideState.pause--;
          if (ideState.pause === 0) ideState.chars = 0;
        } else {
          ideState.chars += 3;
          if (ideState.chars >= full) { ideState.chars = full; ideState.pause = 150; }
        }
      }
      if (now - lastTerm > 110) { lastTerm = now; stepTerm(); drawTerm(); }
      if (now - lastDash > 500) { lastDash = now; drawDash(t); }
      // جابه‌جایی داشبورد/ترمینال روی مانیتور دوم
      swapTimer -= dt;
      if (swapTimer <= -0.35) {
        showTerm = !showTerm;
        dashScreen.visible = !showTerm;
        termScreen.visible = showTerm;
        swapTimer = 15;
      } else if (swapTimer <= 0) {
        dashScreen.visible = false;
        termScreen.visible = false;
      }
    }
    drawIDE();
    screenLight.intensity = 5.0 + Math.sin(t * 6.7) * 0.25 + Math.sin(t * 13.1) * 0.12;

    // فن
    fanBlades.rotation.z += dt * 7;

    // بخار چای
    for (const s of steam) {
      const ph = ((t * 0.35 + s.offset) % 1 + 1) % 1;
      s.mesh.position.y = 0.15 + ph * 0.3;
      s.mesh.position.x = Math.sin(ph * 7 + s.offset * 9) * 0.02;
      s.mesh.material.opacity = 0.34 * (1 - ph);
      const sc = 0.7 + ph * 0.9;
      s.mesh.scale.set(sc, sc, sc);
    }

    // غبار
    if (dust) {
      const pos = dust.geometry.attributes.position;
      const seeds = dust.userData.seeds;
      for (let i = 0; i < seeds.length; i++) {
        let y = pos.getY(i) + dt * 0.05;
        if (y > 3.2) y = 0.25;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.4 + seeds[i]) * dt * 0.02);
      }
      pos.needsUpdate = true;
    }

    updateRaycast();
    updateHotspots();
    renderer.render(scene, camera);
  }

  /* ===== اندازه و دید ===== */

  function resize() {
    const w = wrap ? wrap.clientWidth : canvas.clientWidth;
    const h = wrap ? wrap.clientHeight : canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.85 ? 52 : 40;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxDPR));
    renderer.setSize(w, h, false);
  }

  const ro = new ResizeObserver(resize);
  if (wrap) ro.observe(wrap);
  resize();

  const io = new IntersectionObserver((entries) => {
    active = entries[0].isIntersecting;
    if (active) clock.getDelta();
  }, { threshold: 0.02 });
  io.observe(canvas);

  const onVis = () => { active = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);

  applyCamera();
  rafId = requestAnimationFrame(frame);
  onReady();

  /* ===== پاک‌سازی ===== */

  function dispose() {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('resize', invalidateKeepOut);
    window.removeEventListener('scroll', invalidateKeepOut);
    hotspotEls.forEach((h) => h.el.remove());
    scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
          m.dispose();
        });
      }
    });
    renderer.dispose();
  }

  return { dispose, setActive: (v) => { active = v; } };
}
