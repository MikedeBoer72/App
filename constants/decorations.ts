// Unlockable background decoration layers. Same gating model as
// themes: level-gated + (mostly) Pro-gated, since you need to be
// past the level-5 paywall to be at level 5+ anyway. The first
// two are free as a sampler.

export type DecorationId =
  | 'none'
  | 'dots'
  | 'grid'
  | 'circles'
  | 'constellation'
  | 'magic-ring';

export interface Decoration {
  id:           DecorationId;
  name:         string;
  unlockLevel:  number;
  isPaid:       boolean;
  description:  string;
}

export const DECORATIONS: readonly Decoration[] = [
  {
    id:          'none',
    name:        'None',
    unlockLevel: 1,
    isPaid:      false,
    description: 'No background pattern.',
  },
  {
    id:          'dots',
    name:        'Dots',
    unlockLevel: 3,
    isPaid:      false,
    description: 'Subtle polka dots.',
  },
  {
    id:          'grid',
    name:        'Grid',
    unlockLevel: 8,
    isPaid:      true,
    description: 'Faint graph-paper lines.',
  },
  {
    id:          'circles',
    name:        'Orbs',
    unlockLevel: 15,
    isPaid:      true,
    description: 'Soft glowing orbs scattered behind.',
  },
  {
    id:          'constellation',
    name:        'Constellation',
    unlockLevel: 25,
    isPaid:      true,
    description: 'Stars connected by ley lines.',
  },
  {
    id:          'magic-ring',
    name:        'Magic Ring',
    unlockLevel: 60,
    isPaid:      true,
    description: 'A glowing rune circle behind your level.',
  },
] as const;

export const DEFAULT_DECORATION_ID: DecorationId = 'none';

export function getDecoration(id: DecorationId): Decoration {
  return DECORATIONS.find((d) => d.id === id) ?? DECORATIONS[0]!;
}
