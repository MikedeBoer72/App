// The endless meadow: a terrain mesh and a wind-blown instanced grass field
// that both travel with the viewer, so the world never runs out.

import * as THREE from 'three';
import { fbm, groundY, GROUND_GLSL } from './noise';
import { windUniforms } from './wind';
import { MEADOW, currentSeason, type Season } from './seasons';

const GROUND_SIZE = 700;
const GROUND_SEGS = 160;

export class Ground {
  mesh: THREE.Mesh;
  private center = new THREE.Vector2(Infinity, Infinity);
  private season: Season = currentSeason();
  private last = new THREE.Vector3();

  setSeason(s: Season) {
    if (s === this.season) return;
    this.season = s;
    this.center.set(Infinity, Infinity);
    this.follow(this.last);
  }

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGS, GROUND_SEGS);
    geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'ground';
    scene.add(this.mesh);
  }

  /** Re-centre under the viewer when they have walked far enough. */
  follow(p: THREE.Vector3) {
    this.last.copy(p);
    const step = GROUND_SIZE / GROUND_SEGS;
    if (Math.abs(p.x - this.center.x) < 60 && Math.abs(p.z - this.center.y) < 60) return;
    const cx = Math.round(p.x / step) * step;
    const cz = Math.round(p.z / step) * step;
    this.center.set(cx, cz);
    const geo = this.mesh.geometry as THREE.PlaneGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const [g0, g1, g2] = MEADOW[this.season].ground;
    const base = new THREE.Color(g0);
    const dry = new THREE.Color(g1);
    const lush = new THREE.Color(g2);
    const c = new THREE.Color();
    const params = geo.parameters;
    let i = 0;
    for (let iy = 0; iy <= GROUND_SEGS; iy++) {
      for (let ix = 0; ix <= GROUND_SEGS; ix++) {
        const x = cx - params.width / 2 + ix * step;
        const z = cz - params.height / 2 + iy * step;
        pos.setXYZ(i, x, groundY(x, z) - 0.02, z);
        const n = fbm(x * 0.03, z * 0.03, 3);
        const m = fbm(x * 0.12 + 40, z * 0.12, 2);
        c.copy(base).lerp(dry, Math.max(0, n - 0.5) * 1.4).lerp(lush, Math.max(0, m - 0.5));
        col.setXYZ(i, c.r, c.g, c.b);
        i++;
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
  }
}

const MAX_HOLES = 24;

export class Grass {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  holes: THREE.Vector4[] = [];

  constructor(scene: THREE.Scene, count: number, tile: number) {
    // One blade: tapered strip, 5 levels, folded slightly along its spine.
    const segs = 4;
    const bladeVerts: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const w = 0.032 * (1 - t * 0.9);
      if (i === segs) {
        bladeVerts.push(0, t, 0);
        ys.push(t);
      } else {
        bladeVerts.push(-w, t, 0.01, w, t, 0.01);
        ys.push(t, t);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < segs - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const last = (segs - 1) * 2;
    idx.push(last, last + 1, last + 2);

    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute(bladeVerts, 3));
    base.setIndex(idx);

    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    const offsets = new Float32Array(count * 2);
    const rand = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      offsets[i * 2] = (Math.random() - 0.5) * tile;
      offsets[i * 2 + 1] = (Math.random() - 0.5) * tile;
      rand[i] = Math.random();
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2));
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
    geo.instanceCount = count;

    for (let i = 0; i < MAX_HOLES; i++) this.holes.push(new THREE.Vector4(0, 0, 0, 0));

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uCenter: { value: new THREE.Vector2() },
          uTile: { value: tile },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color('#fff') },
          uSkyColor: { value: new THREE.Color('#9bb') },
          uHoles: { value: this.holes },
          uMidA: { value: new THREE.Vector3() },
          uMidB: { value: new THREE.Vector3() },
          uTipA: { value: new THREE.Vector3() },
          uTipB: { value: new THREE.Vector3() },
          uSnow: { value: 0 },
          uHeight: { value: 1 },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        uniform vec2 uCenter;
        uniform float uTile;
        uniform float uTime;
        uniform vec4 uHoles[${MAX_HOLES}];
        uniform float uHeight;
        attribute vec2 aOffset;
        attribute float aRand;
        varying float vY;
        varying float vRand;
        varying vec3 vNormal2;
        varying float vPatch;
        ${GROUND_GLSL}
        float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
        float vn(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        void main() {
          vec2 wp = uCenter + mod(aOffset - uCenter + uTile * 0.5, uTile) - uTile * 0.5;
          float d = length(wp - uCenter);
          float fade = 1.0 - smoothstep(uTile * 0.32, uTile * 0.5, d);
          float hole = 1.0;
          for (int i = 0; i < ${MAX_HOLES}; i++) {
            vec4 h = uHoles[i];
            if (h.z > 0.0) hole *= smoothstep(h.z * 0.85, h.z * 1.1, length(wp - h.xy));
          }
          float patchN = vn(wp * 0.09);
          vPatch = patchN;
          float height = (0.13 + 0.24 * aRand + 0.18 * patchN) * fade * hole * uHeight;
          float ang = aRand * 6.2831 + h21(wp) * 3.0;
          vec3 p = position;
          float y = p.y;
          vY = y;
          vRand = aRand;
          p.y *= height;
          p.x *= (0.8 + aRand * 0.6);
          // natural curve + wind
          float wind = sin(uTime * 1.3 + wp.x * 0.32 + wp.y * 0.21) * 0.55 + sin(uTime * 2.7 + wp.x * 0.9) * 0.18;
          wind += (vn(wp * 0.05 + vec2(uTime * 0.25, 0.0)) - 0.5) * 1.4;
          float bend = (0.25 + aRand * 0.35 + wind * 0.45) * y * y * height;
          float ca = cos(ang), sa = sin(ang);
          vec3 r = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
          r.x += bend * 0.9;
          r.z += bend * 0.35;
          vec3 world = vec3(wp.x + r.x, groundY(wp) + r.y, wp.y + r.z);
          vNormal2 = normalize(vec3(sa, 0.6, ca));
          vec4 mvPosition = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uMidA, uMidB, uTipA, uTipB;
        uniform float uSnow;
        varying float vY;
        varying float vRand;
        varying vec3 vNormal2;
        varying float vPatch;
        void main() {
          vec3 rootC = vec3(0.06, 0.12, 0.03);
          vec3 midC = mix(uMidA, uMidB, vPatch);
          vec3 tipC = mix(uTipA, uTipB, vRand * vPatch);
          vec3 col = mix(rootC, midC, smoothstep(0.0, 0.5, vY));
          col = mix(col, tipC, smoothstep(0.45, 1.0, vY));
          float diff = max(dot(normalize(vNormal2), normalize(uSunDir)), 0.0) * 0.6 + 0.4;
          float trans = pow(vY, 2.0) * 0.35; // light through the tips
          vec3 lit = col * (uSkyColor * 0.55 + uSunColor * diff * 0.75) + col * uSunColor * trans;
          lit *= 0.65 + 0.35 * vY; // self-shadowing near the roots
          vec3 snowLit = vec3(0.86, 0.9, 0.95) * (uSkyColor * 0.6 + uSunColor * diff * 0.6);
          lit = mix(lit, snowLit, uSnow * (0.55 + 0.45 * smoothstep(0.0, 0.9, vY)) * (0.7 + 0.3 * vRand));
          gl_FragColor = vec4(lit, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    this.material.uniforms.uTime = windUniforms.uTime;

    this.setSeason(currentSeason());
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setSeason(s: Season) {
    const m = MEADOW[s];
    const u = this.material.uniforms;
    u.uMidA.value.fromArray(m.midA);
    u.uMidB.value.fromArray(m.midB);
    u.uTipA.value.fromArray(m.tipA);
    u.uTipB.value.fromArray(m.tipB);
    u.uSnow.value = m.snow;
    u.uHeight.value = m.height;
  }

  setHoles(list: { x: number; z: number; r: number }[]) {
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = list[i];
      this.holes[i].set(h ? h.x : 0, h ? h.z : 0, h ? h.r : 0, 0);
    }
  }

  update(center: THREE.Vector3, sunDir: THREE.Vector3, sun: THREE.Color, sky: THREE.Color, sunI: number) {
    this.material.uniforms.uCenter.value.set(center.x, center.z);
    this.material.uniforms.uSunDir.value.copy(sunDir);
    this.material.uniforms.uSunColor.value.copy(sun).multiplyScalar(sunI / 2.6);
    this.material.uniforms.uSkyColor.value.copy(sky);
  }
}
