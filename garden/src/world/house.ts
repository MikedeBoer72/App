// The home that grows with every won day. Each level adds to the previous ones.

import * as THREE from 'three';
import { buildFlowerClump } from './flowers';
import { glowTexture, roofTexture, stoneWallTexture, woodTexture } from './textures';
import { warmMaterials } from './props';

export const HOUSE_POS = new THREE.Vector3(0, 0, -16);

function rep(t: THREE.Texture, x: number, y: number) {
  const c = t.clone();
  c.repeat.set(x, y);
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.needsUpdate = true;
  return c;
}

function box(w: number, h: number, d: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function stoneMat(w: number, h: number) {
  return new THREE.MeshStandardMaterial({ map: rep(stoneWallTexture(), w / 2.2, h / 2.2), roughness: 0.92 });
}

function woodMat(x = 1, y = 1, tint = '#ffffff') {
  return new THREE.MeshStandardMaterial({ map: rep(woodTexture(), x, y), roughness: 0.85, color: tint });
}

/** Gable roof with ridge along X, sitting on walls of size w×d whose top is at y. */
function gableRoof(w: number, d: number, y: number, rise: number, overhang = 0.35): THREE.Group {
  const g = new THREE.Group();
  const half = d / 2 + overhang;
  const drop = rise * (half / (d / 2));
  const slope = Math.hypot(half, drop);
  const ang = Math.atan2(rise, d / 2);
  const mat = new THREE.MeshStandardMaterial({ map: rep(roofTexture(), (w + overhang * 2) / 2, slope / 2), roughness: 0.75 });
  for (const s of [-1, 1]) {
    const p = box(w + overhang * 2, 0.12, slope, mat);
    p.rotation.x = s * ang;
    // centre of the slab = midpoint between ridge and eave, lifted by half its thickness
    p.position.set(0, y + rise - drop / 2 + 0.06 * Math.cos(ang), (s * half) / 2 + 0.06 * Math.sin(ang) * s);
    g.add(p);
  }
  // Gable end triangles
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const tri = new THREE.ShapeGeometry(shape);
  const triMat = stoneMat(d, rise);
  triMat.side = THREE.DoubleSide;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(tri, triMat);
    m.rotation.y = Math.PI / 2;
    m.position.set((s * w) / 2, y, 0);
    m.castShadow = true;
    g.add(m);
  }
  // ridge cap
  const ridge = box(w + overhang * 2, 0.14, 0.2, new THREE.MeshStandardMaterial({ color: '#3a3b3d', roughness: 0.7 }));
  ridge.position.set(0, y + rise + 0.05, 0);
  g.add(ridge);
  return g;
}

function windowPane(w: number, h: number) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: '#2a3238', emissive: '#ffb55e', emissiveIntensity: 0, roughness: 0.15, metalness: 0.3 });
  warmMaterials.push(glass);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
  pane.position.z = 0.01;
  const frameMat = new THREE.MeshStandardMaterial({ color: '#e9e2d2', roughness: 0.6 });
  const t = 0.07;
  const parts = [
    [w + t * 2, t, 0, h / 2],
    [w + t * 2, t, 0, -h / 2],
    [t, h, -w / 2, 0],
    [t, h, w / 2, 0],
    [w, t * 0.6, 0, 0],
    [t * 0.6, h, 0, 0],
  ];
  for (const [pw, ph, x, y] of parts) {
    const f = box(pw, ph, 0.06, frameMat);
    f.position.set(x, y, 0.03);
    g.add(f);
  }
  const sill = box(w + 0.25, 0.06, 0.18, frameMat);
  sill.position.set(0, -h / 2 - 0.05, 0.08);
  g.add(pane, sill);
  return g;
}

function door() {
  const g = new THREE.Group();
  const d = box(1.0, 2.0, 0.08, woodMat(1.2, 1.8, '#8a5a3a'));
  d.position.y = 1.0;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 0.9, roughness: 0.3 }));
  knob.position.set(0.36, 1.0, 0.06);
  const lintel = box(1.25, 0.16, 0.14, new THREE.MeshStandardMaterial({ color: '#b5ab98', roughness: 0.9 }));
  lintel.position.y = 2.08;
  g.add(d, knob, lintel);
  return g;
}

function cottage(w: number, h: number, d: number, withDoor: boolean, windows: number[]) {
  const g = new THREE.Group();
  const plinth = box(w + 0.25, 0.3, d + 0.25, new THREE.MeshStandardMaterial({ color: '#77716a', roughness: 1 }));
  plinth.position.y = 0.15;
  const walls = box(w, h, d, stoneMat(w, h));
  walls.position.y = h / 2 + 0.05;
  g.add(plinth, walls);
  g.add(gableRoof(w, d, h + 0.05, d * 0.42));
  if (withDoor) {
    const dr = door();
    dr.position.set(0, 0.3, d / 2 + 0.01);
    g.add(dr);
  }
  for (const x of windows) {
    const win = windowPane(0.85, 0.95);
    win.position.set(x, 1.65, d / 2 + 0.01);
    g.add(win);
    const back = windowPane(0.85, 0.95);
    back.rotation.y = Math.PI;
    back.position.set(x, 1.65, -d / 2 - 0.01);
    g.add(back);
  }
  return g;
}

export interface HouseBuild {
  group: THREE.Group;
  update: (t: number) => void;
  footprint: { x: number; z: number; r: number }[];
}

export function buildHouse(level: number): HouseBuild {
  const g = new THREE.Group();
  const updates: ((t: number) => void)[] = [];
  const footprint: { x: number; z: number; r: number }[] = [];

  if (level === 0) {
    const stake = box(0.1, 1.1, 0.1, woodMat());
    stake.position.y = 0.55;
    const plate = box(0.7, 0.35, 0.04, woodMat(1, 1, '#c9b48e'));
    plate.position.set(0, 0.9, 0.06);
    g.add(stake, plate);
    // Corner pegs + string outline of the future cottage
    const line = new THREE.LineBasicMaterial({ color: '#efe6cf' });
    const pts = [[-3, 2.25], [3, 2.25], [3, -2.25], [-3, -2.25], [-3, 2.25]].map(([x, z]) => new THREE.Vector3(x, 0.25, z));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), line));
    for (const p of pts.slice(0, 4)) {
      const peg = box(0.06, 0.4, 0.06, woodMat());
      peg.position.set(p.x, 0.2, p.z);
      g.add(peg);
    }
    footprint.push({ x: HOUSE_POS.x, z: HOUSE_POS.z, r: 1.2 });
  }

  if (level >= 1) {
    g.add(cottage(6, 2.9, 4.5, true, [-1.8, 1.8]));
    footprint.push({ x: HOUSE_POS.x, z: HOUSE_POS.z, r: 4.3 });
    // a stepping-stone path toward the meadow
    const stoneM = new THREE.MeshStandardMaterial({ color: '#9a958a', roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32 + (i % 2) * 0.05, 0.36, 0.08, 9), stoneM);
      s.position.set(Math.sin(i * 1.3) * 0.25, 0.03, 2.9 + i * 0.85 + (level >= 2 ? 1.6 : 0));
      s.receiveShadow = true;
      g.add(s);
    }
  }

  if (level >= 2) {
    // Porch: deck, posts, lean-to roof
    const deck = box(6.4, 0.18, 1.8, woodMat(4, 1.2, '#b08a64'));
    deck.position.set(0, 0.22, 2.25 + 0.9);
    g.add(deck);
    const post = woodMat(0.3, 1.5, '#d9cdb6');
    for (const x of [-3, -1, 1, 3]) {
      const p = box(0.14, 2.35, 0.14, post);
      p.position.set(x, 0.3 + 1.17, 3.95);
      g.add(p);
    }
    const lean = box(6.8, 0.1, 2.2, new THREE.MeshStandardMaterial({ map: rep(roofTexture(), 3, 1), roughness: 0.75 }));
    lean.position.set(0, 2.78, 3.15);
    lean.rotation.x = 0.22;
    g.add(lean);
    // Flower boxes under the windows
    for (const x of [-1.8, 1.8]) {
      const fb = box(1.0, 0.22, 0.26, woodMat(1, 0.3, '#7a5236'));
      fb.position.set(x, 1.0, 2.42);
      g.add(fb);
      const fl = buildFlowerClump(x < 0 ? 'poppy' : 'daisy', x < 0 ? 11 : 12);
      fl.scale.set(1.5, 0.55, 0.45);
      fl.position.set(x, 1.1, 2.42);
      g.add(fl);
    }
    footprint[footprint.length - 1].r = 4.8;
  }

  if (level >= 3) {
    // Chimney with smoke
    const ch = box(0.6, 2.2, 0.6, stoneMat(0.6, 2.2));
    ch.position.set(2.2, 3.6, -0.6);
    g.add(ch);
    const smokeMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#d8d8d4', transparent: true, opacity: 0.22, depthWrite: false });
    const puffs: THREE.Sprite[] = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(smokeMat.clone());
      g.add(s);
      puffs.push(s);
    }
    updates.push((t) => {
      puffs.forEach((s, i) => {
        const life = (t * 0.12 + i / puffs.length) % 1;
        s.position.set(2.2 + life * 1.2 + Math.sin(t + i) * 0.1, 4.8 + life * 3.5, -0.6 + life * 0.4);
        s.scale.setScalar(0.5 + life * 2.2);
        (s.material as THREE.SpriteMaterial).opacity = 0.28 * Math.sin(life * Math.PI);
      });
    });
    // Picket fence around the yard, open at the front
    const fenceMat = woodMat(0.2, 1, '#e6dccb');
    const W = 18;
    const Dz0 = -5;
    const Dz1 = 8.5;
    const picket = new THREE.BoxGeometry(0.09, 0.8, 0.04);
    const positions: [number, number, number][] = [];
    for (let x = -W / 2; x <= W / 2; x += 0.3) {
      positions.push([x, Dz0, 0]);
      if (Math.abs(x) > 1.4) positions.push([x, Dz1, 0]);
    }
    for (let z = Dz0; z <= Dz1; z += 0.3) {
      positions.push([-W / 2, z, Math.PI / 2], [W / 2, z, Math.PI / 2]);
    }
    const inst = new THREE.InstancedMesh(picket, fenceMat, positions.length);
    const m = new THREE.Matrix4();
    positions.forEach(([x, z, r], i) => {
      m.makeRotationY(r).setPosition(x, 0.4, z);
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    g.add(inst);
    for (const z of [Dz0, Dz1]) {
      for (const y of [0.25, 0.6]) {
        const rail = box(W, 0.06, 0.05, fenceMat);
        rail.position.set(0, y, z - 0.04);
        g.add(rail);
      }
    }
    for (const x of [-W / 2, W / 2]) {
      for (const y of [0.25, 0.6]) {
        const rail = box(0.05, 0.06, Dz1 - Dz0, fenceMat);
        rail.position.set(x + 0.04, y, (Dz0 + Dz1) / 2);
        g.add(rail);
      }
    }
  }

  if (level >= 4) {
    const wing = cottage(4, 2.6, 4.2, false, [0]);
    wing.rotation.y = Math.PI / 2;
    wing.position.set(-5.1, 0, -0.4);
    g.add(wing);
    footprint.push({ x: HOUSE_POS.x - 5.1, z: HOUSE_POS.z - 0.4, r: 2.6 });
  }

  if (level >= 5) {
    const gh = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.5 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#dfeee6', roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const gw = 3.4, gd = 3.2, gh2 = 2.2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(gw, gh2, gd), glass);
    body.position.y = gh2 / 2 + 0.2;
    gh.add(body);
    for (let x = -gw / 2; x <= gw / 2 + 0.01; x += gw / 4) {
      for (const z of [-gd / 2, gd / 2]) {
        const b = box(0.06, gh2, 0.06, frame);
        b.position.set(x, gh2 / 2 + 0.2, z);
        gh.add(b);
      }
    }
    const roofG = new THREE.Mesh(new THREE.CylinderGeometry(gd / 2, gd / 2, gw, 12, 1, true, 0, Math.PI), glass);
    roofG.rotation.set(0, 0, Math.PI / 2); // axis along X, open side down
    roofG.position.y = gh2 + 0.2;
    roofG.scale.set(0.45, 1, 1);
    gh.add(roofG);
    const base = box(gw + 0.2, 0.25, gd + 0.2, new THREE.MeshStandardMaterial({ color: '#7d776e', roughness: 1 }));
    base.position.y = 0.12;
    gh.add(base);
    for (let i = 0; i < 4; i++) {
      const pl = buildFlowerClump(i % 2 ? 'sunflower' : 'foxglove', 50 + i);
      pl.scale.setScalar(0.6);
      pl.position.set(-1 + i * 0.7, 0.25, 0);
      gh.add(pl);
    }
    gh.position.set(5.3, 0, 0.3);
    g.add(gh);
    footprint.push({ x: HOUSE_POS.x + 5.3, z: HOUSE_POS.z + 0.3, r: 2.3 });
  }

  if (level >= 6) {
    const tower = new THREE.Group();
    const r = 1.4, th = 7;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, th, 24), stoneMat(r * 6, th));
    body.position.y = th / 2;
    body.castShadow = body.receiveShadow = true;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, 3, 24), new THREE.MeshStandardMaterial({ map: rep(roofTexture(), 4, 1.5), roughness: 0.75 }));
    cone.position.y = th + 1.5;
    cone.castShadow = true;
    tower.add(body, cone);
    for (const y of [3, 5.4]) {
      const win = windowPane(0.55, 0.85);
      win.position.set(0, y, r + 0.02);
      tower.add(win);
    }
    tower.position.set(-4.6, 0, -3.4);
    g.add(tower);
    footprint.push({ x: HOUSE_POS.x - 4.6, z: HOUSE_POS.z - 3.4, r: 1.8 });
  }

  g.position.copy(HOUSE_POS);
  return { group: g, update: (t) => updates.forEach((u) => u(t)), footprint };
}
