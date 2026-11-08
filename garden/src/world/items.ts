import * as THREE from 'three';
import type { FlowerSpecies, ItemKind } from '../data/config';
import { buildFlowerClump } from './flowers';
import { buildBench, buildLantern } from './props';
import { buildBoulders } from './rocks';
import { buildBush, buildTree } from './trees';
import { buildPond, buildWaterfall } from './water';

export interface BuiltItem {
  object: THREE.Object3D;
  update?: (t: number) => void;
  /** radius in which grass is cleared */
  clear?: number;
  /** radius the viewer can't walk through */
  solid?: number;
}

export function buildItem(kind: ItemKind, seed: number, species?: FlowerSpecies): BuiltItem {
  switch (kind) {
    case 'flower':
      return { object: buildFlowerClump(species ?? 'daisy', seed) };
    case 'birch':
    case 'oak':
    case 'cherry':
    case 'pine':
      return { object: buildTree(kind, seed), solid: kind === 'oak' ? 0.6 : 0.4 };
    case 'bush':
      return { object: buildBush(seed), solid: 0.7 };
    case 'boulder':
      return { object: buildBoulders(seed), solid: 1.0, clear: 0.9 };
    case 'lantern':
      return { object: buildLantern(), solid: 0.35 };
    case 'bench':
      return { object: buildBench(), solid: 0.6 };
    case 'pond':
      return { object: buildPond(seed), clear: 2.9, solid: 2.4 };
    case 'waterfall': {
      const w = buildWaterfall(seed);
      return { object: w.group, update: w.update, clear: 3.6, solid: 2.6 };
    }
  }
}
