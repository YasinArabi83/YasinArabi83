/* ============================================================
   ui.js — تعاملات رابط کاربری: ناوبری، اسکرول‌اسپای، شمارنده‌ها،
   ماشین‌تحریر، نمایش تدریجی بخش‌ها و منوی موبایل.
   محتوا بدون این فایل هم کامل و خوانا است (پیشرفت‌گرا).
   ============================================================ */

import { HERO_ROLES, faDigits } from './data.js';

export function initUI({ reducedMotion = false } = {}) {

  /* ---------- اسکرول نرم ---------- */
  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    el.removeAttribute('tabindex');
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToSection(id);
    history.replaceState(null, '', `#${id}`);
  });

  /* ---------- نوار پیشرفت + سایهٔ هدر ---------- */
  const bar = document.getElementById('progress-bar');
  const topbar = document.getElementById('topbar');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (bar) bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
      if (topbar) topbar.classList.toggle('scrolled', window.scrollY > 24);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- منوی کشویی موبایل (از چپ) ---------- */
  const menuToggle = document.getElementById('menu-toggle');
  const navDrawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('menu-backdrop');
  const drawerClose = document.getElementById('drawer-close');
  let menuOpen = false;
  let lastFocused = null;

  function setMenu(open) {
    if (!navDrawer || open === menuOpen) return;
    menuOpen = open;
    navDrawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('show', open);
    navDrawer.setAttribute('aria-hidden', String(!open));
    if (backdrop) backdrop.setAttribute('aria-hidden', String(!open));
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'بستن منو' : 'باز کردن منو');
    }
    document.body.classList.toggle('menu-open', open);
    if (open) {
      lastFocused = document.activeElement;
      if (drawerClose) drawerClose.focus();
    } else {
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      lastFocused = null;
    }
  }

  if (menuToggle && navDrawer) {
    menuToggle.addEventListener('click', () => setMenu(!menuOpen));
    if (drawerClose) drawerClose.addEventListener('click', () => setMenu(false));
    if (backdrop) backdrop.addEventListener('click', () => setMenu(false));

    /* بستن با کلیک روی لینک‌ها — این شنونده قبل از شنوندهٔ سراسری سند اجرا می‌شود
       تا قفل اسکرول باز شود و اسکرول نرم به مقصد کار کند. */
    navDrawer.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });

    /* ESC + تلهٔ فوکوس */
    document.addEventListener('keydown', (e) => {
      if (!menuOpen) return;
      if (e.key === 'Escape') { setMenu(false); if (menuToggle) menuToggle.focus(); return; }
      if (e.key === 'Tab') {
        const focusables = Array.from(
          navDrawer.querySelectorAll('a[href], button:not([disabled])')
        ).filter((el) => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = navDrawer.contains(document.activeElement) ? document.activeElement : first;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (document.activeElement !== active) { e.preventDefault(); active.focus(); }
        else if (document.activeElement === navDrawer) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      }
    });

    /* بستن خودکار هنگام گذر به نمای دسکتاپ */
    const desktopMq = window.matchMedia('(min-width: 769px)');
    const onDesktop = () => { if (desktopMq.matches && menuOpen) setMenu(false); };
    if (desktopMq.addEventListener) desktopMq.addEventListener('change', onDesktop);
    else if (desktopMq.addListener) desktopMq.addListener(onDesktop);
  }

  /* ---------- اسکرول‌اسپای ---------- */
  const spyLinks = new Map(); // id -> Element[]
  document.querySelectorAll('.nav-link[data-spy], .drawer-link[data-spy]').forEach((l) => {
    const key = l.dataset.spy;
    if (!spyLinks.has(key)) spyLinks.set(key, []);
    spyLinks.get(key).push(l);
  });
  const spySections = ['about', 'skills', 'experience', 'projects', 'education', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if ('IntersectionObserver' in window && spySections.length) {
    const spyIO = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        spyLinks.forEach((arr) => arr.forEach((l) => l.classList.remove('active')));
        const actives = spyLinks.get(en.target.id) || [];
        actives.forEach((l) => l.classList.add('active'));
      }
    }, { rootMargin: '-38% 0px -55% 0px' });
    spySections.forEach((s) => spyIO.observe(s));
  }

  /* ---------- نمایش تدریجی ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const revealIO = new IntersectionObserver((entries, obs) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          obs.unobserve(en.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => revealIO.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------- شمارنده‌های آمار ---------- */
  const counters = document.querySelectorAll('.counter');
  if (counters.length) {
    const animate = (el) => {
      const target = parseInt(el.dataset.count || '0', 10);
      if (reducedMotion || !isFinite(target)) { el.textContent = faDigits(target); return; }
      const dur = 1300;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = faDigits(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      const cIO = new IntersectionObserver((entries, obs) => {
        for (const en of entries) {
          if (en.isIntersecting) { animate(en.target); obs.unobserve(en.target); }
        }
      }, { threshold: 0.4 });
      counters.forEach((c) => cIO.observe(c));
    } else counters.forEach(animate);
  }

  /* ---------- ترمینال «دربارهٔ من»: تایپ دستورها ---------- */
  const terminal = document.querySelector('.terminal');
  if (terminal) {
    const cmdEls = Array.from(terminal.querySelectorAll('.term-cmd'));
    const starts = [350, 1300, 2700, 3700];

    const playTyping = () => {
      cmdEls.forEach((el, i) => {
        const full = el.textContent;
        if (reducedMotion) return;
        el.textContent = '';
        const start = starts[i] != null ? starts[i] : 400 + i * 800;
        setTimeout(() => {
          let n = 0;
          const step = () => {
            n += 1;
            el.textContent = full.slice(0, n);
            if (n < full.length) setTimeout(step, 42);
          };
          step();
        }, start);
      });
    };

    if ('IntersectionObserver' in window) {
      const tIO = new IntersectionObserver((entries, obs) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add('play');
            playTyping();
            obs.unobserve(en.target);
          }
        }
      }, { threshold: 0.3 });
      tIO.observe(terminal);
    } else {
      terminal.classList.add('play');
      playTyping();
    }
  }

  /* ---------- ماشین‌تحریر نقش‌ها در هیرو ---------- */
  const roleEl = document.getElementById('hero-role-text');
  if (roleEl && !reducedMotion && HERO_ROLES.length > 1) {
    roleEl.setAttribute('aria-hidden', 'true');
    let idx = 0;
    let text = HERO_ROLES[0];
    let deleting = false;

    const tick = () => {
      const current = HERO_ROLES[idx];
      if (!deleting) {
        text = current.slice(0, text.length + 1);
        roleEl.textContent = text;
        if (text === current) { deleting = true; setTimeout(tick, 1900); return; }
        setTimeout(tick, 62);
      } else {
        text = text.slice(0, -1);
        roleEl.textContent = text;
        if (text.length === 0) {
          deleting = false;
          idx = (idx + 1) % HERO_ROLES.length;
          setTimeout(tick, 350);
          return;
        }
        setTimeout(tick, 28);
      }
    };
    setTimeout(tick, 2300);
  }

  return { scrollToSection };
}
