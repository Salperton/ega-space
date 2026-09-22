import * as THREE from './vendor/three.module.js';

/** Sparse, pixel-sized stars: three depth layers, three draw calls. */
export function createBackground(scene, renderer, viewport) {
  const layers = [
    { area: 4200, min: 1.05, max: 1.5, opacity: 0.68, scroll: 0.025, pointer: 3 },
    { area: 9500, min: 1.4, max: 2.0, opacity: 0.78, scroll: 0.055, pointer: 8 },
    { area: 24000, min: 1.9, max: 2.6, opacity: 0.84, scroll: 0.10, pointer: 17 },
  ].map((settings, index) => {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uViewport: { value: new THREE.Vector2() },
        uOffset: { value: new THREE.Vector2() },
        uDpr: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aSize, aAlpha, aWarmth;
        uniform vec2 uViewport, uOffset;
        uniform float uDpr;
        varying float vAlpha, vWarmth;
        void main() {
          // Wrap outside the visible area; no new stars pop in at the edges.
          vec2 point = mod(position.xy + uOffset / uViewport * 2.0 + 1.25, 2.5) - 1.25;
          gl_Position = vec4(point, 0.9998, 1.0);
          gl_PointSize = max(1.0, aSize * uDpr);
          vAlpha = aAlpha;
          vWarmth = aWarmth;
        }`,
      fragmentShader: `
        varying float vAlpha, vWarmth;
        void main() {
          float radius = length(gl_PointCoord - 0.5) * 2.0;
          float core = 1.0 - smoothstep(0.1, 1.0, radius);
          vec3 color = mix(vec3(0.76, 0.85, 1.0), vec3(1.0, 0.91, 0.79), vWarmth);
          gl_FragColor = vec4(color, core * vAlpha);
        }`,
    });
    const points = new THREE.Points(new THREE.BufferGeometry(), material);
    // Vertices are projected in the shader, so their CPU bounds aren't applicable.
    points.frustumCulled = false;
    points.renderOrder = -3;
    scene.add(points);
    return { ...settings, points, material, index };
  });

  function resize() {
    const { width, height } = viewport;
    layers.forEach((layer) => {
      // A private seed keeps background edits independent of spacecraft textures.
      let seed = 9041 + layer.index * 317;
      const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
      const count = Math.max(8, Math.round(width * height / layer.area));
      const columns = Math.ceil(Math.sqrt(count * width / height));
      const rows = Math.ceil(count / columns);
      const positions = [], sizes = [], alphas = [], warmth = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          positions.push(((col + 0.1 + random() * 0.8) / columns - 0.5) * 2.5,
            ((row + 0.1 + random() * 0.8) / rows - 0.5) * 2.5, 0);
          sizes.push(THREE.MathUtils.lerp(layer.min, layer.max, random()));
          alphas.push(layer.opacity * (0.55 + random() * 0.45));
          warmth.push(random() < 0.14 ? 0.85 : 0.15);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
      geometry.setAttribute('aWarmth', new THREE.Float32BufferAttribute(warmth, 1));
      layer.points.geometry.dispose();
      layer.points.geometry = geometry;
      layer.material.uniforms.uViewport.value.set(width, height);
      layer.material.uniforms.uDpr.value = renderer.getPixelRatio();
    });
  }

  let scrollPosition = window.scrollY;
  function update({ dt, scrollY, pointerX, pointerY, paused, reducedMotion }) {
    // Freeze parallax when paused; resume without jumping to the new scroll position.
    if (!paused && !reducedMotion) {
      scrollPosition += (scrollY - scrollPosition) * (1 - Math.exp(-5 * dt));
    }
    layers.forEach((layer) => {
      layer.material.uniforms.uOffset.value.set(-pointerX * layer.pointer,
        scrollPosition * layer.scroll + pointerY * layer.pointer * 0.7);
    });

  }
  resize();
  return { resize, update };
}
