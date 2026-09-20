// Unlockable theme / font palettes. Each theme is gated by a level
// milestone (see `unlockLevel`) and most are also Pro-only (`isPaid`).
// The level-5 paywall already requires a subscription to progress
// past level 5, so every theme from Calm onwards is Pro.
//
// The font identifiers match the *export names* in @expo-google-fonts
// packages (e.g. `Orbitron_900Black`). The same strings must appear
// in app/_layout.tsx's useFonts call so React Native can resolve them
// at render time.

export type ThemeId =
  | 'default'
  | 'paper'
  | 'calm'
  | 'slate'
  | 'green'
  | 'vapor'
  | 'sunset'
  | 'vampire'
  | 'royal'
  | 'solo'
  | 'inferno'
  | 'galaxy'
  | 'cyberpunk';

export interface Theme {
  id:           ThemeId;
  name:         string;
  unlockLevel:  number;
  isPaid:       boolean;
  description:  string;
  /** Display name shown to humans (the Fonts settings preview, etc.). */
  fontLabel:    string;
  /**
   * RN fontFamily strings, mapped to @expo-google-fonts export names.
   * `heavy` is reserved for biggest-text moments (level number,
   * level-up celebration); `bold` for headers; `regular` for body.
   * Single-weight display fonts (Russo One, Audiowide, DM Serif
   * Display) alias all three to the same export — they're already
   * visually heavy.
   */
  fonts: {
    regular: string;
    bold:    string;
    heavy:   string;
  };
  colors: {
    background: string;
    surface:    string;
    primary:    string;
    secondary:  string;
    accent:     string;
    danger:     string;
    success:    string;
    muted:      string;
  };
}

// ---------------------------------------------------------------------------
// Font weight maps
// ---------------------------------------------------------------------------

const SPACE_GROTESK = {
  regular: 'SpaceGrotesk_400Regular',
  bold:    'SpaceGrotesk_700Bold',
  heavy:   'SpaceGrotesk_700Bold',           // tops at 700
};
const INTER = {
  regular: 'Inter_400Regular',
  bold:    'Inter_700Bold',
  heavy:   'Inter_900Black',
};
const PACIFICO = {                            // single-weight script
  regular: 'Pacifico_400Regular',
  bold:    'Pacifico_400Regular',
  heavy:   'Pacifico_400Regular',
};
const CHAKRA_PETCH = {                        // squared sci-fi/mecha
  regular: 'ChakraPetch_400Regular',
  bold:    'ChakraPetch_600SemiBold',
  heavy:   'ChakraPetch_700Bold',            // tops at 700
};
const BALOO = {
  regular: 'Baloo2_400Regular',
  bold:    'Baloo2_700Bold',
  heavy:   'Baloo2_800ExtraBold',
};
const ALFA_SLAB = {                           // single-weight chunky slab
  regular: 'AlfaSlabOne_400Regular',
  bold:    'AlfaSlabOne_400Regular',
  heavy:   'AlfaSlabOne_400Regular',
};
const CINZEL = {
  regular: 'Cinzel_400Regular',
  bold:    'Cinzel_700Bold',
  heavy:   'Cinzel_900Black',
};
const MAJOR_MONO = {                          // single-weight retro mono
  regular: 'MajorMonoDisplay_400Regular',
  bold:    'MajorMonoDisplay_400Regular',
  heavy:   'MajorMonoDisplay_400Regular',
};
const DM_SERIF = {                            // single-weight display
  regular: 'DMSerifDisplay_400Regular',
  bold:    'DMSerifDisplay_400Regular',
  heavy:   'DMSerifDisplay_400Regular',
};
const ORBITRON = {
  regular: 'Orbitron_400Regular',
  bold:    'Orbitron_700Bold',
  heavy:   'Orbitron_900Black',
};
const RUSSO_ONE = {                           // single-weight display
  regular: 'RussoOne_400Regular',
  bold:    'RussoOne_400Regular',
  heavy:   'RussoOne_400Regular',
};
const AUDIOWIDE = {                           // single-weight display
  regular: 'Audiowide_400Regular',
  bold:    'Audiowide_400Regular',
  heavy:   'Audiowide_400Regular',
};
const JET_MONO = {
  regular: 'JetBrainsMono_400Regular',
  bold:    'JetBrainsMono_700Bold',
  heavy:   'JetBrainsMono_800ExtraBold',
};

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export const THEMES: readonly Theme[] = [
  {
    id:          'default',
    name:        'Default',
    unlockLevel: 1,
    isPaid:      false,
    description: 'Clean and simple.',
    fontLabel:   'Space Grotesk',
    fonts:       SPACE_GROTESK,
    colors: {
      background: '#0A0A0A',
      surface:    '#141414',
      primary:    '#FFFFFF',
      secondary:  '#B8B8B8',
      accent:     '#4A90E2',
      danger:     '#FF4D4F',
      success:    '#3DD68C',
      muted:      '#3A3A3A',
    },
  },
  {
    id:          'paper',
    name:        'Paper',
    unlockLevel: 2,
    isPaid:      false,
    description: 'Clean white. Distraction-free.',
    fontLabel:   'Inter',
    fonts:       INTER,
    colors: {
      background: '#FFFFFF',
      surface:    '#F5F5F5',
      primary:    '#1A1A1A',
      secondary:  '#525252',
      accent:     '#2563EB',
      danger:     '#DC2626',
      success:    '#16A34A',
      muted:      '#A3A3A3',
    },
  },
  {
    id:          'calm',   // id kept for saved profiles; shown as "Sand"
    name:        'Sand',
    unlockLevel: 5,
    isPaid:      true,
    description: 'Light sandy dunes and dark gold.',
    fontLabel:   'Pacifico',
    fonts:       PACIFICO,
    colors: {
      background: '#FBF3D8',
      surface:    '#F3E7BC',
      primary:    '#3E3316',
      secondary:  '#8A7440',
      accent:     '#D4A843',
      danger:     '#C95B5B',
      success:    '#5B9C6E',
      muted:      '#E2D5A6',
    },
  },
  {
    id:          'slate',
    name:        'Slate',
    unlockLevel: 10,
    isPaid:      true,
    description: 'Cool gray with a sky-blue spark.',
    fontLabel:   'Chakra Petch',
    fonts:       CHAKRA_PETCH,
    colors: {
      background: '#1E293B',
      surface:    '#334155',
      primary:    '#F1F5F9',
      secondary:  '#CBD5E1',
      accent:     '#38BDF8',
      danger:     '#F87171',
      success:    '#4ADE80',
      muted:      '#475569',
    },
  },
  {
    id:          'green',
    name:        'Green Vibes',
    unlockLevel: 20,
    isPaid:      true,
    description: 'Kiwi cream and grass green.',
    fontLabel:   'Baloo 2',
    fonts:       BALOO,
    colors: {
      background: '#F7FEE7',
      surface:    '#FFFFFF',
      primary:    '#1A2E05',
      secondary:  '#365314',
      accent:     '#65A30D',
      danger:     '#B91C1C',
      success:    '#16A34A',
      muted:      '#4D7C0F',
    },
  },
  {
    id:          'vapor',
    name:        'Vapor',
    unlockLevel: 30,
    isPaid:      true,
    description: 'Vaporwave. Pink, cyan and 80s neon.',
    fontLabel:   'Major Mono Display',
    fonts:       MAJOR_MONO,
    colors: {
      background: '#1A0B2E',  // deep purple-black
      surface:    '#2E1A47',  // mid purple
      primary:    '#F0E6FF',  // lavender white
      secondary:  '#FF71CE',  // hot pink
      accent:     '#01CDFE',  // electric cyan
      danger:     '#FF4F4F',
      success:    '#05FFA1',  // mint
      muted:      '#4A2C6B',  // dim purple
    },
  },
  {
    id:          'sunset',
    name:        'Sunset',
    unlockLevel: 40,
    isPaid:      true,
    description: 'Warm dusk, orange embers.',
    fontLabel:   'Alfa Slab One',
    fonts:       ALFA_SLAB,
    colors: {
      background: '#292524',
      surface:    '#44403C',
      primary:    '#FEF3C7',
      secondary:  '#FCD34D',
      accent:     '#F97316',
      danger:     '#EF4444',
      success:    '#FBBF24',
      muted:      '#57534E',
    },
  },
  {
    id:          'vampire',
    name:        'Vampire',
    unlockLevel: 50,
    isPaid:      true,
    description: 'Blood red on black velvet. Gothic.',
    fontLabel:   'Cinzel',
    fonts:       CINZEL,
    colors: {
      background: '#0A0001',  // near-black, hint of red
      surface:    '#1A0408',  // dark red-black
      primary:    '#F5E4E4',  // off-white with red tint
      secondary:  '#FCA5A5',  // pale rose
      accent:     '#DC2626',  // blood red
      danger:     '#B91C1C',  // deeper alarm red
      success:    '#4ADE80',  // clean lime for contrast
      muted:      '#2A0408',  // very dim red-black for dividers
    },
  },
  {
    id:          'royal',
    name:        'Royal',
    unlockLevel: 75,
    isPaid:      true,
    description: 'Black velvet and antique gold.',
    fontLabel:   'DM Serif Display',
    fonts:       DM_SERIF,
    colors: {
      background: '#0C0A09',
      surface:    '#1C1917',
      primary:    '#FAEEC3',
      secondary:  '#D4AF37',
      accent:     '#FFD700',
      danger:     '#B91C1C',
      success:    '#4ADE80',
      muted:      '#292524',
    },
  },
  {
    id:          'solo',
    // NOTE: the id stays 'solo' so saved profiles keep working, but the
    // user-visible name must never reference a third-party franchise
    // (App Review guideline 5.2.1). The look is unchanged.
    name:        'Eclipse',
    unlockLevel: 100,
    isPaid:      true,
    description: 'Deep blue-black with violet runes.',
    fontLabel:   'Orbitron',
    fonts:       ORBITRON,
    colors: {
      background: '#06070C',
      surface:    '#0E1020',
      primary:    '#E8E8F0',
      secondary:  '#A0A0C8',
      accent:     '#8B5CF6',
      danger:     '#F43F5E',
      success:    '#22D3EE',
      muted:      '#1F1F35',
    },
  },
  {
    id:          'inferno',
    name:        'Inferno',
    unlockLevel: 150,
    isPaid:      true,
    description: 'Hellfire. Don\'t get burned.',
    fontLabel:   'Russo One',
    fonts:       RUSSO_ONE,
    colors: {
      background: '#18181B',
      surface:    '#27272A',
      primary:    '#FEF2F2',
      secondary:  '#FCA5A5',
      accent:     '#DC2626',
      danger:     '#FB923C',
      success:    '#4ADE80',
      muted:      '#3F3F46',
    },
  },
  {
    id:          'galaxy',
    name:        'Galaxy',
    unlockLevel: 200,
    isPaid:      true,
    description: 'Cosmic indigo and cyan stardust.',
    fontLabel:   'Audiowide',
    fonts:       AUDIOWIDE,
    colors: {
      background: '#1E1B4B',
      surface:    '#312E81',
      primary:    '#E0E7FF',
      secondary:  '#C7D2FE',
      accent:     '#22D3EE',
      danger:     '#F472B6',
      success:    '#4ADE80',
      muted:      '#4338CA',
    },
  },
  {
    id:          'cyberpunk',
    name:        'Cyberpunk',
    unlockLevel: 250,
    isPaid:      true,
    description: 'Neon. Outside the matrix.',
    fontLabel:   'JetBrains Mono',
    fonts:       JET_MONO,
    colors: {
      background: '#0D0D2B',
      surface:    '#15163A',
      primary:    '#00FFFF',
      secondary:  '#9D9DFF',
      accent:     '#FF00FF',
      danger:     '#FF4D6D',
      success:    '#3DFFAE',
      muted:      '#2A2A5E',
    },
  },
] as const;

export const DEFAULT_THEME_ID: ThemeId = 'default';

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
