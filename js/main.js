/* ============ ORBITAL — Earth · Orbit · Exploded satellite ============ */
import * as THREE from './vendor/three.module.js';

const { gsap } = window;
gsap.registerPlugin(window.ScrollTrigger);

/* ---------------------------------------------------------------- setup */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 7);

/* ------------------------------------------------------------- lighting */
const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
sun.position.set(5, 2.5, 3.5);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x3d6aa8, 0.5);
fill.position.set(-5, -1, 2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0x9fd9ff, 1.1);
rim.position.set(-3, 3, -4);
scene.add(rim);

scene.add(new THREE.AmbientLight(0x1c3048, 2.2));

const front = new THREE.PointLight(0xbdd9ee, 26, 40, 1.8);
front.position.set(1.5, 1.5, 6);
scene.add(front);

/* --------------------------------------------- procedural environment map
   (gives the aluminium its reflective, "machined metal" look)            */
function makeEnvMap() {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    if (i === 2) {           // +Y : bright sky
      grad.addColorStop(0, '#cfe4f2'); grad.addColorStop(1, '#5f7f99');
    } else if (i === 3) {    // -Y : dark
      grad.addColorStop(0, '#0a1119'); grad.addColorStop(1, '#02050a');
    } else {                 // sides
      grad.addColorStop(0, '#89a8bf'); grad.addColorStop(0.55, '#22394e');
      grad.addColorStop(1, '#050b12');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    if (i === 0) {           // +X : sun hotspot
      const s = g.createRadialGradient(20, 18, 2, 20, 18, 26);
      s.addColorStop(0, 'rgba(255,244,220,1)');
      s.addColorStop(1, 'rgba(255,244,220,0)');
      g.fillStyle = s;
      g.fillRect(0, 0, 64, 64);
    }
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
scene.environment = makeEnvMap();

/* ------------------------------------------------------------------ stars */
function makeStars(count, spread, size, color, opacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = spread * (0.5 + Math.random() * 0.5);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size, color, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}
const starsFar = makeStars(2600, 90, 0.14, 0xcfe4f5, 0.75);
const starsNear = makeStars(900, 55, 0.22, 0x7fd8e8, 0.55);
scene.add(starsFar, starsNear);

/* ------------------------------------------------------------------ earth */
const loadManager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(loadManager);
const srgb = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

const earthGroup = new THREE.Group();
scene.add(earthGroup);

const earthMat = new THREE.MeshStandardMaterial({
  map: srgb(texLoader.load('assets/textures/earth-blue-marble.jpg')),
  bumpMap: texLoader.load('assets/textures/earth-topology.png'),
  bumpScale: 0.6,
  emissiveMap: srgb(texLoader.load('assets/textures/earth-night.jpg')),
  emissive: new THREE.Color(0xffc98a),
  emissiveIntensity: 0.65,
  roughness: 0.9,
  metalness: 0,
  envMapIntensity: 0.12,
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 96, 96), earthMat);
earth.rotation.set(-0.55, 2.2, 0);   // tilt pole back so the equator faces the camera
earthGroup.add(earth);

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(2.025, 64, 64),
  new THREE.MeshLambertMaterial({
    map: srgb(texLoader.load('assets/textures/earth-clouds.png')),
    transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
);
clouds.material.opacity = 0.34;
clouds.rotation.x = -0.55;
earthGroup.add(clouds);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.14, 64, 64),
  new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(0x5fb9e8) } },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 c; varying vec3 vN; varying vec3 vP;
      void main() {
        float f = pow(clamp(0.62 - dot(vN, normalize(-vP)), 0.0, 1.0), 4.0);
        gl_FragColor = vec4(c, 1.0) * f * 0.85;
      }`,
  })
);
earthGroup.add(atmosphere);

/* ------------------------------------------------------------ orbit lines */
const orbitGroup = new THREE.Group();
earthGroup.add(orbitGroup);

const orbitMats = [];
const orbitDots = [];
function addOrbit(rx, ry, tiltX, tiltZ, color, dotPhase, speed) {
  const g = new THREE.Group();
  g.rotation.set(tiltX, 0, tiltZ);
  const pts = new THREE.EllipseCurve(0, 0, rx, ry).getPoints(256);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const line = new THREE.LineLoop(geo, mat);
  line.rotation.x = Math.PI / 2;
  g.add(line);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })
  );
  g.add(dot);
  orbitGroup.add(g);
  orbitMats.push(mat, dot.material);
  orbitDots.push({ dot, rx, ry, phase: dotPhase, speed });
}
addOrbit(3.15, 2.55, 1.25, 0.5, 0x8b5cf6, 0.0, 0.12);   // PREVENTION
addOrbit(3.55, 2.75, 1.05, -0.45, 0xff8a3d, 2.2, 0.09); // REMOVAL
addOrbit(2.85, 2.85, 1.45, 0.15, 0x35e08a, 4.1, 0.15);  // REUSE

/* -------------------------------------------------------------- satellite */
function solarCellTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2440';
  g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const grad = g.createLinearGradient(x * 64, y * 64, x * 64 + 64, y * 64 + 64);
      grad.addColorStop(0, '#123054');
      grad.addColorStop(0.5, '#0c2138');
      grad.addColorStop(1, '#153a63');
      g.fillStyle = grad;
      g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
      g.strokeStyle = 'rgba(120,190,255,0.25)';
      g.strokeRect(x * 64 + 3, y * 64 + 3, 58, 58);
    }
  }
  g.fillStyle = 'rgba(216,164,55,0.9)';
  for (let y = 0; y <= 8; y++) g.fillRect(0, y * 64 - 1, 256, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const M = {
  alu:      new THREE.MeshStandardMaterial({ color: 0xa8b4c0, metalness: 0.88, roughness: 0.38, envMapIntensity: 1.15 }),
  aluDark:  new THREE.MeshStandardMaterial({ color: 0x4a5764, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.0 }),
  gold:     new THREE.MeshStandardMaterial({ color: 0xd9a437, metalness: 1.0,  roughness: 0.28, envMapIntensity: 1.5 }),
  panel:    new THREE.MeshStandardMaterial({ map: solarCellTexture(), metalness: 0.55, roughness: 0.4, envMapIntensity: 0.9 }),
  panelBack:new THREE.MeshStandardMaterial({ color: 0x8f9aa5, metalness: 0.8, roughness: 0.5 }),
  white:    new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 0.15, roughness: 0.55, envMapIntensity: 0.6 }),
  dark:     new THREE.MeshStandardMaterial({ color: 0x1c242e, metalness: 0.6,  roughness: 0.6 }),
  glowCyan: new THREE.MeshBasicMaterial({ color: 0x7fd8e8 }),
};

const satGroup = new THREE.Group();
scene.add(satGroup);
const satInner = new THREE.Group();          // rotates; parts explode inside it
satInner.rotation.set(0.18, 0.6, -0.12);
satGroup.add(satInner);

const parts = [];   // { obj, home:Vector3, out:Vector3 }
function part(obj, home, out, labelId) {
  obj.position.copy(home);
  satInner.add(obj);
  parts.push({ obj, home: home.clone(), out: out.clone() });
  if (labelId) labelAnchors[labelId] = obj;
  return obj;
}
const labelAnchors = {};

/* — bus core (stays) — */
const core = new THREE.Group();
const coreBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.62), M.aluDark);
core.add(coreBox);
const coreEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.64, 0.94, 0.64)),
  new THREE.LineBasicMaterial({ color: 0x7fd8e8, transparent: true, opacity: 0.35 })
);
core.add(coreEdges);
part(core, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));

/* — internal electronics (revealed by the explosion) — */
[
  [0xbfc9d2, new THREE.Vector3(0.1, 0.3, 0.1),   new THREE.Vector3(0.55, 0.85, 0.75)],
  [0xd9a437, new THREE.Vector3(-0.1, 0, -0.05),  new THREE.Vector3(-0.7, 0.15, 0.85)],
  [0x8f9aa5, new THREE.Vector3(0.05, -0.3, -0.1), new THREE.Vector3(0.85, -0.35, -0.7)],
].forEach(([col, home, out]) => {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.2, 0.26),
    new THREE.MeshStandardMaterial({ color: col, metalness: 0.85, roughness: 0.35 })
  );
  part(b, home, out);
});

/* — six bus face plates (fly outward → "opens up") — */
const plateGeoXY = new THREE.BoxGeometry(1.06, 1.42, 0.045);
const plateGeoTB = new THREE.BoxGeometry(1.06, 0.045, 1.06);
part(new THREE.Mesh(plateGeoXY, M.alu),  new THREE.Vector3(0, 0,  0.53), new THREE.Vector3(0, -0.15, 1.35), 'bus');
part(new THREE.Mesh(plateGeoXY, M.gold), new THREE.Vector3(0, 0, -0.53), new THREE.Vector3(0, 0.15, -1.35));
const plateGeoZY = new THREE.BoxGeometry(0.045, 1.42, 1.06);
part(new THREE.Mesh(plateGeoZY, M.gold), new THREE.Vector3( 0.53, 0, 0), new THREE.Vector3( 1.3, 0.1, -0.35));
part(new THREE.Mesh(plateGeoZY, M.alu),  new THREE.Vector3(-0.53, 0, 0), new THREE.Vector3(-1.3, -0.1, 0.35));
part(new THREE.Mesh(plateGeoTB, M.alu),  new THREE.Vector3(0,  0.74, 0), new THREE.Vector3(0,  1.15, 0));
part(new THREE.Mesh(plateGeoTB, M.aluDark), new THREE.Vector3(0, -0.74, 0), new THREE.Vector3(0, -1.15, 0));

/* — solar wings — */
function wing(side) {
  const w = new THREE.Group();
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), M.aluDark);
  yoke.rotation.z = Math.PI / 2;
  yoke.position.x = side * 0.25;
  w.add(yoke);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.5, 0.028), M.panel);
    p.position.set(side * (0.9 + i * 0.82), 0, 0);
    p.rotation.x = -0.06;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.5, 0.006), M.panelBack);
    back.position.z = -0.018;
    p.add(back);
    w.add(p);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), M.alu);
    hinge.position.set(side * (0.49 + i * 0.82), 0, 0);
    hinge.rotation.z = Math.PI / 2;
    w.add(hinge);
  }
  return w;
}
part(wing(1),  new THREE.Vector3( 0.53, 0.05, 0), new THREE.Vector3( 1.75, 0.35, 0));
part(wing(-1), new THREE.Vector3(-0.53, 0.05, 0), new THREE.Vector3(-1.75, -0.35, 0), 'panelL');

/* — high-gain dish — */
const dishGroup = new THREE.Group();
const profile = [];
for (let i = 0; i <= 12; i++) {
  const r = (i / 12) * 0.52;
  profile.push(new THREE.Vector2(r, r * r * 0.9));
}
const dish = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), M.alu);
dish.material = M.alu.clone();
dish.material.side = THREE.DoubleSide;
dishGroup.add(dish);
const feedRod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8), M.aluDark);
feedRod.position.y = 0.24;
dishGroup.add(feedRod);
const feedTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), M.gold);
feedTip.position.y = 0.46;
dishGroup.add(feedTip);
const dishMount = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 12), M.aluDark);
dishMount.position.y = -0.1;
dishGroup.add(dishMount);
part(dishGroup, new THREE.Vector3(0, 0.86, 0), new THREE.Vector3(0.15, 2.0, 0.1), 'dish');

/* — antennas — */
function whip(x, z, lean) {
  const a = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.6, 8), M.alu);
  rod.position.y = 0.3;
  a.add(rod);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), M.glowCyan);
  tip.position.y = 0.62;
  a.add(tip);
  a.rotation.z = lean;
  return a;
}
part(whip(), new THREE.Vector3( 0.42, 0.74,  0.42), new THREE.Vector3( 1.1, 1.7,  1.0));
part(whip(), new THREE.Vector3(-0.42, 0.74, -0.42), new THREE.Vector3(-1.1, 1.7, -1.0));

/* — propellant tank + plumbing — */
const tankGroup = new THREE.Group();
const tank = new THREE.Mesh(new THREE.SphereGeometry(0.27, 28, 28), M.gold);
tankGroup.add(tank);
const strap = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 10, 40), M.aluDark);
strap.rotation.x = Math.PI / 2;
tankGroup.add(strap);
part(tankGroup, new THREE.Vector3(0, -0.18, 0.05), new THREE.Vector3(1.15, -0.75, 1.15), 'tank');

/* — reaction wheels — */
const wheels = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24), M.alu);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 10, 30), M.aluDark);
  ring.rotation.x = Math.PI / 2;
  wheel.add(ring);
  wheel.position.set((i - 1) * 0.16, i * 0.14 - 0.1, (i % 2) * 0.1);
  wheel.rotation.set(i * 0.9, 0, i * 0.5);
  wheels.add(wheel);
}
part(wheels, new THREE.Vector3(-0.05, 0.3, -0.05), new THREE.Vector3(-1.3, 0.85, -0.9), 'wheels');

/* — thruster — */
const thrusterGroup = new THREE.Group();
const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.075, 0.3, 24, 1, true), M.aluDark);
nozzle.material = M.aluDark.clone();
nozzle.material.side = THREE.DoubleSide;
thrusterGroup.add(nozzle);
const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 16), M.alu);
throat.position.y = 0.2;
thrusterGroup.add(throat);
const glow = new THREE.Mesh(
  new THREE.CircleGeometry(0.13, 24),
  new THREE.MeshBasicMaterial({ color: 0x7fd8e8, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
);
glow.rotation.x = Math.PI / 2;
glow.position.y = -0.16;
thrusterGroup.add(glow);
part(thrusterGroup, new THREE.Vector3(0, -0.92, 0), new THREE.Vector3(0, -1.95, 0.2), 'thruster');

/* — radiators — */
const radGeo = new THREE.BoxGeometry(0.55, 1.05, 0.02);
part(new THREE.Mesh(radGeo, M.white), new THREE.Vector3(0.2, 0, 0.56), new THREE.Vector3(0.55, 0.5, 1.75), 'radiator');
part(new THREE.Mesh(radGeo, M.white), new THREE.Vector3(-0.2, 0, -0.56), new THREE.Vector3(-0.55, -0.5, -1.75));

/* — star tracker + sensor — */
const tracker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 14), M.dark);
tracker.rotation.x = 0.8;
part(tracker, new THREE.Vector3(0.3, 0.72, -0.25), new THREE.Vector3(0.9, 1.55, -0.75));
const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 18), M.dark.clone());
lens.rotation.x = Math.PI / 2;
part(lens, new THREE.Vector3(-0.25, -0.35, 0.56), new THREE.Vector3(-0.85, -1.05, 1.5));

/* ------------------------------------------------------------ parameters */
const P = {
  earthX: 0, earthY: -6.9, earthZ: 0, earthS: 3,
  satX: 2.8, satY: -3.2, satZ: 0, satS: 0.001,
  orbit: 0, explode: 0, labels: 0,
};
window.__P = P;
window.__earth = earthGroup;
window.__sat = satGroup;

/* --------------------------------------------------------- scroll phases
   Stateless: every scroll event recomputes the full state from the base,
   so it is always correct no matter where the page loads or refreshes.  */
const BASE = { ...P };
const T = { ...P };            // target state (P eases toward it each frame)

const phases = [];
let cursor = { ...BASE };      // running "state so far" while defining phases
/* rangeFn(top, height, vh) -> [startPx, endPx] — measured from element offsets */
function phase(selector, rangeFn, delta) {
  const from = { ...cursor };
  cursor = { ...cursor, ...delta };
  phases.push({ el: document.querySelector(selector), rangeFn, from, delta, a: 0, b: 1 });
}

function measurePhases() {
  const vh = window.innerHeight;
  for (const ph of phases) {
    const top = ph.el.offsetTop;
    const h = ph.el.offsetHeight;
    [ph.a, ph.b] = ph.rangeFn(top, h, vh);
  }
}

function applyPhases() {
  const y = window.scrollY;
  Object.assign(T, BASE);
  for (const ph of phases) {
    const p = Math.min(1, Math.max(0, (y - ph.a) / Math.max(1, ph.b - ph.a)));
    if (p <= 0) continue;
    for (const k in ph.delta) {
      T[k] = ph.from[k] + (ph.delta[k] - ph.from[k]) * p;
    }
  }
}

/* hero → mission : pull back to full globe, orbits fade in */
phase('#mission', (top, h, vh) => [top - vh, top], {
  earthX: 1.5, earthY: -0.05, earthS: 0.62, orbit: 1,
});

/* mission → spacecraft : Earth steps aside, AL-01 rises from the orbit lane */
phase('#spacecraft', (top, h, vh) => [top - vh, top], {
  earthX: -3.3, earthY: -0.55, earthS: 0.36, orbit: 0.3,
  satX: 1.45, satY: -0.05, satS: 0.5,
});

/* inside spacecraft section : slow zoom toward the satellite */
phase('#spacecraft', (top, h, vh) => [top, top + h - vh], {
  satS: 0.8, satX: 1.15, orbit: 0.12,
});

/* spacecraft → anatomy : satellite takes center stage */
phase('#anatomy', (top, h, vh) => [top - vh, top], {
  earthX: -6.0, earthY: -1.4, earthS: 0.3, orbit: 0,
  satX: 0, satY: -0.12, satS: 0.92,
});

/* inside anatomy : THE EXPLOSION */
phase('#anatomy', (top, h, vh) => [top, top + h * 0.75 - vh], { explode: 1 });
phase('#anatomy', (top, h, vh) => [top + h * 0.18, top + h * 0.42], { labels: 1 });
phase('#anatomy', (top, h, vh) => [top + h * 0.82 - vh, top + h - vh], { labels: 0 });

/* anatomy → materials : reassemble, drift to top-right */
phase('#materials', (top, h, vh) => [top - vh, top - vh * 0.25], {
  satX: 2.25, satY: 1.3, satS: 0.42, explode: 0,
});

/* materials → outro : satellite departs, Earth rises again */
phase('#outro', (top, h, vh) => [top - vh, top], {
  satY: 3.4, satX: 0.5, satS: 0.05,
  earthX: 0, earthY: -6.9, earthZ: 0, earthS: 3, orbit: 0,
});

measurePhases();
window.addEventListener('resize', measurePhases);
window.addEventListener('load', measurePhases);
window.__phases = phases;
window.__T = T;

/* --------------------------------------------------------- DOM animations */
gsap.utils.toArray('[data-reveal]').forEach((el) => {
  gsap.fromTo(el,
    { y: 44, opacity: 0 },
    { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' } });
});

gsap.utils.toArray('.count').forEach((el) => {
  const target = +el.dataset.count;
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target, duration: 1.6, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 85%' },
    onUpdate: () => { el.textContent = Math.round(obj.v); },
  });
});

/* nav background on scroll */
window.ScrollTrigger.create({
  start: 60,
  onUpdate: (self) => {
    document.querySelector('.nav').style.opacity = self.direction === 1 && self.scroll() > 200 ? 0.25 : 1;
  },
});
document.querySelector('.nav').style.transition = 'opacity .5s';

/* ------------------------------------------------------------ part labels */
const labelsWrap = document.getElementById('part-labels');
const CHIP_OFFSET = {   // px nudges so chips never collide
  dish:     [10, -30],
  panelL:   [-30, -34],
  bus:      [40, 30],
  tank:     [-80, 10],
  wheels:   [-20, -36],
  thruster: [90, 30],
  radiator: [30, -40],
};
const chips = [...document.querySelectorAll('.part-chip')].map((el, i) => ({
  el, i, anchor: labelAnchors[el.dataset.part],
  off: CHIP_OFFSET[el.dataset.part] || [0, -30],
}));
const _v = new THREE.Vector3();
const anatomyCopy = document.querySelector('#anatomy .copy');

function updateChips() {
  labelsWrap.style.opacity = P.labels;
  labelsWrap.style.visibility = P.labels < 0.02 ? 'hidden' : 'visible';
  anatomyCopy.style.opacity = Math.max(0, 1 - P.explode * 2.2);
  if (P.labels < 0.02) return;
  const w = window.innerWidth, h = window.innerHeight;
  chips.forEach(({ el, i, anchor, off }) => {
    if (!anchor) return;
    anchor.getWorldPosition(_v).project(camera);
    if (_v.z > 1) { el.style.opacity = 0; return; }
    const stagger = Math.min(1, Math.max(0, (P.labels - i * 0.06) * 2.5));
    el.style.opacity = stagger;
    const x = (_v.x * 0.5 + 0.5) * w + off[0];
    const y = (-_v.y * 0.5 + 0.5) * h + off[1];
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  });
}

/* -------------------------------------------------------------- pointer */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ----------------------------------------------------------------- tick */
const clock = new THREE.Clock();
const easeExpl = (t) => t * t * (3 - 2 * t);   // smoothstep
let lastT = 0;

function tick() {
  const t = clock.getElapsedTime();
  const dt = Math.min(Math.max(t - lastT, 0.001), 0.05);
  lastT = t;

  applyPhases();

  /* ease actual state toward scroll target (replaces GSAP scrub lag) */
  const ease = 1 - Math.exp(-4.2 * dt);
  for (const k in P) P[k] += (T[k] - P[k]) * ease;

  /* keep horizontal composition inside narrow viewports */
  const xf = Math.min(1, Math.max(0.45, camera.aspect / 1.65));

  /* earth */
  earthGroup.position.set(P.earthX * xf, P.earthY, P.earthZ);
  earthGroup.scale.setScalar(P.earthS);
  earth.rotation.y += 0.00045;
  clouds.rotation.y += 0.00058;

  /* orbits */
  orbitMats.forEach((m) => { m.opacity = P.orbit * (m.isLineBasicMaterial ? 0.9 : 1); });
  orbitDots.forEach((d) => {
    const a = t * d.speed + d.phase;
    d.dot.position.set(Math.cos(a) * d.rx, 0, -Math.sin(a) * d.ry);
    d.dot.scale.setScalar(1 / Math.max(P.earthS, 0.001) * 0.35 + 0.35);
  });
  orbitGroup.rotation.y = t * 0.02;

  /* satellite */
  const sf = Math.min(1, Math.max(0.5, camera.aspect / 1.35));
  satGroup.position.set(P.satX * xf, P.satY + Math.sin(t * 0.7) * 0.035, P.satZ);
  satGroup.scale.setScalar(P.satS * sf);
  satInner.rotation.y += 0.0026 * (1 - P.explode * 0.72);
  satInner.rotation.x = 0.18 + Math.sin(t * 0.23) * 0.04;

  const k = easeExpl(P.explode);
  parts.forEach(({ obj, home, out }) => {
    obj.position.lerpVectors(home, out, k);
  });

  /* stars parallax */
  const sp = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
  starsFar.rotation.y = t * 0.004;
  starsFar.position.y = sp * 3;
  starsNear.rotation.y = -t * 0.006;
  starsNear.position.y = sp * 6;

  /* camera drift */
  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;
  camera.position.x = mouse.x * 0.22;
  camera.position.y = -mouse.y * 0.16;
  camera.lookAt(0, 0, 0);

  updateChips();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* --------------------------------------------------------------- resize */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------- smooth anchor scrolling
   (CSS scroll-behavior:smooth breaks scroll measurements, so we do it here) */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const to = a.getAttribute('href') === '#top' ? 0 : target.offsetTop;
    window.scrollTo({ top: to, behavior: 'smooth' });
  });
});

/* --------------------------------------------------------------- loader */
function done() {
  const loader = document.getElementById('loader');
  if (loader.classList.contains('done')) return;
  loader.classList.add('done');
  window.ScrollTrigger.refresh();
}
loadManager.onLoad = () => setTimeout(done, 400);
setTimeout(done, 6000);   // fallback
