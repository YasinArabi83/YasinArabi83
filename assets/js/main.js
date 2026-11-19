/* ============================================================
   main.js — نقطهٔ شروع: تشخیص توانایی‌ها، بارگذاری،
   مدیریت دو حالت «شب» و «روز» و هماهنگی صحنه و رابط
   ============================================================ */
import { STATIONS, faDigits } from './data.js';
import { initUI } from './ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

/* ---------- تشخیص محیط ---------- */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
const webglOK = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
})();

/* ---------- ارجاع‌ها ---------- */
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderBar = document.querySelector('.loader-bar');
const loaderStatus = document.getElementById('loader-status');
const btnEnterNight = document.getElementById('enter-night');
const btnEnterDay = document.getElementById('enter-day');
const stageEl = document.getElementById('stage');
const topbarEl = document.getElementById('topbar');
const edgeNavEl = document.getElementById('edge-nav');
const dayviewEl = document.getElementById('dayview');
const canvasEl = document.getElementById('scene-canvas');

/* ---------- وضعیت ---------- */
let mode = null;
let world = null;
let worldPromise = null;
let ui = null;
let prepared = false;

function setProgress(p, text) {
  loaderFill.style.width = `${p}%`;
  loaderBar.setAttribute('aria-valuenow', String(p));
  if (text) loaderStatus.textContent = `${text} (${faDigits(p)}٪)`;
}

function loaderDone(instant = false) {
  if (instant) loaderEl.classList.add('instant');
  loaderEl.classList.add('done');
  loaderEl.setAttribute('aria-hidden', 'true');
}

/* ---------- ساخت دنیای سه‌بعدی (تنها زمانی که لازم است) ---------- */
async function ensureWorld() {
  if (world) return world;
  if (!worldPromise) {
    worldPromise = (async () => {
      setProgress(15, 'بارگذاری فونت وزیرمتن');
      await Promise.race([document.fonts.ready, sleep(2500)]);
      setProgress(45, 'آماده‌سازی موتور سه‌بعدی');
      const { createWorld } = await import('./scene.js');
      await nextFrame();
      setProgress(75, 'کاشت سکوها و روشن کردن چراغ‌ها');
      const w = createWorld(canvasEl, { isMobile, reducedMotion });
      await nextFrame();
      setProgress(100, 'آماده است');
      world = w;
      prepared = true;
      btnEnterNight.disabled = false;
      btnEnterNight.setAttribute('aria-busy', 'false');
      return w;
    })();
  }
  return worldPromise;
}

/* ---------- تغییر حالت شب/روز ---------- */
function setMode(next) {
  if (next === mode) return;
  mode = next;
  const night = next === 'night';
  document.body.classList.toggle('night', night);
  document.body.classList.toggle('day', !night);
  topbarEl.hidden = !night;
  stageEl.hidden = !night;
  edgeNavEl.hidden = !night;
  dayviewEl.hidden = night;
  if (night) {
    world.resize();
    world.start();
  } else {
    if (world) world.stop();
    if (ui) ui.hidePanel({ focusNav: false });
    document.title = 'یاسین عربی | برنامه‌نویس .NET — توسعه سامانه‌های سازمانی';
    dayviewEl.focus({ preventScroll: true });
  }
}

/* ---------- ورود به شب‌باغ ---------- */
async function enterNightGarden() {
  const w = await ensureWorld();
  loaderDone();
  setMode('night');

  // ایستگاه آغازین: از hash یا خانه
  const h = decodeURIComponent(location.hash.replace('#', ''));
  const startId = STATIONS.some((s) => s.id === h) ? h : 'home';

  ui.setActive(startId);
  ui.syncHash(startId);
  w.rig.jump('overview');
  await sleep(reducedMotion ? 60 : 380);
  await w.rig.goTo(startId, { duration: reducedMotion ? 0.01 : 2.4 });
  ui.showPanel(startId);
  ui.showHint();
}

/* ---------- جابه‌جایی بین ایستگاه‌ها ---------- */
async function goto(id) {
  if (mode !== 'night' || !world) return;
  ui.setActive(id);
  ui.syncHash(id);
  ui.hidePanel({ focusNav: false });
  await world.rig.goTo(id);
  if (ui.current === id) ui.showPanel(id);
}

/* ---------- راه‌اندازی UI ---------- */
ui = initUI({
  mode: () => mode,
  goto,
  toggleMode(next) {
    if (next === mode) return;
    if (next === 'day') {
      setMode('day');
      if (location.hash !== '#resume') location.hash = '#resume';
    } else if (webglOK) {
      enterNightGarden();
    }
  },
  pick: (x, y) => (mode === 'night' && world ? world.pickAt(x, y) : null),
  hover: (id) => world && world.setHovered(id),
  parallax: (nx, ny) => world && world.rig.setParallax(nx, ny),
  onPanelOpen: (open) => world && world.rig.setPanelOpen(open),
});

/* ---------- رویدادهای بارگذاری ---------- */
btnEnterNight.addEventListener('click', enterNightGarden);
btnEnterDay.addEventListener('click', () => {
  loaderDone();
  setMode('day');
  if (location.hash !== '#resume') location.hash = '#resume';
});

/* ---------- بوت ---------- */
if (!webglOK) {
  // بدون WebGL: مستقیم نمای روز
  loaderDone(true);
  setMode('day');
  btnEnterNight.hidden = true;
  document.getElementById('loader-note').textContent =
    'مرورگر شما از WebGL پشتیبانی نمی‌کند؛ رزومه در نمای روز در دسترس است.';
} else if (reducedMotion) {
  // کاهش حرکت: پیش‌فرض نمای روز (تجربهٔ سه‌بعدی به‌صورت ایستا در دسترس است)
  loaderDone(true);
  setMode('day');
  // دکمهٔ بازگشت به شب در فوتر نمای روز:
  document.querySelectorAll('.js-night-return').forEach((b) => (b.hidden = false));
} else {
  // مسیر کامل: بارگذاری در پس‌زمینه + دو گزینه
  document.querySelectorAll('.js-night-return').forEach((b) => (b.hidden = false));
  ensureWorld();
  // پیوند عمیق اولیه
  const h = decodeURIComponent(location.hash.replace('#', ''));
  if (h === 'resume') {
    loaderDone(true);
    setMode('day');
  }
  // بقیهٔ hashها پس از ورود به باغ اعمال می‌شوند
}
