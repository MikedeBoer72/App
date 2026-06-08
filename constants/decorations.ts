// Unlockable background decoration layers. Same gating model as
// themes: level-gated + (mostly) Pro-gated, since you need to be
// past the level-5 paywall to be at level 5+ anyway. Only "None"
// is free; the rest are Pro and spaced out across the level range
// so each is a distinct "I unlocked something" moment.

export type DecorationId =
  | 'none'
  | 'dots'
  | 'grid'
  | 'circles'
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
    unlockLevel: 25,
    isPaid:      true,
    description: 'Subtle polka dots.',
  },
  {
    id:          'grid',
    name:        'Grid',
    unlockLevel: 75,
    isPaid:      true,
    description: 'Faint graph-paper lines.',
  },
  {
    id:          'circles',
    name:        'Orbs',
    unlockLevel: 125,
    isPaid:      true,
    description: 'Soft glowing orbs scattered behind.',
  },
  {
    id:          'magic-ring',
    name:        'Magic Ring',
    unlockLevel: 225,
    isPaid:      true,
    description: 'A glowing rune circle behind your level.',
  },
] as const;

export const DEFAULT_DECORATION_ID: DecorationId = 'none';

export function getDecoration(id: DecorationId): Decoration {
  return DECORATIONS.find((d) => d.id === id) ?? DECORATIONS[0]!;
}
