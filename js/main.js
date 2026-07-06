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

/* --------------------------------------------------------------- cosmos
   Layered starfields (soft sprites), bright flare stars, procedural
   nebulae and a milky-way band — everything additive, cheap, deep.   */
const cosmos = new THREE.Group();
scene.add(cosmos);

function starSprite(flare) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(230,242,255,0.55)');
  grad.addColorStop(1, 'rgba(200,225,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  if (flare) {
    g.globalCompositeOperation = 'lighter';
    const beam = (w, l) => {
      const b = g.createLinearGradient(32 - l, 32, 32 + l, 32);
      b.addColorStop(0, 'rgba(255,255,255,0)');
      b.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      b.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = b;
      g.fillRect(32 - l, 32 - w / 2, l * 2, w);
    };
    beam(2.5, 30);
    g.save(); g.translate(32, 32); g.rotate(Math.PI / 2); g.translate(-32, -32);
    beam(2.5, 30);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const softTex = starSprite(false);
const flareTex = starSprite(true);

function makeStars(count, spread, size, color, opacity, tex) {
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
    size, color, transparent: true, opacity, map: tex,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}
const starsFar  = makeStars(3600, 110, 0.34, 0xdfeaf7, 0.85, softTex);
const starsMid  = makeStars(1400, 75,  0.5,  0x9fc4e8, 0.6,  softTex);
const starsNear = makeStars(520,  52,  0.75, 0x7fd8e8, 0.45, softTex);
const starsWarm = makeStars(260,  85,  0.55, 0xffd9a8, 0.5,  softTex);
const starsBig  = makeStars(70,   65,  2.4,  0xffffff, 0.85, flareTex);
cosmos.add(starsFar, starsMid, starsNear, starsWarm, starsBig);

/* — nebulae — */
function nebulaTexture(palette) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 38; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const r = 40 + Math.random() * 150;
    const col = palette[Math.floor(Math.random() * palette.length)];
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, col.replace('A', (0.05 + Math.random() * 0.09).toFixed(3)));
    grad.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
  }
  // radial fade so the plane dissolves into space instead of ending
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createRadialGradient(256, 256, 130, 256, 256, 356);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const nebulaMats = [];
function addNebula(tex, size, x, y, z, rot, op) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: op,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mat.userData.baseOp = op;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.position.set(x, y, z);
  m.rotation.z = rot;
  nebulaMats.push(mat);
  cosmos.add(m);
  return m;
}
const nebCyan   = nebulaTexture(['rgba(45,110,150,A)', 'rgba(30,150,160,A)', 'rgba(60,130,190,A)']);
const nebPurple = nebulaTexture(['rgba(90,60,180,A)', 'rgba(60,70,190,A)', 'rgba(130,60,160,A)']);
const nebDeep   = nebulaTexture(['rgba(35,70,120,A)', 'rgba(50,60,140,A)', 'rgba(25,90,120,A)']);
addNebula(nebDeep,  420, 0, 0, -95, 0.2, 0.32);   // full-sky base wash — no gaps
addNebula(nebCyan,   70, -24, 10, -58, 0.5, 0.42);
addNebula(nebPurple, 85,  26, -8, -66, -0.8, 0.36);
addNebula(nebCyan,   45,   6, 18, -50, 1.9, 0.26);

/* — milky-way band — */
function milkyWayTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  const glow = g.createLinearGradient(0, 106, 0, 406);
  glow.addColorStop(0, 'rgba(120,160,210,0)');
  glow.addColorStop(0.5, 'rgba(150,185,225,0.16)');
  glow.addColorStop(1, 'rgba(120,160,210,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 2048, 512);
  for (let i = 0; i < 5200; i++) {
    // gaussian-ish spread around the band's center line
    const y = 256 + (Math.random() + Math.random() + Math.random() - 1.5) * 130;
    const x = Math.random() * 2048;
    const r = Math.random() * 1.15;
    const a = 0.04 + Math.random() * 0.3;
    const warm = Math.random() < 0.12;
    g.fillStyle = warm ? `rgba(255,214,170,${a})` : `rgba(215,232,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // dark dust lanes
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 14; i++) {
    const y = 200 + Math.random() * 120, w = 200 + Math.random() * 600;
    const x = Math.random() * 2048;
    const dust = g.createRadialGradient(x, y, 0, x, y, w / 2);
    dust.addColorStop(0, 'rgba(4,8,14,0.35)');
    dust.addColorStop(1, 'rgba(4,8,14,0)');
    g.fillStyle = dust;
    g.save(); g.translate(x, y); g.scale(1, 0.22); g.translate(-x, -y);
    g.fillRect(x - w, y - w, w * 2, w * 2);
    g.restore();
  }
  // fade every edge of the band so the plane boundary never shows
  g.globalCompositeOperation = 'destination-out';
  let f = g.createLinearGradient(0, 0, 300, 0);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = f; g.fillRect(0, 0, 300, 512);
  f = g.createLinearGradient(2048, 0, 1748, 0);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = f; g.fillRect(1748, 0, 300, 512);
  f = g.createLinearGradient(0, 0, 0, 90);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = f; g.fillRect(0, 0, 2048, 90);
  f = g.createLinearGradient(0, 512, 0, 422);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = f; g.fillRect(0, 422, 2048, 90);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const milkyWay = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 60),
  new THREE.MeshBasicMaterial({
    map: milkyWayTexture(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
);
milkyWay.position.set(0, 14, -80);
milkyWay.rotation.z = -0.32;
cosmos.add(milkyWay);

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

/* ------------------------------------------------- orbits: aurora ribbons
   Elliptical paths rendered as glowing tubes with energy pulses that
   travel along the orbit and breathe like an aurora.                    */
const orbitGroup = new THREE.Group();
earthGroup.add(orbitGroup);

const orbitShaders = [];
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
    float shimmer = 0.82 + 0.18 * sin(u * 52.0 - uTime * 2.6)
                         * sin(u * 17.0 + uTime * 1.3);
    float i = min((0.16 + pulse) * shimmer, 1.3);
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
    new THREE.TubeGeometry(curve, 320, 0.014, 8, true),
    auroraMaterial(c1, c2, speed, phase, 1.0, 7.0)
  );
  const halo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 320, 0.052, 8, true),
    auroraMaterial(c1, c2, speed, phase, 0.28, 5.0)
  );
  g.add(core, halo);
  orbitGroup.add(g);
}
addOrbit(3.15, 2.55, 1.25, 0.5,  0x8b5cf6, 0x4ea0ff, 0.045, 0.0);  // PREVENTION
addOrbit(3.55, 2.75, 1.05, -0.45, 0xff8a3d, 0xffc78a, 0.032, 0.35); // REMOVAL
addOrbit(2.85, 2.85, 1.45, 0.15, 0x35e08a, 0x7fd8e8, 0.055, 0.7);  // REUSE

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
    const x = Math.random() * 512, y = Math.random() * 512;
    const s = 8 + Math.random() * 46;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * s * 2, y + (Math.random() - 0.5) * s * 2);
    g.lineTo(x + (Math.random() - 0.5) * s * 2, y + (Math.random() - 0.5) * s * 2);
    g.closePath();
    const light = Math.random() > 0.5;
    g.fillStyle = light
      ? `rgba(255,236,190,${0.04 + Math.random() * 0.13})`
      : `rgba(70,45,8,${0.04 + Math.random() * 0.12})`;
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
    const y = Math.random() * 512;
    const x = Math.random() * 512;
    const l = 30 + Math.random() * 180;
    const a = 0.015 + Math.random() * 0.05;
    g.strokeStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,55,70,${a})`;
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
    const onX = Math.random() > 0.5;
    const seam = onX ? [128, 300, 430][Math.floor(Math.random() * 3)] : [170, 370][Math.floor(Math.random() * 2)];
    const t = 10 + Math.random() * 492;
    g.beginPath();
    g.arc(onX ? seam + (Math.random() > 0.5 ? 6 : -6) : t, onX ? t : seam + (Math.random() > 0.5 ? 6 : -6), 1.6, 0, Math.PI * 2);
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

const mliTex = mliTexture();
const brushTex = brushedTexture();
const M = {
  alu: new THREE.MeshStandardMaterial({
    map: brushTex, bumpMap: brushTex, bumpScale: 0.006,
    metalness: 0.85, roughness: 0.34, envMapIntensity: 1.2,
  }),
  aluDark:  new THREE.MeshStandardMaterial({ color: 0x4a5764, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.0 }),
  gold: new THREE.MeshStandardMaterial({
    map: mliTex, bumpMap: mliTex, bumpScale: 0.02,
    metalness: 0.95, roughness: 0.33, envMapIntensity: 1.45,
  }),
  panel:    new THREE.MeshStandardMaterial({ map: solarCellTexture(), metalness: 0.85, roughness: 0.24, envMapIntensity: 1.5 }),
  panelBack:new THREE.MeshStandardMaterial({ color: 0x8f9aa5, metalness: 0.8, roughness: 0.5 }),
  white:    new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 0.15, roughness: 0.55, envMapIntensity: 0.6 }),
  dark:     new THREE.MeshStandardMaterial({ color: 0x1c242e, metalness: 0.6,  roughness: 0.6 }),
  glowCyan: new THREE.MeshBasicMaterial({ color: 0x7fd8e8 }),
};

const satGroup = new THREE.Group();
scene.add(satGroup);
const satInner = new THREE.Group();          // rotates; parts explode inside it
satInner.rotation.set(0.32, 0.85, -0.22);
satGroup.add(satInner);

const parts = [];   // { obj, home, out, rot, spin }
function part(obj, home, out, labelId) {
  obj.position.copy(home);
  satInner.add(obj);
  const still = out.lengthSq() === 0;
  parts.push({
    obj, home: home.clone(), out: out.clone(),
    rot: obj.rotation.clone(),
    // gentle tumble as the part drifts free (anchored parts stay true)
    spin: still ? new THREE.Vector3() : new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
    ),
  });
  if (labelId) labelAnchors[labelId] = obj;
  return obj;
}
const labelAnchors = {};

/* small surface hardware so faces never read as blank slabs */
function greeble(parent, w, h, n, z) {
  for (let i = 0; i < n; i++) {
    const kind = Math.random();
    let m;
    if (kind < 0.5) {
      m = new THREE.Mesh(
        new THREE.BoxGeometry(0.05 + Math.random() * 0.1, 0.04 + Math.random() * 0.08, 0.03),
        Math.random() > 0.4 ? M.aluDark : M.dark
      );
    } else if (kind < 0.8) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.045, 10), M.alu);
      m.rotation.x = Math.PI / 2;
    } else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), M.gold);
      m.rotation.x = Math.PI / 2;
    }
    m.position.set((Math.random() - 0.5) * w, (Math.random() - 0.5) * h, z);
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

const frontPlate = new THREE.Group();
frontPlate.add(new THREE.Mesh(plateGeoXY, M.alu));
greeble(frontPlate, 0.8, 1.1, 9, 0.045);
part(frontPlate, new THREE.Vector3(0, 0,  0.53), new THREE.Vector3(0, -0.15, 1.35), 'bus');

part(new THREE.Mesh(plateGeoXY, M.gold), new THREE.Vector3(0, 0, -0.53), new THREE.Vector3(0, 0.15, -1.35));
const plateGeoZY = new THREE.BoxGeometry(0.045, 1.42, 1.06);
part(new THREE.Mesh(plateGeoZY, M.gold), new THREE.Vector3( 0.53, 0, 0), new THREE.Vector3( 1.3, 0.1, -0.35));

part(new THREE.Mesh(plateGeoZY, M.alu), new THREE.Vector3(-0.53, 0, 0), new THREE.Vector3(-1.3, -0.1, 0.35));

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
part(topPlate, new THREE.Vector3(0,  0.74, 0), new THREE.Vector3(0,  1.15, 0));

part(new THREE.Mesh(plateGeoTB, M.aluDark), new THREE.Vector3(0, -0.74, 0), new THREE.Vector3(0, -1.15, 0));

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
part(adapter, new THREE.Vector3(0, -0.62, 0), new THREE.Vector3(0.35, -1.5, -0.4));

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
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.5, 0.028), M.panel);
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

  /* orbits — aurora ribbons */
  orbitShaders.forEach((u) => {
    u.uTime.value = t;
    u.uOp.value = P.orbit;
  });
  orbitGroup.rotation.y = t * 0.02;

  /* satellite */
  const sf = Math.min(1, Math.max(0.5, camera.aspect / 1.35));
  satGroup.position.set(P.satX * xf, P.satY + Math.sin(t * 0.7) * 0.035, P.satZ);
  satGroup.scale.setScalar(P.satS * sf);
  satInner.rotation.y += 0.0026 * (1 - P.explode * 0.72);
  satInner.rotation.x = 0.32 + Math.sin(t * 0.23) * 0.05;

  const k = easeExpl(P.explode);
  parts.forEach(({ obj, home, out, rot, spin }) => {
    obj.position.lerpVectors(home, out, k);
    obj.rotation.set(rot.x + spin.x * k, rot.y + spin.y * k, rot.z + spin.z * k);
  });

  /* cosmos — parallax depth + slow drift + twinkle */
  const sp = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
  cosmos.position.y = sp * 3.5;
  cosmos.rotation.z = sp * 0.05;
  starsFar.rotation.y = t * 0.0025;
  starsMid.rotation.y = -t * 0.004;
  starsNear.rotation.y = t * 0.006;
  starsNear.position.y = sp * 3;      // extra parallax on the closest layer
  starsBig.material.opacity = 0.7 + Math.sin(t * 1.7) * 0.15;
  starsNear.material.opacity = 0.38 + Math.sin(t * 2.3 + 1.2) * 0.1;
  starsWarm.material.opacity = 0.42 + Math.sin(t * 1.1 + 3) * 0.12;
  nebulaMats.forEach((m, i) => {
    m.opacity = m.userData.baseOp * (0.85 + 0.15 * Math.sin(t * 0.22 + i * 2.1));
  });

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
