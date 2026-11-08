// The garden world: renderer, camera, controls, placement and the frame loop.

import * as THREE from 'three';
import type { FlowerSpecies, ItemKind } from '../data/config';
import type { Placed, TimeOfDay } from '../data/store';
import { Environment } from './environment';
import { HOUSE_POS, buildHouse, type HouseBuild } from './house';
import { buildItem, type BuiltItem } from './items';
import { Grass, Ground } from './meadow';
import { groundY } from './noise';
import { buildStartSign, glowMaterials, warmMaterials } from './props';
import { butterflyTexture, glowTexture } from './textures';
import { waterUniforms } from './water';
import { windUniforms } from './wind';
import { applySeason, currentSeason, unregisterFoliage, type Season } from './seasons';
import { Clouds, FallingFoliage, Precip, Rainbow, type Weather } from './weather';

const EYE = 1.65;
const POSE_KEY = 'bloom-garden/pose';

interface Live {
  placed: Placed;
  built: BuiltItem;
  born: number;
}

export interface WorldOptions {
  quality: 'high' | 'battery';
  startLines: string[];
}

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  env: Environment;
  ground: Ground;
  grass: Grass;
  private clock = new THREE.Timer();
  private items = new Map<string, Live>();
  private house: HouseBuild | null = null;
  private houseLevel = -1;
  private running = true;

  // viewer
  pos = new THREE.Vector3(0, 0, 9);
  yaw = 0;
  pitch = -0.05;
  mode: 'walk' | 'overview' = 'walk';
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private move = new THREE.Vector2(); // joystick/keys, x = strafe, y = forward
  private keys = new Set<string>();
  private bob = 0;

  // placement
  private ghost: THREE.Object3D | null = null;
  private ghostRing: THREE.Mesh;
  private placing: { kind: ItemKind; species?: FlowerSpecies; seed: number; rot: number } | null = null;
  onPlacingMove?: () => void;

  // ambient life
  private butterflies: { g: THREE.Group; wings: THREE.Mesh[]; target: THREE.Vector3; speed: number; phase: number }[] = [];
  private motes: THREE.Points;

  // seasons & weather
  private clouds: Clouds;
  private precip: Precip;
  private falling: FallingFoliage;
  private rainbow: Rainbow;
  season: Season = currentSeason();
  weather: Weather = 'clear';
  private nextBolt = 8;
  private flash = 0;
  /** Called when lightning strikes, with a 0..1 closeness. */
  onLightning?: (closeness: number) => void;

  constructor(private container: HTMLElement, opts: WorldOptions) {
    const high = opts.quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.25));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.05, 6000);
    this.env = new Environment(this.scene, this.renderer, high ? 2048 : 1024);
    this.ground = new Ground(this.scene);
    this.grass = new Grass(this.scene, high ? 110000 : 45000, high ? 60 : 44);

    const sign = buildStartSign(opts.startLines);
    sign.position.set(2.6, groundY(2.6, 5), 5);
    sign.rotation.y = -0.35;
    this.scene.add(sign);

    this.ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: '#fff7df', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.visible = false;
    this.scene.add(this.ghostRing);

    this.motes = this.makeMotes();
    this.scene.add(this.motes);
    this.makeButterflies(7);

    this.clouds = new Clouds(this.scene);
    this.precip = new Precip(this.scene);
    this.falling = new FallingFoliage(this.scene);
    this.rainbow = new Rainbow(this.scene);
    this.setSeason(this.season);

    this.restorePose();
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) {
        this.clock.reset();
        this.loop();
      }
    });
    this.camPos.copy(this.eyePosition());
    this.loop();
  }

  // ---------- Public API ----------

  setTime(t: TimeOfDay) {
    this.env.apply(t, this.weather === 'storm');
  }

  setSeason(s: Season) {
    this.season = s;
    applySeason(s);
    this.ground.setSeason(s);
    this.grass.setSeason(s);
    this.falling.setSeason(s);
    this.updatePrecip();
  }

  setWeather(w: Weather, t: TimeOfDay, instant = false) {
    this.weather = w;
    if (instant) {
      this.clouds.uniforms.uCover.value = w === 'storm' ? 0.97 : 0.36;
      this.clouds.uniforms.uDark.value = w === 'storm' ? 1 : 0;
      this.rainbow.snap(w === 'rainbow');
    }
    this.env.apply(t, w === 'storm');
    this.updatePrecip();
  }

  private updatePrecip() {
    this.precip.set(this.weather === 'storm' ? 'rain' : this.season === 'winter' ? 'snow' : 'none');
  }

  /** Distances from the listener to the nearest waterfall and pond (for sound). */
  waterDistances(): { waterfall: number; pond: number } {
    const at = this.mode === 'walk' ? this.camPos : this.camTarget;
    let waterfall = Infinity;
    let pond = Infinity;
    for (const live of this.items.values()) {
      const k = live.placed.kind;
      if (k !== 'waterfall' && k !== 'pond') continue;
      const d = Math.hypot(live.placed.x - at.x, live.placed.z - at.z);
      if (k === 'waterfall') waterfall = Math.min(waterfall, d);
      else pond = Math.min(pond, d);
    }
    // in the bird's-eye view everything sounds a bit further away
    const extra = this.mode === 'overview' ? this.overviewZoom * 0.6 : 0;
    return { waterfall: waterfall + extra, pond: pond + extra };
  }

  setHouseLevel(level: number) {
    if (level === this.houseLevel) return;
    const grew = this.houseLevel >= 0 && level > this.houseLevel;
    this.houseLevel = level;
    if (this.house) this.scene.remove(this.house.group);
    this.house = buildHouse(level);
    this.house.group.position.y = groundY(HOUSE_POS.x, HOUSE_POS.z);
    this.scene.add(this.house.group);
    if (grew) this.sparkle(HOUSE_POS.clone().setY(2), 60);
    this.refreshHoles();
  }

  sync(placed: Placed[]) {
    const want = new Set(placed.map((p) => p.token));
    for (const [tok, live] of this.items) {
      if (!want.has(tok)) {
        this.scene.remove(live.built.object);
        unregisterFoliage(live.built.object);
        this.items.delete(tok);
      }
    }
    const fresh = this.items.size > 0 || placed.length === 0; // only animate after first load
    for (const p of placed) {
      if (this.items.has(p.token)) continue;
      const built = buildItem(p.kind, p.seed, p.species);
      built.object.position.set(p.x, groundY(p.x, p.z), p.z);
      built.object.rotation.y = p.rot;
      this.scene.add(built.object);
      const born = fresh ? this.clock.getElapsed() : -10;
      if (fresh) {
        built.object.scale.setScalar(0.001);
        this.sparkle(built.object.position.clone().setY(built.object.position.y + 0.4), p.kind === 'flower' ? 18 : 40);
      }
      this.items.set(p.token, { placed: p, built, born });
    }
    this.refreshHoles();
    this.retargetButterflies();
  }

  startPlacing(kind: ItemKind, seed: number, species?: FlowerSpecies) {
    this.cancelPlacing();
    this.placing = { kind, species, seed, rot: Math.random() * Math.PI * 2 };
    const built = buildItem(kind, seed, species);
    const ghost = built.object;
    ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const cl = mats.map((mm) => {
          const c = mm.clone();
          c.transparent = true;
          c.opacity = 0.55;
          c.depthWrite = false;
          c.onBeforeCompile = mm.onBeforeCompile;
          c.customProgramCacheKey = mm.customProgramCacheKey;
          return c;
        });
        m.material = Array.isArray(m.material) ? cl : cl[0];
        m.castShadow = false;
      }
    });
    this.ghost = ghost;
    this.ghost.rotation.y = this.placing.rot;
    this.scene.add(ghost);
    const r = built.solid ?? built.clear ?? 0.4;
    this.ghostRing.scale.setScalar(Math.max(0.6, r * 1.6));
    this.ghostRing.visible = true;
    // start in front of the viewer: close for flowers, further for trees and water
    const f = this.forward();
    const dist = this.mode === 'walk' ? (kind === 'flower' ? 3 : 8 + r * 1.5) : 0;
    this.setGhostAt(this.pos.x + f.x * dist, this.pos.z + f.z * dist);
  }

  rotateGhost() {
    if (!this.placing || !this.ghost) return;
    this.placing.rot += Math.PI / 4;
    this.ghost.rotation.y = this.placing.rot;
  }

  confirmPlacing(): { x: number; z: number; rot: number } | null {
    if (!this.placing || !this.ghost) return null;
    const res = { x: this.ghost.position.x, z: this.ghost.position.z, rot: this.placing.rot };
    this.cancelPlacing();
    return res;
  }

  cancelPlacing() {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      unregisterFoliage(this.ghost);
    }
    this.ghost = null;
    this.placing = null;
    this.ghostRing.visible = false;
  }

  get isPlacing() {
    return !!this.placing;
  }

  toggleOverview(on?: boolean) {
    const overview = on ?? this.mode === 'walk';
    this.mode = overview ? 'overview' : 'walk';
  }

  /** Walk back to the start sign. */
  goHome() {
    this.pos.set(0, 0, 9);
    this.yaw = 0;
    this.pitch = -0.05;
  }

  // ---------- Internals ----------

  private forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  private eyePosition() {
    return new THREE.Vector3(this.pos.x, groundY(this.pos.x, this.pos.z) + EYE + Math.sin(this.bob) * 0.025, this.pos.z);
  }

  private setGhostAt(x: number, z: number) {
    if (!this.ghost) return;
    const y = groundY(x, z);
    this.ghost.position.set(x, y, z);
    this.ghostRing.position.set(x, y + 0.03, z);
    this.onPlacingMove?.();
  }

  private refreshHoles() {
    const holes: { x: number; z: number; r: number; d: number }[] = [];
    for (const live of this.items.values()) {
      if (live.built.clear) {
        const o = live.built.object.position;
        holes.push({ x: o.x, z: o.z, r: live.built.clear, d: o.distanceToSquared(this.pos) });
      }
    }
    if (this.house) for (const f of this.house.footprint) holes.push({ ...f, r: Math.min(f.r, 4.4), d: 0 });
    holes.sort((a, b) => a.d - b.d);
    this.grass.setHoles(holes);
  }

  private solids(): { x: number; z: number; r: number }[] {
    const out: { x: number; z: number; r: number }[] = [];
    for (const live of this.items.values()) {
      if (live.built.solid) out.push({ x: live.placed.x, z: live.placed.z, r: live.built.solid });
    }
    if (this.house && this.houseLevel >= 1) for (const f of this.house.footprint) out.push(f);
    return out;
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    const pointers = new Map<number, { kind: 'stick' | 'look'; sx: number; sy: number; x: number; y: number; t: number }>();
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      const leftHalf = e.clientX < window.innerWidth * 0.45 && e.pointerType === 'touch';
      const kind = leftHalf && this.mode === 'walk' ? 'stick' : 'look';
      pointers.set(e.pointerId, { kind, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t: performance.now() });
      if (kind === 'stick' && stick) {
        stick.style.display = 'block';
        stick.style.left = `${e.clientX}px`;
        stick.style.top = `${e.clientY}px`;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.kind === 'stick') {
        const vx = e.clientX - p.sx;
        const vy = e.clientY - p.sy;
        const len = Math.min(55, Math.hypot(vx, vy));
        const a = Math.atan2(vy, vx);
        this.move.set((Math.cos(a) * len) / 55, (-Math.sin(a) * len) / 55);
        if (knob) knob.style.transform = `translate(${Math.cos(a) * len}px, ${Math.sin(a) * len}px)`;
      } else if (this.mode === 'overview') {
        // drag to pan the map
        const f = this.forward();
        const r = new THREE.Vector3(-f.z, 0, f.x);
        const k = 0.05;
        this.pos.addScaledVector(r, -dx * k).addScaledVector(f, dy * k);
      } else {
        const k = e.pointerType === 'touch' ? 0.006 : 0.004;
        this.yaw -= dx * k;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.2, 1.0);
      }
    });
    const end = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      if (p.kind === 'stick') {
        this.move.set(0, 0);
        if (stick) stick.style.display = 'none';
        if (knob) knob.style.transform = '';
      }
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (moved < 12 && performance.now() - p.t < 400) this.tap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      if (this.mode === 'overview') this.overviewZoom = THREE.MathUtils.clamp(this.overviewZoom + e.deltaY * 0.02, 10, 70);
    });

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  overviewZoom = 26;

  private raycaster = new THREE.Raycaster();
  private tap(x: number, y: number) {
    if (!this.placing) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.ground.mesh, false)[0];
    if (hit) this.setGhostAt(hit.point.x, hit.point.z);
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private makeMotes() {
    const n = 220;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 30;
      p[i * 3 + 1] = Math.random() * 4;
      p[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({
      map: glowTexture(),
      color: '#fff1c9',
      size: 0.07,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }

  private makeButterflies(n: number) {
    const tex = butterflyTexture();
    const colors = ['#f2e9d0', '#e9b04a', '#c9d9f2', '#f2d24a', '#ffffff', '#d98c4a', '#bfa6e0'];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ map: tex, color: colors[i % colors.length], alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
      const wings: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(0.09, 0.09);
        geo.translate(0.045, 0, 0);
        geo.rotateX(-Math.PI / 2);
        const w = new THREE.Mesh(geo, mat);
        w.scale.x = s;
        wings.push(w);
        g.add(w);
      }
      g.position.set((Math.random() - 0.5) * 16, 0.6 + Math.random(), (Math.random() - 0.5) * 16 + 4);
      this.scene.add(g);
      this.butterflies.push({ g, wings, target: g.position.clone(), speed: 0.8 + Math.random() * 0.6, phase: Math.random() * 10 });
    }
  }

  private flowerSpots: THREE.Vector3[] = [];
  private retargetButterflies() {
    const emitters: { p: THREE.Vector3; r: number; h: number }[] = [];
    for (const live of this.items.values()) {
      const k = live.placed.kind;
      if (k === 'birch' || k === 'oak' || k === 'cherry') {
        emitters.push({ p: live.built.object.position.clone(), r: k === 'oak' ? 3.5 : 2.5, h: k === 'cherry' ? 4.5 : 7 });
      }
    }
    this.falling.setEmitters(emitters);
    this.flowerSpots = [];
    for (const live of this.items.values()) {
      if (live.placed.kind === 'flower' || live.placed.kind === 'bush' || live.placed.kind === 'cherry') {
        this.flowerSpots.push(live.built.object.position.clone());
      }
    }
  }

  private pickButterflyTarget(): THREE.Vector3 {
    if (this.flowerSpots.length && Math.random() < 0.8) {
      const s = this.flowerSpots[Math.floor(Math.random() * this.flowerSpots.length)];
      return new THREE.Vector3(s.x + (Math.random() - 0.5), s.y + 0.4 + Math.random() * 0.8, s.z + (Math.random() - 0.5));
    }
    return new THREE.Vector3(this.pos.x + (Math.random() - 0.5) * 20, groundY(this.pos.x, this.pos.z) + 0.5 + Math.random() * 1.5, this.pos.z + (Math.random() - 0.5) * 20);
  }

  // sparkles when something new grows
  private sparks: { pts: THREE.Points; vel: Float32Array; born: number }[] = [];
  private sparkle(at: THREE.Vector3, n: number) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = 0.4 + Math.random() * 1.2;
      v.set([Math.cos(a) * s, 0.6 + Math.random() * 1.4, Math.sin(a) * s], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(
      g,
      new THREE.PointsMaterial({ map: glowTexture(), color: '#ffe7a8', size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.sparks.push({ pts, vel: v, born: this.clock.getElapsed() });
  }

  private restorePose() {
    try {
      const raw = localStorage.getItem(POSE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        this.pos.set(p.x, 0, p.z);
        this.yaw = p.yaw;
      }
    } catch {
      /* ignore */
    }
  }

  private savePose() {
    try {
      localStorage.setItem(POSE_KEY, JSON.stringify({ x: this.pos.x, z: this.pos.z, yaw: this.yaw }));
    } catch {
      /* ignore */
    }
  }

  private lastPoseSave = 0;
  private lastHoleRefresh = new THREE.Vector3();

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.getElapsed();
    windUniforms.uTime.value = t;

    // --- movement ---
    const mv = this.move.clone();
    if (this.keys.has('w') || this.keys.has('arrowup')) mv.y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) mv.y -= 1;
    if (this.keys.has('a')) mv.x -= 1;
    if (this.keys.has('d')) mv.x += 1;
    if (this.keys.has('arrowleft')) this.yaw += dt * 1.8;
    if (this.keys.has('arrowright')) this.yaw -= dt * 1.8;
    if (mv.lengthSq() > 1) mv.normalize();
    const speed = this.mode === 'overview' ? 9 : this.keys.has('shift') ? 5.5 : 2.6;
    if (mv.lengthSq() > 0.0001) {
      const f = this.forward();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      this.pos.addScaledVector(f, mv.y * speed * dt).addScaledVector(r, mv.x * speed * dt);
      if (this.mode === 'walk') {
        this.bob += dt * 9 * mv.length();
        for (const s of this.solids()) {
          const dx = this.pos.x - s.x;
          const dz = this.pos.z - s.z;
          const d = Math.hypot(dx, dz);
          const min = s.r + 0.35;
          if (d < min && d > 0.0001) {
            this.pos.x = s.x + (dx / d) * min;
            this.pos.z = s.z + (dz / d) * min;
          }
        }
      }
    }

    // --- camera ---
    const eye = this.eyePosition();
    let desiredPos: THREE.Vector3;
    let desiredTarget: THREE.Vector3;
    if (this.mode === 'walk') {
      desiredPos = eye;
      const look = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      desiredTarget = eye.clone().add(look);
    } else {
      const f = this.forward();
      const z = this.overviewZoom;
      desiredTarget = new THREE.Vector3(this.pos.x, groundY(this.pos.x, this.pos.z), this.pos.z);
      desiredPos = desiredTarget.clone().addScaledVector(f, -z * 0.75).setY(desiredTarget.y + z * 0.85);
    }
    const k = 1 - Math.exp(-dt * (this.mode === 'walk' ? 30 : 4));
    this.camPos.lerp(desiredPos, k);
    this.camTarget.lerp(desiredTarget, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // --- world follows viewer ---
    const focus = this.mode === 'walk' ? this.camPos : this.camTarget;
    this.ground.follow(focus);
    this.env.follow(focus);
    const night = this.env.night;
    this.grass.update(focus, this.env.sunDir, this.env.sun.color, this.env.hemi.color, this.env.sun.intensity);
    waterUniforms.uSunDir.value.copy(this.env.sunDir);
    waterUniforms.uSunColor.value.copy(this.env.sun.color).multiplyScalar(night > 0.5 ? 0.3 : 1);
    waterUniforms.uSky.value.copy(this.env.hemi.color);
    waterUniforms.uNight.value = night;
    const gloom = this.weather === 'storm' ? 0.55 : 0;
    for (const m of warmMaterials) m.emissiveIntensity = Math.max(night, gloom) * 1.8 + 0.05;

    // clouds, rain/snow, falling leaves, rainbow, lightning
    const cu = this.clouds.uniforms;
    const storm = this.weather === 'storm';
    cu.uCover.value += ((storm ? 0.97 : 0.36) - cu.uCover.value) * Math.min(1, dt * 0.5);
    cu.uDark.value += ((storm ? 1 : 0) - cu.uDark.value) * Math.min(1, dt * 0.5);
    cu.uSun.value.copy(this.env.sun.color);
    cu.uSky.value.copy(this.env.hemi.color);
    cu.uSunDir.value.copy(this.env.sunDir);
    cu.uNight.value = night;
    this.clouds.mesh.position.set(focus.x, 0, focus.z);
    this.precip.update(focus, groundY(focus.x, focus.z), dt, t);
    this.falling.update(dt, t);
    this.rainbow.update(this.weather === 'rainbow' && night < 0.5, focus, this.env.sunDir, dt);
    if (storm) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 7 + Math.random() * 16;
        this.flash = 1;
        this.onLightning?.(Math.random());
      }
    }
    if (this.flash > 0) {
      // double flicker
      const f = this.flash;
      const flick = f > 0.75 ? 1 : f > 0.6 ? 0.2 : f > 0.4 ? 0.8 : f * 0.6;
      cu.uFlash.value = flick;
      this.env.hemi.intensity = this.env.baseHemi * (1 + flick * 3);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      if (this.flash === 0) this.env.hemi.intensity = this.env.baseHemi;
    } else {
      cu.uFlash.value = 0;
    }
    for (const m of glowMaterials) m.opacity = night * 0.9;
    if (focus.distanceToSquared(this.lastHoleRefresh) > 25) {
      this.lastHoleRefresh.copy(focus);
      this.refreshHoles();
    }

    // motes drift around the viewer (wrapped box)
    const mp = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    const arr = mp.array as Float32Array;
    for (let i = 0; i < mp.count; i++) {
      arr[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.08;
      arr[i * 3 + 1] += Math.sin(t * 0.5 + i * 1.7) * dt * 0.05;
    }
    mp.needsUpdate = true;
    this.motes.position.set(Math.round(focus.x / 30) * 30, groundY(focus.x, focus.z), Math.round(focus.z / 30) * 30);
    (this.motes.material as THREE.PointsMaterial).opacity = 0.35 + night * 0.4;

    // grow-in animation
    for (const live of this.items.values()) {
      const age = t - live.born;
      if (age < 1.6) {
        const x = Math.min(1, age / 1.4);
        const s = 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); // easeOutBack
        live.built.object.scale.setScalar(Math.max(0.001, s));
      }
      live.built.update?.(t);
    }
    this.house?.update(t);

    // butterflies
    for (const b of this.butterflies) {
      const d = b.target.clone().sub(b.g.position);
      if (d.length() < 0.15) b.target.copy(this.pickButterflyTarget());
      d.normalize();
      b.g.position.addScaledVector(d, b.speed * dt);
      b.g.position.y += Math.sin(t * 5 + b.phase) * dt * 0.3;
      b.g.rotation.y = Math.atan2(d.x, d.z) + Math.PI / 2;
      const flap = Math.sin(t * 18 + b.phase) * 1.1;
      b.wings[0].rotation.z = -flap;
      b.wings[1].rotation.z = flap;
      if (b.g.position.distanceTo(focus) > 30) b.g.position.copy(this.pickButterflyTarget());
    }

    // sparkles
    this.sparks = this.sparks.filter((s) => {
      const age = t - s.born;
      if (age > 2) {
        this.scene.remove(s.pts);
        s.pts.geometry.dispose();
        return false;
      }
      const pa = s.pts.geometry.attributes.position as THREE.BufferAttribute;
      const a = pa.array as Float32Array;
      for (let i = 0; i < pa.count; i++) {
        a[i * 3] += s.vel[i * 3] * dt;
        a[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
        a[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
        s.vel[i * 3 + 1] -= dt * 0.8;
      }
      pa.needsUpdate = true;
      (s.pts.material as THREE.PointsMaterial).opacity = 1 - age / 2;
      return true;
    });

    if (t - this.lastPoseSave > 3) {
      this.lastPoseSave = t;
      this.savePose();
    }

    this.renderer.render(this.scene, this.camera);
  };
}
