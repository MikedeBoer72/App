// Level + XP constants for YourLevel.
//
// XP cost to advance one level depends on the band the current level is in:
//   levels  1..4  -> 500   xp each (gets you to 2, 3, 4, 5)
//   levels  5..19 -> 2000  xp each (gets you to 6..20)
//   levels 20..49 -> 5000  xp each (gets you to 21..50)
//   levels 50+    -> 10000 xp each
//
// Tier names are intentionally sparse (only 4) — one per band.

export const LEVEL_TIERS = [
  { minLevel: 1,   name: 'Beginner'   },
  { minLevel: 5,   name: 'Challenger' },
  { minLevel: 20,  name: 'Warrior'    },
  { minLevel: 50,  name: 'Legend'     },
  { minLevel: 100, name: 'Master'     },
  { minLevel: 150, name: 'Mythic'     },
  { minLevel: 200, name: 'Ascended'   },
  { minLevel: 250, name: 'Sovereign'  },
] as const;

export const XP_BANDS = [
  { minLevel: 1,  maxLevel: 4,             xpPerLevel:   500 },
  { minLevel: 5,  maxLevel: 19,            xpPerLevel:  2000 },
  { minLevel: 20, maxLevel: 49,            xpPerLevel:  5000 },
  { minLevel: 50, maxLevel: Infinity,      xpPerLevel: 10000 },
] as const;

export const MAX_LEVEL_NAMED = 100;
