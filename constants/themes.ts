// Unlockable theme / font palettes. Each theme is gated by a level
// milestone matching the tier breakpoints in `levels.ts`. One paid
// theme (`green`) requires both the level unlock and a Pro subscription.
//
// The font identifiers match the *export names* in @expo-google-fonts
// packages (e.g. `Orbitron_900Black`). These exact strings must also
// be passed to useFonts in app/_layout.tsx so React Native can resolve
// them at render time.

export type ThemeId = 'default' | 'cyberpunk' | 'solo' | 'calm' | 'green';

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
   * `heavy` is reserved for the biggest-text moments (level number,
   * level-up celebration); `bold` for headers; `regular` for body.
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

const SPACE_GROTESK = {
  regular: 'SpaceGrotesk_400Regular',
  bold:    'SpaceGrotesk_700Bold',
  heavy:   'SpaceGrotesk_700Bold', // Space Grotesk tops out at 700
};
const JET_MONO = {
  regular: 'JetBrainsMono_400Regular',
  bold:    'JetBrainsMono_700Bold',
  heavy:   'JetBrainsMono_800ExtraBold',
};
const ORBITRON = {
  regular: 'Orbitron_400Regular',
  bold:    'Orbitron_700Bold',
  heavy:   'Orbitron_900Black',
};
const PLAYFAIR = {
  regular: 'PlayfairDisplay_400Regular',
  bold:    'PlayfairDisplay_700Bold',
  heavy:   'PlayfairDisplay_900Black',
};
const OUTFIT = {
  regular: 'Outfit_400Regular',
  bold:    'Outfit_700Bold',
  heavy:   'Outfit_900Black',
};

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
    id:          'cyberpunk',
    name:        'Cyberpunk',
    unlockLevel: 10,
    isPaid:      false,
    description: 'Dark blue with neon lines.',
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
  {
    id:          'solo',
    name:        'Solo Leveling',
    unlockLevel: 20,
    isPaid:      false,
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
    id:          'calm',
    name:        'Calm',
    unlockLevel: 35,
    isPaid:      false,
    description: 'Peaceful yellow and warm white tones.',
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
    id:          'green',
    name:        'Green Vibes',
    unlockLevel: 50,
    isPaid:      true,
    description: 'Nature-inspired green palette. Premium.',
    fontLabel:   'Outfit',
    fonts:       OUTFIT,
    colors: {
      background: '#0A1A0A',
      surface:    '#13251A',
      primary:    '#E8FFE8',
      secondary:  '#90EE90',
      accent:     '#32CD32',
      danger:     '#FF7A6B',
      success:    '#7CFC00',
      muted:      '#1F3520',
    },
  },
] as const;

export const DEFAULT_THEME_ID: ThemeId = 'default';

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
