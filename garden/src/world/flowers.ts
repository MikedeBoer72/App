// Procedural flowers. Each placed "flower" is a natural clump of several blooms
// merged into one mesh (one draw call) with vertex colours and wind sway.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FlowerSpecies } from '../data/config';
import { mulberry32 } from './noise';
import { windify } from './wind';

type Rnd = () => number;

function colorize(g: THREE.BufferGeometry, c: THREE.Color, jitter = 0, rnd?: Rnd) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = rnd ? 1 + (rnd() - 0.5) * jitter : 1;
    arr[i * 3] = c.r * j;
    arr[i * 3 + 1] = c.g * j;
    arr[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Strip non-essential attributes so geometries merge cleanly. */
function clean(g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') ng.deleteAttribute(k);
  return ng;
}

/** Curved petal pointing along +Y from origin. */
function petal(len: number, wid: number, cup: number, curl = 0): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 3, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i); // -0.5..0.5
    const v = p.getY(i) + 0.5; // 0..1
    const shape = Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.75) * (0.35 + 0.65 * v);
    const x = u * wid * shape;
    const y = v * len;
    const z = cup * (u * u * 4) * wid * 0.5 + curl * v * v * len;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function stem(h: number, r: number, bendX: number, bendZ: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r * 0.7, r, h, 5, 4, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setX(i, p.getX(i) + bendX * t * t);
    p.setZ(i, p.getZ(i) + bendZ * t * t);
  }
  g.computeVertexNormals();
  return g;
}

function leaf(len: number, wid: number): THREE.BufferGeometry {
  const g = petal(len, wid, 0.6, 0.35);
  return g;
}

const GREEN = new THREE.Color('#3d6a2a');
const DARK_GREEN = new THREE.Color('#2b4f1f');

interface Bloom {
  parts: THREE.BufferGeometry[];
}

function headRing(
  rnd: Rnd,
  count: number,
  len: number,
  wid: number,
  cup: number,
  tilt: number,
  color: THREE.Color,
  layers = 1,
): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < count; i++) {
      const g = petal(len * (1 - l * 0.12), wid, cup, -0.15);
      g.rotateX(-tilt - l * 0.25 + (rnd() - 0.5) * 0.15);
      g.rotateY((i / count) * Math.PI * 2 + l * (Math.PI / count) + (rnd() - 0.5) * 0.12);
      const c = color.clone().offsetHSL((rnd() - 0.5) * 0.015, 0, (rnd() - 0.5) * 0.06 - l * 0.04);
      out.push(colorize(g, c));
    }
  }
  return out;
}

function disc(r: number, h: number, color: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, h / r, 1);
  return colorize(g, color);
}

function bloomFor(species: FlowerSpecies, rnd: Rnd): Bloom {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, y: number, bx: number, bz: number) => {
    g.translate(bx, y, bz);
    parts.push(g);
  };
  const leaves = (h: number, n: number, len: number, wid: number) => {
    for (let i = 0; i < n; i++) {
      const g = leaf(len * (0.7 + rnd() * 0.5), wid);
      g.rotateX(-0.9 - rnd() * 0.4);
      g.rotateY(rnd() * Math.PI * 2);
      g.translate(0, h * (0.05 + rnd() * 0.25), 0);
      parts.push(colorize(g, GREEN.clone().lerp(DARK_GREEN, rnd())));
    }
  };

  switch (species) {
    case 'poppy': {
      const h = 0.45 + rnd() * 0.25;
      const bx = (rnd() - 0.5) * 0.12, bz = (rnd() - 0.5) * 0.12;
      parts.push(colorize(stem(h, 0.008, bx, bz), GREEN));
      const ring = headRing(rnd, 4, 0.075, 0.12, 1.1, 0.7, new THREE.Color('#c42a1f'));
      const center = disc(0.018, 0.02, new THREE.Color('#1c1a10'));
      for (const g of [...ring, center]) add(g, h, bx, bz);
      leaves(h, 3, 0.12, 0.05);
      break;
    }
    case 'daisy': {
      const h = 0.22 + rnd() * 0.16;
      const bx = (rnd() - 0.5) * 0.08, bz = (rnd() - 0.5) * 0.08;
      parts.push(colorize(stem(h, 0.005, bx, bz), GREEN));
      const ring = headRing(rnd, 16, 0.045, 0.014, 0.3, 1.35, new THREE.Color('#f6f3ea'));
      const center = disc(0.014, 0.012, new THREE.Color('#e3b21c'));
      for (const g of [...ring, center]) add(g, h, bx, bz);
      leaves(h, 4, 0.07, 0.03);
      break;
    }
    case 'lavender': {
      const h = 0.4 + rnd() * 0.18;
      const bx = (rnd() - 0.5) * 0.1, bz = (rnd() - 0.5) * 0.1;
      parts.push(colorize(stem(h, 0.004, bx, bz), new THREE.Color('#6d7f55')));
      const bud = new THREE.Color('#8b78c4');
      for (let i = 0; i < 14; i++) {
        const t = 0.72 + (i / 14) * 0.28;
        const g = new THREE.IcosahedronGeometry(0.011 + rnd() * 0.004, 0);
        const a = rnd() * Math.PI * 2;
        g.translate(Math.cos(a) * 0.009 + bx * t * t, h * t, Math.sin(a) * 0.009 + bz * t * t);
        parts.push(colorize(g, bud.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.12)));
      }
      for (let i = 0; i < 5; i++) {
        const g = leaf(0.12, 0.012);
        g.rotateX(-0.4 - rnd() * 0.3);
        g.rotateY(rnd() * Math.PI * 2);
        parts.push(colorize(g, new THREE.Color('#7d8f66')));
      }
      break;
    }
    case 'sunflower': {
      const h = 1.1 + rnd() * 0.45;
      const bx = (rnd() - 0.5) * 0.15, bz = 0.08 + rnd() * 0.08;
      parts.push(colorize(stem(h, 0.016, bx, bz), GREEN));
      const ring = headRing(rnd, 18, 0.11, 0.045, 0.3, 1.25, new THREE.Color('#e9b51f'), 2);
      const center = disc(0.07, 0.03, new THREE.Color('#4a2e14'));
      for (const g of [...ring, center]) {
        g.rotateX(0.5); // face slightly towards the viewer / sun
        add(g, h, bx, bz);
      }
      for (let i = 0; i < 4; i++) {
        const g = leaf(0.2, 0.13);
        g.rotateX(-1.1);
        g.rotateY(rnd() * Math.PI * 2);
        g.translate(bx * 0.3, h * (0.3 + i * 0.15), bz * 0.3);
        parts.push(colorize(g, GREEN));
      }
      break;
    }
    case 'cornflower': {
      const h = 0.35 + rnd() * 0.2;
      const bx = (rnd() - 0.5) * 0.12, bz = (rnd() - 0.5) * 0.12;
      parts.push(colorize(stem(h, 0.005, bx, bz), new THREE.Color('#5b7a4a')));
      const ring = headRing(rnd, 9, 0.04, 0.026, -0.4, 0.95, new THREE.Color('#3d64c4'));
      const center = disc(0.012, 0.014, new THREE.Color('#2b2f6e'));
      for (const g of [...ring, center]) add(g, h, bx, bz);
      leaves(h, 3, 0.1, 0.015);
      break;
    }
    case 'foxglove': {
      const h = 0.7 + rnd() * 0.3;
      const bx = (rnd() - 0.5) * 0.08, bz = (rnd() - 0.5) * 0.08;
      parts.push(colorize(stem(h, 0.008, bx, bz), GREEN));
      const bell = new THREE.Color('#d47fb0');
      for (let i = 0; i < 12; i++) {
        const t = 0.45 + (i / 12) * 0.52;
        const s = 1 - (i / 12) * 0.6;
        const g = new THREE.CylinderGeometry(0.012 * s, 0.024 * s, 0.05 * s, 7, 1, true);
        g.rotateX(Math.PI / 2 + 0.6);
        const a = i * 2.4;
        g.rotateY(a);
        g.translate(Math.sin(a) * 0.025 + bx * t * t, h * t, Math.cos(a) * 0.025 + bz * t * t);
        parts.push(colorize(g, bell.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.1 + i * 0.008)));
      }
      leaves(h, 5, 0.16, 0.06);
      break;
    }
    case 'tulip': {
      const h = 0.3 + rnd() * 0.15;
      const bx = (rnd() - 0.5) * 0.06, bz = (rnd() - 0.5) * 0.06;
      parts.push(colorize(stem(h, 0.007, bx, bz), GREEN));
      const ring = headRing(rnd, 6, 0.07, 0.05, 1.4, 0.22, new THREE.Color('#e88a63'), 1);
      for (const g of ring) add(g, h - 0.01, bx, bz);
      for (let i = 0; i < 2; i++) {
        const g = leaf(0.2, 0.05);
        g.rotateX(-0.35);
        g.rotateY(rnd() * Math.PI * 2);
        parts.push(colorize(g, new THREE.Color('#5a7f49')));
      }
      break;
    }
  }
  return { parts };
}

const BLOOMS_PER_CLUMP: Record<FlowerSpecies, [number, number]> = {
  poppy: [4, 7],
  daisy: [7, 12],
  lavender: [9, 14],
  sunflower: [2, 3],
  cornflower: [5, 8],
  foxglove: [3, 5],
  tulip: [5, 8],
};

let sharedMat: THREE.MeshStandardMaterial | null = null;
function flowerMaterial() {
  if (!sharedMat) {
    sharedMat = windify(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
      0.06,
      0.5,
    );
  }
  return sharedMat;
}

export function buildFlowerClump(species: FlowerSpecies, seed: number): THREE.Mesh {
  const rnd = mulberry32(seed);
  const [lo, hi] = BLOOMS_PER_CLUMP[species];
  const n = lo + Math.floor(rnd() * (hi - lo + 1));
  const radius = species === 'sunflower' ? 0.4 : 0.34;
  const all: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    const { parts } = bloomFor(species, rnd);
    const s = 1.0 + rnd() * 0.35;
    for (const p of parts) {
      p.scale(s, s, s);
      p.rotateY(rnd() * 0.3);
      p.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      all.push(clean(p));
    }
  }
  const merged = mergeGeometries(all, false)!;
  all.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, flowerMaterial());
  mesh.castShadow = species === 'sunflower' || species === 'foxglove';
  mesh.receiveShadow = true;
  return mesh;
}
