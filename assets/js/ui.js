/* ============================================================
   ui.js — لایهٔ رابط کاربری: ناوبری، پنل محتوا، توست،
   کیبورد، اسکرول، سوایپ، کپی و مسیریابی hash
   ============================================================ */
import { STATIONS, faDigits } from './data.js';

const ORDER = STATIONS.map((s) => s.id);
const LABEL = Object.fromEntries(STATIONS.map((s) => [s.id, s.label]));

export function initUI(handlers) {
  const $ = (sel) => document.querySelector(sel);
  const el = {
    loader: $('#loader'),
    loaderFill: $('#loader-fill'),
    loaderStatus: $('#loader-status'),
    loaderBar: $('.loader-bar'),
    enterNight: $('#enter-night'),
    enterDay: $('#enter-day'),
    stage: $('#stage'),
    canvas: $('#scene-canvas'),
    topbar: $('#topbar'),
    nav: $('#mainnav'),
    panel: $('#panel'),
    panelKicker: $('#panel-kicker'),
    panelTitle: $('#panel-title'),
    panelBody: $('#panel-body'),
    panelClose: $('#panel-close'),
    panelPrev: $('#panel-prev'),
    panelNext: $('#panel-next'),
    panelDots: $('#panel-dots'),
    edgeNav: $('#edge-nav'),
    navPrev: $('#nav-prev'),
    navNext: $('#nav-next'),
    edgeDots: $('#edge-dots'),
    hint: $('#hint'),
    tip: $('#tip'),
    toast: $('#toast'),
    dayview: $('#dayview'),
    btnDay: $('#btn-day'),
  };

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2200);
  }

  /* ---------- پنل محتوا ---------- */
  let panelOpen = false;
  function fillPanel(id) {
    const st = STATIONS.find((s) => s.id === id);
    if (!st) return;
    const sec = document.getElementById(st.section);
    el.panelKicker.textContent = sec.dataset.kicker || '';
    const h2 = sec.querySelector('h2');
    el.panelTitle.textContent = h2 ? h2.textContent : st.label;
    el.panelBody.innerHTML = '';
    el.panelBody.appendChild(sec.cloneNode(true));
    const cloneH2 = el.panelBody.querySelector('h2');
    if (cloneH2) cloneH2.remove();
    el.panelBody.scrollTop = 0;
  }
  function showPanel(id) {
    fillPanel(id);
    panelOpen = true;
    el.panel.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.panel.classList.add('open')));
    el.panelTitle.focus({ preventScroll: true });
    handlers.onPanelOpen(true);
  }
  function hidePanel({ focusNav = true } = {}) {
    if (!panelOpen) return;
    panelOpen = false;
    el.panel.classList.remove('open');
    const active = el.nav.querySelector('.navlink.active');
    if (focusNav && document.activeElement && el.panel.contains(document.activeElement)) {
      if (active) active.focus({ preventScroll: true });
    }
    setTimeout(() => { if (!panelOpen) el.panel.hidden = true; }, 380);
    handlers.onPanelOpen(false);
  }

  /* ---------- ناوبری ---------- */
  let current = 'home';
  function setActive(id) {
    current = id;
    el.nav.querySelectorAll('.navlink').forEach((b) => {
      b.classList.toggle('active', b.dataset.station === id);
    });
    [...el.panelDots.children, ...el.edgeDots.children].forEach((d) => {
      d.classList.toggle('active', d.dataset.station === id);
    });
    document.title = `یاسین عربی — ${LABEL[id] || 'شب‌باغ کد'}`;
  }
  function step(dir) {
    const i = ORDER.indexOf(current);
    const next = ORDER[(i + dir + ORDER.length) % ORDER.length];
    handlers.goto(next);
  }

  /* ---------- Dots ---------- */
  for (const target of [el.panelDots, el.edgeDots]) {
    for (const s of STATIONS) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'pdot';
      d.dataset.station = s.id;
      d.setAttribute('aria-label', s.label);
      d.title = s.label;
      d.addEventListener('click', () => handlers.goto(s.id));
      target.appendChild(d);
    }
  }

  /* ---------- رویدادهای UI ---------- */
  el.nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-station]');
    if (b) handlers.goto(b.dataset.station);
  });
  document.querySelectorAll('.brand').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); handlers.goto('home'); })
  );
  el.panelClose.addEventListener('click', () => hidePanel());
  el.panelPrev.addEventListener('click', () => step(-1));
  el.panelNext.addEventListener('click', () => step(1));
  el.navPrev.addEventListener('click', () => step(-1));
  el.navNext.addEventListener('click', () => step(1));
  el.btnDay.addEventListener('click', () => handlers.toggleMode('day'));

  document.querySelectorAll('.js-night-return').forEach((b) =>
    b.addEventListener('click', () => handlers.toggleMode('night'))
  );

  /* ---------- کپی (روز + پنل) ---------- */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast('کپی شد');
    } catch {
      toast('کپی نشد — دستی انتخاب کنید');
    }
  });

  /* ---------- کیبورد (نمای شب) ---------- */
  window.addEventListener('keydown', (e) => {
    if (handlers.mode() !== 'night') return;
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    switch (e.key) {
      case 'ArrowLeft': step(1); break;   // RTL: بعدی
      case 'ArrowRight': step(-1); break; // RTL: قبلی
      case 'ArrowDown': step(1); break;
      case 'ArrowUp': step(-1); break;
      case 'Escape': hidePanel(); break;
    }
  });

  /* ---------- اسکرول ماوس (نمای شب) ---------- */
  let wheelAcc = 0, wheelLock = 0;
  window.addEventListener('wheel', (e) => {
    if (handlers.mode() !== 'night') return;
    if (el.panel.contains(e.target)) return; // اسکرول خود پنل
    const now = performance.now();
    if (now < wheelLock) { wheelAcc = 0; return; }
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 90) {
      step(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0;
      wheelLock = now + 850;
      hideHint();
    }
  }, { passive: true });

  /* ---------- اشاره‌گر روی صحنه ---------- */
  let down = null;
  el.stage.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  el.stage.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    const dist = Math.hypot(dx, dy);
    const t0 = down.t;
    down = null;
    if (handlers.mode() !== 'night') return;
    if (dist > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      // سوایپ افقی — RTL: کشیدن به راست = بعدی
      step(dx > 0 ? 1 : -1);
      hideHint();
    } else if (dist < 8 && performance.now() - t0 < 600) {
      const id = handlers.pick(e.clientX, e.clientY);
      if (id) handlers.goto(id);
    }
  });
  el.stage.addEventListener('pointermove', (e) => {
    if (handlers.mode() !== 'night') return;
    hideTip();
    if (e.pointerType === 'mouse') {
      handlers.parallax(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      );
      const id = handlers.pick(e.clientX, e.clientY);
      handlers.hover(id);
      if (id) showTip(id, e.clientX, e.clientY);
      el.canvas.style.cursor = id ? 'pointer' : 'default';
    }
  });
  el.stage.addEventListener('pointerleave', () => {
    hideTip();
    handlers.hover(null);
    handlers.parallax(0, 0);
  });

  /* ---------- Tip ---------- */
  function showTip(id, x, y) {
    el.tip.textContent = LABEL[id] || '';
    el.tip.style.left = `${x}px`;
    el.tip.style.top = `${y}px`;
    el.tip.hidden = false;
  }
  function hideTip() { el.tip.hidden = true; }

  /* ---------- راهنمای اولیه ---------- */
  let hintShown = false, hintHidden = false;
  function showHint() {
    if (hintShown || hintHidden) return;
    hintShown = true;
    el.hint.hidden = false;
    setTimeout(hideHint, 7000);
  }
  function hideHint() {
    if (hintHidden) return;
    hintHidden = true;
    el.hint.classList.add('hide');
    setTimeout(() => { el.hint.hidden = true; }, 800);
  }

  /* ---------- Hash routing ---------- */
  function applyHash() {
    const h = decodeURIComponent(location.hash.replace('#', ''));
    if (h === 'resume') { handlers.toggleMode('day'); return; }
    if (ORDER.includes(h) && handlers.mode() === 'night' && h !== current) handlers.goto(h);
  }
  window.addEventListener('hashchange', applyHash);
  let lastHash = '';
  function syncHash(id) {
    const h = `#${id}`;
    if (location.hash !== h) {
      lastHash = h;
      location.hash = h;
    }
  }

  return {
    toast, showPanel, hidePanel, setActive, showHint, hideHint, syncHash,
    get panelOpen() { return panelOpen; },
    get current() { return current; },
    applyHash,
  };
}
