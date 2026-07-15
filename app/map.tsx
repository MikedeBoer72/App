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
// Roadside scenery. 5 variants per theme: 0-3 = small/medium props,
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
      return (<><Polygon points="-13,0 -9,-36 9,-36 13,0" fill={C('#E8DCC0')} /><Polygon points="-12,-36 0,-52 12,-36" fill={C('#C0522B')} /><Rect x={-4} y={-13} width={8} height={13} rx={2} fill={C('#7A5A3A')} /><Rect x={-6} y={-30} width={12} height={9} rx={1.5} fill={C('#FAF6EA')} /><Line x1={0} y1={-44} x2={-19} y2={-61} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={19} y2={-61} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={-19} y2={-27} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={19} y2={-27} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Circle cx={0} cy={-44} r={3.5} fill={C('#5A4028')} /></>);
    case 'paper': // origami: crane / hill / plane / boat / house
      if (variant === 0) return (<><Polygon points="-12,0 0,-18 4,-6" fill={C('#FFFFFF')} /><Polygon points="4,-6 14,-14 10,0" fill={C('#DDE4EE')} /><Line x1={-12} y1={0} x2={10} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 1) return (<><Polygon points="-16,0 0,-20 16,0" fill={C('#FFFFFF')} /><Line x1={0} y1={-20} x2={0} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 2) return (<><Polygon points="-14,-6 14,-14 -2,0" fill={C('#FFFFFF')} /><Polygon points="-2,0 14,-14 2,-4" fill={C('#CBD5E1')} /></>);
      if (variant === 3) return (<><Polygon points="-14,-7 14,-7 8,0 -8,0" fill={C('#FFFFFF')} /><Polygon points="0,-19 0,-7 9,-7" fill={C('#DDE4EE')} /><Polygon points="0,-19 0,-7 -8,-7" fill={C('#FFFFFF')} /><Line x1={-14} y1={-7} x2={14} y2={-7} stroke={C('#2563EB')} strokeWidth={1} /></>);
      return (<><Polygon points="-18,0 -18,-24 18,-24 18,0" fill={C('#FFFFFF')} /><Polygon points="-21,-24 0,-42 21,-24" fill={C('#DDE4EE')} /><Line x1={0} y1={-42} x2={0} y2={-24} stroke={C('#2563EB')} strokeWidth={1.5} /><Rect x={-5} y={-12} width={10} height={12} fill={C('#CBD5E1')} /><Rect x={8} y={-20} width={7} height={7} fill={C('#BFDBFE')} /><Rect x={-15} y={-20} width={7} height={7} fill={C('#BFDBFE')} /></>);
    case 'calm': // beach: palm / shell / umbrella / beach ball / hut
      if (variant === 0) return (<><Path d="M0 0 Q-3 -14 2 -24" stroke={C('#8A6A45')} strokeWidth={4} fill="none" /><Path d="M2 -24 Q-10 -30 -16 -24 M2 -24 Q0 -36 -8 -38 M2 -24 Q12 -32 18 -26 M2 -24 Q14 -22 18 -14" stroke={C('#5B9C6E')} strokeWidth={3} fill="none" /></>);
      if (variant === 1) return (<><Path d="M-8 0 A8 8 0 0 1 8 0 Z" fill={C('#D4A843')} /><Line x1={0} y1={0} x2={0} y2={-7} stroke={C('#B8923A')} strokeWidth={1.2} /><Line x1={-4} y1={0} x2={-3} y2={-5} stroke={C('#B8923A')} strokeWidth={1.2} /><Line x1={4} y1={0} x2={3} y2={-5} stroke={C('#B8923A')} strokeWidth={1.2} /></>);
      if (variant === 2) return (<><Line x1={0} y1={0} x2={0} y2={-22} stroke={C('#8A6A45')} strokeWidth={2.5} /><Path d="M-16 -22 A16 9 0 0 1 16 -22 Z" fill={C('#C95B5B')} /><Path d="M-16 -22 A16 9 0 0 1 0 -22 Z" fill={C('#F0EFE2')} /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-8} r={8} fill={C('#FAF3DC')} /><Path d="M0 -16 Q6 -8 0 0 Q-6 -8 0 -16 Z" fill={C('#C95B5B')} /><Circle cx={0} cy={-8} r={8} fill="none" stroke={C('#D4A843')} strokeWidth={1} /></>);
      return (<><Rect x={-16} y={-26} width={32} height={26} rx={2} fill={C('#E8CE96')} /><Polygon points="-20,-26 0,-40 20,-26" fill={C('#8A6A45')} /><Rect x={-5} y={-14} width={10} height={14} fill={C('#8A6A45')} /><Rect x={7} y={-21} width={7} height={7} fill={C('#7FC8D8')} /><Rect x={-14} y={-21} width={7} height={7} fill={C('#7FC8D8')} /><Line x1={-18} y1={0} x2={-18} y2={-10} stroke={C('#8A6A45')} strokeWidth={2} /><Line x1={18} y1={0} x2={18} y2={-10} stroke={C('#8A6A45')} strokeWidth={2} /></>);
    case 'slate': // moon rock: crystal / mini moon / pool / stones / observatory
      if (variant === 0) return (<><Polygon points="-8,0 -4,-20 2,0" fill={C('#64748B')} /><Polygon points="0,0 6,-14 12,0" fill={C('#38BDF8')} opacity={0.85} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-14} r={10} fill={C('#BFE7FB')} /><Circle cx={-3} cy={-17} r={2.5} fill={C('#93CBE8')} /><Circle cx={4} cy={-11} r={1.8} fill={C('#93CBE8')} /></>);
      if (variant === 2) return (<><Ellipse cx={0} cy={-3} rx={14} ry={5} fill={C('#38BDF8')} opacity={0.8} /><Ellipse cx={0} cy={-3} rx={8} ry={2.6} fill={C('#7DD3FC')} opacity={0.7} /></>);
      if (variant === 3) return (<><Rect x={-10} y={-14} width={7} height={14} rx={3} fill={C('#64748B')} /><Rect x={1} y={-18} width={8} height={18} rx={3.5} fill={C('#475569')} /><Circle cx={5} cy={-21} r={1.5} fill={C('#38BDF8')} /></>);
      return (<><Rect x={-12} y={-30} width={24} height={30} rx={2} fill={C('#3E4E66')} /><Path d="M-14 -30 A14 14 0 0 1 14 -30 Z" fill={C('#64748B')} /><Line x1={4} y1={-38} x2={15} y2={-50} stroke={C('#38BDF8')} strokeWidth={3} /><Rect x={-7} y={-14} width={5} height={6} fill={C('#38BDF8')} /><Rect x={2} y={-22} width={5} height={6} fill={C('#7DD3FC')} /></>);
    case 'green': // jungle: bush / kiwi / sprout / flowers / giant tree
      if (variant === 0) return (<><Circle cx={-6} cy={-8} r={9} fill={C('#65A30D')} /><Circle cx={6} cy={-9} r={10} fill={C('#84CC16')} /><Circle cx={0} cy={-14} r={8} fill={C('#3F6212')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-10} r={10} fill={C('#84CC16')} /><Circle cx={0} cy={-10} r={7} fill={C('#F7FEE7')} /><Circle cx={0} cy={-10} r={2} fill={C('#365314')} /></>);
      if (variant === 2) return (<><Path d="M0 0 Q0 -10 0 -14" stroke={C('#3F6212')} strokeWidth={2.5} fill="none" /><Path d="M0 -14 Q-8 -16 -10 -22" stroke={C('#84CC16')} strokeWidth={3} fill="none" /><Path d="M0 -14 Q8 -18 9 -24" stroke={C('#84CC16')} strokeWidth={3} fill="none" /></>);
      if (variant === 3) return (<><Line x1={-6} y1={0} x2={-6} y2={-8} stroke={C('#3F6212')} strokeWidth={1.6} /><Circle cx={-6} cy={-10} r={3} fill={C('#FACC15')} /><Line x1={4} y1={0} x2={4} y2={-11} stroke={C('#3F6212')} strokeWidth={1.6} /><Circle cx={4} cy={-13} r={3.4} fill={C('#F472B6')} /><Circle cx={10} cy={-6} r={2.6} fill={C('#FACC15')} /></>);
      return (<><Rect x={-4} y={-26} width={8} height={26} rx={2} fill={C('#6B4A2A')} /><Circle cx={0} cy={-38} r={18} fill={C('#4D7C0F')} /><Circle cx={-14} cy={-30} r={12} fill={C('#3F6212')} /><Circle cx={14} cy={-32} r={12} fill={C('#65A30D')} /><Circle cx={-6} cy={-47} r={10} fill={C('#84CC16')} /><Circle cx={-10} cy={-26} r={3} fill={C('#BEF264')} /><Circle cx={9} cy={-40} r={3} fill={C('#BEF264')} /></>);
    case 'vapor': // vaporwave: neon palm / cassette / grid pyramid / diamond / arcade
      if (variant === 0) return (<><Path d="M0 0 Q-2 -14 2 -22" stroke={C('#FF71CE')} strokeWidth={3} fill="none" /><Path d="M2 -22 Q-8 -28 -14 -22 M2 -22 Q2 -34 -6 -36 M2 -22 Q12 -30 16 -24" stroke={C('#01CDFE')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 1) return (<><Rect x={-13} y={-16} width={26} height={16} rx={2} fill={C('#241238')} /><Rect x={-13} y={-16} width={26} height={16} rx={2} fill="none" stroke={C('#FF71CE')} strokeWidth={1.5} /><Circle cx={-6} cy={-8} r={3} fill={C('#01CDFE')} /><Circle cx={6} cy={-8} r={3} fill={C('#01CDFE')} /></>);
      if (variant === 2) return (<><Polygon points="-14,0 0,-22 14,0" fill="none" stroke={C('#01CDFE')} strokeWidth={1.5} /><Line x1={-7} y1={-11} x2={7} y2={-11} stroke={C('#01CDFE')} strokeWidth={1.2} /><Line x1={0} y1={-22} x2={0} y2={0} stroke={C('#FF71CE')} strokeWidth={1.2} /></>);
      if (variant === 3) return (<><Polygon points="0,-24 7,-14 0,-4 -7,-14" fill={C('#FF71CE')} /><Polygon points="0,-24 7,-14 0,-14" fill={C('#FF9DE0')} /><Circle cx={0} cy={-14} r={11} fill="none" stroke={C('#01CDFE')} strokeWidth={1} opacity={0.7} /></>);
      return (<><Rect x={-14} y={-40} width={28} height={40} rx={3} fill={C('#241238')} stroke={C('#FF71CE')} strokeWidth={1.6} /><Rect x={-10} y={-36} width={20} height={14} rx={2} fill={C('#01CDFE')} opacity={0.85} /><Rect x={-10} y={-18} width={20} height={6} rx={2} fill={C('#3A2359')} /><Circle cx={-5} cy={-9} r={2.4} fill={C('#FF71CE')} /><Circle cx={3} cy={-9} r={2.4} fill={C('#05FFA1')} /><Line x1={-14} y1={-40} x2={14} y2={-40} stroke={C('#01CDFE')} strokeWidth={2} /></>);
    case 'sunset': // desert dusk: cactus / dune / bird / tumbleweed / adobe house
      if (variant === 0) return (<><Rect x={-3} y={-24} width={6} height={24} rx={3} fill={C('#5B7C3A')} /><Rect x={-12} y={-18} width={5} height={10} rx={2.5} fill={C('#5B7C3A')} /><Rect x={-12} y={-11} width={9} height={4} fill={C('#5B7C3A')} /><Rect x={7} y={-21} width={5} height={9} rx={2.5} fill={C('#5B7C3A')} /><Rect x={3} y={-15} width={9} height={4} fill={C('#5B7C3A')} /></>);
      if (variant === 1) return (<><Path d="M-18 0 Q-4 -12 18 0 Z" fill={C('#C77B3F')} /><Path d="M-8 0 Q4 -7 18 0 Z" fill={C('#9A5626')} /></>);
      if (variant === 2) return (<><Path d="M-10 -22 Q-4 -28 0 -22 Q4 -28 10 -22" stroke={C('#57534E')} strokeWidth={2.5} fill="none" /><Path d="M2 -14 Q6 -18 9 -14" stroke={C('#57534E')} strokeWidth={2} fill="none" /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-9} r={8} fill="none" stroke={C('#8A5220')} strokeWidth={1.6} /><Circle cx={0} cy={-9} r={4.5} fill="none" stroke={C('#8A5220')} strokeWidth={1.2} /><Line x1={-6} y1={-14} x2={6} y2={-4} stroke={C('#8A5220')} strokeWidth={1} /><Line x1={6} y1={-14} x2={-6} y2={-4} stroke={C('#8A5220')} strokeWidth={1} /></>);
      return (<><Rect x={-18} y={-24} width={36} height={24} rx={4} fill={C('#C77B3F')} /><Rect x={-10} y={-34} width={20} height={12} rx={3} fill={C('#B4682F')} /><Rect x={-4} y={-12} width={8} height={12} rx={3} fill={C('#7C4A24')} /><Rect x={8} y={-19} width={5} height={5} rx={1} fill={C('#FCD34D')} /><Rect x={-13} y={-19} width={5} height={5} rx={1} fill={C('#FCD34D')} /><Line x1={13} y1={-24} x2={13} y2={-33} stroke={C('#7C4A24')} strokeWidth={2} /><Line x1={17} y1={-24} x2={17} y2={-33} stroke={C('#7C4A24')} strokeWidth={2} /><Line x1={12} y1={-27} x2={18} y2={-27} stroke={C('#7C4A24')} strokeWidth={1.4} /><Line x1={12} y1={-30} x2={18} y2={-30} stroke={C('#7C4A24')} strokeWidth={1.4} /></>);
    case 'vampire': // gothic: tombstone / bat / dead tree / candelabra / castle tower
      if (variant === 0) return (<><Path d="M-8 0 L-8 -14 A8 8 0 0 1 8 -14 L8 0 Z" fill={C('#2A0A10')} /><Line x1={0} y1={-14} x2={0} y2={-6} stroke={C('#DC2626')} strokeWidth={2} /><Line x1={-4} y1={-11} x2={4} y2={-11} stroke={C('#DC2626')} strokeWidth={2} /></>);
      if (variant === 1) return (<><Path d="M-14 -20 Q-8 -26 -3 -20 Q0 -24 3 -20 Q8 -26 14 -20 Q8 -18 6 -13 Q0 -17 -6 -13 Q-8 -18 -14 -20 Z" fill={C('#350d14')} /><Circle cx={-2} cy={-19} r={1} fill={C('#DC2626')} /><Circle cx={2} cy={-19} r={1} fill={C('#DC2626')} /></>);
      if (variant === 2) return (<><Path d="M0 0 L0 -18 M0 -12 L-8 -20 M0 -14 L7 -22 M-8 -20 L-11 -26 M7 -22 L11 -26" stroke={C('#3A1218')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 3) return (<><Line x1={0} y1={0} x2={0} y2={-12} stroke={C('#3A1218')} strokeWidth={2.5} /><Path d="M-8 -12 L-8 -20 M0 -12 L0 -22 M8 -12 L8 -20" stroke={C('#3A1218')} strokeWidth={2} fill="none" /><Path d="M-8 -12 Q0 -8 8 -12" stroke={C('#3A1218')} strokeWidth={2} fill="none" /><Circle cx={-8} cy={-22} r={2} fill={C('#F97316')} /><Circle cx={0} cy={-24} r={2} fill={C('#F97316')} /><Circle cx={8} cy={-22} r={2} fill={C('#F97316')} /></>);
      return (<><Rect x={-12} y={-44} width={24} height={44} fill={C('#1E060B')} /><Polygon points="-13,-44 0,-62 13,-44" fill={C('#350d14')} /><Rect x={-4} y={-36} width={8} height={11} rx={4} fill={C('#DC2626')} opacity={0.9} /><Rect x={-3} y={-16} width={6} height={8} rx={3} fill={C('#DC2626')} opacity={0.7} /><Line x1={0} y1={-62} x2={0} y2={-72} stroke={C('#3A1218')} strokeWidth={2} /><Polygon points="0,-72 12,-68 0,-64" fill={C('#DC2626')} /></>);
    case 'royal': // gilded: pillar / crown / banner / chest / palace gate
      if (variant === 0) return (<><Rect x={-5} y={-24} width={10} height={24} fill={C('#3A3330')} /><Rect x={-8} y={-28} width={16} height={5} fill={C('#D4AF37')} /><Rect x={-8} y={-2} width={16} height={3} fill={C('#D4AF37')} /></>);
      if (variant === 1) return (<><Path d="M-10 -8 L-7 -16 L-2 -10 L2 -18 L6 -10 L10 -16 L9 -4 L-9 -4 Z" fill={C('#FFD700')} /><Circle cx={-7} cy={-17} r={1.6} fill={C('#D4AF37')} /><Circle cx={2} cy={-19} r={1.6} fill={C('#D4AF37')} /><Circle cx={10} cy={-17} r={1.6} fill={C('#D4AF37')} /></>);
      if (variant === 2) return (<><Line x1={0} y1={0} x2={0} y2={-26} stroke={C('#3A3330')} strokeWidth={2.5} /><Polygon points="0,-26 16,-22 0,-16" fill={C('#D4AF37')} /></>);
      if (variant === 3) return (<><Rect x={-11} y={-12} width={22} height={12} rx={2} fill={C('#3A3330')} /><Path d="M-11 -12 A11 8 0 0 1 11 -12 Z" fill={C('#D4AF37')} /><Rect x={-2.5} y={-13} width={5} height={6} rx={1} fill={C('#FFD700')} /></>);
      return (<><Rect x={-20} y={-34} width={8} height={34} fill={C('#211D1A')} /><Rect x={12} y={-34} width={8} height={34} fill={C('#211D1A')} /><Polygon points="-22,-34 -16,-44 -10,-34" fill={C('#D4AF37')} /><Polygon points="10,-34 16,-44 22,-34" fill={C('#D4AF37')} /><Path d="M-12 0 L-12 -22 A12 12 0 0 1 12 -22 L12 0" fill="none" stroke={C('#FFD700')} strokeWidth={2.5} /><Line x1={-6} y1={0} x2={-6} y2={-28} stroke={C('#D4AF37')} strokeWidth={1.6} /><Line x1={0} y1={0} x2={0} y2={-32} stroke={C('#D4AF37')} strokeWidth={1.6} /><Line x1={6} y1={0} x2={6} y2={-28} stroke={C('#D4AF37')} strokeWidth={1.6} /></>);
    case 'solo': // shadow realm: crystals / rune circle / gate / orb / monarch arch
      if (variant === 0) return (<><Polygon points="-10,0 -5,-18 1,0" fill={C('#6D46C4')} /><Polygon points="-1,0 5,-24 11,0" fill={C('#8B5CF6')} /><Circle cx={5} cy={-26} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-11} r={10} fill="none" stroke={C('#8B5CF6')} strokeWidth={1.6} /><Circle cx={0} cy={-11} r={5.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} /><Circle cx={0} cy={-11} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 2) return (<><Path d="M-9 0 L-9 -16 A9 9 0 0 1 9 -16 L9 0" fill="none" stroke={C('#8B5CF6')} strokeWidth={2.5} /><Line x1={0} y1={-6} x2={0} y2={-14} stroke={C('#22D3EE')} strokeWidth={1.5} /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-16} r={7} fill={C('#121530')} stroke={C('#8B5CF6')} strokeWidth={1.6} /><Ellipse cx={0} cy={-16} rx={12} ry={3.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} opacity={0.8} /><Circle cx={0} cy={-16} r={2} fill={C('#8B5CF6')} /></>);
      return (<><Path d="M-16 0 L-16 -34 Q-16 -50 0 -52 Q16 -50 16 -34 L16 0" fill="none" stroke={C('#6D46C4')} strokeWidth={5} /><Path d="M-8 0 L-8 -28 Q-8 -38 0 -40 Q8 -38 8 -28 L8 0 Z" fill={C('#121530')} opacity={0.9} /><Circle cx={0} cy={-46} r={2.5} fill={C('#22D3EE')} /><Circle cx={-13} cy={-24} r={1.6} fill={C('#22D3EE')} /><Circle cx={13} cy={-24} r={1.6} fill={C('#22D3EE')} /><Line x1={0} y1={-6} x2={0} y2={-30} stroke={C('#8B5CF6')} strokeWidth={1.6} opacity={0.8} /></>);
    case 'inferno': // hellscape: flame / lava pool / spikes / geyser / mini volcano
      if (variant === 0) return (<><Path d="M0 0 Q-8 -8 -4 -16 Q-1 -10 2 -14 Q6 -20 4 -8 Q8 -6 5 -2 Z" fill={C('#DC2626')} /><Path d="M0 -2 Q-3 -7 0 -11 Q3 -7 2 -3 Z" fill={C('#FB923C')} /></>);
      if (variant === 1) return (<><Ellipse cx={0} cy={-3} rx={13} ry={5} fill={C('#DC2626')} /><Ellipse cx={2} cy={-3} rx={6} ry={2.4} fill={C('#FB923C')} /><Circle cx={-6} cy={-8} r={1.6} fill={C('#FB923C')} /></>);
      if (variant === 2) return (<><Polygon points="-12,0 -7,-16 -2,0" fill={C('#3F3F46')} /><Polygon points="0,0 6,-22 12,0" fill={C('#27272A')} /><Polygon points="4,-14 6,-22 8,-14" fill={C('#DC2626')} /></>);
      if (variant === 3) return (<><Ellipse cx={0} cy={-2} rx={9} ry={3.5} fill={C('#DC2626')} /><Path d="M0 -4 Q-3 -14 0 -22 Q3 -14 0 -4" fill={C('#FB923C')} /><Circle cx={-4} cy={-24} r={1.6} fill={C('#FB923C')} /><Circle cx={4} cy={-27} r={1.4} fill={C('#DC2626')} /></>);
      return (<><Polygon points="-24,0 -6,-34 6,-34 24,0" fill={C('#3F3F46')} /><Polygon points="-6,-34 6,-34 3,-38 -3,-38" fill={C('#DC2626')} /><Path d="M-2 -34 Q-8 -18 -6 0" stroke={C('#DC2626')} strokeWidth={4} fill="none" /><Path d="M4 -34 Q10 -20 8 0" stroke={C('#FB923C')} strokeWidth={3} fill="none" /><Circle cx={0} cy={-44} r={2.5} fill={C('#FB923C')} /><Circle cx={8} cy={-40} r={1.8} fill={C('#DC2626')} /></>);
    case 'galaxy': // cosmos: ringed planet / star cluster / comet / crescent / rocket
      if (variant === 0) return (<><Circle cx={0} cy={-12} r={8} fill={C('#4338CA')} /><Ellipse cx={0} cy={-12} rx={14} ry={4} fill="none" stroke={C('#22D3EE')} strokeWidth={1.8} /></>);
      if (variant === 1) return (<><Circle cx={-8} cy={-16} r={2} fill={C('#E0E7FF')} /><Circle cx={2} cy={-8} r={1.5} fill={C('#E0E7FF')} /><Circle cx={8} cy={-20} r={2.4} fill={C('#22D3EE')} /><Circle cx={-2} cy={-24} r={1.3} fill={C('#E0E7FF')} /></>);
      if (variant === 2) return (<><Circle cx={6} cy={-18} r={3.5} fill={C('#22D3EE')} /><Path d="M6 -18 L-14 -6" stroke={C('#22D3EE')} strokeWidth={2} opacity={0.6} /><Path d="M6 -16 L-9 -7" stroke={C('#E0E7FF')} strokeWidth={1.2} opacity={0.5} /></>);
      if (variant === 3) return (<><Path d="M0 -24 A10 10 0 1 0 0 -4 A7.5 7.5 0 0 1 0 -24 Z" fill={C('#C7D2FE')} /></>);
      return (<><Path d="M0 -52 Q10 -40 10 -22 L10 -8 L-10 -8 L-10 -22 Q-10 -40 0 -52 Z" fill={C('#E0E7FF')} /><Circle cx={0} cy={-30} r={5} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={1.5} /><Polygon points="-10,-20 -18,0 -10,-8" fill={C('#4338CA')} /><Polygon points="10,-20 18,0 10,-8" fill={C('#4338CA')} /><Polygon points="-6,-8 6,-8 0,4" fill={C('#F97316')} /><Polygon points="-3,-8 3,-8 0,-1" fill={C('#FCD34D')} /></>);
    case 'cyberpunk': // neon city: tower / robot firing / drone / billboard / mega tower
      if (variant === 0) return (<><Rect x={-9} y={-32} width={18} height={32} fill={C('#23245A')} /><Line x1={-9} y1={-32} x2={9} y2={-32} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={0} y1={-32} x2={0} y2={-40} stroke={C('#FF00FF')} strokeWidth={1.6} /><Circle cx={0} cy={-41} r={1.6} fill={C('#FF00FF')} /><Rect x={-5} y={-26} width={3.6} height={4} fill={C('#00FFFF')} /><Rect x={2} y={-19} width={3.6} height={4} fill={C('#FF00FF')} /><Rect x={-5} y={-12} width={3.6} height={4} fill={C('#00FFFF')} /></>);
      if (variant === 1) return (<><Rect x={-7} y={-16} width={14} height={12} rx={2} fill={C('#3A3B7A')} /><Rect x={-5} y={-24} width={10} height={8} rx={2} fill={C('#23245A')} /><Rect x={-3} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={1} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={-11} y={-13} width={4} height={2.6} fill={C('#3A3B7A')} /><Rect x={7} y={-14} width={5} height={2.6} fill={C('#3A3B7A')} /><Line x1={12} y1={-12.7} x2={24} y2={-12.7} stroke={C('#FF00FF')} strokeWidth={1.8} /><Circle cx={26} cy={-12.7} r={1.4} fill={C('#FF00FF')} /><Rect x={-6} y={-4} width={4} height={4} fill={C('#23245A')} /><Rect x={2} y={-4} width={4} height={4} fill={C('#23245A')} /></>);
      if (variant === 2) return (<><Ellipse cx={0} cy={-22} rx={9} ry={4} fill={C('#3A3B7A')} /><Rect x={-3} y={-21} width={6} height={3} fill={C('#00FFFF')} /><Line x1={0} y1={-18} x2={0} y2={-6} stroke={C('#00FFFF')} strokeWidth={1.2} opacity={0.7} /><Polygon points="-4,-6 4,-6 0,0" fill={C('#00FFFF')} opacity={0.4} /></>);
      if (variant === 3) return (<><Rect x={-13} y={-30} width={26} height={16} rx={2} fill={C('#15163A')} stroke={C('#FF00FF')} strokeWidth={1.5} /><Line x1={-8} y1={-25} x2={8} y2={-25} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={-8} y1={-20} x2={4} y2={-20} stroke={C('#00FFFF')} strokeWidth={2} opacity={0.6} /><Line x1={-6} y1={-14} x2={-6} y2={0} stroke={C('#2A2A5E')} strokeWidth={2.5} /><Line x1={6} y1={-14} x2={6} y2={0} stroke={C('#2A2A5E')} strokeWidth={2.5} /></>);
      return (<><Rect x={-16} y={-56} width={32} height={56} fill={C('#1E1F4E')} /><Line x1={-16} y1={-56} x2={16} y2={-56} stroke={C('#00FFFF')} strokeWidth={2.5} /><Line x1={0} y1={-56} x2={0} y2={-70} stroke={C('#FF00FF')} strokeWidth={2} /><Circle cx={0} cy={-71} r={2} fill={C('#FF00FF')} /><Rect x={-11} y={-50} width={5} height={6} fill={C('#00FFFF')} /><Rect x={-2} y={-50} width={5} height={6} fill={C('#FF00FF')} opacity={0.8} /><Rect x={7} y={-50} width={5} height={6} fill={C('#00FFFF')} opacity={0.7} /><Rect x={-11} y={-38} width={5} height={6} fill={C('#FF00FF')} opacity={0.7} /><Rect x={7} y={-38} width={5} height={6} fill={C('#00FFFF')} /><Rect x={-2} y={-26} width={5} height={6} fill={C('#00FFFF')} opacity={0.8} /><Rect x={-11} y={-26} width={5} height={6} fill={C('#2A2A5E')} /><Rect x={-10} y={-16} width={20} height={9} fill={C('#0D0D2B')} stroke={C('#00FFFF')} strokeWidth={1.2} /><Line x1={-6} y1={-11.5} x2={6} y2={-11.5} stroke={C('#FF00FF')} strokeWidth={2} /></>);
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

  // Scenery, all inside the one SVG:
  //   patches — organic ground blobs (under the road)
  //   props   — themed structures both sides of the road; every ~4
  //             levels the big side gets a HERO landmark
  //   specks  — themed ambient particles (fireflies/embers/stars…)
  const patches = [];
  const props = [];
  const specks = [];
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

    // Big prop on the open side of the road (hero every ~4 levels,
    // skipped near the zone top so tall art doesn't clip).
    const off = 78 + jitter(lvl, 1) * 40;
    const px = nx < width / 2 ? Math.min(nx + off, width - 34) : Math.max(nx - off, 34);
    const py = y + 14 + (jitter(lvl, 2) - 0.5) * 20;
    const hero = lvl % 4 === 2 && y > 100;
    const sA = hero ? 1 + jitter(lvl, 3) * 0.25 : 0.85 + jitter(lvl, 3) * 0.45;
    props.push(
      <G key={`p-${lvl}`} transform={`translate(${px} ${py}) scale(${sA})`}>
        {propArt(zone.id, hero ? 4 : lvl % 4, C)}
      </G>,
    );

    // Small filler prop hugging the near screen edge.
    const ex = nx < width / 2 ? 22 + jitter(lvl, 7) * 26 : width - 22 - jitter(lvl, 7) * 26;
    const ey = y + 30 + (jitter(lvl, 12) - 0.5) * 24;
    props.push(
      <G key={`e-${lvl}`} transform={`translate(${ex} ${ey}) scale(${0.5 + jitter(lvl, 13) * 0.25})`} opacity={0.9}>
        {propArt(zone.id, (lvl + 1) % 4, C)}
      </G>,
    );

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
