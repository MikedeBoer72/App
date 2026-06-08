// Absolute-positioned background layer rendered behind the dashboard
// content. Drawn entirely with react-native-svg so each pattern
// scales to any screen size. pointerEvents="none" everywhere so
// touches always pass through to the underlying UI.

import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import type { DecorationId } from '@/constants/decorations';

export interface DecorationLayerProps {
  id:            DecorationId;
  accentColor:   string;
  mutedColor:    string;
  primaryColor:  string;
}

export function DecorationLayer({ id, accentColor, mutedColor, primaryColor }: DecorationLayerProps) {
  switch (id) {
    case 'dots':       return <DotsPattern color={mutedColor} />;
    case 'grid':       return <GridPattern color={mutedColor} />;
    case 'circles':    return <OrbsDeco color={accentColor} />;
    case 'magic-ring': return <MagicRingDeco accent={accentColor} primary={primaryColor} />;
    case 'none':
    default:           return null;
  }
}

// ---------------------------------------------------------------------------
// Patterns (repeat across the whole screen)
// ---------------------------------------------------------------------------

function DotsPattern({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="yl-dots" width={28} height={28} patternUnits="userSpaceOnUse">
          <Circle cx={14} cy={14} r={1.4} fill={color} opacity={0.4} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#yl-dots)" />
    </Svg>
  );
}

function GridPattern({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="yl-grid" width={36} height={36} patternUnits="userSpaceOnUse">
          <Path d="M36 0 L0 0 L0 36" fill="none" stroke={color} strokeWidth={1} opacity={0.28} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#yl-grid)" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Compositions (specific positions, not repeating)
// ---------------------------------------------------------------------------

function OrbsDeco({ color }: { color: string }) {
  // Big soft glowing orbs at fixed corners. Using percentage strings
  // so the layout scales to any phone size.
  const orbs = [
    { cx: '12%', cy: '6%',  r: 90 },
    { cx: '88%', cy: '14%', r: 110 },
    { cx: '78%', cy: '52%', r: 70 },
    { cx: '15%', cy: '64%', r: 130 },
    { cx: '92%', cy: '88%', r: 80 },
  ];
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {orbs.map((o, i) => (
        <Circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={color} opacity={0.07} />
      ))}
    </Svg>
  );
}

function MagicRingDeco({ accent, primary }: { accent: string; primary: string }) {
  // Centered behind the level circle (roughly upper-third of the
  // screen). Double ring with 12 rune dots around the edge — gives a
  // "summoning circle" vibe under whichever theme is active.
  const runeCount = 12;
  const cx = 50;
  const cy = 34;
  const runeR = 36;
  const runes = Array.from({ length: runeCount }, (_, i) => {
    const angle = (i / runeCount) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * runeR, y: cy + Math.sin(angle) * runeR };
  });
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Circle cx={cx} cy={cy} r={41} stroke={accent} strokeWidth={0.45} fill="none" opacity={0.28} />
      <Circle cx={cx} cy={cy} r={36} stroke={accent} strokeWidth={0.25} fill="none" opacity={0.28} />
      <Circle cx={cx} cy={cy} r={29} stroke={primary} strokeWidth={0.15} fill="none" opacity={0.18} />
      {runes.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={0.9} fill={accent} opacity={0.55} />
      ))}
    </Svg>
  );
}
