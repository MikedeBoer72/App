// Upcoming-unlock registry: one place that knows what the player gets
// next, across themes AND decorations.
//
// Hype rule: themes are announced by NAME (name recognition builds
// anticipation), decorations are MYSTERY ("???") until reached — the
// reveal happens in the unlock celebration. The roadmap/map screen
// will reuse this same registry later.

import { DECORATIONS } from '@/constants/decorations';
import { THEMES } from '@/constants/themes';

export interface UpcomingUnlock {
  level:    number;
  kind:     'theme' | 'decoration';
  id:       string;
  name:     string;
  /** True = show as "???" until reached. */
  mystery:  boolean;
}

/** All unlocks strictly above `afterLevel`, nearest first. */
export function getUpcomingUnlocks(afterLevel: number): UpcomingUnlock[] {
  const themes: UpcomingUnlock[] = THEMES
    .filter((t) => t.unlockLevel > afterLevel)
    .map((t) => ({
      level:   t.unlockLevel,
      kind:    'theme' as const,
      id:      t.id,
      name:    t.name,
      mystery: false,
    }));
  const decorations: UpcomingUnlock[] = DECORATIONS
    .filter((d) => d.id !== 'none' && d.unlockLevel > afterLevel)
    .map((d) => ({
      level:   d.unlockLevel,
      kind:    'decoration' as const,
      id:      d.id,
      name:    d.name,
      mystery: true,
    }));
  return [...themes, ...decorations].sort((a, b) => a.level - b.level);
}

/** The nearest unlock above `afterLevel`, or null past the last one. */
export function getNextUnlock(afterLevel: number): UpcomingUnlock | null {
  return getUpcomingUnlocks(afterLevel)[0] ?? null;
}

export interface JourneyItem {
  kind:   'world' | 'decoration';
  id:     string;
  name:   string;
  level:  number;
}

/**
 * The full journey, ascending by unlock level: every theme as a
 * "world", every decoration as a mystery node between worlds. Ties
 * sort worlds before decorations (the world is the destination; the
 * decoration is loot found on the way in).
 */
export function getJourneyTimeline(): JourneyItem[] {
  const worlds: JourneyItem[] = THEMES.map((t) => ({
    kind:  'world' as const,
    id:    t.id,
    name:  t.name,
    level: t.unlockLevel,
  }));
  const decos: JourneyItem[] = DECORATIONS
    .filter((d) => d.id !== 'none')
    .map((d) => ({
      kind:  'decoration' as const,
      id:    d.id,
      name:  d.name,
      level: d.unlockLevel,
    }));
  return [...worlds, ...decos].sort((a, b) =>
    a.level === b.level ? (a.kind === 'world' ? -1 : 1) : a.level - b.level,
  );
}

/**
 * The unlock level the player most recently passed (or 1). Used to
 * draw "progress between milestones" bars: you're X% of the way from
 * the last unlock to the next one.
 */
export function getPreviousUnlockLevel(level: number): number {
  const passed = [...THEMES, ...DECORATIONS.filter((d) => d.id !== 'none')]
    .map((x) => x.unlockLevel)
    .filter((l) => l <= level);
  return passed.length > 0 ? Math.max(...passed) : 1;
}
