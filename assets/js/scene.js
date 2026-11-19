/* ============================================================
   scene.js — موتور صحنه: آسمان گرادیانی، ستاره‌های چشمک‌زن،
   ریسه چراغ‌ها، نورپردازی، حلقهٔ رندر و مدیریت تعامل
   ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { STATIONS, PALETTE, qualityTier, lerp } from './data.js';
import { buildStations, radialGlowTexture } from './stations.js';
import { createRig } from './camera.js';

export function createWorld(canvas, { isMobile = false, reducedMotion = false } = {}) {
  const quality = { ...qualityTier(isMobile), reducedMotion };

  /* ---------- رندرر ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: quality.antialias, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxDPR));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bgDeep);
  scene.fog = new THREE.FogExp2(PALETTE.bgDeep, 0.02);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 240);
  const rig = createRig(camera, { reducedMotion, isMobile });
  rig.jump('overview');

  /* ---------- نورپردازی ---------- */
  scene.add(new THREE.HemisphereLight(0x3b5c4e, 0x201710, 1.05));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
  sun.position.set(7, 13, 9);
  scene.add(sun);
  const centerLight = new THREE.PointLight(PALETTE.teal, 55, 30, 1.9);
  centerLight.position.set(0, 6.5, 0);
  scene.add(centerLight);

  /* ---------- گنبد آسمان ---------- */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(110, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 top = vec3(0.030, 0.070, 0.058);
          vec3 mid = vec3(0.055, 0.150, 0.120);
          vec3 hor = vec3(0.110, 0.150, 0.110);
          vec3 col = mix(hor, mid, smoothstep(-0.08, 0.38, h));
          col = mix(col, top, smoothstep(0.32, 0.95, h));
          // هالهٔ گرم افق در یک سمت آسمان
          float band = pow(max(0.0, 1.0 - abs(h - 0.03) / 0.2), 2.2);
          float az = 0.5 + 0.5 * dot(normalize(vDir.xz), vec2(0.55, -0.83));
          col += vec3(0.30, 0.19, 0.075) * band * az * 0.75;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(sky);

  /* ---------- ستاره‌های چشمک‌زن ---------- */
  const starGeo = new THREE.BufferGeometry();
  {
    const N = quality.stars;
    const pos = new Float32Array(N * 3);
    const phase = new Float32Array(N);
    const size = new Float32Array(N);
    const tint = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 46 + Math.random() * 38;
      const th = Math.random() * Math.PI * 2;
      // بیشتر در نیم‌کرهٔ بالا، کمی پایین‌تر از افق
      const ph = Math.acos(1 - Math.random() * (Math.random() < 0.8 ? 1.15 : 1.6));
      const y = Math.cos(ph);
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
      pos[i * 3 + 1] = y * r * 0.85 + 2;
      pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
      phase[i] = Math.random();
      size[i] = 0.5 + Math.random() * 1.7;
      tint[i] = Math.random();
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    starGeo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  }
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: reducedMotion ? 0 : 1 } },
    vertexShader: /* glsl */ `
      attribute float aPhase; attribute float aSize; attribute float aTint;
      varying float vPhase; varying float vTint;
      void main() {
        vPhase = aPhase; vTint = aTint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (150.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uTwinkle;
      varying float vPhase; varying float vTint;
      void main() {
        float tw = mix(0.85, 0.3 + 0.7 * abs(sin(uTime * 0.9 + vPhase * 6.2831)), uTwinkle);
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d) * tw;
        vec3 col = mix(vec3(0.85, 0.93, 0.88), vec3(0.49, 0.91, 0.80), vTint);
        col = mix(col, vec3(0.93, 0.66, 0.32), step(0.94, vTint));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------- سحابی‌های ملایم ---------- */
  const nebulaColors = [PALETTE.teal, PALETTE.saffron, PALETTE.rose];
  for (let i = 0; i < quality.nebula; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTexture(nebulaColors[i % 3]), transparent: true,
      opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const a = (i / quality.nebula) * Math.PI * 2 + 0.7;
    s.position.set(Math.cos(a) * 46, 8 + i * 7, Math.sin(a) * 46);
    s.scale.set(52, 40, 1);
    scene.add(s);
  }

  /* ---------- ایستگاه‌ها ---------- */
  const stations3d = buildStations(scene, { quality });

  /* ---------- ریسه چراغ‌ها (فانوس‌های باغ شب) ---------- */
  const lanternMats = [
    new THREE.MeshBasicMaterial({ color: PALETTE.tealBright }),
    new THREE.MeshBasicMaterial({ color: PALETTE.saffron }),
  ];
  const lanternGeo = new THREE.SphereGeometry(0.085, 10, 8);
  const glowSpriteTex = radialGlowTexture(0xf7e8c8);
  const home = STATIONS[0];
  for (const st of STATIONS.slice(1)) {
    const from = new THREE.Vector3(...home.position).add(new THREE.Vector3(0, 1.3, 0));
    const to = new THREE.Vector3(...st.position).add(new THREE.Vector3(0, 1.15, 0));
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 2.3;
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);

    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.014, 5),
      new THREE.MeshBasicMaterial({ color: 0x2c2a22 })
    );
    scene.add(wire);

    const n = 8;
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      const lantern = new THREE.Mesh(lanternGeo, lanternMats[i % 2]);
      lantern.position.copy(p).add(new THREE.Vector3(0, -0.09, 0));
      scene.add(lantern);
      if (quality.lanternGlow) {
        const gs = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowSpriteTex, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        gs.scale.set(0.65, 0.65, 1);
        gs.position.copy(p);
        scene.add(gs);
      }
    }
  }

  /* ---------- نور تأکیدی سکوها (فقط دسکتاپ) ---------- */
  if (quality.accentLights) {
    for (const st of STATIONS) {
      const pl = new THREE.PointLight(st.color, 9, 9, 1.8);
      pl.position.set(st.position[0], st.position[1] + 2.6, st.position[2]);
      scene.add(pl);
    }
  }

  /* ---------- Raycast ---------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hoveredId = null;

  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(stations3d.interactables, false);
    if (hits.length) {
      const id = hits[0].object.userData.stationId;
      return id || null;
    }
    return null;
  }

  function setHovered(id) {
    if (id === hoveredId) return;
    for (const p of stations3d.platforms) p.userData.hovered = p.userData.id === id;
    hoveredId = id;
  }

  /* ---------- حلقهٔ رندر ---------- */
  const clock = new THREE.Clock();
  let running = false;
  let rafId = 0;

  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    starMat.uniforms.uTime.value = t;
    stations3d.tick(t, dt, t);
    rig.update(dt, t);
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    clock.getDelta();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  /* ---------- اندازه ---------- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!document.body.classList.contains('day')) start();
  });

  // یک فریم همگام‌سازی‌شده تا بوم هرگز خالی نباشد
  rig.update(0.016, 0);
  renderer.render(scene, camera);

  return {
    camera, rig, quality,
    start, stop, resize,
    pickAt, setHovered,
    get hovered() { return hoveredId; },
  };
}
