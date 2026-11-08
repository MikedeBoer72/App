// Procedural trees and bushes: recursive branching wood + instanced leaf cards.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise';
import { barkTexture, birchBarkTexture, leafTexture, needleTexture } from './textures';
import { windify } from './wind';

type Rnd = () => number;

const UP = new THREE.Vector3(0, 1, 0);

function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, radial = 7): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
  g.deleteAttribute('uv');
  // UVs scaled by length so bark doesn't stretch
  const uv = new Float32Array((g.attributes.position.count) * 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const ang = Math.atan2(pos.getZ(i), pos.getX(i));
    uv[i * 2] = (ang / (Math.PI * 2)) * Math.max(1, r0 * 12);
    uv[i * 2 + 1] = ((pos.getY(i) + len / 2) / 2.5);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.translate(0, len / 2, 0);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
  g.translate(a.x, a.y, a.z);
  return g.index ? g.toNonIndexed() : g;
}

interface LeafSpot {
  p: THREE.Vector3;
  s: number;
}

interface TreeSpec {
  height: number;
  trunkR: number;
  depth: number;
  spread: number; // radians away from parent
  children: [number, number];
  shrink: number;
  leafStart: number; // depth at which leaves appear
  leafSize: number;
  leafPerBranch: number;
  leafRadius: number;
  upward: number; // pull of branches toward the sky
}

function grow(spec: TreeSpec, rnd: Rnd) {
  const wood: THREE.BufferGeometry[] = [];
  const leaves: LeafSpot[] = [];

  const branch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    // two segments per branch for a slight curve
    const mid = start.clone().addScaledVector(dir, len * 0.5);
    const d2 = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.3, spec.upward * 0.3, (rnd() - 0.5) * 0.3)).normalize();
    const end = mid.clone().addScaledVector(d2, len * 0.5);
    const rMid = r * (1 - (1 - spec.shrink) * 0.5);
    const rEnd = r * spec.shrink;
    wood.push(limb(start, mid, r, rMid, depth === 0 ? 9 : 6), limb(mid, end, rMid, rEnd, depth === 0 ? 9 : 6));

    if (depth >= spec.leafStart) {
      for (let i = 0; i < spec.leafPerBranch; i++) {
        const t = 0.3 + rnd() * 0.7;
        const p = start.clone().lerp(end, t).add(
          new THREE.Vector3((rnd() - 0.5), (rnd() - 0.3), (rnd() - 0.5)).multiplyScalar(spec.leafRadius),
        );
        leaves.push({ p, s: spec.leafSize * (0.7 + rnd() * 0.6) });
      }
    }
    if (depth >= spec.depth) return;

    const [lo, hi] = spec.children;
    const n = lo + Math.floor(rnd() * (hi - lo + 1));
    const phase = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const az = phase + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
      // perpendicular axis to rotate away from parent direction
      const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const axis = new THREE.Vector3().crossVectors(dir, side).normalize();
      if (axis.lengthSq() < 0.01) axis.set(1, 0, 0);
      const nd = dir.clone().applyAxisAngle(axis, spec.spread * (0.7 + rnd() * 0.6));
      nd.y += spec.upward * 0.5;
      nd.normalize();
      const from = depth === 0 ? start.clone().lerp(end, 0.55 + rnd() * 0.45) : end;
      branch(from, nd, len * (0.62 + rnd() * 0.18), rEnd * 0.95, depth + 1);
    }
    // the trunk keeps going up
    if (depth === 0) branch(end, d2, len * 0.55, rEnd, depth + 1);
  };

  branch(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3((rnd() - 0.5) * 0.08, 1, (rnd() - 0.5) * 0.08).normalize(), spec.height * 0.55, spec.trunkR, 0);
  return { wood, leaves };
}

function leafCards(
  spots: LeafSpot[],
  tex: THREE.Texture,
  color: THREE.ColorRepresentation,
  variance: number,
  rnd: Rnd,
  windStrength: number,
  windRef: number,
): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = windify(
    new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.8,
      color: '#ffffff',
    }),
    windStrength,
    windRef,
  );
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const base = new THREE.Color(color);
  const c = new THREE.Color();
  spots.forEach((sp, i) => {
    e.set(rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI);
    q.setFromEuler(e);
    s.setScalar(sp.s);
    m.compose(sp.p, q, s);
    mesh.setMatrixAt(i, m);
    c.copy(base).offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * variance);
    mesh.setColorAt(i, c);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function woodMesh(parts: THREE.BufferGeometry[], tex: THREE.Texture, tint: THREE.ColorRepresentation = '#ffffff') {
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: tint }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildTree(kind: 'birch' | 'oak' | 'cherry' | 'pine', seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();

  if (kind === 'pine') {
    const h = 9 + rnd() * 3;
    const wood: THREE.BufferGeometry[] = [limb(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, h, 0), 0.32, 0.05, 9)];
    const spots: LeafSpot[] = [];
    for (let y = h * 0.35; y < h; y += 0.55 + rnd() * 0.2) {
      const t = (y - h * 0.35) / (h * 0.65);
      const len = (1 - t) * 3.2 + 0.4;
      const n = 5 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd();
        const dir = new THREE.Vector3(Math.cos(a), -0.15 - rnd() * 0.15, Math.sin(a)).normalize();
        const start = new THREE.Vector3(0, y, 0);
        const end = start.clone().addScaledVector(dir, len);
        wood.push(limb(start, end, 0.06 * (1 - t) + 0.02, 0.01, 4));
        for (let k = 0; k < 4 + len * 2; k++) {
          const p = start.clone().lerp(end, 0.2 + rnd() * 0.8).add(new THREE.Vector3((rnd() - 0.5) * 0.5, (rnd() - 0.3) * 0.4, (rnd() - 0.5) * 0.5));
          spots.push({ p, s: 0.9 + rnd() * 0.5 });
        }
      }
    }
    group.add(woodMesh(wood, barkTexture(), '#9a8a7a'));
    group.add(leafCards(spots, needleTexture(), '#33502c', 0.08, rnd, 0.03, 8));
    return group;
  }

  const specs: Record<'birch' | 'oak' | 'cherry', TreeSpec> = {
    birch: { height: 8 + rnd() * 2, trunkR: 0.15, depth: 3, spread: 0.55, children: [2, 3], shrink: 0.6, leafStart: 2, leafSize: 0.75, leafPerBranch: 18, leafRadius: 1.0, upward: 0.35 },
    oak: { height: 6.5 + rnd() * 1.5, trunkR: 0.38, depth: 3, spread: 0.95, children: [3, 4], shrink: 0.62, leafStart: 2, leafSize: 1.15, leafPerBranch: 16, leafRadius: 1.6, upward: 0.15 },
    cherry: { height: 5 + rnd(), trunkR: 0.22, depth: 3, spread: 1.0, children: [2, 3], shrink: 0.6, leafStart: 2, leafSize: 0.85, leafPerBranch: 22, leafRadius: 1.1, upward: 0.1 },
  };
  const spec = specs[kind];
  const { wood, leaves } = grow(spec, rnd);
  const bark = kind === 'birch' ? birchBarkTexture() : barkTexture();
  group.add(woodMesh(wood, bark, kind === 'cherry' ? '#8a6f66' : '#ffffff'));
  const leafTex = leafTexture(kind === 'cherry' ? 'blossom' : kind === 'birch' ? 'small' : 'broad');
  const color = kind === 'birch' ? '#a1b45a' : kind === 'oak' ? '#4f6d2c' : '#f3c6d3';
  group.add(leafCards(leaves, leafTex, color, kind === 'cherry' ? 0.05 : 0.12, rnd, 0.06, 6));
  return group;
}

export function buildBush(seed: number): THREE.Group {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const spots: LeafSpot[] = [];
  const blossoms: LeafSpot[] = [];
  const R = 0.9 + rnd() * 0.3;
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * R;
    const y = Math.sqrt(Math.max(0, 1 - (r / R) ** 2)) * R * 1.1 * rnd() + 0.15;
    spots.push({ p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), s: 0.55 + rnd() * 0.3 });
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const el = rnd() * 1.2;
    const p = new THREE.Vector3(Math.cos(a) * Math.cos(el) * R, Math.sin(el) * R * 1.05 + 0.2, Math.sin(a) * Math.cos(el) * R);
    blossoms.push({ p, s: 0.28 + rnd() * 0.12 });
  }
  group.add(leafCards(spots, leafTexture('broad'), '#466a2d', 0.12, rnd, 0.05, 1.5));
  group.add(leafCards(blossoms, leafTexture('blossom'), '#f4efdc', 0.03, rnd, 0.06, 1.5));
  return group;
}
