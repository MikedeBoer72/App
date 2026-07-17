// YourLevel Roadmap — the world map.
//
// Candy-Crush-style level road: EVERY level is a numbered square step
// on ONE continuous serpentine road that winds from level 1 to the
// summit without a single break. There are no island "icons" — the
// road travels THROUGH each biome. Each theme paints the whole zone:
// its own terrain color, organic ground patches, a wide bordered road
// with a dotted trail, and dense themed scenery on both sides of the
// path (palms + beach huts on Calm, tombstones + a castle tower on
// Vampire, neon towers + robots + a mega-skyscraper on Cyberpunk...).
// Every ~4 levels a big HERO structure lands beside the road so each
// world has landmarks you physically walk past.
//
// Zone states:
//   unlocked  — full biome color; passed steps + road fill in accent
//   locked    — fog-grey: terrain, scenery, numbers and name all
//               visible, zero color, lock on the gate banner
//
// The player is a bigger SQUARE on their current step with a YOU ARE
// HERE chip. Decorations are ✨ squares beside the step that unlocks
// them ("???" until reached). Auto-scrolls to the player on mount.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { DECORATIONS, type Decoration } from '@/constants/decorations';
import { getTheme, THEMES, type ThemeId } from '@/constants/themes';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Fixed map palette (header/fog have their own identity)
// ---------------------------------------------------------------------------

const OCEAN       = '#06131D';
const FOG_BG      = '#0C141C';   // locked-zone ground
const FOG_NODE    = '#151C24';
const FOG_BORDER  = '#232E39';
const GREY_TEXT   = '#5E6B77';

/** Luminance-matched grey for locked-zone art: structure stays,
 *  color goes. Compressed into a dark band so it reads as fog. */
function toGrey(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const v = Math.round(42 + (l / 255) * 82); // 42..124
  const s = v.toString(16).padStart(2, '0');
  return `#${s}${s}${s}`;
}

/** Perceived luminance 0..255 of a hex color. */
function lum(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return (
    0.299 * parseInt(full.slice(0, 2), 16) +
    0.587 * parseInt(full.slice(2, 4), 16) +
    0.114 * parseInt(full.slice(4, 6), 16)
  );
}

/** Deterministic 0..1 jitter from a level number (stable across
 *  renders — no Math.random so the map never reshuffles). */
const frac = (n: number) => n - Math.floor(n);
const jitter = (lvl: number, salt: number) => frac(Math.abs(Math.sin(lvl * 12.9898 + salt * 78.233)) * 43758.5453);

// ---------------------------------------------------------------------------
// Per-theme terrain: the biome's ground, organic patch shades, and the
// road colors that cut through it. Hand-tuned so every world reads as
// its own place (grass meadow, golden beach, volcanic rock, neon
// street...) instead of reusing app-UI surface colors.
// ---------------------------------------------------------------------------

interface Terrain {
  ground: string;   // base ground fill
  patchA: string;   // lighter organic patch
  patchB: string;   // darker organic patch
  road:   string;   // road fill
  edge:   string;   // road border
  dash:   string;   // dotted center trail
  speckA: string;   // ambient particle colors (fireflies/embers/stars…)
  speckB: string;
}

const TERRAIN: Record<ThemeId, Terrain> = {
  default:   { ground: '#3B8C4C', patchA: '#4DA05E', patchB: '#2F7A40', road: '#EAD9A8', edge: '#C4A971', dash: '#FFFFFF', speckA: '#8FD9A0', speckB: '#FDE68A' },
  paper:     { ground: '#EDF1F7', patchA: '#FFFFFF', patchB: '#DDE4EE', road: '#CBD5E1', edge: '#9FB0C4', dash: '#FFFFFF', speckA: '#93C5FD', speckB: '#BFD3EA' },
  calm:      { ground: '#EFD9A7', patchA: '#F7E6BD', patchB: '#E3C98E', road: '#FAF3DC', edge: '#C9A96A', dash: '#FFFFFF', speckA: '#D4A843', speckB: '#5B9C6E' },
  slate:     { ground: '#334155', patchA: '#3E4E66', patchB: '#2A3547', road: '#64748B', edge: '#1E293B', dash: '#CBD5E1', speckA: '#38BDF8', speckB: '#BFE7FB' },
  green:     { ground: '#4D7C0F', patchA: '#65A30D', patchB: '#3F6212', road: '#EDF6D4', edge: '#A9BC72', dash: '#FFFFFF', speckA: '#BEF264', speckB: '#FACC15' },
  vapor:     { ground: '#2E1A47', patchA: '#3A2359', patchB: '#241238', road: '#4A2C6B', edge: '#FF71CE', dash: '#01CDFE', speckA: '#FF71CE', speckB: '#01CDFE' },
  sunset:    { ground: '#B4682F', patchA: '#C77B3F', patchB: '#9A5626', road: '#E8C287', edge: '#8A5220', dash: '#FFF7E0', speckA: '#FCD34D', speckB: '#F97316' },
  vampire:   { ground: '#140306', patchA: '#1E060B', patchB: '#0D0203', road: '#2A0A10', edge: '#4A1018', dash: '#DC2626', speckA: '#DC2626', speckB: '#FCA5A5' },
  royal:     { ground: '#171412', patchA: '#211D1A', patchB: '#100E0C', road: '#2E2A26', edge: '#D4AF37', dash: '#FFD700', speckA: '#FFD700', speckB: '#D4AF37' },
  solo:      { ground: '#0B0D1A', patchA: '#121530', patchB: '#070812', road: '#1C2040', edge: '#8B5CF6', dash: '#22D3EE', speckA: '#8B5CF6', speckB: '#22D3EE' },
  inferno:   { ground: '#1C1C1F', patchA: '#27272A', patchB: '#141416', road: '#3A3A40', edge: '#DC2626', dash: '#FB923C', speckA: '#FB923C', speckB: '#DC2626' },
  galaxy:    { ground: '#221F55', patchA: '#2B2868', patchB: '#191645', road: '#3B3788', edge: '#22D3EE', dash: '#E0E7FF', speckA: '#E0E7FF', speckB: '#22D3EE' },
  cyberpunk: { ground: '#0F1030', patchA: '#15163A', patchB: '#0A0A22', road: '#1E1F4E', edge: '#00FFFF', dash: '#FF00FF', speckA: '#00FFFF', speckB: '#FF00FF' },
};

// ---------------------------------------------------------------------------
// Roadside scenery. 6 variants per theme: 0-3 and 5 = small/medium
// props (5 is the biome's creature/extra — camel, parrot, hover car…),
// 4 = HERO structure (big landmark that appears every ~4 levels).
// Drawn around origin (base at 0,0, art extends upward). All rendered
// inside the zone's single SVG so hundreds of props stay cheap.
// ---------------------------------------------------------------------------

function propArt(id: ThemeId, variant: number, C: (c: string) => string) {
  switch (id) {
    case 'default': // meadow: tree / rock / signpost / mushrooms / windmill
      if (variant === 0) return (<><Rect x={-3} y={-16} width={6} height={16} fill={C('#7A5A3A')} /><Circle cx={0} cy={-24} r={12} fill={C('#4DA05E')} /><Circle cx={-8} cy={-18} r={7} fill={C('#2F7A40')} /><Circle cx={7} cy={-19} r={6} fill={C('#2F7A40')} /></>);
      if (variant === 1) return (<><Ellipse cx={0} cy={-5} rx={11} ry={7} fill={C('#7B8B95')} /><Ellipse cx={9} cy={-3} rx={5} ry={4} fill={C('#5E6E78')} /></>);
      if (variant === 2) return (<><Rect x={-2} y={-22} width={4} height={22} fill={C('#8A6A45')} /><Rect x={-13} y={-30} width={26} height={10} rx={2} fill={C('#4A90E2')} /></>);
      if (variant === 3) return (<><Rect x={-7} y={-8} width={4} height={8} rx={1.5} fill={C('#F0E6D2')} /><Path d="M-11 -8 A6 6 0 0 1 -1 -8 Z" fill={C('#D95555')} /><Circle cx={-7} cy={-11} r={1.2} fill={C('#FFFFFF')} /><Rect x={3} y={-6} width={3} height={6} rx={1.5} fill={C('#F0E6D2')} /><Path d="M0 -6 A4.5 4.5 0 0 1 9 -6 Z" fill={C('#D95555')} /></>);
      if (variant === 5) return (<><Line x1={-6} y1={-2} x2={6} y2={-6} stroke={C('#7A5A3A')} strokeWidth={3} /><Line x1={-6} y1={-6} x2={6} y2={-2} stroke={C('#7A5A3A')} strokeWidth={3} /><Path d="M0 -6 Q-5 -12 -2 -18 Q0 -13 2 -16 Q5 -20 3 -11 Q6 -9 3 -6 Z" fill={C('#F97316')} /><Path d="M0 -7 Q-2 -10 0 -13 Q2 -10 1 -8 Z" fill={C('#FDE68A')} /></>);
      return (<><Polygon points="-13,0 -9,-36 9,-36 13,0" fill={C('#E8DCC0')} /><Polygon points="-12,-36 0,-52 12,-36" fill={C('#C0522B')} /><Rect x={-4} y={-13} width={8} height={13} rx={2} fill={C('#7A5A3A')} /><Rect x={-6} y={-30} width={12} height={9} rx={1.5} fill={C('#FAF6EA')} /><Line x1={0} y1={-44} x2={-19} y2={-61} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={19} y2={-61} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={-19} y2={-27} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={19} y2={-27} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Circle cx={0} cy={-44} r={3.5} fill={C('#5A4028')} /></>);
    case 'paper': // origami: crane / hill / plane / boat / house
      if (variant === 0) return (<><Polygon points="-12,0 0,-18 4,-6" fill={C('#FFFFFF')} /><Polygon points="4,-6 14,-14 10,0" fill={C('#DDE4EE')} /><Line x1={-12} y1={0} x2={10} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 1) return (<><Polygon points="-16,0 0,-20 16,0" fill={C('#FFFFFF')} /><Line x1={0} y1={-20} x2={0} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 2) return (<><Polygon points="-14,-6 14,-14 -2,0" fill={C('#FFFFFF')} /><Polygon points="-2,0 14,-14 2,-4" fill={C('#CBD5E1')} /></>);
      if (variant === 3) return (<><Polygon points="-14,-7 14,-7 8,0 -8,0" fill={C('#FFFFFF')} /><Polygon points="0,-19 0,-7 9,-7" fill={C('#DDE4EE')} /><Polygon points="0,-19 0,-7 -8,-7" fill={C('#FFFFFF')} /><Line x1={-14} y1={-7} x2={14} y2={-7} stroke={C('#2563EB')} strokeWidth={1} /></>);
      if (variant === 5) return (<><Polygon points="-1,-10 -12,-17 -9,-5" fill={C('#FFFFFF')} /><Polygon points="1,-10 12,-17 9,-5" fill={C('#DDE4EE')} /><Line x1={0} y1={-4} x2={0} y2={-15} stroke={C('#2563EB')} strokeWidth={1.5} /></>);
      return (<><Polygon points="-18,0 -18,-24 18,-24 18,0" fill={C('#FFFFFF')} /><Polygon points="-21,-24 0,-42 21,-24" fill={C('#DDE4EE')} /><Line x1={0} y1={-42} x2={0} y2={-24} stroke={C('#2563EB')} strokeWidth={1.5} /><Rect x={-5} y={-12} width={10} height={12} fill={C('#CBD5E1')} /><Rect x={8} y={-20} width={7} height={7} fill={C('#BFDBFE')} /><Rect x={-15} y={-20} width={7} height={7} fill={C('#BFDBFE')} /></>);
    case 'calm': // sand desert: palm / shell / dune mound / cactus / camel / HERO oasis
      if (variant === 0) return (<><Path d="M0 0 Q-3 -14 2 -24" stroke={C('#8A6A45')} strokeWidth={4} fill="none" /><Path d="M2 -24 Q-10 -30 -16 -24 M2 -24 Q0 -36 -8 -38 M2 -24 Q12 -32 18 -26 M2 -24 Q14 -22 18 -14" stroke={C('#5B9C6E')} strokeWidth={3} fill="none" /></>);
      if (variant === 1) return (<><Path d="M-8 0 A8 8 0 0 1 8 0 Z" fill={C('#D4A843')} /><Line x1={0} y1={0} x2={0} y2={-7} stroke={C('#B8923A')} strokeWidth={1.2} /><Line x1={-4} y1={0} x2={-3} y2={-5} stroke={C('#B8923A')} strokeWidth={1.2} /><Line x1={4} y1={0} x2={3} y2={-5} stroke={C('#B8923A')} strokeWidth={1.2} /></>);
      if (variant === 2) return (<><Path d="M-18 0 Q-6 -12 20 0 Z" fill={C('#E3C98E')} /><Path d="M-6 0 Q6 -7 20 0 Z" fill={C('#D9BC82')} /><Path d="M-12 -3 Q-6 -6 0 -3" stroke={C('#C9A96A')} strokeWidth={1.2} fill="none" /></>);
      if (variant === 3) return (<><Rect x={-3} y={-24} width={6} height={24} rx={3} fill={C('#6B9C4A')} /><Rect x={-12} y={-19} width={5} height={10} rx={2.5} fill={C('#6B9C4A')} /><Rect x={-12} y={-12} width={9} height={4} fill={C('#6B9C4A')} /><Rect x={7} y={-16} width={5} height={8} rx={2.5} fill={C('#6B9C4A')} /><Rect x={3} y={-11} width={9} height={4} fill={C('#6B9C4A')} /><Circle cx={0} cy={-25} r={2} fill={C('#C95B5B')} /></>);
      if (variant === 5) return (<><Ellipse cx={0} cy={-10} rx={11} ry={6} fill={C('#B98A4A')} /><Circle cx={-4} cy={-16} r={4.5} fill={C('#B98A4A')} /><Circle cx={4} cy={-16} r={4.5} fill={C('#B98A4A')} /><Path d="M10 -12 Q15 -14 15 -20" stroke={C('#B98A4A')} strokeWidth={3.5} fill="none" /><Ellipse cx={16} cy={-21} rx={3} ry={2.2} fill={C('#B98A4A')} /><Circle cx={17} cy={-21.8} r={0.7} fill={C('#3E3316')} /><Line x1={-7} y1={-5} x2={-7} y2={2} stroke={C('#A67B3E')} strokeWidth={2.2} /><Line x1={-2} y1={-5} x2={-2} y2={2} stroke={C('#A67B3E')} strokeWidth={2.2} /><Line x1={3} y1={-5} x2={3} y2={2} stroke={C('#A67B3E')} strokeWidth={2.2} /><Line x1={8} y1={-5} x2={8} y2={2} stroke={C('#A67B3E')} strokeWidth={2.2} /></>);
      return (<><Ellipse cx={0} cy={-4} rx={22} ry={9} fill={C('#6FBBD3')} /><Ellipse cx={0} cy={-4} rx={14} ry={5.5} fill={C('#A8DCE8')} /><Path d="M-14 -2 Q-18 -16 -12 -28" stroke={C('#8A6A45')} strokeWidth={4} fill="none" /><Path d="M-12 -28 Q-22 -34 -28 -28 M-12 -28 Q-14 -40 -22 -42 M-12 -28 Q-2 -36 4 -30" stroke={C('#5B9C6E')} strokeWidth={3} fill="none" /><Path d="M14 -2 Q17 -12 13 -20" stroke={C('#8A6A45')} strokeWidth={3.5} fill="none" /><Path d="M13 -20 Q4 -24 0 -20 M13 -20 Q16 -30 10 -32 M13 -20 Q22 -26 26 -20" stroke={C('#5B9C6E')} strokeWidth={2.5} fill="none" /><Ellipse cx={20} cy={-1} rx={5} ry={3} fill={C('#D9BC82')} /></>);
    case 'slate': // moon rock: crystal / mini moon / pool / stones / observatory
      if (variant === 0) return (<><Polygon points="-8,0 -4,-20 2,0" fill={C('#64748B')} /><Polygon points="0,0 6,-14 12,0" fill={C('#38BDF8')} opacity={0.85} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-14} r={10} fill={C('#BFE7FB')} /><Circle cx={-3} cy={-17} r={2.5} fill={C('#93CBE8')} /><Circle cx={4} cy={-11} r={1.8} fill={C('#93CBE8')} /></>);
      if (variant === 2) return (<><Ellipse cx={0} cy={-3} rx={14} ry={5} fill={C('#38BDF8')} opacity={0.8} /><Ellipse cx={0} cy={-3} rx={8} ry={2.6} fill={C('#7DD3FC')} opacity={0.7} /></>);
      if (variant === 3) return (<><Rect x={-10} y={-14} width={7} height={14} rx={3} fill={C('#64748B')} /><Rect x={1} y={-18} width={8} height={18} rx={3.5} fill={C('#475569')} /><Circle cx={5} cy={-21} r={1.5} fill={C('#38BDF8')} /></>);
      if (variant === 5) return (<><Path d="M-10 0 L-10 -12 Q-10 -20 0 -20 Q10 -20 10 -12 L10 0 L5 0 L5 -10 Q5 -14 0 -14 Q-5 -14 -5 -10 L-5 0 Z" fill={C('#64748B')} /><Circle cx={0} cy={-24} r={1.6} fill={C('#38BDF8')} /></>);
      return (<><Rect x={-12} y={-30} width={24} height={30} rx={2} fill={C('#3E4E66')} /><Path d="M-14 -30 A14 14 0 0 1 14 -30 Z" fill={C('#64748B')} /><Line x1={4} y1={-38} x2={15} y2={-50} stroke={C('#38BDF8')} strokeWidth={3} /><Rect x={-7} y={-14} width={5} height={6} fill={C('#38BDF8')} /><Rect x={2} y={-22} width={5} height={6} fill={C('#7DD3FC')} /></>);
    case 'green': // jungle: bush / kiwi / sprout / flowers / giant tree
      if (variant === 0) return (<><Circle cx={-6} cy={-8} r={9} fill={C('#65A30D')} /><Circle cx={6} cy={-9} r={10} fill={C('#84CC16')} /><Circle cx={0} cy={-14} r={8} fill={C('#3F6212')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-10} r={10} fill={C('#84CC16')} /><Circle cx={0} cy={-10} r={7} fill={C('#F7FEE7')} /><Circle cx={0} cy={-10} r={2} fill={C('#365314')} /></>);
      if (variant === 2) return (<><Path d="M0 0 Q0 -10 0 -14" stroke={C('#3F6212')} strokeWidth={2.5} fill="none" /><Path d="M0 -14 Q-8 -16 -10 -22" stroke={C('#84CC16')} strokeWidth={3} fill="none" /><Path d="M0 -14 Q8 -18 9 -24" stroke={C('#84CC16')} strokeWidth={3} fill="none" /></>);
      if (variant === 3) return (<><Line x1={-6} y1={0} x2={-6} y2={-8} stroke={C('#3F6212')} strokeWidth={1.6} /><Circle cx={-6} cy={-10} r={3} fill={C('#FACC15')} /><Line x1={4} y1={0} x2={4} y2={-11} stroke={C('#3F6212')} strokeWidth={1.6} /><Circle cx={4} cy={-13} r={3.4} fill={C('#F472B6')} /><Circle cx={10} cy={-6} r={2.6} fill={C('#FACC15')} /></>);
      if (variant === 5) return (<><Line x1={-8} y1={-8} x2={8} y2={-10} stroke={C('#6B4A2A')} strokeWidth={2.5} /><Ellipse cx={0} cy={-15} rx={4.5} ry={6} fill={C('#EF4444')} /><Circle cx={1} cy={-21} r={3.2} fill={C('#EF4444')} /><Polygon points="4,-21 9,-20 4,-18.5" fill={C('#FACC15')} /><Circle cx={2.2} cy={-21.8} r={0.8} fill={C('#1A2E05')} /><Path d="M-1 -17 Q-6 -14 -3 -9" stroke={C('#3B82F6')} strokeWidth={2.2} fill="none" /></>);
      return (<><Rect x={-4} y={-26} width={8} height={26} rx={2} fill={C('#6B4A2A')} /><Circle cx={0} cy={-38} r={18} fill={C('#4D7C0F')} /><Circle cx={-14} cy={-30} r={12} fill={C('#3F6212')} /><Circle cx={14} cy={-32} r={12} fill={C('#65A30D')} /><Circle cx={-6} cy={-47} r={10} fill={C('#84CC16')} /><Circle cx={-10} cy={-26} r={3} fill={C('#BEF264')} /><Circle cx={9} cy={-40} r={3} fill={C('#BEF264')} /></>);
    case 'vapor': // vaporwave: neon palm / cassette / grid pyramid / diamond / arcade
      if (variant === 0) return (<><Path d="M0 0 Q-2 -14 2 -22" stroke={C('#FF71CE')} strokeWidth={3} fill="none" /><Path d="M2 -22 Q-8 -28 -14 -22 M2 -22 Q2 -34 -6 -36 M2 -22 Q12 -30 16 -24" stroke={C('#01CDFE')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 1) return (<><Rect x={-13} y={-16} width={26} height={16} rx={2} fill={C('#241238')} /><Rect x={-13} y={-16} width={26} height={16} rx={2} fill="none" stroke={C('#FF71CE')} strokeWidth={1.5} /><Circle cx={-6} cy={-8} r={3} fill={C('#01CDFE')} /><Circle cx={6} cy={-8} r={3} fill={C('#01CDFE')} /></>);
      if (variant === 2) return (<><Polygon points="-14,0 0,-22 14,0" fill="none" stroke={C('#01CDFE')} strokeWidth={1.5} /><Line x1={-7} y1={-11} x2={7} y2={-11} stroke={C('#01CDFE')} strokeWidth={1.2} /><Line x1={0} y1={-22} x2={0} y2={0} stroke={C('#FF71CE')} strokeWidth={1.2} /></>);
      if (variant === 3) return (<><Polygon points="0,-24 7,-14 0,-4 -7,-14" fill={C('#FF71CE')} /><Polygon points="0,-24 7,-14 0,-14" fill={C('#FF9DE0')} /><Circle cx={0} cy={-14} r={11} fill="none" stroke={C('#01CDFE')} strokeWidth={1} opacity={0.7} /></>);
      if (variant === 5) return (<><Rect x={-10} y={-20} width={20} height={20} rx={2} fill={C('#3A2359')} stroke={C('#01CDFE')} strokeWidth={1.4} /><Rect x={-6} y={-20} width={12} height={7} fill={C('#241238')} /><Rect x={2} y={-19} width={3} height={5} fill={C('#FF71CE')} /><Rect x={-5} y={-9} width={10} height={7} fill={C('#FF71CE')} opacity={0.8} /></>);
      return (<><Rect x={-14} y={-40} width={28} height={40} rx={3} fill={C('#241238')} stroke={C('#FF71CE')} strokeWidth={1.6} /><Rect x={-10} y={-36} width={20} height={14} rx={2} fill={C('#01CDFE')} opacity={0.85} /><Rect x={-10} y={-18} width={20} height={6} rx={2} fill={C('#3A2359')} /><Circle cx={-5} cy={-9} r={2.4} fill={C('#FF71CE')} /><Circle cx={3} cy={-9} r={2.4} fill={C('#05FFA1')} /><Line x1={-14} y1={-40} x2={14} y2={-40} stroke={C('#01CDFE')} strokeWidth={2} /></>);
    case 'sunset': // desert dusk: cactus / dune / bird / tumbleweed / adobe house
      if (variant === 0) return (<><Rect x={-3} y={-24} width={6} height={24} rx={3} fill={C('#5B7C3A')} /><Rect x={-12} y={-18} width={5} height={10} rx={2.5} fill={C('#5B7C3A')} /><Rect x={-12} y={-11} width={9} height={4} fill={C('#5B7C3A')} /><Rect x={7} y={-21} width={5} height={9} rx={2.5} fill={C('#5B7C3A')} /><Rect x={3} y={-15} width={9} height={4} fill={C('#5B7C3A')} /></>);
      if (variant === 1) return (<><Path d="M-18 0 Q-4 -12 18 0 Z" fill={C('#C77B3F')} /><Path d="M-8 0 Q4 -7 18 0 Z" fill={C('#9A5626')} /></>);
      if (variant === 2) return (<><Path d="M-10 -22 Q-4 -28 0 -22 Q4 -28 10 -22" stroke={C('#57534E')} strokeWidth={2.5} fill="none" /><Path d="M2 -14 Q6 -18 9 -14" stroke={C('#57534E')} strokeWidth={2} fill="none" /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-9} r={8} fill="none" stroke={C('#8A5220')} strokeWidth={1.6} /><Circle cx={0} cy={-9} r={4.5} fill="none" stroke={C('#8A5220')} strokeWidth={1.2} /><Line x1={-6} y1={-14} x2={6} y2={-4} stroke={C('#8A5220')} strokeWidth={1} /><Line x1={6} y1={-14} x2={-6} y2={-4} stroke={C('#8A5220')} strokeWidth={1} /></>);
      if (variant === 5) return (<><Circle cx={0} cy={-8} r={6.5} fill={C('#F5F0E3')} /><Path d="M-6 -12 Q-14 -16 -13 -24 M6 -12 Q14 -16 13 -24" stroke={C('#F5F0E3')} strokeWidth={3} fill="none" /><Ellipse cx={-2.5} cy={-9} rx={1.4} ry={2} fill={C('#7C4A24')} /><Ellipse cx={2.5} cy={-9} rx={1.4} ry={2} fill={C('#7C4A24')} /><Path d="M-2 -3 L0 -1 L2 -3" stroke={C('#D8CFB8')} strokeWidth={1.2} fill="none" /></>);
      return (<><Rect x={-18} y={-24} width={36} height={24} rx={4} fill={C('#C77B3F')} /><Rect x={-10} y={-34} width={20} height={12} rx={3} fill={C('#B4682F')} /><Rect x={-4} y={-12} width={8} height={12} rx={3} fill={C('#7C4A24')} /><Rect x={8} y={-19} width={5} height={5} rx={1} fill={C('#FCD34D')} /><Rect x={-13} y={-19} width={5} height={5} rx={1} fill={C('#FCD34D')} /><Line x1={13} y1={-24} x2={13} y2={-33} stroke={C('#7C4A24')} strokeWidth={2} /><Line x1={17} y1={-24} x2={17} y2={-33} stroke={C('#7C4A24')} strokeWidth={2} /><Line x1={12} y1={-27} x2={18} y2={-27} stroke={C('#7C4A24')} strokeWidth={1.4} /><Line x1={12} y1={-30} x2={18} y2={-30} stroke={C('#7C4A24')} strokeWidth={1.4} /></>);
    case 'vampire': // gothic: tombstone / bat / dead tree / candelabra / castle tower
      if (variant === 0) return (<><Path d="M-8 0 L-8 -14 A8 8 0 0 1 8 -14 L8 0 Z" fill={C('#2A0A10')} /><Line x1={0} y1={-14} x2={0} y2={-6} stroke={C('#DC2626')} strokeWidth={2} /><Line x1={-4} y1={-11} x2={4} y2={-11} stroke={C('#DC2626')} strokeWidth={2} /></>);
      if (variant === 1) return (<><Path d="M-14 -20 Q-8 -26 -3 -20 Q0 -24 3 -20 Q8 -26 14 -20 Q8 -18 6 -13 Q0 -17 -6 -13 Q-8 -18 -14 -20 Z" fill={C('#350d14')} /><Circle cx={-2} cy={-19} r={1} fill={C('#DC2626')} /><Circle cx={2} cy={-19} r={1} fill={C('#DC2626')} /></>);
      if (variant === 2) return (<><Path d="M0 0 L0 -18 M0 -12 L-8 -20 M0 -14 L7 -22 M-8 -20 L-11 -26 M7 -22 L11 -26" stroke={C('#3A1218')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 3) return (<><Line x1={0} y1={0} x2={0} y2={-12} stroke={C('#3A1218')} strokeWidth={2.5} /><Path d="M-8 -12 L-8 -20 M0 -12 L0 -22 M8 -12 L8 -20" stroke={C('#3A1218')} strokeWidth={2} fill="none" /><Path d="M-8 -12 Q0 -8 8 -12" stroke={C('#3A1218')} strokeWidth={2} fill="none" /><Circle cx={-8} cy={-22} r={2} fill={C('#F97316')} /><Circle cx={0} cy={-24} r={2} fill={C('#F97316')} /><Circle cx={8} cy={-22} r={2} fill={C('#F97316')} /></>);
      if (variant === 5) return (<><Polygon points="-6,0 -9,-8 -5,-22 5,-22 9,-8 6,0" fill={C('#1E060B')} stroke={C('#4A1018')} strokeWidth={1.5} /><Line x1={0} y1={-18} x2={0} y2={-10} stroke={C('#DC2626')} strokeWidth={1.8} /><Line x1={-3} y1={-15} x2={3} y2={-15} stroke={C('#DC2626')} strokeWidth={1.8} /></>);
      return (<><Rect x={-12} y={-44} width={24} height={44} fill={C('#1E060B')} /><Polygon points="-13,-44 0,-62 13,-44" fill={C('#350d14')} /><Rect x={-4} y={-36} width={8} height={11} rx={4} fill={C('#DC2626')} opacity={0.9} /><Rect x={-3} y={-16} width={6} height={8} rx={3} fill={C('#DC2626')} opacity={0.7} /><Line x1={0} y1={-62} x2={0} y2={-72} stroke={C('#3A1218')} strokeWidth={2} /><Polygon points="0,-72 12,-68 0,-64" fill={C('#DC2626')} /></>);
    case 'royal': // gilded: pillar / crown / banner / chest / palace gate
      if (variant === 0) return (<><Rect x={-5} y={-24} width={10} height={24} fill={C('#3A3330')} /><Rect x={-8} y={-28} width={16} height={5} fill={C('#D4AF37')} /><Rect x={-8} y={-2} width={16} height={3} fill={C('#D4AF37')} /></>);
      if (variant === 1) return (<><Path d="M-10 -8 L-7 -16 L-2 -10 L2 -18 L6 -10 L10 -16 L9 -4 L-9 -4 Z" fill={C('#FFD700')} /><Circle cx={-7} cy={-17} r={1.6} fill={C('#D4AF37')} /><Circle cx={2} cy={-19} r={1.6} fill={C('#D4AF37')} /><Circle cx={10} cy={-17} r={1.6} fill={C('#D4AF37')} /></>);
      if (variant === 2) return (<><Line x1={0} y1={0} x2={0} y2={-26} stroke={C('#3A3330')} strokeWidth={2.5} /><Polygon points="0,-26 16,-22 0,-16" fill={C('#D4AF37')} /></>);
      if (variant === 3) return (<><Rect x={-11} y={-12} width={22} height={12} rx={2} fill={C('#3A3330')} /><Path d="M-11 -12 A11 8 0 0 1 11 -12 Z" fill={C('#D4AF37')} /><Rect x={-2.5} y={-13} width={5} height={6} rx={1} fill={C('#FFD700')} /></>);
      if (variant === 5) return (<><Rect x={-12} y={-4} width={24} height={4} rx={2} fill={C('#3A3330')} /><Rect x={-7} y={-10} width={14} height={6} rx={2} fill={C('#211D1A')} /><Rect x={-2.5} y={-18} width={5} height={8} fill={C('#3A3330')} /><Path d="M0 -18 Q-7 -22 -9 -12 M0 -18 Q7 -22 9 -12" stroke={C('#7DD3FC')} strokeWidth={1.6} fill="none" /><Circle cx={0} cy={-20} r={2} fill={C('#FFD700')} /></>);
      return (<><Rect x={-20} y={-34} width={8} height={34} fill={C('#211D1A')} /><Rect x={12} y={-34} width={8} height={34} fill={C('#211D1A')} /><Polygon points="-22,-34 -16,-44 -10,-34" fill={C('#D4AF37')} /><Polygon points="10,-34 16,-44 22,-34" fill={C('#D4AF37')} /><Path d="M-12 0 L-12 -22 A12 12 0 0 1 12 -22 L12 0" fill="none" stroke={C('#FFD700')} strokeWidth={2.5} /><Line x1={-6} y1={0} x2={-6} y2={-28} stroke={C('#D4AF37')} strokeWidth={1.6} /><Line x1={0} y1={0} x2={0} y2={-32} stroke={C('#D4AF37')} strokeWidth={1.6} /><Line x1={6} y1={0} x2={6} y2={-28} stroke={C('#D4AF37')} strokeWidth={1.6} /></>);
    case 'solo': // shadow realm: crystals / rune circle / gate / orb / monarch arch
      if (variant === 0) return (<><Polygon points="-10,0 -5,-18 1,0" fill={C('#6D46C4')} /><Polygon points="-1,0 5,-24 11,0" fill={C('#8B5CF6')} /><Circle cx={5} cy={-26} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-11} r={10} fill="none" stroke={C('#8B5CF6')} strokeWidth={1.6} /><Circle cx={0} cy={-11} r={5.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} /><Circle cx={0} cy={-11} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 2) return (<><Path d="M-9 0 L-9 -16 A9 9 0 0 1 9 -16 L9 0" fill="none" stroke={C('#8B5CF6')} strokeWidth={2.5} /><Line x1={0} y1={-6} x2={0} y2={-14} stroke={C('#22D3EE')} strokeWidth={1.5} /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-16} r={7} fill={C('#121530')} stroke={C('#8B5CF6')} strokeWidth={1.6} /><Ellipse cx={0} cy={-16} rx={12} ry={3.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} opacity={0.8} /><Circle cx={0} cy={-16} r={2} fill={C('#8B5CF6')} /></>);
      if (variant === 5) return (<><Circle cx={0} cy={-20} r={4.5} fill={C('#121530')} /><Path d="M-6 0 Q-6 -14 0 -14 Q6 -14 6 0 Z" fill={C('#121530')} /><Circle cx={-1.6} cy={-20} r={1} fill={C('#8B5CF6')} /><Circle cx={1.6} cy={-20} r={1} fill={C('#8B5CF6')} /><Path d="M6 -10 L11 -24" stroke={C('#22D3EE')} strokeWidth={1.6} /></>);
      return (<><Path d="M-16 0 L-16 -34 Q-16 -50 0 -52 Q16 -50 16 -34 L16 0" fill="none" stroke={C('#6D46C4')} strokeWidth={5} /><Path d="M-8 0 L-8 -28 Q-8 -38 0 -40 Q8 -38 8 -28 L8 0 Z" fill={C('#121530')} opacity={0.9} /><Circle cx={0} cy={-46} r={2.5} fill={C('#22D3EE')} /><Circle cx={-13} cy={-24} r={1.6} fill={C('#22D3EE')} /><Circle cx={13} cy={-24} r={1.6} fill={C('#22D3EE')} /><Line x1={0} y1={-6} x2={0} y2={-30} stroke={C('#8B5CF6')} strokeWidth={1.6} opacity={0.8} /></>);
    case 'inferno': // hellscape: flame / lava pool / spikes / geyser / mini volcano
      if (variant === 0) return (<><Path d="M0 0 Q-8 -8 -4 -16 Q-1 -10 2 -14 Q6 -20 4 -8 Q8 -6 5 -2 Z" fill={C('#DC2626')} /><Path d="M0 -2 Q-3 -7 0 -11 Q3 -7 2 -3 Z" fill={C('#FB923C')} /></>);
      if (variant === 1) return (<><Ellipse cx={0} cy={-3} rx={13} ry={5} fill={C('#DC2626')} /><Ellipse cx={2} cy={-3} rx={6} ry={2.4} fill={C('#FB923C')} /><Circle cx={-6} cy={-8} r={1.6} fill={C('#FB923C')} /></>);
      if (variant === 2) return (<><Polygon points="-12,0 -7,-16 -2,0" fill={C('#3F3F46')} /><Polygon points="0,0 6,-22 12,0" fill={C('#27272A')} /><Polygon points="4,-14 6,-22 8,-14" fill={C('#DC2626')} /></>);
      if (variant === 3) return (<><Ellipse cx={0} cy={-2} rx={9} ry={3.5} fill={C('#DC2626')} /><Path d="M0 -4 Q-3 -14 0 -22 Q3 -14 0 -4" fill={C('#FB923C')} /><Circle cx={-4} cy={-24} r={1.6} fill={C('#FB923C')} /><Circle cx={4} cy={-27} r={1.4} fill={C('#DC2626')} /></>);
      if (variant === 5) return (<><Circle cx={0} cy={-10} r={8} fill={C('#3F3F46')} /><Path d="M-6 -16 Q-11 -20 -10 -26 M6 -16 Q11 -20 10 -26" stroke={C('#3F3F46')} strokeWidth={3} fill="none" /><Ellipse cx={-3} cy={-10} rx={1.8} ry={2.4} fill={C('#DC2626')} /><Ellipse cx={3} cy={-10} rx={1.8} ry={2.4} fill={C('#DC2626')} /><Path d="M-3 -3 L-1.5 -5 L0 -3 L1.5 -5 L3 -3" stroke={C('#18181B')} strokeWidth={1.2} fill="none" /></>);
      return (<><Polygon points="-24,0 -6,-34 6,-34 24,0" fill={C('#3F3F46')} /><Polygon points="-6,-34 6,-34 3,-38 -3,-38" fill={C('#DC2626')} /><Path d="M-2 -34 Q-8 -18 -6 0" stroke={C('#DC2626')} strokeWidth={4} fill="none" /><Path d="M4 -34 Q10 -20 8 0" stroke={C('#FB923C')} strokeWidth={3} fill="none" /><Circle cx={0} cy={-44} r={2.5} fill={C('#FB923C')} /><Circle cx={8} cy={-40} r={1.8} fill={C('#DC2626')} /></>);
    case 'galaxy': // cosmos: ringed planet / star cluster / comet / crescent / rocket
      if (variant === 0) return (<><Circle cx={0} cy={-12} r={8} fill={C('#4338CA')} /><Ellipse cx={0} cy={-12} rx={14} ry={4} fill="none" stroke={C('#22D3EE')} strokeWidth={1.8} /></>);
      if (variant === 1) return (<><Circle cx={-8} cy={-16} r={2} fill={C('#E0E7FF')} /><Circle cx={2} cy={-8} r={1.5} fill={C('#E0E7FF')} /><Circle cx={8} cy={-20} r={2.4} fill={C('#22D3EE')} /><Circle cx={-2} cy={-24} r={1.3} fill={C('#E0E7FF')} /></>);
      if (variant === 2) return (<><Circle cx={6} cy={-18} r={3.5} fill={C('#22D3EE')} /><Path d="M6 -18 L-14 -6" stroke={C('#22D3EE')} strokeWidth={2} opacity={0.6} /><Path d="M6 -16 L-9 -7" stroke={C('#E0E7FF')} strokeWidth={1.2} opacity={0.5} /></>);
      if (variant === 3) return (<><Path d="M0 -24 A10 10 0 1 0 0 -4 A7.5 7.5 0 0 1 0 -24 Z" fill={C('#C7D2FE')} /></>);
      if (variant === 5) return (<><Rect x={-4} y={-18} width={8} height={10} rx={1.5} fill={C('#C7D2FE')} /><Rect x={-14} y={-16} width={8} height={6} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={0.8} /><Rect x={6} y={-16} width={8} height={6} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={0.8} /><Line x1={0} y1={-18} x2={0} y2={-23} stroke={C('#E0E7FF')} strokeWidth={1.2} /><Circle cx={0} cy={-24} r={1.4} fill={C('#22D3EE')} /></>);
      return (<><Path d="M0 -52 Q10 -40 10 -22 L10 -8 L-10 -8 L-10 -22 Q-10 -40 0 -52 Z" fill={C('#E0E7FF')} /><Circle cx={0} cy={-30} r={5} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={1.5} /><Polygon points="-10,-20 -18,0 -10,-8" fill={C('#4338CA')} /><Polygon points="10,-20 18,0 10,-8" fill={C('#4338CA')} /><Polygon points="-6,-8 6,-8 0,4" fill={C('#F97316')} /><Polygon points="-3,-8 3,-8 0,-1" fill={C('#FCD34D')} /></>);
    case 'cyberpunk': // neon city: tower / robot firing / drone / billboard / mega tower
      if (variant === 0) return (<><Rect x={-9} y={-32} width={18} height={32} fill={C('#23245A')} /><Line x1={-9} y1={-32} x2={9} y2={-32} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={0} y1={-32} x2={0} y2={-40} stroke={C('#FF00FF')} strokeWidth={1.6} /><Circle cx={0} cy={-41} r={1.6} fill={C('#FF00FF')} /><Rect x={-5} y={-26} width={3.6} height={4} fill={C('#00FFFF')} /><Rect x={2} y={-19} width={3.6} height={4} fill={C('#FF00FF')} /><Rect x={-5} y={-12} width={3.6} height={4} fill={C('#00FFFF')} /></>);
      if (variant === 1) return (<><Rect x={-7} y={-16} width={14} height={12} rx={2} fill={C('#3A3B7A')} /><Rect x={-5} y={-24} width={10} height={8} rx={2} fill={C('#23245A')} /><Rect x={-3} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={1} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={-11} y={-13} width={4} height={2.6} fill={C('#3A3B7A')} /><Rect x={7} y={-14} width={5} height={2.6} fill={C('#3A3B7A')} /><Line x1={12} y1={-12.7} x2={24} y2={-12.7} stroke={C('#FF00FF')} strokeWidth={1.8} /><Circle cx={26} cy={-12.7} r={1.4} fill={C('#FF00FF')} /><Rect x={-6} y={-4} width={4} height={4} fill={C('#23245A')} /><Rect x={2} y={-4} width={4} height={4} fill={C('#23245A')} /></>);
      if (variant === 2) return (<><Ellipse cx={0} cy={-22} rx={9} ry={4} fill={C('#3A3B7A')} /><Rect x={-3} y={-21} width={6} height={3} fill={C('#00FFFF')} /><Line x1={0} y1={-18} x2={0} y2={-6} stroke={C('#00FFFF')} strokeWidth={1.2} opacity={0.7} /><Polygon points="-4,-6 4,-6 0,0" fill={C('#00FFFF')} opacity={0.4} /></>);
      if (variant === 3) return (<><Rect x={-13} y={-30} width={26} height={16} rx={2} fill={C('#15163A')} stroke={C('#FF00FF')} strokeWidth={1.5} /><Line x1={-8} y1={-25} x2={8} y2={-25} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={-8} y1={-20} x2={4} y2={-20} stroke={C('#00FFFF')} strokeWidth={2} opacity={0.6} /><Line x1={-6} y1={-14} x2={-6} y2={0} stroke={C('#2A2A5E')} strokeWidth={2.5} /><Line x1={6} y1={-14} x2={6} y2={0} stroke={C('#2A2A5E')} strokeWidth={2.5} /></>);
      if (variant === 5) return (<><Ellipse cx={0} cy={-10} rx={12} ry={4.5} fill={C('#3A3B7A')} /><Path d="M-6 -12 Q0 -17 6 -12" stroke={C('#00FFFF')} strokeWidth={1.6} fill="none" /><Rect x={-9} y={-11} width={4} height={2} fill={C('#FF00FF')} /><Line x1={-12} y1={-6} x2={-18} y2={-4} stroke={C('#00FFFF')} strokeWidth={1.4} opacity={0.7} /><Line x1={12} y1={-6} x2={18} y2={-4} stroke={C('#00FFFF')} strokeWidth={1.4} opacity={0.7} /></>);
      return (<><Rect x={-16} y={-56} width={32} height={56} fill={C('#1E1F4E')} /><Line x1={-16} y1={-56} x2={16} y2={-56} stroke={C('#00FFFF')} strokeWidth={2.5} /><Line x1={0} y1={-56} x2={0} y2={-70} stroke={C('#FF00FF')} strokeWidth={2} /><Circle cx={0} cy={-71} r={2} fill={C('#FF00FF')} /><Rect x={-11} y={-50} width={5} height={6} fill={C('#00FFFF')} /><Rect x={-2} y={-50} width={5} height={6} fill={C('#FF00FF')} opacity={0.8} /><Rect x={7} y={-50} width={5} height={6} fill={C('#00FFFF')} opacity={0.7} /><Rect x={-11} y={-38} width={5} height={6} fill={C('#FF00FF')} opacity={0.7} /><Rect x={7} y={-38} width={5} height={6} fill={C('#00FFFF')} /><Rect x={-2} y={-26} width={5} height={6} fill={C('#00FFFF')} opacity={0.8} /><Rect x={-11} y={-26} width={5} height={6} fill={C('#2A2A5E')} /><Rect x={-10} y={-16} width={20} height={9} fill={C('#0D0D2B')} stroke={C('#00FFFF')} strokeWidth={1.2} /><Line x1={-6} y1={-11.5} x2={6} y2={-11.5} stroke={C('#FF00FF')} strokeWidth={2} /></>);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Landscape layer: big full-width background features that make each
// biome read as terrain, not scattered icons. A ridge band lands every
// ~3 levels (dune crests, mountain ranges, canopy, skylines...) and
// water/lava rivers meander across select biomes every ~8 levels —
// the road bridges over them.
// ---------------------------------------------------------------------------

function ridgeArt(id: ThemeId, w: number, C: (c: string) => string) {
  switch (id) {
    case 'default': // rolling hills
      return (<><Path d={`M-10 8 Q ${w * 0.25} -22 ${w * 0.55} 4 L ${w * 0.55} 20 L -10 20 Z`} fill={C('#2F7A40')} opacity={0.45} /><Path d={`M ${w * 0.4} 10 Q ${w * 0.7} -18 ${w + 10} 6 L ${w + 10} 22 L ${w * 0.4} 22 Z`} fill={C('#4DA05E')} opacity={0.45} /></>);
    case 'paper': // folded mountain range
      return (<><Polygon points={`-10,10 ${w * 0.2},-24 ${w * 0.4},2 ${w * 0.6},-18 ${w * 0.8},6 ${w + 10},-10 ${w + 10},18 -10,18`} fill={C('#FFFFFF')} opacity={0.5} /><Line x1={w * 0.2} y1={-24} x2={w * 0.28} y2={2} stroke={C('#2563EB')} strokeWidth={1} opacity={0.4} /><Line x1={w * 0.6} y1={-18} x2={w * 0.66} y2={4} stroke={C('#2563EB')} strokeWidth={1} opacity={0.4} /></>);
    case 'calm': // sand mountains: dune crests with a lit edge
      return (<><Path d={`M-10 6 Q ${w * 0.22} -30 ${w * 0.5} -4 Q ${w * 0.75} 16 ${w + 10} -12 L ${w + 10} 22 L -10 22 Z`} fill={C('#D9BC82')} opacity={0.5} /><Path d={`M-10 6 Q ${w * 0.22} -30 ${w * 0.5} -4`} stroke={C('#F7E6BD')} strokeWidth={2} fill="none" opacity={0.6} /><Path d={`M ${w * 0.4} 12 Q ${w * 0.68} -14 ${w + 10} 4 L ${w + 10} 24 L ${w * 0.4} 24 Z`} fill={C('#E3C98E')} opacity={0.45} /></>);
    case 'slate': // jagged moonlit ridge
      return (<><Polygon points={`-10,10 ${w * 0.18},-20 ${w * 0.34},-2 ${w * 0.52},-26 ${w * 0.7},0 ${w * 0.86},-14 ${w + 10},6 ${w + 10},20 -10,20`} fill={C('#2A3547')} opacity={0.55} /><Circle cx={w * 0.52} cy={-30} r={1.6} fill={C('#38BDF8')} opacity={0.7} /></>);
    case 'green': // dense canopy band
      return (<>{[0.05, 0.22, 0.4, 0.58, 0.76, 0.94].map((f, i) => (<Circle key={f} cx={w * f} cy={-4 - (i % 2) * 6} r={14 + (i % 3) * 4} fill={C(i % 2 === 0 ? '#3F6212' : '#65A30D')} opacity={0.45} />))}</>);
    case 'vapor': // retro grid horizon + distant sun
      return (<><Line x1={-10} y1={-4} x2={w + 10} y2={-4} stroke={C('#01CDFE')} strokeWidth={1.2} opacity={0.45} /><Line x1={-10} y1={-12} x2={w + 10} y2={-12} stroke={C('#01CDFE')} strokeWidth={1} opacity={0.3} /><Line x1={-10} y1={-20} x2={w + 10} y2={-20} stroke={C('#01CDFE')} strokeWidth={1} opacity={0.2} /><Circle cx={w * 0.8} cy={-26} r={10} fill={C('#FF71CE')} opacity={0.4} /></>);
    case 'sunset': // mesa silhouettes
      return (<><Rect x={w * 0.06} y={-22} width={w * 0.14} height={26} rx={5} fill={C('#9A5626')} opacity={0.5} /><Rect x={w * 0.55} y={-16} width={w * 0.1} height={20} rx={4} fill={C('#9A5626')} opacity={0.45} /><Rect x={w * 0.78} y={-26} width={w * 0.16} height={30} rx={6} fill={C('#7C4A24')} opacity={0.45} /></>);
    case 'vampire': // iron fence in the mist
      return (<>{[0.1, 0.25, 0.4, 0.55, 0.7].map((f) => (<Line key={f} x1={w * f} y1={2} x2={w * f} y2={-18} stroke={C('#350d14')} strokeWidth={2.5} />))}<Line x1={w * 0.05} y1={-12} x2={w * 0.75} y2={-12} stroke={C('#350d14')} strokeWidth={2} /><Ellipse cx={w * 0.6} cy={-2} rx={w * 0.3} ry={8} fill={C('#2A0A10')} opacity={0.4} /></>);
    case 'royal': // gilded colonnade
      return (<>{[0.15, 0.35, 0.55, 0.75].map((f) => (<Rect key={f} x={w * f - 4} y={-24} width={8} height={24} fill={C('#211D1A')} opacity={0.75} />))}<Rect x={w * 0.15 - 10} y={-29} width={w * 0.6 + 20} height={5} fill={C('#D4AF37')} opacity={0.55} /></>);
    case 'solo': // violet crystal ridge
      return (<><Polygon points={`${w * 0.1},0 ${w * 0.16},-26 ${w * 0.22},0`} fill={C('#6D46C4')} opacity={0.45} /><Polygon points={`${w * 0.3},0 ${w * 0.38},-38 ${w * 0.46},0`} fill={C('#8B5CF6')} opacity={0.4} /><Polygon points={`${w * 0.72},0 ${w * 0.78},-30 ${w * 0.84},0`} fill={C('#6D46C4')} opacity={0.45} /><Circle cx={w * 0.38} cy={-42} r={1.6} fill={C('#22D3EE')} opacity={0.8} /></>);
    case 'inferno': // charred ridge with a lava seam
      return (<><Polygon points={`-10,8 ${w * 0.2},-18 ${w * 0.4},-4 ${w * 0.6},-24 ${w * 0.8},-6 ${w + 10},4 ${w + 10},18 -10,18`} fill={C('#141416')} opacity={0.65} /><Path d={`M ${w * 0.6} -24 L ${w * 0.62} -10`} stroke={C('#DC2626')} strokeWidth={2} opacity={0.7} /></>);
    case 'galaxy': // nebula clouds + stars
      return (<><Ellipse cx={w * 0.3} cy={-10} rx={54} ry={16} fill={C('#4338CA')} opacity={0.35} /><Ellipse cx={w * 0.7} cy={-16} rx={40} ry={12} fill={C('#22D3EE')} opacity={0.16} /><Circle cx={w * 0.25} cy={-14} r={1.5} fill={C('#E0E7FF')} /><Circle cx={w * 0.75} cy={-20} r={1.2} fill={C('#E0E7FF')} /></>);
    case 'cyberpunk': // distant skyline with lit windows
      return (<>{[0.05, 0.2, 0.38, 0.55, 0.7, 0.85].map((f, i) => (<Rect key={f} x={w * f} y={-(14 + (i % 3) * 10)} width={w * 0.1} height={14 + (i % 3) * 10} fill={C('#0A0A22')} opacity={0.75} />))}<Line x1={-10} y1={0} x2={w + 10} y2={0} stroke={C('#00FFFF')} strokeWidth={1} opacity={0.35} /><Rect x={w * 0.22} y={-18} width={3} height={3} fill={C('#00FFFF')} opacity={0.8} /><Rect x={w * 0.57} y={-24} width={3} height={3} fill={C('#FF00FF')} opacity={0.8} /></>);
    default:
      return null;
  }
}

/** Biomes with a meandering river (the road bridges over it). */
const RIVER: Partial<Record<ThemeId, { base: string; core: string }>> = {
  calm:    { base: '#6FBBD3', core: '#A8DCE8' },  // desert oasis river
  slate:   { base: '#38BDF8', core: '#7DD3FC' },
  green:   { base: '#3E9CB8', core: '#7CC7DB' },
  inferno: { base: '#DC2626', core: '#FB923C' },  // lava river
  galaxy:  { base: '#22D3EE', core: '#A5F3FC' },  // stardust stream
};

/** Small ground-texture marks (ripples, tufts, pebbles...), scattered
 *  under the road so the terrain never looks empty. */
function detailArt(id: ThemeId, C: (c: string) => string) {
  switch (id) {
    case 'calm':
      return <Path d="M-7 0 Q0 -4 7 0 M-3 4 Q4 1 9 4" stroke={C('#C9A96A')} strokeWidth={1.4} fill="none" />;
    case 'sunset':
      return <Path d="M-7 0 Q0 -4 7 0 M-3 4 Q4 1 9 4" stroke={C('#8A5220')} strokeWidth={1.4} fill="none" />;
    case 'default':
      return <Path d="M0 0 L-3 -7 M0 0 L0 -8 M0 0 L3 -7" stroke={C('#2F7A40')} strokeWidth={1.6} fill="none" />;
    case 'green':
      return <Path d="M0 0 L-3 -7 M0 0 L0 -8 M0 0 L3 -7" stroke={C('#84CC16')} strokeWidth={1.6} fill="none" />;
    case 'paper':
      return <Path d="M-5 0 L0 -4 L5 0" stroke={C('#9FB0C4')} strokeWidth={1.4} fill="none" />;
    case 'slate':
      return (<><Circle cx={-3} cy={-2} r={2.4} fill={C('#64748B')} /><Circle cx={3} cy={-1.5} r={1.7} fill={C('#64748B')} /></>);
    case 'vampire':
      return (<><Circle cx={-3} cy={-2} r={2.4} fill={C('#350d14')} /><Circle cx={3} cy={-1.5} r={1.7} fill={C('#350d14')} /></>);
    case 'royal':
      return (<><Circle cx={-3} cy={-2} r={2.4} fill={C('#3A3330')} /><Circle cx={3} cy={-1.5} r={1.7} fill={C('#D4AF37')} /></>);
    case 'solo':
      return (<><Circle cx={-3} cy={-2} r={2.4} fill={C('#6D46C4')} /><Circle cx={3} cy={-1.5} r={1.7} fill={C('#121530')} /></>);
    case 'inferno':
      return <Path d="M-6 0 L-2 -2 L2 1 L6 -1" stroke={C('#DC2626')} strokeWidth={1.3} fill="none" opacity={0.8} />;
    case 'vapor':
      return <Rect x={-2} y={-4} width={4} height={4} fill={C('#FF71CE')} opacity={0.7} />;
    case 'cyberpunk':
      return <Rect x={-2} y={-4} width={4} height={4} fill={C('#00FFFF')} opacity={0.7} />;
    case 'galaxy':
      return <Path d="M0 -6 L0 0 M-3 -3 L3 -3" stroke={C('#E0E7FF')} strokeWidth={1.2} fill="none" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Road geometry
// ---------------------------------------------------------------------------

const SPACING  = 56;    // vertical px per level step
const NODE     = 34;    // level square size
const NODE_CUR = 46;    // player's square size
const BANNER   = 96;    // world-gate banner strip at the zone entrance

/** Serpentine x for a level. Continuous across zones so the road
 *  never jumps at a border. */
function xForLevel(level: number, width: number): number {
  return width / 2 + width * 0.27 * Math.sin(level * 0.72);
}

interface ZoneInfo {
  id:    ThemeId;
  name:  string;
  start: number;   // first level of this world
  end:   number;   // last level (inclusive)
}

function buildZones(playerLevel: number): ZoneInfo[] {
  return THEMES.map((t, i) => {
    const next = THEMES[i + 1]?.unlockLevel ?? null;
    // The summit zone keeps growing ahead of the player.
    const end = next != null ? next - 1 : Math.max(t.unlockLevel + 9, playerLevel + 5);
    return { id: t.id, name: t.name, start: t.unlockLevel, end };
  });
}

/** Zone height: steps live in the top portion, the gate banner strip
 *  fills the bottom (the road runs straight through it). */
const zoneHeight = (z: ZoneInfo) => (z.end - z.start + 1) * SPACING + BANNER;
/** A step's y within its zone. */
const stepY = (z: ZoneInfo, lvl: number) =>
  (z.end - z.start + 1) * SPACING - (lvl - z.start) * SPACING - SPACING / 2;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const scrollRef = useRef<ScrollView>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);

  const level = profile?.level ?? 1;
  const zones = useMemo(() => buildZones(level), [level]);
  const descending = useMemo(() => [...zones].reverse(), [zones]);
  const hostZone = zones.find((z) => level >= z.start && level <= z.end) ?? null;

  useEffect(() => {
    if (currentY == null) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, currentY - 300), animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [currentY]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: OCEAN }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color="#E6EDF3" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: theme.fonts.bold }]}>YourLevel Roadmap</Text>
        <View style={styles.levelChip}>
          <Text style={[styles.levelChipText, { color: theme.colors.accent }]}>LV {level}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} ref={scrollRef}>
        {descending.map((zone, di) => (
          <View
            key={zone.id}
            onLayout={
              hostZone?.id === zone.id
                ? (e) => setCurrentY(e.nativeEvent.layout.y + stepY(zone, level))
                : undefined
            }
          >
            <Zone
              zone={zone}
              level={level}
              width={width}
              accent={theme.colors.accent}
              hasAbove={di > 0}
              hasBelow={di < descending.length - 1}
              onPressSign={(unlocked) => {
                if (unlocked) router.push('/settings/fonts');
                else Alert.alert(zone.name, `Reach Level ${zone.start} to enter this world.`);
              }}
              onPressDeco={(d, unlocked) => {
                if (unlocked) router.push('/settings/decorations');
                else Alert.alert('Mystery unlock', `Reach Level ${d.unlockLevel} to reveal it.`);
              }}
            />
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Zone: one full-bleed biome. The continuous road enters at the bottom
// through the world-gate banner, winds up through dense scenery, and
// exits at the top into the next world.
// ---------------------------------------------------------------------------

function Zone({
  zone,
  level,
  width,
  accent,
  hasAbove,
  hasBelow,
  onPressSign,
  onPressDeco,
}: {
  zone:        ZoneInfo;
  level:       number;
  width:       number;
  accent:      string;
  hasAbove:    boolean;
  hasBelow:    boolean;
  onPressSign: (unlocked: boolean) => void;
  onPressDeco: (d: Decoration, unlocked: boolean) => void;
}) {
  const wt = getTheme(zone.id);
  const T = TERRAIN[zone.id];
  const unlocked = level >= zone.start;
  const conquered = level > zone.end;
  const C = (c: string) => (unlocked ? c : toGrey(c));

  const H = zoneHeight(zone);
  const yFor = (lvl: number) => stepY(zone, lvl);

  // Road polyline. Neighbor steps (start-1 below / end+1 above) are
  // included at their true global positions so the visible segments
  // in adjacent zones join into one unbroken line.
  const pt = (lvl: number, y: number) => `${xForLevel(lvl, width)},${y}`;
  const points: string[] = [];
  if (hasBelow) points.push(pt(zone.start - 1, H + SPACING / 2));
  for (let lvl = zone.start; lvl <= zone.end; lvl++) points.push(pt(lvl, yFor(lvl)));
  if (hasAbove) points.push(pt(zone.end + 1, -(BANNER + SPACING / 2)));

  // Lit portion: same line, stopped at the player's step.
  const litPoints: string[] = [];
  if (unlocked) {
    if (hasBelow) litPoints.push(pt(zone.start - 1, H + SPACING / 2));
    for (let lvl = zone.start; lvl <= Math.min(level, zone.end); lvl++) {
      litPoints.push(pt(lvl, yFor(lvl)));
    }
    if (conquered && hasAbove) litPoints.push(pt(zone.end + 1, -(BANNER + SPACING / 2)));
  }

  // Scenery, all inside the one SVG, painted back-to-front:
  //   patches — organic ground blobs
  //   ridges  — full-width terrain bands (dunes/mountains/skylines)
  //   details — small ground texture (ripples/tufts/pebbles)
  //   rivers  — meandering streams the road bridges over
  //   props   — themed structures both sides of the road; every ~4
  //             levels the big side gets a HERO landmark
  //   specks  — themed ambient particles (fireflies/embers/stars…)
  const POOL = [0, 1, 2, 3, 5];   // non-hero prop rotation
  const patches = [];
  const rivers = [];
  const props = [];
  const specks = [];
  const riverSpec = RIVER[zone.id];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const nx = xForLevel(lvl, width);
    const y = yFor(lvl);

    patches.push(
      <Ellipse
        key={`g-${lvl}`}
        cx={jitter(lvl, 8) * width}
        cy={y + (jitter(lvl, 9) - 0.5) * SPACING}
        rx={42 + jitter(lvl, 10) * 55}
        ry={10 + jitter(lvl, 11) * 9}
        fill={C(lvl % 2 === 0 ? T.patchA : T.patchB)}
        opacity={0.55}
      />,
    );

    // Full-width terrain band every ~3 levels.
    if (lvl % 3 === 1) {
      patches.push(
        <G key={`r-${lvl}`} transform={`translate(0 ${y + SPACING * 0.45 + jitter(lvl, 24) * 10})`}>
          {ridgeArt(zone.id, width, C)}
        </G>,
      );
    }

    // Ground texture marks (2 per level).
    patches.push(
      <G
        key={`d1-${lvl}`}
        transform={`translate(${jitter(lvl, 18) * width} ${y + (jitter(lvl, 19) - 0.5) * SPACING}) scale(${0.8 + jitter(lvl, 20) * 0.6})`}
        opacity={0.6}
      >
        {detailArt(zone.id, C)}
      </G>,
      <G
        key={`d2-${lvl}`}
        transform={`translate(${jitter(lvl, 21) * width} ${y + (jitter(lvl, 22) - 0.5) * SPACING}) scale(${0.7 + jitter(lvl, 23) * 0.6})`}
        opacity={0.55}
      >
        {detailArt(zone.id, C)}
      </G>,
    );

    // Meandering river every ~8 levels (biomes that have one).
    if (riverSpec && lvl % 8 === 4) {
      const cy = y + SPACING / 2;
      const d = `M -20 ${cy} C ${width * 0.18} ${cy - 24}, ${width * 0.3} ${cy + 16}, ${width * 0.52} ${cy - 4} S ${width * 0.8} ${cy + 16}, ${width + 20} ${cy - 12}`;
      rivers.push(
        <Path key={`w-${lvl}`} d={d} stroke={C(riverSpec.base)} strokeWidth={13} fill="none" strokeLinecap="round" opacity={0.9} />,
        <Path key={`wc-${lvl}`} d={d} stroke={C(riverSpec.core)} strokeWidth={5.5} fill="none" strokeLinecap="round" opacity={0.8} />,
      );
    }

    // Big prop on the open side of the road (hero every ~4 levels,
    // skipped near the zone top so tall art doesn't clip).
    const off = 78 + jitter(lvl, 1) * 40;
    const px = nx < width / 2 ? Math.min(nx + off, width - 34) : Math.max(nx - off, 34);
    const py = y + 14 + (jitter(lvl, 2) - 0.5) * 20;
    const hero = lvl % 4 === 2 && y > 100;
    const sA = hero ? 1 + jitter(lvl, 3) * 0.25 : 0.85 + jitter(lvl, 3) * 0.45;
    props.push(
      <G key={`p-${lvl}`} transform={`translate(${px} ${py}) scale(${sA})`}>
        {propArt(zone.id, hero ? 4 : POOL[lvl % 5]!, C)}
      </G>,
    );

    // Small filler prop hugging the near screen edge.
    const ex = nx < width / 2 ? 22 + jitter(lvl, 7) * 26 : width - 22 - jitter(lvl, 7) * 26;
    const ey = y + 30 + (jitter(lvl, 12) - 0.5) * 24;
    props.push(
      <G key={`e-${lvl}`} transform={`translate(${ex} ${ey}) scale(${0.5 + jitter(lvl, 13) * 0.25})`} opacity={0.9}>
        {propArt(zone.id, POOL[(lvl + 2) % 5]!, C)}
      </G>,
    );

    // Mid-size prop between road and edge every other level, so the
    // land feels populated instead of icon-per-level.
    if (lvl % 2 === 0) {
      const mx = nx < width / 2
        ? Math.min(nx + 40 + jitter(lvl, 17) * 24, width - 24)
        : Math.max(nx - 40 - jitter(lvl, 17) * 24, 24);
      props.push(
        <G key={`m-${lvl}`} transform={`translate(${mx} ${y + 44}) scale(0.6)`} opacity={0.85}>
          {propArt(zone.id, POOL[(lvl + 3) % 5]!, C)}
        </G>,
      );
    }

    specks.push(
      <Circle
        key={`a-${lvl}`}
        cx={jitter(lvl, 4) * width}
        cy={y + (jitter(lvl, 5) - 0.5) * SPACING}
        r={1.2 + jitter(lvl, 6) * 1.4}
        fill={C(T.speckA)}
        opacity={0.5}
      />,
      <Circle
        key={`b-${lvl}`}
        cx={jitter(lvl, 14) * width}
        cy={y + (jitter(lvl, 15) - 0.5) * SPACING}
        r={1 + jitter(lvl, 16) * 1.2}
        fill={C(T.speckB)}
        opacity={0.45}
      />,
    );
  }

  // Level steps + player marker (RN views over the SVG).
  const steps = [];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const x = xForLevel(lvl, width);
    const y = yFor(lvl);
    const isCurrent = lvl === level;
    const size = isCurrent ? NODE_CUR : NODE;

    let bg: string, border: string, num: string;
    if (!unlocked || lvl > level) {
      bg = unlocked ? T.road : FOG_NODE;
      border = unlocked ? T.edge : FOG_BORDER;
      // Number must read on the road color: dark ink on light roads,
      // the theme's bright trail color on dark ones.
      num = unlocked ? (lum(T.road) > 130 ? '#4A4132' : T.dash) : GREY_TEXT;
    } else {
      bg = wt.colors.accent;
      border = isCurrent ? '#FFFFFF' : wt.colors.accent;
      num = wt.colors.background;
    }

    steps.push(
      <View
        key={lvl}
        pointerEvents="none"
        style={[
          styles.step,
          {
            width: size,
            height: size,
            left: x - size / 2,
            top: y - size / 2,
            backgroundColor: bg,
            borderColor: border,
            borderWidth: isCurrent ? 3 : 1.5,
            borderRadius: isCurrent ? 10 : 8,
          },
        ]}
      >
        <Text
          style={[
            styles.stepNum,
            { color: num, fontSize: lvl >= 100 ? 10.5 : isCurrent ? 15 : 12.5 },
          ]}
        >
          {lvl}
        </Text>
      </View>,
    );

    if (isCurrent) {
      const chipW = 128;
      steps.push(
        <View
          key="here"
          pointerEvents="none"
          style={[
            styles.hereChip,
            {
              backgroundColor: accent,
              left: Math.min(Math.max(x - chipW / 2, 8), width - chipW - 8),
              top: y - size / 2 - 30,
              width: chipW,
            },
          ]}
        >
          <Text style={[styles.hereText, { color: OCEAN }]}>YOU ARE HERE</Text>
        </View>,
      );
    }
  }

  const decos = DECORATIONS.filter(
    (d) => d.id !== 'none' && d.unlockLevel >= zone.start && d.unlockLevel <= zone.end,
  );

  return (
    <View style={{ height: H, backgroundColor: unlocked ? T.ground : FOG_BG }}>
      {/* Ground, road and all scenery in ONE svg. */}
      <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={StyleSheet.absoluteFill}>
        {patches}
        {rivers}
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={C(T.edge)}
          strokeWidth={30}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={C(T.road)}
          strokeWidth={21}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {litPoints.length > 1 ? (
          <Polyline
            points={litPoints.join(' ')}
            fill="none"
            stroke={wt.colors.accent}
            strokeWidth={21}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.9}
          />
        ) : null}
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={C(T.dash)}
          strokeWidth={3.4}
          strokeDasharray="0.1 14"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.65}
        />
        {props}
        {specks}
      </Svg>

      {steps}

      {decos.map((d) => {
        const nx = xForLevel(d.unlockLevel, width);
        const y = yFor(d.unlockLevel);
        const x = nx < width / 2 ? nx + 46 : nx - 46 - 30;
        const isUnlocked = d.unlockLevel <= level;
        return (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            onPress={() => onPressDeco(d, isUnlocked)}
            style={({ pressed }) => [
              styles.decoSquare,
              {
                left: x,
                top: y - 15,
                borderColor: isUnlocked ? wt.colors.accent : FOG_BORDER,
                backgroundColor: unlocked ? T.road : FOG_NODE,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.decoEmoji}>✨</Text>
          </Pressable>
        );
      })}

      {/* World-gate banner at the entrance. The road passes under it. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => onPressSign(unlocked)}
        style={({ pressed }) => [styles.banner, { top: H - BANNER + 14, opacity: pressed ? 0.8 : 1 }]}
      >
        <View
          style={[
            styles.bannerCard,
            {
              backgroundColor: unlocked ? T.patchB : FOG_NODE,
              borderColor: unlocked ? wt.colors.accent : FOG_BORDER,
            },
          ]}
        >
          {!unlocked ? <Ionicons name="lock-closed" size={15} color={GREY_TEXT} /> : null}
          <View style={styles.bannerTextWrap}>
            <Text
              style={[
                styles.bannerName,
                { color: unlocked ? wt.colors.accent : GREY_TEXT, fontFamily: wt.fonts.heavy },
              ]}
              numberOfLines={1}
            >
              {zone.name.toUpperCase()}
            </Text>
            <Text style={[styles.bannerRange, { color: unlocked ? T.dash : GREY_TEXT }]}>
              {zone.end > zone.start ? `LEVEL ${zone.start}–${zone.end}` : `LEVEL ${zone.start}`}
            </Text>
          </View>
          {conquered ? (
            <Ionicons name="checkmark-circle" size={17} color={wt.colors.accent} />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 18, fontWeight: '800', letterSpacing: 0.3, color: '#E6EDF3' },
  levelChip:     { paddingHorizontal: 10, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10222F' },
  levelChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  step:          { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  stepNum:       { fontWeight: '900', includeFontPadding: false },

  hereChip:      { position: 'absolute', height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  hereText:      { fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },

  decoSquare:    {
    position: 'absolute', width: 30, height: 30, borderRadius: 7, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  decoEmoji:     { fontSize: 13 },

  banner:        { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bannerCard:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 2,
    maxWidth: '86%',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  bannerTextWrap:{ alignItems: 'center' },
  bannerName:    { fontSize: 19, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  bannerRange:   { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 1 },
});
