/* ============================================================
   camera.js — دوربین‌ران: پرواز نرم بین ایستگاه‌ها،
   پارالاکس ماوس، جابه‌جایی سوژه هنگام باز بودن پنل
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { STATIONS, OVERVIEW_VIEW, lerp, clamp } from './data.js';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createRig(camera, { reducedMotion = false, isMobile = false } = {}) {
  const views = new Map();
  views.set('overview', OVERVIEW_VIEW);
  for (const s of STATIONS) views.set(s.id, s.view);

  let basePos = new THREE.Vector3(...OVERVIEW_VIEW.cam);
  let baseLook = new THREE.Vector3(...OVERVIEW_VIEW.look);
  let tween = null;
  let currentId = 'overview';

  // پارالاکس اشاره‌گر
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  // جابه‌جایی سوژه وقتی پنل باز است (دسکتاپ)
  let panelShift = 0, panelShiftTarget = 0;
  const PANEL_OFFSET = isMobile ? 0 : 1.55;

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function goTo(id, { duration } = {}) {
    const v = views.get(id);
    if (!v) return Promise.resolve();
    currentId = id;
    if (reducedMotion) {
      basePos.set(...v.cam);
      baseLook.set(...v.look);
      if (tween && tween.onDone) { const d = tween.onDone; tween = null; d(); }
      return Promise.resolve();
    }
    // اگر پرواز قبلی نیمه‌کاره مانده، فوراً آن را ببند تا caller معلق نماند
    if (tween && tween.onDone) { const d = tween.onDone; tween.onDone = null; d(); }
    const dur = duration ?? 1.55;
    tween = {
      t: 0,
      dur,
      startWall: performance.now(),
      fromPos: basePos.clone(),
      fromLook: baseLook.clone(),
      toPos: new THREE.Vector3(...v.cam),
      toLook: new THREE.Vector3(...v.look),
    };
    return new Promise((resolve) => { tween.onDone = resolve; });
  }

  function jump(id) {
    const v = views.get(id);
    if (!v) return;
    currentId = id;
    basePos.set(...v.cam);
    baseLook.set(...v.look);
    tween = null;
  }

  function update(dt, elapsed) {
    if (tween) {
      // پیشرفت بر اساس زمان واقعی (مستقل از نرخ فریم دستگاه)
      tween.t = Math.min(1, (performance.now() - tween.startWall) / (tween.dur * 1000));
      const e = easeInOutCubic(tween.t);
      tmpPos.lerpVectors(tween.fromPos, tween.toPos, e);
      tmpLook.lerpVectors(tween.fromLook, tween.toLook, e);
      // قوس پرواز: کمی صعود در میانهٔ مسیر
      tmpPos.y += Math.sin(e * Math.PI) * 1.35;
      basePos.copy(tmpPos);
      baseLook.copy(tmpLook);
      if (tween.t >= 1) {
        const done = tween.onDone;
        tween = null;
        if (done) done();
      }
    }

    // پارالاکس نرم
    if (!reducedMotion) {
      const k = 1 - Math.pow(0.0018, dt);
      parallax.x = lerp(parallax.x, parallax.tx, k);
      parallax.y = lerp(parallax.y, parallax.ty, k);
      // تاب ملایم در حالت بی‌حرکتی (به‌ویژه لمسی)
      const sway = Math.sin(elapsed * 0.22) * 0.22 + Math.sin(elapsed * 0.13) * 0.12;
      camera.position.set(
        basePos.x + parallax.x * 0.85 + sway * 0.4,
        basePos.y + parallax.y * 0.5 + Math.sin(elapsed * 0.18) * 0.08,
        basePos.z
      );
    } else {
      camera.position.copy(basePos);
    }

    panelShift = lerp(panelShift, panelShiftTarget, 1 - Math.pow(0.002, dt));
    tmpLook.set(baseLook.x + panelShift, baseLook.y + parallax.y * 0.35, baseLook.z);
    camera.lookAt(tmpLook);
  }

  return {
    goTo,
    jump,
    update,
    get current() { return currentId; },
    setParallax(nx, ny) { parallax.tx = clamp(nx, -1, 1); parallax.ty = clamp(ny, -1, 1); },
    setPanelOpen(open) { panelShiftTarget = open ? PANEL_OFFSET : 0; },
  };
}
