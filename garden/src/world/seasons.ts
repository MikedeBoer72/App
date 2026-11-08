// Seasons follow the real calendar (northern hemisphere / Netherlands).
// Foliage meshes register here so a season change can recolour them in place.

import * as THREE from 'three';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function seasonFor(d = new Date()): Season {
  const m = d.getMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export type FoliageRole = 'birch' | 'oak' | 'cherry' | 'pine' | 'bush' | 'bushBloom';

interface Look {
  color: string;
  visible: boolean;
}

const FOLIAGE: Record<FoliageRole, Record<Season, Look>> = {
  birch: {
    spring: { color: '#a8c95c', visible: true },
    summer: { color: '#a1b45a', visible: true },
    autumn: { color: '#e0b43c', visible: true },
    winter: { color: '#a1b45a', visible: false },
  },
  oak: {
    spring: { color: '#6f9c38', visible: true },
    summer: { color: '#4f6d2c', visible: true },
    autumn: { color: '#b4622b', visible: true },
    winter: { color: '#4f6d2c', visible: false },
  },
  cherry: {
    spring: { color: '#f6c6d4', visible: true },
    summer: { color: '#5f8034', visible: true },
    autumn: { color: '#c4462c', visible: true },
    winter: { color: '#5f8034', visible: false },
  },
  pine: {
    spring: { color: '#3a5a2e', visible: true },
    summer: { color: '#33502c', visible: true },
    autumn: { color: '#304a2a', visible: true },
    winter: { color: '#5d7466', visible: true },
  },
  bush: {
    spring: { color: '#5c8d35', visible: true },
    summer: { color: '#466a2d', visible: true },
    autumn: { color: '#8d6a2b', visible: true },
    winter: { color: '#6a7560', visible: true },
  },
  bushBloom: {
    spring: { color: '#f6f1df', visible: true },
    summer: { color: '#f4efdc', visible: true },
    autumn: { color: '#f4efdc', visible: false },
    winter: { color: '#f4efdc', visible: false },
  },
};

const registry = new Set<THREE.InstancedMesh>();
let current: Season = seasonFor();

export function currentSeason() {
  return current;
}

/** Register a foliage mesh; its per-instance variation is stored so it survives recolouring. */
export function registerFoliage(mesh: THREE.InstancedMesh, role: FoliageRole, variance: number, rnd: () => number) {
  const jitter = new Float32Array(mesh.count * 3);
  for (let i = 0; i < mesh.count; i++) {
    jitter[i * 3] = (rnd() - 0.5) * 0.04;
    jitter[i * 3 + 1] = (rnd() - 0.5) * 0.1;
    jitter[i * 3 + 2] = (rnd() - 0.5) * variance;
  }
  mesh.userData.foliage = { role, jitter };
  registry.add(mesh);
  paint(mesh, current);
}

export function unregisterFoliage(root: THREE.Object3D) {
  root.traverse((o) => registry.delete(o as THREE.InstancedMesh));
}

function paint(mesh: THREE.InstancedMesh, season: Season) {
  const { role, jitter } = mesh.userData.foliage as { role: FoliageRole; jitter: Float32Array };
  const look = FOLIAGE[role][season];
  mesh.visible = look.visible;
  const base = new THREE.Color(look.color);
  const c = new THREE.Color();
  for (let i = 0; i < mesh.count; i++) {
    c.copy(base).offsetHSL(jitter[i * 3], jitter[i * 3 + 1], jitter[i * 3 + 2]);
    mesh.setColorAt(i, c);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function applySeason(season: Season) {
  current = season;
  registry.forEach((m) => paint(m, season));
}

/** Grass + ground palettes (linear RGB). */
export const MEADOW: Record<
  Season,
  { midA: number[]; midB: number[]; tipA: number[]; tipB: number[]; snow: number; height: number; ground: [string, string, string] }
> = {
  spring: { midA: [0.15, 0.33, 0.07], midB: [0.21, 0.37, 0.09], tipA: [0.38, 0.6, 0.16], tipB: [0.5, 0.63, 0.2], snow: 0, height: 0.95, ground: ['#3f6326', '#5f7a30', '#2c4f1c'] },
  summer: { midA: [0.17, 0.3, 0.07], midB: [0.24, 0.33, 0.08], tipA: [0.42, 0.52, 0.17], tipB: [0.58, 0.55, 0.24], snow: 0, height: 1, ground: ['#3f5a26', '#7a7a3c', '#2c4a1c'] },
  autumn: { midA: [0.2, 0.25, 0.07], midB: [0.29, 0.28, 0.08], tipA: [0.52, 0.47, 0.18], tipB: [0.66, 0.52, 0.22], snow: 0, height: 0.9, ground: ['#4d5426', '#80662f', '#36451d'] },
  winter: { midA: [0.3, 0.33, 0.27], midB: [0.36, 0.38, 0.32], tipA: [0.55, 0.57, 0.5], tipB: [0.62, 0.62, 0.56], snow: 0.9, height: 0.38, ground: ['#d9dee3', '#c9cfd6', '#eef1f4'] },
};
