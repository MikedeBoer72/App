// Ponds and the waterfall.

import * as THREE from 'three';
import { mulberry32 } from './noise';
import { rockMesh } from './rocks';
import { windUniforms, windify } from './wind';

export const waterUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color('#fff') },
  uSky: { value: new THREE.Color('#9bc') },
  uNight: { value: 0 },
};

let waterMat: THREE.ShaderMaterial | null = null;
export function waterMaterial() {
  if (waterMat) return waterMat;
  waterMat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSky;
      uniform float uNight;
      varying vec3 vWorld;
      varying vec2 vUv;
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
        float ph = dot(p, d) * f + uTime * s;
        return d * cos(ph) * a * f;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec2 g = wave(p, normalize(vec2(1.0, 0.3)), 2.1, 1.3, 0.02)
               + wave(p, normalize(vec2(-0.4, 1.0)), 3.3, 1.7, 0.012)
               + wave(p, normalize(vec2(0.7, -0.8)), 5.7, 2.4, 0.006)
               + wave(p, normalize(vec2(-0.9, -0.2)), 9.1, 3.1, 0.003);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 deep = mix(vec3(0.03, 0.10, 0.10), vec3(0.01, 0.02, 0.04), uNight);
        vec3 shallow = vec3(0.10, 0.22, 0.18);
        float edge = smoothstep(0.75, 1.0, length(vUv - 0.5) * 2.0);
        vec3 base = mix(deep, shallow, edge * 0.6);
        vec3 refl = uSky * (1.0 - uNight * 0.7);
        vec3 h = normalize(normalize(uSunDir) + v);
        float spec = pow(max(dot(n, h), 0.0), 220.0) * 3.0;
        vec3 col = mix(base, refl, fres) + uSunColor * spec;
        float alpha = mix(0.82, 0.95, fres);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  Object.assign(waterMat.uniforms, waterUniforms);
  waterMat.uniforms.uTime = windUniforms.uTime;
  return waterMat;
}

function lilyPads(rnd: () => number, radius: number, y: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3f6a2a', roughness: 0.6, side: THREE.DoubleSide });
  const flowerMat = new THREE.MeshStandardMaterial({ color: '#f5e9ef', roughness: 0.5, emissive: '#331a22', side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const r = 0.18 + rnd() * 0.12;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 18, 0.25, Math.PI * 2 - 0.25), mat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = rnd() * 6;
    const a = rnd() * Math.PI * 2;
    const d = (0.3 + rnd() * 0.55) * radius;
    pad.position.set(Math.cos(a) * d, y + 0.01, Math.sin(a) * d);
    pad.receiveShadow = true;
    g.add(pad);
    if (rnd() < 0.45) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 7, 1, true), flowerMat);
      f.rotation.x = Math.PI;
      f.position.set(pad.position.x, y + 0.04, pad.position.z);
      g.add(f);
    }
  }
  return g;
}

function reeds(rnd: () => number, radius: number) {
  const parts = new THREE.Group();
  const mat = windify(new THREE.MeshStandardMaterial({ color: '#6b7a3a', roughness: 0.8, side: THREE.DoubleSide }), 0.12, 1.2);
  const head = new THREE.MeshStandardMaterial({ color: '#5b3b22', roughness: 0.9 });
  const clumps = 3;
  for (let c = 0; c < clumps; c++) {
    const a = rnd() * Math.PI * 2;
    const cx = Math.cos(a) * radius;
    const cz = Math.sin(a) * radius;
    for (let i = 0; i < 9; i++) {
      const h = 0.8 + rnd() * 0.7;
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.04, h, 1, 3).translate(0, h / 2, 0), mat);
      blade.position.set(cx + (rnd() - 0.5) * 0.4, 0, cz + (rnd() - 0.5) * 0.4);
      blade.rotation.set((rnd() - 0.5) * 0.2, rnd() * 3, (rnd() - 0.5) * 0.2);
      parts.add(blade);
      if (i % 3 === 0) {
        const cat = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6), head);
        cat.position.set(blade.position.x, h + 0.05, blade.position.z);
        parts.add(cat);
      }
    }
  }
  return parts;
}

export function buildPond(seed: number, radius = 2.6): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  // Basin: a dark dish under the water for depth.
  const basin = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.02, 40),
    new THREE.MeshStandardMaterial({ color: '#2a2a1c', roughness: 1 }),
  );
  basin.rotation.x = -Math.PI / 2;
  basin.position.y = -0.03;
  g.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), waterMaterial());
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  g.add(water);
  // Stones around the rim.
  const n = Math.round(radius * 7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.2;
    const r = rockMesh(seed * 31 + i, 0.18 + rnd() * 0.18, 0.55, 0.5);
    r.position.set(Math.cos(a) * (radius + 0.05), 0, Math.sin(a) * (radius + 0.05));
    r.rotation.y = rnd() * 6;
    g.add(r);
  }
  g.add(lilyPads(rnd, radius, 0.04));
  g.add(reeds(rnd, radius * 0.95));
  return g;
}

export function buildWaterfall(seed: number): { group: THREE.Group; update: (t: number) => void } {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const H = 2.8;

  // Cliff of stacked rocks behind (−z) the pool.
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + (i / 13 - 0.5) * 2.2;
    const tier = i % 3;
    const r = rockMesh(seed * 7 + i, 0.9 + rnd() * 0.5, 0.9, 0.6);
    const dist = 2.7 + rnd() * 0.3 + tier * 0.25;
    r.position.set(Math.sin(a) * dist, tier * 0.95, Math.cos(a) * dist);
    r.rotation.y = rnd() * 6;
    g.add(r);
  }
  const top = rockMesh(seed + 99, 1.2, 0.7, 0.8);
  top.position.set(0, H - 0.5, -3.1);
  g.add(top);
  // lip stone the water pours over
  const lip = rockMesh(seed + 98, 0.65, 0.5, 0.4);
  lip.position.set(0, H - 0.15, -2.35);
  g.add(lip);

  const pond = buildPond(seed + 5, 2.4);
  g.add(pond);

  // Falling sheet.
  const sheetGeo = new THREE.PlaneGeometry(0.9, 1, 6, 20);
  const pos = sheetGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = 0.5 - pos.getY(i); // 0 top .. 1 bottom
    const x = pos.getX(i) * (1 + v * 0.35);
    const y = H - 0.05 - v * (H - 0.05);
    const z = -2.2 + Math.pow(v, 0.6) * 0.55;
    pos.setXYZ(i, x, y, z);
  }
  const sheetMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv;
        float streak = n(vec2(uv.x * 22.0, uv.y * 3.0 + uTime * 2.6)) * 0.6 + n(vec2(uv.x * 50.0, uv.y * 6.0 + uTime * 3.8)) * 0.4;
        float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
        float a = (0.35 + streak * 0.6) * edge;
        vec3 col = mix(vec3(0.55, 0.7, 0.72), vec3(0.95), streak);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  sheetMat.uniforms.uTime = windUniforms.uTime;
  g.add(new THREE.Mesh(sheetGeo, sheetMat));

  // Mist + foam particles at the base.
  const count = 160;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const mist = new THREE.Points(
    pg,
    new THREE.PointsMaterial({ color: '#f4f8f8', size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  mist.frustumCulled = false;
  g.add(mist);

  const update = (t: number) => {
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const life = (t * (0.35 + s * 0.3) + s * 10) % 1;
      const a = s * 40;
      const r = 0.2 + life * 0.6;
      pp[i * 3] = Math.cos(a) * r * 0.8;
      pp[i * 3 + 1] = 0.08 + Math.sin(life * Math.PI) * 0.55;
      pp[i * 3 + 2] = -1.65 + Math.sin(a) * r * 0.5;
    }
    pg.attributes.position.needsUpdate = true;
  };
  return { group: g, update };
}
