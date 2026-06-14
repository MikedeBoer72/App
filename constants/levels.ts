// Level + XP constants for YourLevel.
//
// XP cost to advance one level depends on the band the current level is in:
//   levels   1..4   -> 500   xp each (gets you to 2, 3, 4, 5)
//   levels   5..19  -> 1000  xp each (gets you to 6..20)
//   levels  20..99  -> 2000  xp each (gets you to 21..100)
//   levels 100+     -> 5000  xp each
//
// Tier names are sparse — one per major milestone.

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
  { minLevel: 1,   maxLevel: 4,             xpPerLevel:   500 },
  { minLevel: 5,   maxLevel: 19,            xpPerLevel:  1000 },
  { minLevel: 20,  maxLevel: 99,            xpPerLevel:  2000 },
  { minLevel: 100, maxLevel: Infinity,      xpPerLevel:  5000 },
] as const;

export const MAX_LEVEL_NAMED = 100;
