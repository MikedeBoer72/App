// Sky, sun, ambient light, fog and image-based lighting, driven by time of day.

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { TimeOfDay } from '../data/store';

interface Preset {
  elevation: number; // degrees
  azimuth: number;
  sunColor: THREE.ColorRepresentation;
  sunIntensity: number;
  hemiSky: THREE.ColorRepresentation;
  hemiGround: THREE.ColorRepresentation;
  hemiIntensity: number;
  fog: THREE.ColorRepresentation;
  fogDensity: number;
  turbidity: number;
  rayleigh: number;
  exposure: number;
  night: number; // 0..1, drives stars + warm windows
}

const PRESETS: Record<Exclude<TimeOfDay, 'live'>, Preset> = {
  morning: {
    elevation: 9, azimuth: 115, sunColor: '#ffd8a8', sunIntensity: 2.6,
    hemiSky: '#bcd2ec', hemiGround: '#4a5a32', hemiIntensity: 0.9,
    fog: '#d9dccf', fogDensity: 0.0125, turbidity: 6, rayleigh: 2.2, exposure: 0.62, night: 0,
  },
  day: {
    elevation: 42, azimuth: 165, sunColor: '#fff3df', sunIntensity: 3.0,
    hemiSky: '#b7cff0', hemiGround: '#4f6233', hemiIntensity: 1.0,
    fog: '#bfd0e0', fogDensity: 0.0075, turbidity: 2.2, rayleigh: 1.1, exposure: 0.42, night: 0,
  },
  evening: {
    elevation: 5, azimuth: 250, sunColor: '#ffb070', sunIntensity: 2.4,
    hemiSky: '#9fa9c9', hemiGround: '#4a4428', hemiIntensity: 0.75,
    fog: '#e3c3a2', fogDensity: 0.011, turbidity: 8, rayleigh: 2.6, exposure: 0.6, night: 0.15,
  },
  night: {
    elevation: -6, azimuth: 300, sunColor: '#9fb4ff', sunIntensity: 0.45,
    hemiSky: '#3a4a78', hemiGround: '#141a14', hemiIntensity: 0.55,
    fog: '#1b2235', fogDensity: 0.016, turbidity: 2, rayleigh: 0.6, exposure: 0.85, night: 1,
  },
};

export function resolveTime(t: TimeOfDay): Exclude<TimeOfDay, 'live'> {
  if (t !== 'live') return t;
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 5.5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export class Environment {
  sky = new Sky();
  sun = new THREE.DirectionalLight();
  hemi = new THREE.HemisphereLight();
  stars: THREE.Points;
  sunDir = new THREE.Vector3();
  current: Exclude<TimeOfDay, 'live'> | null = null;
  night = 0;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, shadowSize: number) {
    this.sky.scale.setScalar(4500);
    scene.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -45;
    cam.right = cam.top = 45;
    cam.near = 1;
    cam.far = 200;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target, this.hemi);

    // Stars
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let i = 0; i < 1600; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const r = Math.sqrt(1 - y * y);
      pos.push(Math.cos(th) * r * 2000, y * 2000, Math.sin(th) * r * 2000);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: '#dfe6ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
    );
    scene.add(this.stars);

    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  apply(t: TimeOfDay) {
    const key = resolveTime(t);
    if (key === this.current) return;
    this.current = key;
    const p = PRESETS[key];
    const u = this.sky.material.uniforms;
    u.turbidity.value = p.turbidity;
    u.rayleigh.value = p.rayleigh;
    u.mieCoefficient.value = 0.003;
    u.mieDirectionalG.value = 0.82;
    const phi = THREE.MathUtils.degToRad(90 - p.elevation);
    const theta = THREE.MathUtils.degToRad(p.azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);

    this.sun.color.set(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
    this.renderer.toneMappingExposure = p.exposure;
    this.night = p.night;
    (this.stars.material as THREE.PointsMaterial).opacity = p.night * 0.9;
    // At night light comes from the moon, opposite-ish and higher than the sun.
    if (p.night > 0.5) this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), theta);

    // Image based lighting from the sky only.
    const envScene = new THREE.Scene();
    const skyCopy = new Sky();
    skyCopy.scale.setScalar(1000);
    Object.assign(skyCopy.material.uniforms.turbidity, { value: p.turbidity });
    skyCopy.material.uniforms.rayleigh.value = p.rayleigh;
    skyCopy.material.uniforms.sunPosition.value.copy(u.sunPosition.value);
    envScene.add(skyCopy);
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = p.night > 0.5 ? 0.15 : 0.35;
    skyCopy.geometry.dispose();
    skyCopy.material.dispose();
  }

  /** Keep the shadow frustum centred on the viewer. */
  follow(target: THREE.Vector3) {
    const snap = 2;
    const cx = Math.round(target.x / snap) * snap;
    const cz = Math.round(target.z / snap) * snap;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + this.sunDir.x * 80, Math.max(8, this.sunDir.y * 80), cz + this.sunDir.z * 80);
    this.sky.position.set(target.x, 0, target.z);
    this.stars.position.set(target.x, 0, target.z);
  }
}
