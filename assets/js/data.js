/* ============================================================
   data.js — پیکربندی صحنه و ایستگاه‌ها
   محتوای رزومه در index.html (بخش‌های نمای روز) نگهداری می‌شود؛
   این فایل فقط چیدمان و تنظیمات سه‌بعدی است.
   ============================================================ */

/** تبدیل ارقام لاتین به فارسی */
export function faDigits(value) {
  const map = { 0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹' };
  return String(value).replace(/[0-9]/g, (d) => map[d]);
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** پالت رنگی صحنه (هماهنگ با توکن‌های CSS) */
export const PALETTE = {
  bgDeep: 0x0c1310,
  ink: 0xf2ebdc,
  teal: 0x2fb8a6,
  tealBright: 0x7de8cd,
  saffron: 0xe8a24c,
  rose: 0xe86a5e,
  amber: 0xd9b45b,
  cream: 0xf0c987,
  slate: 0x1d2a24,
  slateDark: 0x141f1a,
};

/**
 * ایستگاه‌های شب‌باغ.
 * position: محل سکو | view: جای دوربین و نقطهٔ نگاه | color: رنگ تأکیدی سکو
 * ترتیب = ترتیب ناوبری (راست به چپ، مثل خواندن فارسی)
 */
export const STATIONS = [
  {
    id: 'home',
    label: 'خانه',
    section: 'sec-home',
    color: 0x2fb8a6,
    position: [0, 0, 0],
    view: { cam: [0, 3.6, 7.6], look: [0, 1.5, 0] },
  },
  {
    id: 'experience',
    label: 'تجربه',
    section: 'sec-experience',
    color: 0xe8a24c,
    position: [7.7, 1.0, 2.8],
    view: { cam: [11.4, 4.1, 4.6], look: [7.7, 2.0, 2.8] },
  },
  {
    id: 'skills',
    label: 'مهارت‌ها',
    section: 'sec-skills',
    color: 0x7de8cd,
    position: [4.5, 1.6, -6.8],
    view: { cam: [7.3, 4.5, -10.9], look: [4.5, 2.5, -6.8] },
  },
  {
    id: 'projects',
    label: 'پروژه‌ها',
    section: 'sec-projects',
    color: 0xe86a5e,
    position: [-4.5, 2.0, -6.8],
    view: { cam: [-7.3, 4.9, -10.9], look: [-4.5, 2.9, -6.8] },
  },
  {
    id: 'education',
    label: 'تحصیلات',
    section: 'sec-education',
    color: 0xd9b45b,
    position: [-7.7, 1.3, 2.8],
    view: { cam: [-11.4, 4.3, 4.6], look: [-7.7, 2.3, 2.8] },
  },
  {
    id: 'contact',
    label: 'تماس',
    section: 'sec-contact',
    color: 0xf0c987,
    position: [0, 0.7, 8.2],
    view: { cam: [0, 3.9, 13.8], look: [0, 1.7, 8.2] },
  },
];

/** نمای آغازین (پیش از ورود به باغ) */
export const OVERVIEW_VIEW = { cam: [0, 9.5, 19.5], look: [0, 1.2, 0] };

/** اطلاعات پروژه‌ها برای بافت قاب‌های سه‌بعدی */
export const PROJECT_FRAMES = [
  { title: 'Obligation Manager', sub: 'ASP.NET Core · DDD', accent: '#7de8cd' },
  { title: 'WeatherAPI', sub: 'ASP.NET Core · Swagger', accent: '#e8a24c' },
  { title: 'Django Web API', sub: 'DRF · JWT · PostgreSQL', accent: '#e86a5e' },
];

/** تنظیمات کیفیت بر اساس دستگاه */
export function qualityTier(isMobile) {
  return isMobile
    ? { stars: 320, antialias: false, maxDPR: 1.5, lanternGlow: false, accentLights: false, nebula: 2 }
    : { stars: 850, antialias: true, maxDPR: 2.0, lanternGlow: true, accentLights: true, nebula: 3 };
}
