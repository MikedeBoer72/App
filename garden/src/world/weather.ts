// Clouds, rain, snow, falling leaves and petals, lightning and the rainbow.

import * as THREE from 'three';
import { glowTexture } from './textures';
import { windUniforms } from './wind';
import type { Season } from './seasons';

export type Weather = 'clear' | 'storm' | 'rainbow';

// ---------- Cloud dome ----------

export class Clouds {
  mesh: THREE.Mesh;
  uniforms = {
    uTime: windUniforms.uTime,
    uCover: { value: 0.35 },
    uDark: { value: 0 },
    uSun: { value: new THREE.Color('#ffffff') },
    uSky: { value: new THREE.Color('#b0c4de') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uFlash: { value: 0 },
    uNight: { value: 0 },
  };

  constructor(scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(1800, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uCover, uDark, uFlash, uNight;
        uniform vec3 uSun, uSky, uSunDir;
        varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main() {
          if (vDir.y <= 0.0) discard;
          vec2 uv = vDir.xz / (vDir.y + 0.12) * 1.4;
          vec2 wind = vec2(uTime * 0.006, uTime * 0.002);
          float d = fbm(uv + wind);
          float d2 = fbm(uv * 2.1 - wind * 1.7 + 7.0);
          float shape = d * 0.75 + d2 * 0.25;
          float cov = smoothstep(1.0 - uCover, 1.0 - uCover + 0.28, shape);
          // lit edge toward the sun, darker bellies
          float toward = max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
          vec3 bright = mix(vec3(1.0), uSun, 0.35) * (1.0 - uNight * 0.85);
          vec3 belly = mix(uSky * 0.75, vec3(0.32, 0.34, 0.38), uDark) * (1.0 - uNight * 0.8);
          vec3 col = mix(bright, belly, clamp(d2 * 1.3 - 0.2 + uDark * 0.6, 0.0, 1.0));
          col += uSun * pow(toward, 6.0) * 0.25 * (1.0 - uDark);
          col += vec3(0.75, 0.8, 1.0) * uFlash * (0.5 + d);
          float horizon = mix(smoothstep(0.0, 0.18, vDir.y), 1.0, uDark * 0.95);
          gl_FragColor = vec4(col, cov * horizon * mix(0.9, 1.0, uDark));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
}

// ---------- Precipitation and drifting foliage ----------

type FallKind = 'none' | 'snow' | 'rain';

export class Precip {
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private kind: FallKind = 'none';
  private readonly box = new THREE.Vector3(36, 18, 36);
  private origin = new THREE.Vector3();
  intensity = 1;

  constructor(private scene: THREE.Scene) {
    // Rain streaks
    const rn = 1600;
    const rp = new Float32Array(rn * 6);
    for (let i = 0; i < rn; i++) {
      const x = (Math.random() - 0.5) * this.box.x;
      const y = Math.random() * this.box.y;
      const z = (Math.random() - 0.5) * this.box.z;
      rp.set([x, y, z, x + 0.03, y - 0.55, z], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(
      rg,
      new THREE.LineBasicMaterial({ color: '#c8d2dc', transparent: true, opacity: 0.38, depthWrite: false }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // Snow flakes
    const sn = 2200;
    const sp = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) {
      sp.set([(Math.random() - 0.5) * this.box.x, Math.random() * this.box.y, (Math.random() - 0.5) * this.box.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ map: glowTexture(), color: '#ffffff', size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.snow);
  }

  set(kind: FallKind) {
    this.kind = kind;
    this.rain.visible = kind === 'rain';
    this.snow.visible = kind === 'snow';
  }

  update(center: THREE.Vector3, groundY: number, dt: number, t: number) {
    if (this.kind === 'none') return;
    this.origin.set(center.x, groundY, center.z);
    const half = this.box.clone().multiplyScalar(0.5);
    if (this.kind === 'rain') {
      const pa = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      const a = pa.array as Float32Array;
      const fall = 15 * dt;
      for (let i = 0; i < a.length; i += 6) {
        a[i + 1] -= fall;
        a[i + 4] -= fall;
        if (a[i + 4] < 0) {
          const x = (Math.random() - 0.5) * this.box.x;
          const z = (Math.random() - 0.5) * this.box.z;
          const y = this.box.y * (0.8 + Math.random() * 0.2);
          a[i] = x; a[i + 1] = y; a[i + 2] = z;
          a[i + 3] = x + 0.03; a[i + 4] = y - 0.55; a[i + 5] = z;
        }
      }
      pa.needsUpdate = true;
      this.rain.position.copy(this.origin);
    } else {
      const pa = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const a = pa.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        a[i] += Math.sin(t * 0.7 + i) * dt * 0.25;
        a[i + 1] -= dt * (0.6 + (i % 7) * 0.06);
        a[i + 2] += Math.cos(t * 0.5 + i * 0.3) * dt * 0.2;
        if (a[i + 1] < 0) a[i + 1] += this.box.y;
        if (a[i] > half.x) a[i] -= this.box.x;
        if (a[i] < -half.x) a[i] += this.box.x;
      }
      pa.needsUpdate = true;
      this.snow.position.copy(this.origin);
    }
    void this.scene;
  }
}

/** Leaves (autumn) or petals (spring) tumbling down from the trees. */
export class FallingFoliage {
  private mesh: THREE.InstancedMesh;
  private parts: { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; life: number }[] = [];
  private emitters: { p: THREE.Vector3; r: number; h: number }[] = [];
  private season: Season = 'summer';
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, private count = 90) {
    const geo = new THREE.PlaneGeometry(0.09, 0.06);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, color: '#ffffff' });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < count; i++) {
      this.parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: -1 });
      this.mesh.setColorAt(i, new THREE.Color('#ffffff'));
    }
    scene.add(this.mesh);
  }

  setEmitters(list: { p: THREE.Vector3; r: number; h: number }[]) {
    this.emitters = list;
  }

  setSeason(s: Season) {
    this.season = s;
    const palette = s === 'autumn' ? ['#d9a032', '#c2582a', '#a8452a', '#e0b84a', '#8f5a2a'] : ['#f7cdd9', '#f3bccb', '#fbe3ea'];
    const c = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      c.set(palette[i % palette.length]);
      this.mesh.setColorAt(i, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number, t: number) {
    const active = (this.season === 'autumn' || this.season === 'spring') && this.emitters.length > 0;
    if (!active) {
      this.mesh.count = 0;
      return;
    }
    this.mesh.count = this.count;
    for (let i = 0; i < this.count; i++) {
      const q = this.parts[i];
      if (q.life < 0 || q.p.y < -0.05) {
        const e = this.emitters[Math.floor(Math.random() * this.emitters.length)];
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * e.r;
        q.p.set(e.p.x + Math.cos(a) * r, e.p.y + e.h * (0.5 + Math.random() * 0.5), e.p.z + Math.sin(a) * r);
        q.v.set((Math.random() - 0.5) * 0.3, -(0.35 + Math.random() * 0.35), (Math.random() - 0.5) * 0.3);
        q.spin.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        q.life = 0;
      }
      q.life += dt;
      q.p.x += (q.v.x + Math.sin(t * 1.3 + i) * 0.35) * dt;
      q.p.y += q.v.y * dt;
      q.p.z += (q.v.z + Math.cos(t * 0.9 + i * 0.7) * 0.25) * dt;
      q.rot.x += q.spin.x * dt;
      q.rot.y += q.spin.y * dt;
      q.rot.z += q.spin.z * dt;
      this.dummy.position.copy(q.p);
      this.dummy.rotation.copy(q.rot);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Rainbow ----------

export class Rainbow {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.TorusGeometry(260, 14, 8, 96, Math.PI);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec2 vUv;
        vec3 spectrum(float t){
          return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0);
        }
        void main(){
          // vUv.y wraps around the tube; use the outer half as the band
          float t = vUv.y;
          float band = smoothstep(0.0, 0.08, t) * smoothstep(0.5, 0.42, t);
          vec3 c = spectrum(1.0 - t * 2.0) ;
          float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          gl_FragColor = vec4(c * band * ends * uOpacity, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  snap(on: boolean) {
    this.mat.uniforms.uOpacity.value = on ? 0.2 : 0;
  }

  update(on: boolean, center: THREE.Vector3, sunDir: THREE.Vector3, dt: number) {
    const target = on ? 0.2 : 0;
    const u = this.mat.uniforms.uOpacity;
    u.value += (target - u.value) * Math.min(1, dt * 0.6);
    this.mesh.visible = u.value > 0.01;
    if (!this.mesh.visible) return;
    // Opposite the sun, as in nature.
    const away = new THREE.Vector3(-sunDir.x, 0, -sunDir.z).normalize();
    if (away.lengthSq() < 0.01) away.set(0, 0, -1);
    this.mesh.position.set(center.x + away.x * 420, -40, center.z + away.z * 420);
    this.mesh.lookAt(center.x, -40, center.z);
  }
}
