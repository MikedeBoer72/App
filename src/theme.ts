export const theme = {
  colors: {
    bg: '#0b0b1a',
    bgElevated: '#15152a',
    card: '#1c1c36',
    cardBorder: '#2a2a4a',
    text: '#f1f1ff',
    textDim: '#9a9ac4',
    textMuted: '#6b6b8e',
    primary: '#8a5cf6',
    primaryDim: '#5d3fa8',
    accent: '#22d3ee',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    sleep: '#818cf8',
    nutrition: '#fb923c',
    workout: '#f472b6',
    water: '#38bdf8',
    xp: '#facc15',
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  font: {
    title: 28,
    heading: 20,
    body: 16,
    small: 14,
    tiny: 12,
  },
};

export type Theme = typeof theme;
