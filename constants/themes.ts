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
  | 'ocean'
  | 'sunset'
  | 'midnight'
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
const PLAYFAIR = {
  regular: 'PlayfairDisplay_400Regular',
  bold:    'PlayfairDisplay_700Bold',
  heavy:   'PlayfairDisplay_900Black',
};
const RUBIK = {
  regular: 'Rubik_400Regular',
  bold:    'Rubik_700Bold',
  heavy:   'Rubik_900Black',
};
const OUTFIT = {
  regular: 'Outfit_400Regular',
  bold:    'Outfit_700Bold',
  heavy:   'Outfit_900Black',
};
const QUICKSAND = {
  regular: 'Quicksand_400Regular',
  bold:    'Quicksand_700Bold',
  heavy:   'Quicksand_700Bold',              // tops at 700
};
const LORA = {
  regular: 'Lora_400Regular',
  bold:    'Lora_700Bold',
  heavy:   'Lora_700Bold',                   // tops at 700
};
const CINZEL = {
  regular: 'Cinzel_400Regular',
  bold:    'Cinzel_700Bold',
  heavy:   'Cinzel_900Black',
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
    id:          'calm',
    name:        'Calm',
    unlockLevel: 5,
    isPaid:      true,
    description: 'Warm cream and antique gold.',
    fontLabel:   'Playfair Display',
    fonts:       PLAYFAIR,
    colors: {
      background: '#FAFAF0',
      surface:    '#F0EFE2',
      primary:    '#2C2C2C',
      secondary:  '#6B6B5A',
      accent:     '#D4A843',
      danger:     '#C95B5B',
      success:    '#5B9C6E',
      muted:      '#D8D6C2',
    },
  },
  {
    id:          'slate',
    name:        'Slate',
    unlockLevel: 10,
    isPaid:      true,
    description: 'Cool gray with a sky-blue spark.',
    fontLabel:   'Rubik',
    fonts:       RUBIK,
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
    fontLabel:   'Outfit',
    fonts:       OUTFIT,
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
    id:          'ocean',
    name:        'Ocean',
    unlockLevel: 30,
    isPaid:      true,
    description: 'Deep blue, like the abyss.',
    fontLabel:   'Quicksand',
    fonts:       QUICKSAND,
    colors: {
      background: '#0C4A6E',
      surface:    '#075985',
      primary:    '#E0F2FE',
      secondary:  '#BAE6FD',
      accent:     '#06B6D4',
      danger:     '#F87171',
      success:    '#34D399',
      muted:      '#155E75',
    },
  },
  {
    id:          'sunset',
    name:        'Sunset',
    unlockLevel: 40,
    isPaid:      true,
    description: 'Warm dusk, orange embers.',
    fontLabel:   'Lora',
    fonts:       LORA,
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
    id:          'midnight',
    name:        'Midnight',
    unlockLevel: 50,
    isPaid:      true,
    description: 'Mysterious night blue with indigo runes.',
    fontLabel:   'Cinzel',
    fonts:       CINZEL,
    colors: {
      background: '#0F172A',
      surface:    '#1E293B',
      primary:    '#E2E8F0',
      secondary:  '#CBD5E1',
      accent:     '#818CF8',
      danger:     '#F87171',
      success:    '#4ADE80',
      muted:      '#334155',
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
    name:        'Solo Leveling',
    unlockLevel: 100,
    isPaid:      true,
    description: 'Shadow Monarch — deep blue-black with violet runes.',
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
