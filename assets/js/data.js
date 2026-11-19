/* ============================================================
   data.js — داده‌ها و پیکربندی «میز کار برنامه‌نویس»
   محتوای اصلی رزومه در index.html قرار دارد و بدون جاوااسکریپت
   هم کامل خوانا می‌ماند؛ این فایل فقط داده‌های تعاملات و
   صحنهٔ سه‌بعدی را نگه می‌دارد.
   ============================================================ */

/** تبدیل ارقام لاتین به فارسی */
export function faDigits(value) {
  const map = { 0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹' };
  return String(value).replace(/[0-9]/g, (d) => map[d]);
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** پالت رنگی — هماهنگ با توکن‌های CSS در main.css */
export const PALETTE = {
  bgDeep: 0x0d1117,
  wall: 0x22262e,
  wallDark: 0x1b1f26,
  wood: 0x7a5230,
  woodDark: 0x5d3d23,
  green: 0x3fb950,
  greenBright: 0x7ee787,
  amber: 0xe3b341,
  red: 0xe86a5e,
  slate: 0x2a2f3a,
  slateDark: 0x20242d,
  steel: 0x39404d,
  cream: 0xf0c987,
};

/** نقش‌های چرخان زیر نام (ماشین تحریر هیرو) */
export const HERO_ROLES = [
  'برنامه‌نویس .NET',
  'توسعه‌دهندهٔ سامانه‌های سازمانی (ERP)',
  'علاقه‌مند به DDD و Modular Monolith',
  'مهاجرت‌دهندهٔ پلتفرم به .NET 10',
];

/** کاشی‌های آمار (شمارنده) */
export const STATS = [
  { value: 1, suffix: '+', label: 'سال تجربهٔ تمام‌وقت توسعهٔ .NET' },
  { value: 11, suffix: '', label: 'ماژول سازمانی مهاجرت‌یافته به .NET 10' },
  { value: 45, suffix: '', label: 'ساعت دورهٔ تخصصی Domain-Driven Design' },
  { value: 3, suffix: '', label: 'پروژهٔ شخصی و متن‌باز روی GitHub' },
];

/**
 * نقاط داغ (Hotspot) صحنهٔ سه‌بعدی.
 * anchor: مختصات سه‌بعدی برچسب | target: نام شیء قابل‌کلیک
 * section: شناسهٔ بخش مقصد | dot: شمارهٔ نمایشی
 */
export const HOTSPOTS = [
  { id: 'hs-about',     dot: '۱', label: 'دربارهٔ من',    section: 'about',     anchor: [-0.05, 1.78, -2.2],  target: 'monitorMain' },
  { id: 'hs-skills',    dot: '۲', label: 'مهارت‌ها',      section: 'skills',    anchor: [0.4, 0.96, -1.84],   target: 'keyboard' },
  { id: 'hs-experience',dot: '۳', label: 'تجربهٔ کاری',   section: 'experience',anchor: [1.26, 0.74, -1.72],  target: 'pcTower' },
  { id: 'hs-projects',  dot: '۴', label: 'پروژه‌ها',      section: 'projects',  anchor: [-1.38, 1.5, -2.32],  target: 'monitorDash' },
  { id: 'hs-education', dot: '۵', label: 'تحصیلات',      section: 'education', anchor: [0.55, 2.68, -3.15],  target: 'bookshelf' },
  { id: 'hs-contact',   dot: '۶', label: 'تماس',          section: 'contact',   anchor: [-0.78, 1.02, -2.05], target: 'mug' },
];

/** اطلاعات پروژه‌ها برای داشبورد مانیتور دوم */
export const PROJECT_FRAMES = [
  { title: 'Personal Obligation Manager', sub: '.NET 10 · DDD', accent: '#7ee787' },
  { title: 'WeatherAPI', sub: 'ASP.NET Core · Swagger', accent: '#e3b341' },
  { title: 'Django Web API', sub: 'DRF · JWT · PostgreSQL', accent: '#e86a5e' },
];

/** کیفیت رندر بر اساس دستگاه */
export function qualityTier(isMobile) {
  return isMobile
    ? { shadows: false, dust: false, maxDPR: 1.75, typingFPS: 7 }
    : { shadows: true, dust: true, maxDPR: 2.0, typingFPS: 10 };
}
