/* ============ ORBITAL — Earth · Orbit · Exploded satellite ============ */
import * as THREE from './vendor/three.module.js';
import { createBackground } from './background.js?v=2';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionQuery.matches;
let motionPaused = reducedMotion;
let selectedOrbit = -1;
let manualExplosion = null;
const narrowQuery = window.matchMedia('(max-width: 760px)');
const compactView = () => narrowQuery.matches;
const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
const clamp = THREE.MathUtils.clamp;
const smooth = (t) => t * t * (3 - 2 * t);
// Stable surface details and star placement across refreshes.
let seed = 4107;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }


/* ---------------------------------------------------------------- setup */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactView() ? 1.5 : 1.75));
renderer.setSize(viewport.width, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, viewport.width / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 7);

/* ------------------------------------------------------------- lighting */
const sun = new THREE.DirectionalLight(0xfff4e3, 3.2);
sun.position.set(-3, 5, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 25 });
sun.shadow.normalBias = 0.015;
sun.shadow.bias = -0.00015;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x547da8, 0.45);
fill.position.set(-5, -1, 2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xa7d8ff, 1.5);
rim.position.set(-3, 3, -4);
scene.add(rim);

scene.add(new THREE.AmbientLight(0x7192ad, 0.32));

const front = new THREE.PointLight(0xbdd9ee, 9, 40, 1.8);
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
const environmentSource = makeEnvMap();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromCubemap(environmentSource).texture;
environmentSource.dispose();
pmrem.dispose();

/* --------------------------------------------------------- distant space */
const background = createBackground(scene, renderer, viewport);
// Keep the established spacecraft's seeded surface details stable.
seed = 1511443769;

/* ------------------------------------------------------------------ earth */
const loadManager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(loadManager);
const srgb = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

const earthGroup = new THREE.Group();
scene.add(earthGroup);

// Day/night illumination is independent of the spacecraft studio fill lights.
const sunDirection = new THREE.Vector3(-0.85, 0.5, 0.45).normalize();
const earthMat = new THREE.ShaderMaterial({
  uniforms: {
    dayMap: { value: srgb(texLoader.load('assets/textures/earth-blue-marble.jpg')) },
    nightMap: { value: srgb(texLoader.load('assets/textures/earth-night.jpg')) },
    sunDirection: { value: sunDirection },
  },
  vertexShader: `
    varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 world = modelMatrix * vec4(position, 1.0);
      vPosition = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: `
    uniform sampler2D dayMap, nightMap;
    uniform vec3 sunDirection;
    varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(cameraPosition - vPosition);
      float light = dot(N, sunDirection);
      float day = smoothstep(-0.12, 0.20, light);
      vec3 surface = texture2D(dayMap, vUv).rgb;
      vec3 night = texture2D(nightMap, vUv).rgb;
      vec3 color = surface * (0.018 + day * (0.22 + 1.1 * max(light, 0.0)));
      color += night * vec3(1.0, 0.72, 0.42) * (1.0 - smoothstep(-0.28, 0.1, light)) * 1.2;
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      color += vec3(0.08, 0.32, 0.65) * fresnel * day * 0.65;
      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 96, 64), earthMat);
earth.rotation.set(0.12, 2.7, -0.12);
earthGroup.add(earth);

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(2.008, 80, 48),
  new THREE.MeshPhongMaterial({
    map: srgb(texLoader.load('assets/textures/earth-clouds.png')),
    transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false,
    shininess: 2,
  })
);
clouds.rotation.copy(earth.rotation);
earthGroup.add(clouds);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.02, 96, 64),
  new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { sunDirection: { value: sunDirection } },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vP = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform vec3 sunDirection; varying vec3 vN; varying vec3 vP;
      void main() {
        float facing = dot(normalize(vN), normalize(cameraPosition - vP));
        float edge = pow(max(0.0, 1.0 + facing), 6.0);
        float lit = smoothstep(-0.4, 0.6, dot(normalize(vN), sunDirection));
        gl_FragColor = vec4(mix(vec3(0.10, 0.19, 0.45), vec3(0.22, 0.57, 1.0), lit), edge * (0.06 + lit * 0.48));
      }`,
  })
);
earthGroup.add(atmosphere);

/* ------------------------------------------------- orbits: aurora ribbons
   Elliptical paths rendered as glowing tubes with energy pulses that
   travel along the orbit and breathe like an aurora.                    */
const orbitGroup = new THREE.Group();
earthGroup.add(orbitGroup);

const orbitShaders = [];
const orbitMarkers = [];
const AURORA_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const AURORA_FRAG = `
  uniform float uTime, uOp, uSpeed, uPhase, uMul, uTrail;
  uniform vec3 uColor, uColor2;
  varying vec2 vUv;
  void main() {
    float u = fract(vUv.x + uPhase);
    // two energy pulses chasing each other, comet-style exponential trails
    float d1 = fract(u - uTime * uSpeed);
    float d2 = fract(u - uTime * uSpeed + 0.47);
    float pulse = exp(-d1 * uTrail) * 1.7 + exp(-d2 * (uTrail * 1.5)) * 0.7;
    // aurora shimmer along the path
    float shimmer = 1.0;
    float i = min((0.3 + pulse * 0.65) * shimmer, 1.3);
    vec3 col = mix(uColor, uColor2, 0.5 + 0.5 * sin(u * 6.2831 + uTime * 0.55));
    gl_FragColor = vec4(col * i, i) * uOp * uMul;
  }`;

function auroraMaterial(c1, c2, speed, phase, mul, trail) {
  const uniforms = {
    uTime: { value: 0 }, uOp: { value: 0 },
    uSpeed: { value: speed }, uPhase: { value: phase },
    uMul: { value: mul }, uTrail: { value: trail },
    uColor: { value: new THREE.Color(c1) },
    uColor2: { value: new THREE.Color(c2) },
  };
  orbitShaders.push(uniforms);
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
}

function addOrbit(rx, ry, tiltX, tiltZ, c1, c2, speed, phase) {
  const g = new THREE.Group();
  g.rotation.set(tiltX, 0, tiltZ);
  const pts = [];
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * ry));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const core = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 320, 0.0045, 6, true),
    auroraMaterial(c1, c2, speed, phase, 1.0, 7.0)
  );
  const halo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 320, 0.013, 6, true),
    auroraMaterial(c1, c2, speed, phase, 0.28, 5.0)
  );
  g.add(core, halo);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), new THREE.MeshBasicMaterial({ color: c2, transparent: true }));
  g.add(marker);
  orbitMarkers.push({ marker, rx, ry, speed, phase });
  orbitGroup.add(g);
}
addOrbit(2.30, 2.30, 0.5, 0.5,  0xa894d2, 0xb4ccff, 0.045, 0.0);  // PREVENTION
addOrbit(2.52, 2.52, 1.0, -0.65, 0xd9a376, 0xffd6a2, 0.032, 0.35); // REMOVAL
addOrbit(2.72, 2.72, 1.7, 0.3, 0x99c6b6, 0xb1e0df, 0.055, 0.7);  // REUSE

/* -------------------------------------------------------------- satellite */
/* crinkled gold multi-layer-insulation foil (map + bump from one canvas) */
function mliTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, '#c8922b');
  base.addColorStop(0.5, '#e0ac45');
  base.addColorStop(1, '#a87820');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  // random facets = foil wrinkles
  for (let i = 0; i < 520; i++) {
    const x = random() * 512, y = random() * 512;
    const s = 8 + random() * 46;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (random() - 0.5) * s * 2, y + (random() - 0.5) * s * 2);
    g.lineTo(x + (random() - 0.5) * s * 2, y + (random() - 0.5) * s * 2);
    g.closePath();
    const light = random() > 0.5;
    g.fillStyle = light
      ? `rgba(255,236,190,${0.04 + random() * 0.13})`
      : `rgba(70,45,8,${0.04 + random() * 0.12})`;
    g.fill();
  }
  // kapton tape seams
  g.strokeStyle = 'rgba(90,60,12,0.35)';
  g.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* brushed / machined aluminium with panel seams and rivets */
function brushedTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#aab6c1';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) {
    const y = random() * 512;
    const x = random() * 512;
    const l = 30 + random() * 180;
    const a = 0.015 + random() * 0.05;
    g.strokeStyle = random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,55,70,${a})`;
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke();
  }
  // panel seams
  g.strokeStyle = 'rgba(35,48,60,0.5)';
  g.lineWidth = 1.5;
  [128, 300, 430].forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); });
  [170, 370].forEach((y) => { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); });
  // rivets along seams
  g.fillStyle = 'rgba(50,62,74,0.8)';
  for (let i = 0; i < 60; i++) {
    const onX = random() > 0.5;
    const seam = onX ? [128, 300, 430][Math.floor(random() * 3)] : [170, 370][Math.floor(random() * 2)];
    const t = 10 + random() * 492;
    g.beginPath();
    g.arc(onX ? seam + (random() > 0.5 ? 6 : -6) : t, onX ? t : seam + (random() > 0.5 ? 6 : -6), 1.6, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function solarCellTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#131b29';
  g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const grad = g.createLinearGradient(x * 64, y * 64, x * 64 + 64, y * 64 + 64);
      grad.addColorStop(0, '#23345e');
      grad.addColorStop(0.5, '#101a39');
      grad.addColorStop(1, '#283d64');
      g.fillStyle = grad;
      g.beginPath();
      const cx = x * 64 + 3, cy = y * 64 + 3;
      g.moveTo(cx + 6, cy); g.lineTo(cx + 52, cy); g.lineTo(cx + 58, cy + 6);
      g.lineTo(cx + 58, cy + 52); g.lineTo(cx + 52, cy + 58);
      g.lineTo(cx + 6, cy + 58); g.lineTo(cx, cy + 52); g.lineTo(cx, cy + 6);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(178,194,220,0.22)';
      for (let line = 0; line < 20; line++) g.fillRect(cx + 4, cy + 4 + line * 2.6, 50, 0.45);
      g.fillStyle = 'rgba(199,193,163,0.5)';
      g.fillRect(cx + 18, cy + 2, 0.8, 54); g.fillRect(cx + 40, cy + 2, 0.8, 54);
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

const mliTex = mliTexture();
const brushTex = brushedTexture();
const M = {
  alu: new THREE.MeshStandardMaterial({
    map: brushTex, bumpMap: brushTex, bumpScale: 0.006,
    metalness: 0.88, roughness: 0.30, envMapIntensity: 0.8,
  }),
  aluDark:  new THREE.MeshStandardMaterial({ color: 0x4a5764, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.0 }),
  gold: new THREE.MeshStandardMaterial({
    map: mliTex, bumpMap: mliTex, bumpScale: 0.055,
    metalness: 0.9, roughness: 0.38, envMapIntensity: 1.1,
  }),
  panel:    new THREE.MeshPhysicalMaterial({ map: solarCellTexture(), metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.19, envMapIntensity: 0.7 }),
  panelBack:new THREE.MeshStandardMaterial({ color: 0x293346, metalness: 0.65, roughness: 0.5 }),
  white:    new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 0.15, roughness: 0.55, envMapIntensity: 0.6 }),
  dark:     new THREE.MeshStandardMaterial({ color: 0x1c242e, metalness: 0.6,  roughness: 0.6 }),
  glowCyan: new THREE.MeshBasicMaterial({ color: 0x7fd8e8 }),
};

const satGroup = new THREE.Group();
scene.add(satGroup);
const satInner = new THREE.Group();          // rotates; parts explode inside it
satInner.rotation.set(0.3, -0.42, -0.16);
satGroup.add(satInner);

const parts = [];   // { obj, home, out, rot }
function part(obj, home, out, labelId) {
  obj.position.copy(home);
  satInner.add(obj);
  parts.push({
    obj, home: home.clone(), out: out.clone(),
    rot: obj.rotation.clone(),
  });
  if (labelId) labelAnchors[labelId] = obj;
  return obj;
}
const labelAnchors = {};

/* small surface hardware so faces never read as blank slabs */
function greeble(parent, w, h, n, z) {
  for (let i = 0; i < n; i++) {
    const kind = random();
    let m;
    if (kind < 0.5) {
      m = new THREE.Mesh(
        new THREE.BoxGeometry(0.05 + random() * 0.1, 0.04 + random() * 0.08, 0.03),
        random() > 0.4 ? M.aluDark : M.dark
      );
    } else if (kind < 0.8) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.045, 10), M.alu);
      m.rotation.x = Math.PI / 2;
    } else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), M.gold);
      m.rotation.x = Math.PI / 2;
    }
    m.position.set((random() - 0.5) * w, (random() - 0.5) * h, z);
    parent.add(m);
  }
}

/* — bus core (stays) — */
const core = new THREE.Group();
const coreBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.62), M.aluDark);
core.add(coreBox);
const coreEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.64, 0.94, 0.64)),
  new THREE.LineBasicMaterial({ color: 0x7fd8e8, transparent: true, opacity: 0.35 })
);
core.add(coreEdges);
// longeron rails — the primary frame that remains when the skin flies off
for (const [lx, lz] of [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.46, 0.06), M.alu);
  rail.position.set(lx, 0, lz);
  core.add(rail);
}
// wiring harness across the core
for (let i = 0; i < 3; i++) {
  const wire = new THREE.Mesh(
    new THREE.TorusGeometry(0.34 + i * 0.02, 0.008, 6, 40, Math.PI * 1.2),
    i === 1 ? M.gold : M.dark
  );
  wire.rotation.set(Math.PI / 2, 0, i * 1.9);
  wire.position.y = -0.2 + i * 0.24;
  core.add(wire);
}
part(core, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), 'bus');

/* — internal electronics (revealed by the explosion) — */
[
  [0xbfc9d2, new THREE.Vector3(0.1, 0.3, 0.1),   new THREE.Vector3(0.7, 0.75, 0.85)],
  [0xd9a437, new THREE.Vector3(-0.1, 0, -0.05),  new THREE.Vector3(-0.8, 0.3, 0.85)],
  [0x8f9aa5, new THREE.Vector3(0.05, -0.3, -0.1), new THREE.Vector3(0.85, -0.4, -0.8)],
].forEach(([col, home, out]) => {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.2, 0.26),
    new THREE.MeshStandardMaterial({ color: col, metalness: 0.85, roughness: 0.35 })
  );
  part(b, home, out);
});

/* — six bus face plates (fly outward along face normals) — */
const plateGeoXY = new THREE.BoxGeometry(1.06, 1.42, 0.045);
const plateGeoTB = new THREE.BoxGeometry(1.06, 0.045, 1.06);

const frontPlate = new THREE.Group();
frontPlate.add(new THREE.Mesh(plateGeoXY, M.alu));
greeble(frontPlate, 0.8, 1.1, 9, 0.045);
part(frontPlate, new THREE.Vector3(0, 0,  0.53), new THREE.Vector3(0, 0, 1.55));

part(new THREE.Mesh(plateGeoXY, M.gold), new THREE.Vector3(0, 0, -0.53), new THREE.Vector3(0, 0, -1.55));
const plateGeoZY = new THREE.BoxGeometry(0.045, 1.42, 1.06);
part(new THREE.Mesh(plateGeoZY, M.gold), new THREE.Vector3( 0.53, 0, 0), new THREE.Vector3( 1.55, 0, 0));

part(new THREE.Mesh(plateGeoZY, M.alu), new THREE.Vector3(-0.53, 0, 0), new THREE.Vector3(-1.55, 0, 0));

/* top plate carries patch antennas + GPS hardware */
const topPlate = new THREE.Group();
topPlate.add(new THREE.Mesh(plateGeoTB, M.alu));
for (const [px, pz] of [[-0.3, 0.28], [0.05, -0.3], [0.32, 0.12]]) {
  const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.035, 18), M.white);
  patch.position.set(px, 0.04, pz);
  topPlate.add(patch);
  const patchTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 18), M.gold);
  patchTop.position.set(px, 0.062, pz);
  topPlate.add(patchTop);
}
part(topPlate, new THREE.Vector3(0,  0.74, 0), new THREE.Vector3(0,  1.55, 0));

part(new THREE.Mesh(plateGeoTB, M.aluDark), new THREE.Vector3(0, -0.74, 0), new THREE.Vector3(0, -1.55, 0));

/* — launch adapter ring (bottom interface to the rocket) — */
const adapter = new THREE.Group();
const ringGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.14, 36, 1, true);
const ring = new THREE.Mesh(ringGeo, M.alu.clone());
ring.material.side = THREE.DoubleSide;
adapter.add(ring);
const ringLip = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 10, 40), M.aluDark);
ringLip.rotation.x = Math.PI / 2;
ringLip.position.y = -0.07;
adapter.add(ringLip);
// separation bolts
for (let i = 0; i < 8; i++) {
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 8), M.dark);
  const a = (i / 8) * Math.PI * 2;
  bolt.position.set(Math.cos(a) * 0.32, -0.07, Math.sin(a) * 0.32);
  adapter.add(bolt);
}
part(adapter, new THREE.Vector3(0, -0.62, 0), new THREE.Vector3(0, -1.9, 0));

/* — solar wings — */
function wing(side) {
  const w = new THREE.Group();
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), M.aluDark);
  yoke.rotation.z = Math.PI / 2;
  yoke.position.x = side * 0.25;
  w.add(yoke);
  // deployment struts back to the bus
  for (const dy of [-0.18, 0.18]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.54, 8), M.alu);
    strut.position.set(side * 0.26, dy / 2, 0.02);
    strut.rotation.z = Math.PI / 2 + side * (dy > 0 ? 0.32 : -0.32);
    w.add(strut);
  }
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.5, 0.028), [M.aluDark, M.aluDark, M.aluDark, M.aluDark, M.panel, M.panelBack]);
    p.position.set(side * (0.9 + i * 0.82), 0, 0);
    p.rotation.x = -0.06;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.5, 0.006), M.panelBack);
    back.position.z = -0.018;
    p.add(back);
    // frame rails around each panel
    const frameMat = M.aluDark;
    const railH = new THREE.BoxGeometry(0.82, 0.03, 0.04);
    const railV = new THREE.BoxGeometry(0.03, 1.54, 0.04);
    for (const dy of [-0.755, 0.755]) {
      const r = new THREE.Mesh(railH, frameMat);
      r.position.set(0, dy, -0.004);
      p.add(r);
    }
    for (const dx of [-0.395, 0.395]) {
      const r = new THREE.Mesh(railV, frameMat);
      r.position.set(dx, 0, -0.004);
      p.add(r);
    }
    w.add(p);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), M.alu);
    hinge.position.set(side * (0.49 + i * 0.82), 0, 0);
    hinge.rotation.z = Math.PI / 2;
    w.add(hinge);
  }
  return w;
}
part(wing(1),  new THREE.Vector3( 0.53, 0.05, 0), new THREE.Vector3( 2.2, 0.05, 0));
part(wing(-1), new THREE.Vector3(-0.53, 0.05, 0), new THREE.Vector3(-2.2, -0.05, 0), 'panelL');

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
part(dishGroup, new THREE.Vector3(0, 0.86, 0), new THREE.Vector3(0, 2.15, 0), 'dish');

/* — antennas — */
function whip(lean = 0) {
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
part(whip(0.28), new THREE.Vector3( 0.42, 0.74,  0.42), new THREE.Vector3( 1.15, 1.95,  1.05));
part(whip(-0.28), new THREE.Vector3(-0.42, 0.74, -0.42), new THREE.Vector3(-1.15, 1.95, -1.05));

/* — propellant tank + plumbing — */
const tankGroup = new THREE.Group();
const tank = new THREE.Mesh(new THREE.SphereGeometry(0.27, 28, 28), M.gold);
tankGroup.add(tank);
const strap = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 10, 40), M.aluDark);
strap.rotation.x = Math.PI / 2;
tankGroup.add(strap);
part(tankGroup, new THREE.Vector3(0, -0.18, 0.05), new THREE.Vector3(1.25, -0.85, 1.2), 'tank');

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
part(wheels, new THREE.Vector3(-0.05, 0.3, -0.05), new THREE.Vector3(-1.2, 0.95, -1.1), 'wheels');

/* — thruster — */
const thrusterGroup = new THREE.Group();
const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.16, 0.3, 32, 1, true), M.aluDark);
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
part(thrusterGroup, new THREE.Vector3(0, -0.92, 0), new THREE.Vector3(0, -2.35, 0), 'thruster');

/* — radiators — clear of the bus face plates */
const radGeo = new THREE.BoxGeometry(0.55, 1.05, 0.02);
part(new THREE.Mesh(radGeo, M.white), new THREE.Vector3(0.2, 0, 0.56), new THREE.Vector3(0.7, 0.4, 2.05), 'radiator');
part(new THREE.Mesh(radGeo, M.white), new THREE.Vector3(-0.2, 0, -0.56), new THREE.Vector3(-0.7, -0.4, -2.05));

/* — star tracker + sensor — */
const tracker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 14), M.dark);
tracker.rotation.x = 0.8;
part(tracker, new THREE.Vector3(0.3, 0.72, -0.25), new THREE.Vector3(0.95, 1.7, -0.9));
const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 18), M.dark.clone());
lens.rotation.x = Math.PI / 2;
part(lens, new THREE.Vector3(-0.25, -0.35, 0.56), new THREE.Vector3(-0.95, -0.9, 1.5));

/* — Flight hardware: reflector supports, fasteners, radiator fins, cable runs — */
function strutBetween(parent, from, to, radius, material) {
  const delta = new THREE.Vector3().subVectors(to, from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  parent.add(mesh);
  return mesh;
}
const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.012, 8, 80), M.alu);
rimRing.rotation.x = Math.PI / 2;
rimRing.position.y = 0.52 * 0.52 * 0.9;
dishGroup.add(rimRing);
for (let i = 0; i < 3; i++) {
  const a = i / 3 * Math.PI * 2;
  strutBetween(dishGroup, new THREE.Vector3(Math.cos(a) * 0.46, 0.2, Math.sin(a) * 0.46), new THREE.Vector3(0, 0.46, 0), 0.008, M.aluDark);
}
// Repeated bolts use instancing, keeping the hardware detail inexpensive.
const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6), M.aluDark, 28);
const boltPose = new THREE.Object3D();
let boltIndex = 0;
for (const side of [-1, 1]) {
  for (let i = 0; i < 7; i++) {
    boltPose.position.set(side * 0.475, -0.63 + i * 0.21, 0.032);
    boltPose.rotation.x = Math.PI / 2; boltPose.updateMatrix();
    bolts.setMatrixAt(boltIndex++, boltPose.matrix);
    boltPose.position.set(-0.42 + i * 0.14, side * 0.65, 0.032); boltPose.updateMatrix();
    bolts.setMatrixAt(boltIndex++, boltPose.matrix);
  }
}
frontPlate.add(bolts);
for (const x of [-0.46, 0.46]) {
  for (const y of [-0.57, 0.57]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.055), M.alu);
    bracket.position.set(x, y, 0.045); frontPlate.add(bracket);
  }
}
const radiator = labelAnchors.radiator;
for (let i = 0; i < 9; i++) {
  const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.012, 0.012), M.alu);
  pipe.position.set(0, -0.44 + i * 0.11, 0.018); radiator.add(pipe);
}
for (let i = 0; i < 3; i++) {
  const points = [new THREE.Vector3(-0.36 + i * 0.04, 0.59, 0.055), new THREE.Vector3(-0.34 + i * 0.04, 0.24, 0.075), new THREE.Vector3(-0.22 + i * 0.04, 0.05, 0.075), new THREE.Vector3(-0.22 + i * 0.04, -0.48, 0.06)];
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.007, 5, false), i === 1 ? M.gold : M.dark);
  frontPlate.add(cable);
}
// Fine folds deform the insulation itself, so highlights follow the surface.
function blanketGeometry(width, height, depth) {
  const geo = new THREE.BoxGeometry(width, height, depth, width < 0.1 ? 1 : 20, 24, depth < 0.1 ? 1 : 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const fold = (Math.sin(y * 63 + x * 39 + z * 47) * Math.sin(y * 29 - x * 43 + z * 21)) * 0.009;
    if (depth < 0.1) pos.setZ(i, z + fold);
    else pos.setX(i, x + fold);
  }
  geo.computeVertexNormals();
  return geo;
}
parts.forEach(({obj}) => {
  if (obj.isMesh && obj.material === M.gold && obj.geometry.type === 'BoxGeometry') {
    const {width, height, depth} = obj.geometry.parameters;
    obj.geometry = blanketGeometry(width, height, depth);
  }
});
satInner.traverse((obj) => {
  if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
});

/* ------------------------------------------------------ scroll composition */
const desktopBase = { earthX: 2.2, earthY: -3.5, earthZ: 0, earthS: 2.05, satX: 1.6, satY: 0, satZ: 0, satS: 0.001, orbit: 0, explode: 0, labels: 0 };
const mobileBase = { ...desktopBase, earthX: 0.65, earthY: -3.2, earthS: 1.55 };
const P = { ...desktopBase }, T = { ...P };
const phases = [];
function phase(selector, rangeFn, desktop, mobile = {}) {
  phases.push({ el: document.querySelector(selector), rangeFn, desktop, mobile, from: {}, delta: {}, a: 0, b: 1 });
}
phase('#mission', (top, h, vh) => [top - vh, top],
  { earthX: 1.6, earthY: -0.12, earthS: 0.72, orbit: 1 },
  { earthX: 0, earthY: -1.52, earthS: 0.39 });
phase('#spacecraft', (top, h, vh) => [top - vh, top],
  { earthX: -2.2, earthY: -5.2, earthS: 1.65, orbit: 0, satX: 1.6, satY: 0.15, satS: 0.58 },
  { earthX: -0.7, earthY: -4.8, earthS: 1.25, satX: 0, satY: -0.25, satS: 0.32 });
phase('#spacecraft', (top, h, vh) => [top, top + h - vh],
  { satS: 0.68, satX: 1.5, satY: 0.2 }, { satS: 0.36, satX: 0, satY: -0.35 });
phase('#anatomy', (top, h, vh) => [top - vh, top],
  { earthX: -6, earthY: -5, earthS: 0.4, satX: 0, satY: -0.35, satS: 0.7 },
  { satX: 0, satY: -0.1, satS: 0.33 });
phase('#anatomy', (top, h, vh) => [top + vh * 0.1, top + h - vh * 1.3],
  { explode: 1, satS: 0.57, labels: 1 }, { satS: 0.22 });
phase('#materials', (top, h, vh) => [top - vh, top],
  { satX: 3, satY: 1.4, satS: 0.001, explode: 0, labels: 0 }, { satX: 2, satS: 0.001 });
phase('#outro', (top, h, vh) => [top - vh, top],
  { ...desktopBase, satS: 0.001, earthX: 0, earthY: -6.5, earthS: 2.2 },
  { ...mobileBase, satS: 0.001, earthY: -5.0 });
let documentHeight = 1;
function measurePhases() {
  const vh = window.innerHeight;
  let cursor = { ...(compactView() ? mobileBase : desktopBase) };
  for (const ph of phases) {
    ph.from = { ...cursor };
    ph.delta = { ...ph.desktop, ...(compactView() ? ph.mobile : {}) };
    if (compactView() && ph.el.id === 'mission') {
      const sticky = ph.el.querySelector('.sticky');
      const copyBottom = parseFloat(getComputedStyle(sticky).paddingTop) + ph.el.querySelector('.copy').offsetHeight;
      const available = Math.max(130, vh - copyBottom - 24);
      const worldHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      ph.delta.earthY = -(copyBottom + available / 2 - vh / 2) / vh * worldHeight;
      ph.delta.earthS = Math.min(0.41, available / vh * worldHeight / 6.1);
    }
    Object.assign(cursor, ph.delta);
    [ph.a, ph.b] = ph.rangeFn(ph.el.offsetTop, ph.el.offsetHeight, vh);
  }
  documentHeight = Math.max(1, document.documentElement.scrollHeight - vh);
}
function applyPhases() {
  Object.assign(T, compactView() ? mobileBase : desktopBase);
  const y = window.scrollY;
  for (const ph of phases) {
    const progress = smooth(clamp((y - ph.a) / Math.max(1, ph.b - ph.a), 0, 1));
    if (progress <= 0) continue;
    for (const key in ph.delta) T[key] = THREE.MathUtils.lerp(ph.from[key], ph.delta[key], progress);
  }
  if (manualExplosion !== null) {
    T.explode = manualExplosion;
    T.labels = manualExplosion;
    T.satS = compactView() ? THREE.MathUtils.lerp(0.33, 0.22, manualExplosion) : THREE.MathUtils.lerp(0.7, 0.57, manualExplosion);
  }
}
measurePhases();
applyPhases();
Object.assign(P, T);

/* ------------------------------------------------------------- interface */
const motionButton = document.querySelector('.motion-toggle');
function updateMotionButton() {
  motionButton.setAttribute('aria-pressed', String(motionPaused));
  motionButton.setAttribute('aria-label', motionPaused ? 'Resume ambient animation' : 'Pause ambient animation');
  motionButton.textContent = motionPaused ? 'RESUME MOTION' : 'PAUSE MOTION';
  document.body.classList.toggle('motion-paused', motionPaused);
}
motionButton.addEventListener('click', () => { motionPaused = !motionPaused; updateMotionButton(); });
motionQuery.addEventListener('change', (event) => {
  reducedMotion = event.matches; motionPaused = reducedMotion; updateMotionButton();
});
updateMotionButton();

const nav = document.querySelector('.nav');
document.querySelectorAll('.orbit-option').forEach((button) => {
  button.addEventListener('click', () => {
    const index = Number(button.dataset.orbit);
    selectedOrbit = selectedOrbit === index ? -1 : index;
    document.querySelectorAll('.orbit-option').forEach((item) => item.setAttribute('aria-pressed', String(Number(item.dataset.orbit) === selectedOrbit)));
  });
});
const assembly = document.getElementById('assembly');
assembly.addEventListener('input', () => { manualExplosion = Number(assembly.value) / 100; });
window.addEventListener('scroll', () => { manualExplosion = null; }, { passive: true });

// Reveal normal content once, keeping it readable when navigating in either direction.
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(({target, isIntersecting}) => {
    if (!isIntersecting) return;
    target.classList.add('revealed'); revealObserver.unobserve(target);
  });
}, { threshold: 0.12 });
document.body.classList.add('reveal-ready');
document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));
document.querySelectorAll('.count').forEach((el) => { el.textContent = el.dataset.count; });

const chapterElements = [...document.querySelectorAll('main > section')];
const navLinks = [...document.querySelectorAll('.nav-links a')];
const progressBar = document.querySelector('.reading-progress span');
let chapterPositions = [];
function measureChapters() { chapterPositions = chapterElements.map((el) => ({ id: el.id, top: el.offsetTop })); }
measureChapters();
let activeChapter = '';
function updateNavigation() {
  const y = window.scrollY;
  progressBar.style.transform = `scaleX(${clamp(y / documentHeight, 0, 1)})`;
  nav.classList.toggle('scrolled', y > 40);
  let chapter = 'hero';
  for (const section of chapterPositions) if (y + window.innerHeight * 0.4 >= section.top) chapter = section.id;
  if (chapter !== activeChapter) {
    activeChapter = chapter;
    document.body.dataset.chapter = chapter;
    navLinks.forEach((link) => {
      if (link.hash === '#' + chapter) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
}

/* ------------------------------------------------------ annotation layout */
const labelsWrap = document.getElementById('part-labels');
const svgNS = 'http://www.w3.org/2000/svg';
const leaderLayer = document.createElementNS(svgNS, 'svg');
leaderLayer.classList.add('label-leaders');
leaderLayer.setAttribute('aria-hidden', 'true');
labelsWrap.prepend(leaderLayer);
const chips = [...document.querySelectorAll('.part-chip')].map((el) => {
  const leader = document.createElementNS(svgNS, 'path');
  const dot = document.createElementNS(svgNS, 'circle');
  dot.setAttribute('r', '2');
  leaderLayer.append(leader, dot);
  const offset = el.dataset.part === 'panelL' ? new THREE.Vector3(-1.7, 0, 0) : new THREE.Vector3();
  return { el, anchor: labelAnchors[el.dataset.part], offset, leader, dot, width: el.offsetWidth };
});
const vector = new THREE.Vector3();
function updateChips() {
  const visible = activeChapter === 'anatomy' && P.labels > 0.12;
  labelsWrap.style.opacity = visible ? clamp((P.labels - 0.12) * 3, 0, 1) : 0;
  labelsWrap.style.visibility = visible ? 'visible' : 'hidden';
  const w = viewport.width, h = window.innerHeight;
  if (visible) {
    leaderLayer.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // Two ordered columns avoid collisions regardless of camera orientation.
    const left = [], right = [];
    chips.forEach((chip) => {
      chip.anchor.localToWorld(vector.copy(chip.offset)).project(camera);
      chip.x = (vector.x * 0.5 + 0.5) * w;
      chip.y = (-vector.y * 0.5 + 0.5) * h;
      (chip.x < w * 0.5 ? left : right).push(chip);
    });
    [left, right].forEach((column, side) => {
      column.sort((a,b) => a.y - b.y);
      const gap = compactView() ? 50 : 67;
      column.forEach((chip, i) => {
        const y = clamp(h * 0.51 - (column.length - 1) * gap / 2 + i * gap, 210, h - 130);
        const x = side === 0 ? (compactView() ? 14 : w * 0.075) : (compactView() ? w - 14 : w * 0.925);
        chip.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${side ? '-100%' : '0'}, -50%)`;
        chip.el.classList.toggle('label-right', side === 1);
        const startX = x + (side === 0 ? chip.width : -chip.width);
        const bendX = startX + (side === 0 ? 20 : -20);
        chip.leader.setAttribute('d', `M ${startX} ${y} L ${bendX} ${y} L ${chip.x.toFixed(1)} ${chip.y.toFixed(1)}`);
        chip.dot.setAttribute('cx', chip.x.toFixed(1));
        chip.dot.setAttribute('cy', chip.y.toFixed(1));
      });
    });
  }
  if (document.activeElement !== assembly) assembly.value = String(Math.round(P.explode * 100));
  assembly.setAttribute('aria-valuetext', `${Math.round(P.explode * 100)} percent exploded`);
}

/* ----------------------------------------------------- pointer + rendering */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || compactView()) return;
  mouse.tx = (event.clientX / viewport.width - 0.5) * 2;
  mouse.ty = (event.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = 0; });
let lastTime = 0, elapsed = 0, frameId = 0;
let contextLost = false;
function tick(now) {
  frameId = 0;
  if (document.hidden || contextLost) return;
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
  lastTime = now;
  if (!motionPaused) elapsed += dt;
  const t = elapsed;
  applyPhases();
  const ease = reducedMotion ? 1 : 1 - Math.exp(-7.5 * dt);
  for (const key in P) P[key] += (T[key] - P[key]) * ease;
  const sceneFit = compactView() ? Math.min(1, camera.aspect / (390 / 844)) : Math.min(1, camera.aspect / 1.65);
  const earthFit = compactView() || P.earthS > 1 ? 1 : sceneFit;
  earthGroup.position.set(P.earthX * (compactView() ? 1 : sceneFit), P.earthY, P.earthZ);
  earthGroup.scale.setScalar(P.earthS * earthFit);
  earth.rotation.y = 2.7 + t * 0.012;
  clouds.rotation.y = 2.7 + t * 0.015;
  orbitShaders.forEach((uniforms, i) => {
    uniforms.uTime.value = t;
    const target = P.orbit * (selectedOrbit < 0 || selectedOrbit === Math.floor(i / 2) ? 0.8 : 0.09);
    uniforms.uOp.value += (target - uniforms.uOp.value) * (1 - Math.exp(-8 * dt));
  });
  orbitMarkers.forEach(({marker, rx, ry, speed, phase}, i) => {
    const angle = (t * speed - phase) * Math.PI * 2;
    marker.position.set(Math.cos(angle) * rx, 0, Math.sin(angle) * ry);
    marker.material.opacity = P.orbit * (selectedOrbit < 0 || selectedOrbit === i ? 1 : 0.12);
  });
  // Orbital planes remain stable rather than rotating like decorative hoops.
  orbitGroup.rotation.y = -0.22;
  satGroup.position.set(P.satX * sceneFit, P.satY, P.satZ);
  satGroup.scale.setScalar(P.satS * sceneFit);
  const hold = 1 - P.explode;
  satInner.rotation.set(0.3 + Math.sin(t * 0.15) * 0.035 * hold, -0.42 + Math.sin(t * 0.13) * 0.14 * hold, -0.16);
  parts.forEach(({obj, home, out, rot}) => {
    // Small offsets reveal outer structures before the internal systems.
    const delay = home.length() < 0.5 ? 0.12 : 0;
    const progress = smooth(clamp((P.explode - delay) / (1 - delay), 0, 1));
    obj.position.lerpVectors(home, out, progress);
    obj.rotation.copy(rot);
  });
  const pointerEase = 1 - Math.exp(-5 * dt);
  const pointerStrength = motionPaused ? 0 : 1;
  mouse.x += (mouse.tx * pointerStrength - mouse.x) * pointerEase;
  mouse.y += (mouse.ty * pointerStrength - mouse.y) * pointerEase;
  background.update({ dt, scrollY: window.scrollY, pointerX: mouse.x, pointerY: mouse.y,
    paused: motionPaused, reducedMotion });
  camera.position.x = mouse.x * 0.09;
  camera.position.y = -mouse.y * 0.065;
  camera.lookAt(0, 0, 0);
  updateNavigation();
  scene.updateMatrixWorld();
  updateChips();
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(tick);
}
function resumeRendering() {
  lastTime = 0;
  if (!frameId && !document.hidden && !contextLost) frameId = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
  else resumeRendering();
});
canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); contextLost = true; cancelAnimationFrame(frameId); frameId = 0; });
canvas.addEventListener('webglcontextrestored', () => { contextLost = false; resumeRendering(); });
function resize() {
  viewport.width = document.documentElement.clientWidth;
  viewport.height = window.innerHeight;
  chips.forEach((chip) => { chip.width = chip.el.offsetWidth; });
  camera.aspect = viewport.width / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactView() ? 1.5 : 1.75));
  renderer.setSize(viewport.width, window.innerHeight);
  background.resize();
  measurePhases(); measureChapters();
}
window.addEventListener('resize', resize);
window.addEventListener('load', resize);
if (document.fonts) document.fonts.ready.then(resize);
resumeRendering();

function done() { document.getElementById('loader').classList.add('done'); }
loadManager.onLoad = done;
loadManager.onError = done;
setTimeout(done, 4500);
