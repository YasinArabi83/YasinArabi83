/* ============================================================
   main.js — نقطهٔ ورود «میز کار برنامه‌نویس»
   ابتدا رابط کاربری راه می‌افتد (محتوا همیشه در دسترس)،
   سپس صحنهٔ سه‌بعدی به‌صورت تنبل بارگذاری می‌شود.
   ============================================================ */

import { initUI } from './ui.js';

const prefersReduced =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ui = initUI({ reducedMotion: prefersReduced });

function showFallback() {
  const fallback = document.getElementById('hero-fallback');
  const canvas = document.getElementById('scene3d');
  const hint = document.getElementById('hero-hint');
  const wrap = document.getElementById('hero-canvas-wrap');
  if (fallback) fallback.hidden = false;
  if (canvas) canvas.style.display = 'none';
  if (hint) hint.style.display = 'none';
  if (wrap) wrap.classList.add('no3d');
}

async function bootScene() {
  const canvas = document.getElementById('scene3d');
  const wrap = document.getElementById('hero-canvas-wrap');
  if (!canvas || !wrap) return;

  try {
    const { createScene } = await import('./scene.js');
    const result = await createScene(canvas, {
      reducedMotion: prefersReduced,
      onNavigate: (section) => ui.scrollToSection(section),
      onReady: () => wrap.classList.add('ready'),
      onFail: showFallback,
    });
    if (!result) showFallback();
  } catch (err) {
    console.error('Scene boot failed:', err);
    showFallback();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootScene);
} else {
  bootScene();
}
