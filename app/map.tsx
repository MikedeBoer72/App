// YourLevel Roadmap — the world map.
//
// Candy-game-style level road, art-directed to match professional
// match-3 world maps: a SMOOTH bezier road with a dark outline, soft
// drop shadow and pebble ovals; vivid full-bleed biome terrain with a
// vertical light gradient and organic patches; 3D "candy" level
// buttons (gold = done, white = ahead) with bevels, gloss and contact
// shadows; and dense shaded scenery — two-tone trees with highlight
// lobes, rocks with lit facets, camels/cacti/pyramids in the Sand
// desert, treehouses and parrots in the jungle, neon skyscrapers and
// robots in the Neon City... Every prop casts a contact shadow.
// Clouds drift over the bright worlds.
//
// One unbroken road: each zone's path includes TWO neighbor steps
// beyond each edge, so the Catmull-Rom curve is IDENTICAL across the
// zone seam (the SVG clips at the boundary).
//
// Zone states:
//   unlocked  — full-color biome
//   locked    — fog-grey via toGrey(): terrain, scenery, numbers and
//               name all visible, zero color, lock on the gate banner
//
// The player is a bigger gold candy button with a white ring + YOU
// ARE HERE chip. Decorations are ✨ squares beside their unlock step.
// Auto-scrolls to the player on mount.

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
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

import { DECORATIONS, type Decoration } from '@/constants/decorations';
import { getTheme, THEMES, type ThemeId } from '@/constants/themes';
import { track } from '@/lib/analytics';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Fixed map palette (header/fog have their own identity)
// ---------------------------------------------------------------------------

const OCEAN       = '#06131D';
const FOG_BG      = '#0C141C';   // locked-zone ground
const FOG_NODE    = '#151C24';
const FOG_BEVEL   = '#0A1016';
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

/** Deterministic 0..1 jitter from a level number (stable across
 *  renders — no Math.random so the map never reshuffles). */
const frac = (n: number) => n - Math.floor(n);
const jitter = (lvl: number, salt: number) => frac(Math.abs(Math.sin(lvl * 12.9898 + salt * 78.233)) * 43758.5453);

type Cfn = (c: string) => string;

/** Catmull-Rom spline through the step points -> one smooth cubic
 *  bezier path. This is what makes the road wind like game art
 *  instead of a jointed polyline. */
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Per-theme terrain: VIVID game-art palettes (the app-UI theme colors
// stay muted for readability; the map goes full saturation like the
// reference maps). ground/groundHi feed a vertical gradient.
// ---------------------------------------------------------------------------

interface Terrain {
  ground:   string;   // base ground fill (gradient bottom)
  groundHi: string;   // gradient top (sunlit)
  patchA:   string;   // lighter organic patch
  patchB:   string;   // darker organic patch
  road:     string;   // road fill
  edge:     string;   // road border
  pebble:   string;   // pebble ovals on the road
  speckA:   string;   // ambient particle colors
  speckB:   string;
  clouds:   boolean;  // white clouds drift over bright worlds
}

const TERRAIN: Record<ThemeId, Terrain> = {
  default:   { ground: '#5CB84A', groundHi: '#74CC5D', patchA: '#6EC957', patchB: '#48A238', road: '#F2E5BC', edge: '#8F6B3F', pebble: '#D9C692', speckA: '#A8E894', speckB: '#FDE68A', clouds: true },
  paper:     { ground: '#E4EDF5', groundHi: '#F8FBFF', patchA: '#FFFFFF', patchB: '#CFDBE8', road: '#F7FAFD', edge: '#A0B6CC', pebble: '#C4D2E0', speckA: '#93C5FD', speckB: '#FFFFFF', clouds: true },
  calm:      { ground: '#F2BE3B', groundHi: '#FFD45E', patchA: '#FFCE52', patchB: '#E3AC2C', road: '#FAEFC9', edge: '#B9873E', pebble: '#E4CE96', speckA: '#FFE28A', speckB: '#F09C28', clouds: true },
  slate:     { ground: '#4A5E7C', groundHi: '#5A7096', patchA: '#546A8C', patchB: '#3A4C66', road: '#8FA3BC', edge: '#2C3A50', pebble: '#A9BCD4', speckA: '#38BDF8', speckB: '#BFE7FB', clouds: false },
  green:     { ground: '#63BE3E', groundHi: '#7FD457', patchA: '#79CE50', patchB: '#4FA92F', road: '#F4E6B8', edge: '#906B3E', pebble: '#DCC891', speckA: '#BEF264', speckB: '#FACC15', clouds: true },
  vapor:     { ground: '#332052', groundHi: '#3E2864', patchA: '#3A2560', patchB: '#281942', road: '#4E3172', edge: '#FF71CE', pebble: '#6B4C94', speckA: '#FF71CE', speckB: '#01CDFE', clouds: false },
  sunset:    { ground: '#C4703A', groundHi: '#D98149', patchA: '#D07C42', patchB: '#AC5E2C', road: '#EDCB90', edge: '#7E4A20', pebble: '#D9A968', speckA: '#FCD34D', speckB: '#F97316', clouds: true },
  vampire:   { ground: '#1C060C', groundHi: '#2A0A14', patchA: '#260812', patchB: '#120305', road: '#38101A', edge: '#5C1622', pebble: '#4A1420', speckA: '#DC2626', speckB: '#FCA5A5', clouds: false },
  royal:     { ground: '#1F1A16', groundHi: '#2A241E', patchA: '#28221C', patchB: '#151110', road: '#332C24', edge: '#D4AF37', pebble: '#4A3F30', speckA: '#FFD700', speckB: '#D4AF37', clouds: false },
  solo:      { ground: '#0E1124', groundHi: '#151A36', patchA: '#131736', patchB: '#090B18', road: '#20264C', edge: '#8B5CF6', pebble: '#33395F', speckA: '#8B5CF6', speckB: '#22D3EE', clouds: false },
  inferno:   { ground: '#232326', groundHi: '#2C2C30', patchA: '#2A2A2E', patchB: '#19191C', road: '#403F46', edge: '#DC2626', pebble: '#5A5860', speckA: '#FB923C', speckB: '#DC2626', clouds: false },
  galaxy:    { ground: '#26225E', groundHi: '#302B72', patchA: '#2C2870', patchB: '#1B1848', road: '#413C90', edge: '#22D3EE', pebble: '#5A54AE', speckA: '#E0E7FF', speckB: '#22D3EE', clouds: false },
  cyberpunk: { ground: '#12133A', groundHi: '#1B1C4E', patchA: '#191A48', patchB: '#0C0D2C', road: '#23255C', edge: '#00FFFF', pebble: '#3A3C86', speckA: '#00FFFF', speckB: '#FF00FF', clouds: false },
};

/** Biomes with a meandering river (the road bridges over it). */
const RIVER: Partial<Record<ThemeId, { foam: string; base: string; core: string }>> = {
  calm:    { foam: '#FFFFFF', base: '#4FB8D8', core: '#8FDCEF' },  // desert oasis river
  slate:   { foam: '#FFFFFF', base: '#38BDF8', core: '#7DD3FC' },
  green:   { foam: '#FFFFFF', base: '#3E9CB8', core: '#7CC7DB' },
  inferno: { foam: '#FB923C', base: '#DC2626', core: '#FB923C' },  // lava river
  galaxy:  { foam: '#A5F3FC', base: '#22D3EE', core: '#A5F3FC' },  // stardust stream
};

// ---------------------------------------------------------------------------
// Shaded art builders — the cartoon shading language every biome
// shares: dark base lobes, lit mid tone, light top-left lobe, white
// highlight dots. Props draw around origin with their base at y=0;
// the placement code adds a contact shadow underneath.
// ---------------------------------------------------------------------------

interface TreeColors { dark: string; main: string; light: string; hi: string; trunk: string; trunkDark: string }

function shadedTree(C: Cfn, c: TreeColors) {
  return (
    <>
      <Path d="M-2 0 L-3 -14 L3 -14 L2 0 Z" fill={C(c.trunkDark)} />
      <Path d="M-2 0 L-3 -14 L0.5 -14 L0 0 Z" fill={C(c.trunk)} />
      <Circle cx={-8} cy={-18} r={10} fill={C(c.dark)} />
      <Circle cx={8} cy={-18} r={10} fill={C(c.dark)} />
      <Circle cx={0} cy={-26} r={12} fill={C(c.dark)} />
      <Circle cx={-7} cy={-17} r={8.5} fill={C(c.main)} />
      <Circle cx={7.5} cy={-17.5} r={8} fill={C(c.main)} />
      <Circle cx={0} cy={-25} r={10} fill={C(c.main)} />
      <Circle cx={-3.5} cy={-27.5} r={6.5} fill={C(c.light)} />
      <Circle cx={-9} cy={-20} r={4} fill={C(c.light)} />
      <Circle cx={-1} cy={-29} r={2} fill={C(c.hi)} />
      <Circle cx={-6} cy={-24} r={1.4} fill={C(c.hi)} />
      <Circle cx={4} cy={-22} r={1.2} fill={C(c.hi)} opacity={0.7} />
    </>
  );
}

function shadedRock(C: Cfn) {
  return (
    <>
      <Path d="M-11 0 Q-13 -8 -6 -11 Q0 -15 7 -10 Q12 -7 10 0 Z" fill={C('#B9A6A6')} />
      <Path d="M-11 0 Q-13 -8 -6 -11 Q-2 -13 1 -12 L-2 0 Z" fill={C('#D8C9C9')} />
      <Path d="M-6 -11 Q0 -15 7 -10 L5 -8 Q0 -12 -4 -9 Z" fill={C('#EADDDD')} />
      <Circle cx={-5} cy={-9} r={1.2} fill={C('#F4ECEC')} />
    </>
  );
}

interface BushColors { dark: string; main: string; light: string; hi: string }

function shadedBush(C: Cfn, c: BushColors) {
  return (
    <>
      <Circle cx={-6} cy={-5} r={7} fill={C(c.dark)} />
      <Circle cx={6} cy={-5} r={7} fill={C(c.dark)} />
      <Circle cx={0} cy={-8} r={8} fill={C(c.main)} />
      <Circle cx={-3} cy={-10} r={4.5} fill={C(c.light)} />
      <Circle cx={-1} cy={-11.5} r={1.3} fill={C(c.hi)} />
    </>
  );
}

const MEADOW_TREE: TreeColors = { dark: '#2E8A24', main: '#46AF33', light: '#63CC4C', hi: '#A8EE8F', trunk: '#9C6B3A', trunkDark: '#7A4E26' };
const MEADOW_BUSH: BushColors = { dark: '#2E8A24', main: '#4CB438', light: '#6ED153', hi: '#B4F09B' };
const SAND_TREE: TreeColors   = { dark: '#C87E1B', main: '#F09C28', light: '#FFB846', hi: '#FFDC9A', trunk: '#9C6B3A', trunkDark: '#7A4E26' };
const SAND_BUSH: BushColors   = { dark: '#D98A20', main: '#F7A93A', light: '#FFC463', hi: '#FFE3AC' };
const JUNGLE_TREE: TreeColors = { dark: '#2E8A24', main: '#46AF33', light: '#63CC4C', hi: '#A8EE8F', trunk: '#9C6B3A', trunkDark: '#7A4E26' };
const JUNGLE_BUSH: BushColors = { dark: '#2E8A24', main: '#4CB438', light: '#6ED153', hi: '#B4F09B' };

// ---------------------------------------------------------------------------
// Roadside scenery. 6 variants per theme: 0-3 and 5 = small/medium
// props (5 is the biome's creature/extra — camel, parrot, hover car…),
// 4 = HERO structure (big landmark that appears every ~4 levels).
// ---------------------------------------------------------------------------

function propArt(id: ThemeId, variant: number, C: Cfn) {
  switch (id) {
    case 'default': // meadow: tree / rock / signpost / mushrooms / campfire / windmill
      if (variant === 0) return shadedTree(C, MEADOW_TREE);
      if (variant === 1) return shadedRock(C);
      if (variant === 2) return (<><Rect x={-2} y={-22} width={4} height={22} fill={C('#8A6A45')} /><Rect x={-13} y={-30} width={26} height={10} rx={2} fill={C('#4A90E2')} /><Rect x={-13} y={-30} width={26} height={3.5} rx={1.7} fill={C('#75AEEF')} /></>);
      if (variant === 3) return (<><Rect x={-7} y={-8} width={4} height={8} rx={1.5} fill={C('#F0E6D2')} /><Path d="M-11 -8 A6 6 0 0 1 -1 -8 Z" fill={C('#D95555')} /><Circle cx={-7} cy={-11} r={1.2} fill={C('#FFFFFF')} /><Rect x={3} y={-6} width={3} height={6} rx={1.5} fill={C('#F0E6D2')} /><Path d="M0 -6 A4.5 4.5 0 0 1 9 -6 Z" fill={C('#D95555')} /></>);
      if (variant === 5) return (<><Line x1={-6} y1={-2} x2={6} y2={-6} stroke={C('#7A5A3A')} strokeWidth={3} /><Line x1={-6} y1={-6} x2={6} y2={-2} stroke={C('#7A5A3A')} strokeWidth={3} /><Path d="M0 -6 Q-5 -12 -2 -18 Q0 -13 2 -16 Q5 -20 3 -11 Q6 -9 3 -6 Z" fill={C('#F97316')} /><Path d="M0 -7 Q-2 -10 0 -13 Q2 -10 1 -8 Z" fill={C('#FDE68A')} /></>);
      return (<><Polygon points="-13,0 -9,-36 9,-36 13,0" fill={C('#E8DCC0')} /><Polygon points="-13,0 -9,-36 -1,-36 -3,0" fill={C('#F6EEDA')} /><Polygon points="-12,-36 0,-52 12,-36" fill={C('#C0522B')} /><Polygon points="-12,-36 0,-52 0,-36" fill={C('#D96A3C')} /><Rect x={-4} y={-13} width={8} height={13} rx={2} fill={C('#7A5A3A')} /><Rect x={-6} y={-30} width={12} height={9} rx={1.5} fill={C('#FAF6EA')} /><Line x1={0} y1={-44} x2={-19} y2={-61} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={19} y2={-61} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={-19} y2={-27} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Line x1={0} y1={-44} x2={19} y2={-27} stroke={C('#7A5A3A')} strokeWidth={3.5} /><Circle cx={0} cy={-44} r={3.5} fill={C('#5A4028')} /></>);
    case 'paper': // origami: crane / hill / plane / boat / butterfly / house
      if (variant === 0) return (<><Polygon points="-12,0 0,-18 4,-6" fill={C('#FFFFFF')} /><Polygon points="4,-6 14,-14 10,0" fill={C('#D5DEEA')} /><Line x1={-12} y1={0} x2={10} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 1) return (<><Polygon points="-16,0 0,-20 16,0" fill={C('#FFFFFF')} /><Polygon points="-16,0 0,-20 0,0" fill={C('#EAF0F8')} /><Line x1={0} y1={-20} x2={0} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 2) return (<><Polygon points="-14,-6 14,-14 -2,0" fill={C('#FFFFFF')} /><Polygon points="-2,0 14,-14 2,-4" fill={C('#CBD5E1')} /></>);
      if (variant === 3) return (<><Polygon points="-14,-7 14,-7 8,0 -8,0" fill={C('#FFFFFF')} /><Polygon points="0,-19 0,-7 9,-7" fill={C('#D5DEEA')} /><Polygon points="0,-19 0,-7 -8,-7" fill={C('#FFFFFF')} /><Line x1={-14} y1={-7} x2={14} y2={-7} stroke={C('#2563EB')} strokeWidth={1} /></>);
      if (variant === 5) return (<><Polygon points="-1,-10 -12,-17 -9,-5" fill={C('#FFFFFF')} /><Polygon points="1,-10 12,-17 9,-5" fill={C('#D5DEEA')} /><Line x1={0} y1={-4} x2={0} y2={-15} stroke={C('#2563EB')} strokeWidth={1.5} /></>);
      return (<><Polygon points="-18,0 -18,-24 18,-24 18,0" fill={C('#FFFFFF')} /><Polygon points="-18,0 -18,-24 -8,-24 -8,0" fill={C('#EAF0F8')} /><Polygon points="-21,-24 0,-42 21,-24" fill={C('#D5DEEA')} /><Polygon points="-21,-24 0,-42 0,-24" fill={C('#E8EEF6')} /><Line x1={0} y1={-42} x2={0} y2={-24} stroke={C('#2563EB')} strokeWidth={1.5} /><Rect x={-5} y={-12} width={10} height={12} fill={C('#CBD5E1')} /><Rect x={8} y={-20} width={7} height={7} fill={C('#BFDBFE')} /><Rect x={-15} y={-20} width={7} height={7} fill={C('#BFDBFE')} /></>);
    case 'calm': // SAND desert: orange tree / rock / cactus / bush / camel / pyramid oasis
      if (variant === 0) return shadedTree(C, SAND_TREE);
      if (variant === 1) return shadedRock(C);
      if (variant === 2) return (<><Path d="M-3.4 0 L-3.4 -22 Q-3.4 -26 0 -26 Q3.4 -26 3.4 -22 L3.4 0 Z" fill={C('#4E9C3F')} /><Path d="M-3.4 0 L-3.4 -22 Q-3.4 -26 0 -26 L0 0 Z" fill={C('#63B44E')} /><Path d="M-11.5 -18 Q-11.5 -21 -8.8 -21 Q-6.4 -21 -6.4 -18 L-6.4 -12 L-3.4 -12 L-3.4 -8.6 L-8 -8.6 Q-11.5 -8.6 -11.5 -12 Z" fill={C('#4E9C3F')} /><Path d="M6.4 -15 Q6.4 -18 9 -18 Q11.5 -18 11.5 -15 L11.5 -10 Q11.5 -6.4 8 -6.4 L3.4 -6.4 L3.4 -9.8 L6.4 -9.8 Z" fill={C('#63B44E')} /><Circle cx={-1} cy={-24} r={1} fill={C('#CFF0C4')} opacity={0.9} /><Circle cx={0} cy={-27.5} r={2.4} fill={C('#E76A6A')} /><Circle cx={-0.8} cy={-28.3} r={0.8} fill={C('#FFB3B3')} /></>);
      if (variant === 3) return shadedBush(C, SAND_BUSH);
      if (variant === 5) return (<><Ellipse cx={0} cy={-9} rx={11} ry={6} fill={C('#B98A4A')} /><Ellipse cx={-2} cy={-10.5} rx={9} ry={5} fill={C('#CB9C58')} /><Circle cx={-4} cy={-16} r={4.6} fill={C('#C29254')} /><Circle cx={4} cy={-16} r={4.6} fill={C('#B98A4A')} /><Circle cx={-5} cy={-17.5} r={2.6} fill={C('#D4A868')} /><Path d="M10 -11 Q15 -13 15 -19" stroke={C('#B98A4A')} strokeWidth={3.5} fill="none" /><Ellipse cx={16} cy={-20} rx={3} ry={2.3} fill={C('#C29254')} /><Circle cx={17} cy={-20.8} r={0.7} fill={C('#5B4423')} /><Line x1={-7} y1={-4} x2={-7} y2={2} stroke={C('#8F6B34')} strokeWidth={2.4} /><Line x1={-2} y1={-4} x2={-2} y2={2} stroke={C('#8F6B34')} strokeWidth={2.4} /><Line x1={3} y1={-4} x2={3} y2={2} stroke={C('#8F6B34')} strokeWidth={2.4} /><Line x1={8} y1={-4} x2={8} y2={2} stroke={C('#8F6B34')} strokeWidth={2.4} /></>);
      return (<><Ellipse cx={14} cy={-2} rx={20} ry={7.5} fill={C('#4FB8D8')} /><Ellipse cx={14} cy={-2.6} rx={15} ry={5} fill={C('#8FDCEF')} /><Ellipse cx={14} cy={-3} rx={7} ry={2.4} fill={C('#C8F0FA')} /><Path d="M-34 0 L-14 -38 L6 0 Z" fill={C('#E3AC2C')} /><Path d="M-34 0 L-14 -38 L-11 0 Z" fill={C('#FFCE52')} /><Path d="M-18.5 -29.5 L-14 -38 L-9.5 -29.5 L-14 -31.5 Z" fill={C('#B9873E')} /><Path d="M-16 0 L-14 -10 L-10 0 Z" fill={C('#9C6B2A')} /><Path d="M28 -1 Q24 -13 29 -24" stroke={C('#8F6B34')} strokeWidth={4} fill="none" /><Path d="M29 -24 Q19 -30 13 -25 M29 -24 Q27 -36 19 -38 M29 -24 Q39 -32 44 -26 M29 -24 Q41 -24 45 -16" stroke={C('#4E9C3F')} strokeWidth={3.2} fill="none" /><Path d="M29 -24 Q21 -28 16 -25 M29 -24 Q28 -34 22 -36" stroke={C('#63B44E')} strokeWidth={2} fill="none" /></>);
    case 'slate': // moon rock: crystal / mini moon / pool / stones / arch / observatory
      if (variant === 0) return (<><Polygon points="-8,0 -4,-20 2,0" fill={C('#64748B')} /><Polygon points="-8,0 -4,-20 -2,0" fill={C('#7C8CA4')} /><Polygon points="0,0 6,-14 12,0" fill={C('#38BDF8')} opacity={0.85} /><Polygon points="0,0 6,-14 6,0" fill={C('#7DD3FC')} opacity={0.8} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-14} r={10} fill={C('#BFE7FB')} /><Circle cx={-3} cy={-17} r={2.5} fill={C('#93CBE8')} /><Circle cx={4} cy={-11} r={1.8} fill={C('#93CBE8')} /><Circle cx={-5} cy={-11} r={1.4} fill={C('#DCF3FD')} /></>);
      if (variant === 2) return (<><Ellipse cx={0} cy={-3} rx={14} ry={5} fill={C('#38BDF8')} opacity={0.8} /><Ellipse cx={0} cy={-3} rx={8} ry={2.6} fill={C('#7DD3FC')} opacity={0.8} /><Ellipse cx={-2} cy={-3.5} rx={3.5} ry={1.2} fill={C('#DCF3FD')} opacity={0.8} /></>);
      if (variant === 3) return (<><Rect x={-10} y={-14} width={7} height={14} rx={3} fill={C('#64748B')} /><Rect x={-10} y={-14} width={3} height={14} rx={1.5} fill={C('#7C8CA4')} /><Rect x={1} y={-18} width={8} height={18} rx={3.5} fill={C('#475569')} /><Rect x={1} y={-18} width={3.5} height={18} rx={1.7} fill={C('#5C6C84')} /><Circle cx={5} cy={-21} r={1.5} fill={C('#38BDF8')} /></>);
      if (variant === 5) return (<><Path d="M-10 0 L-10 -12 Q-10 -20 0 -20 Q10 -20 10 -12 L10 0 L5 0 L5 -10 Q5 -14 0 -14 Q-5 -14 -5 -10 L-5 0 Z" fill={C('#64748B')} /><Path d="M-10 0 L-10 -12 Q-10 -20 0 -20 L0 -14 Q-5 -14 -5 -10 L-5 0 Z" fill={C('#7C8CA4')} /><Circle cx={0} cy={-24} r={1.6} fill={C('#38BDF8')} /></>);
      return (<><Rect x={-12} y={-30} width={24} height={30} rx={2} fill={C('#3E4E66')} /><Rect x={-12} y={-30} width={8} height={30} rx={2} fill={C('#4C5E7A')} /><Path d="M-14 -30 A14 14 0 0 1 14 -30 Z" fill={C('#64748B')} /><Path d="M-14 -30 A14 14 0 0 1 0 -44 L0 -30 Z" fill={C('#7C8CA4')} /><Line x1={4} y1={-38} x2={15} y2={-50} stroke={C('#38BDF8')} strokeWidth={3} /><Rect x={-7} y={-14} width={5} height={6} fill={C('#38BDF8')} /><Rect x={2} y={-22} width={5} height={6} fill={C('#7DD3FC')} /></>);
    case 'green': // jungle: tree / rock / kiwi / bush / parrot / treehouse
      if (variant === 0) return shadedTree(C, JUNGLE_TREE);
      if (variant === 1) return shadedRock(C);
      if (variant === 2) return (<><Circle cx={0} cy={-10} r={10} fill={C('#84CC16')} /><Circle cx={-1} cy={-11} r={8.6} fill={C('#9BE032')} /><Circle cx={0} cy={-10} r={6.6} fill={C('#F7FEE7')} /><Circle cx={0} cy={-10} r={2} fill={C('#3F6212')} /><Circle cx={-2.6} cy={-13.4} r={1} fill={C('#FFFFFF')} opacity={0.8} /></>);
      if (variant === 3) return shadedBush(C, JUNGLE_BUSH);
      if (variant === 5) return (<><Line x1={-8} y1={-8} x2={8} y2={-10} stroke={C('#7A4E26')} strokeWidth={2.6} /><Ellipse cx={0} cy={-15} rx={4.6} ry={6} fill={C('#E23B3B')} /><Ellipse cx={-1} cy={-16} rx={3.4} ry={4.4} fill={C('#F55E4E')} /><Circle cx={1} cy={-21} r={3.3} fill={C('#F55E4E')} /><Polygon points="4,-21 9.5,-20 4,-18.4" fill={C('#FFC63C')} /><Circle cx={2.3} cy={-21.9} r={0.9} fill={C('#3B1B0E')} /><Circle cx={2.6} cy={-22.2} r={0.35} fill={C('#FFFFFF')} /><Path d="M-1 -17 Q-6.5 -14 -3.5 -9" stroke={C('#2F7ACC')} strokeWidth={2.4} fill="none" /><Path d="M-1.6 -16 Q-5 -14 -3.6 -11" stroke={C('#5EA0E8')} strokeWidth={1.3} fill="none" /></>);
      return (<><Path d="M-4 0 L-6 -22 L6 -22 L4 0 Z" fill={C('#7A4E26')} /><Path d="M-4 0 L-6 -22 L0 -22 L-0.5 0 Z" fill={C('#9C6B3A')} /><Circle cx={-14} cy={-27} r={13} fill={C('#2E8A24')} /><Circle cx={14} cy={-28} r={13} fill={C('#2E8A24')} /><Circle cx={0} cy={-38} r={16} fill={C('#2E8A24')} /><Circle cx={-13} cy={-26} r={11} fill={C('#46AF33')} /><Circle cx={13.5} cy={-27} r={11} fill={C('#46AF33')} /><Circle cx={0} cy={-37} r={13.6} fill={C('#46AF33')} /><Circle cx={-5} cy={-41} r={8} fill={C('#63CC4C')} /><Circle cx={-12} cy={-30} r={5} fill={C('#63CC4C')} /><Circle cx={-2} cy={-44} r={2} fill={C('#A8EE8F')} /><Circle cx={-8} cy={-36} r={1.4} fill={C('#A8EE8F')} /><Rect x={-7} y={-20} width={14} height={10} rx={2} fill={C('#B9873E')} /><Rect x={-7} y={-20} width={14} height={3} fill={C('#D9A759')} /><Rect x={-2.4} y={-17.6} width={5} height={7.6} rx={1} fill={C('#5B3A1E')} /><Path d="M-9 -20 L0 -27 L9 -20 Z" fill={C('#8F5B2E')} /><Path d="M-9 -20 L0 -27 L0 -20 Z" fill={C('#A96F3B')} /></>);
    case 'vapor': // vaporwave: neon palm / cassette / grid pyramid / diamond / floppy / arcade
      if (variant === 0) return (<><Path d="M0 0 Q-2 -14 2 -22" stroke={C('#FF71CE')} strokeWidth={3} fill="none" /><Path d="M2 -22 Q-8 -28 -14 -22 M2 -22 Q2 -34 -6 -36 M2 -22 Q12 -30 16 -24" stroke={C('#01CDFE')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 1) return (<><Rect x={-13} y={-16} width={26} height={16} rx={2} fill={C('#241238')} /><Rect x={-13} y={-16} width={26} height={16} rx={2} fill="none" stroke={C('#FF71CE')} strokeWidth={1.5} /><Circle cx={-6} cy={-8} r={3} fill={C('#01CDFE')} /><Circle cx={6} cy={-8} r={3} fill={C('#01CDFE')} /></>);
      if (variant === 2) return (<><Polygon points="-14,0 0,-22 14,0" fill="none" stroke={C('#01CDFE')} strokeWidth={1.5} /><Line x1={-7} y1={-11} x2={7} y2={-11} stroke={C('#01CDFE')} strokeWidth={1.2} /><Line x1={0} y1={-22} x2={0} y2={0} stroke={C('#FF71CE')} strokeWidth={1.2} /></>);
      if (variant === 3) return (<><Polygon points="0,-24 7,-14 0,-4 -7,-14" fill={C('#FF71CE')} /><Polygon points="0,-24 7,-14 0,-14" fill={C('#FF9DE0')} /><Circle cx={0} cy={-14} r={11} fill="none" stroke={C('#01CDFE')} strokeWidth={1} opacity={0.7} /></>);
      if (variant === 5) return (<><Rect x={-10} y={-20} width={20} height={20} rx={2} fill={C('#3A2359')} stroke={C('#01CDFE')} strokeWidth={1.4} /><Rect x={-6} y={-20} width={12} height={7} fill={C('#241238')} /><Rect x={2} y={-19} width={3} height={5} fill={C('#FF71CE')} /><Rect x={-5} y={-9} width={10} height={7} fill={C('#FF71CE')} opacity={0.8} /></>);
      return (<><Rect x={-14} y={-40} width={28} height={40} rx={3} fill={C('#241238')} stroke={C('#FF71CE')} strokeWidth={1.6} /><Rect x={-10} y={-36} width={20} height={14} rx={2} fill={C('#01CDFE')} opacity={0.85} /><Rect x={-10} y={-36} width={20} height={5} rx={2} fill={C('#7FE7FF')} opacity={0.9} /><Rect x={-10} y={-18} width={20} height={6} rx={2} fill={C('#3A2359')} /><Circle cx={-5} cy={-9} r={2.4} fill={C('#FF71CE')} /><Circle cx={3} cy={-9} r={2.4} fill={C('#05FFA1')} /><Line x1={-14} y1={-40} x2={14} y2={-40} stroke={C('#01CDFE')} strokeWidth={2} /></>);
    case 'sunset': // red canyon: cactus / dune / bird / tumbleweed / cow skull / adobe house
      if (variant === 0) return (<><Rect x={-3} y={-24} width={6} height={24} rx={3} fill={C('#4E8C34')} /><Rect x={-3} y={-24} width={2.6} height={24} rx={1.3} fill={C('#63A848')} /><Rect x={-12} y={-18} width={5} height={10} rx={2.5} fill={C('#4E8C34')} /><Rect x={-12} y={-11} width={9} height={4} fill={C('#4E8C34')} /><Rect x={7} y={-21} width={5} height={9} rx={2.5} fill={C('#63A848')} /><Rect x={3} y={-15} width={9} height={4} fill={C('#63A848')} /></>);
      if (variant === 1) return (<><Path d="M-18 0 Q-4 -12 18 0 Z" fill={C('#D07C42')} /><Path d="M-18 0 Q-10 -8 0 -6 L0 0 Z" fill={C('#DE8F52')} /><Path d="M-8 0 Q4 -7 18 0 Z" fill={C('#AC5E2C')} /></>);
      if (variant === 2) return (<><Path d="M-10 -22 Q-4 -28 0 -22 Q4 -28 10 -22" stroke={C('#57534E')} strokeWidth={2.5} fill="none" /><Path d="M2 -14 Q6 -18 9 -14" stroke={C('#57534E')} strokeWidth={2} fill="none" /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-9} r={8} fill="none" stroke={C('#7E4A20')} strokeWidth={1.6} /><Circle cx={0} cy={-9} r={4.5} fill="none" stroke={C('#7E4A20')} strokeWidth={1.2} /><Line x1={-6} y1={-14} x2={6} y2={-4} stroke={C('#7E4A20')} strokeWidth={1} /><Line x1={6} y1={-14} x2={-6} y2={-4} stroke={C('#7E4A20')} strokeWidth={1} /></>);
      if (variant === 5) return (<><Circle cx={0} cy={-8} r={6.5} fill={C('#F5F0E3')} /><Path d="M-6 -12 Q-14 -16 -13 -24 M6 -12 Q14 -16 13 -24" stroke={C('#F5F0E3')} strokeWidth={3} fill="none" /><Ellipse cx={-2.5} cy={-9} rx={1.4} ry={2} fill={C('#7C4A24')} /><Ellipse cx={2.5} cy={-9} rx={1.4} ry={2} fill={C('#7C4A24')} /><Path d="M-2 -3 L0 -1 L2 -3" stroke={C('#D8CFB8')} strokeWidth={1.2} fill="none" /></>);
      return (<><Rect x={-18} y={-24} width={36} height={24} rx={4} fill={C('#D07C42')} /><Rect x={-18} y={-24} width={12} height={24} rx={4} fill={C('#DE8F52')} /><Rect x={-10} y={-34} width={20} height={12} rx={3} fill={C('#BC6A34')} /><Rect x={-10} y={-34} width={7} height={12} rx={3} fill={C('#CE7C42')} /><Rect x={-4} y={-12} width={8} height={12} rx={3} fill={C('#6B3E1C')} /><Rect x={8} y={-19} width={5} height={5} rx={1} fill={C('#FCD34D')} /><Rect x={-13} y={-19} width={5} height={5} rx={1} fill={C('#FCD34D')} /><Line x1={13} y1={-24} x2={13} y2={-33} stroke={C('#7C4A24')} strokeWidth={2} /><Line x1={17} y1={-24} x2={17} y2={-33} stroke={C('#7C4A24')} strokeWidth={2} /><Line x1={12} y1={-27} x2={18} y2={-27} stroke={C('#7C4A24')} strokeWidth={1.4} /><Line x1={12} y1={-30} x2={18} y2={-30} stroke={C('#7C4A24')} strokeWidth={1.4} /></>);
    case 'vampire': // gothic: tombstone / bat / dead tree / candelabra / coffin / castle tower
      if (variant === 0) return (<><Path d="M-8 0 L-8 -14 A8 8 0 0 1 8 -14 L8 0 Z" fill={C('#2A0A10')} /><Path d="M-8 0 L-8 -14 A8 8 0 0 1 0 -22 L0 0 Z" fill={C('#3A1018')} /><Line x1={0} y1={-14} x2={0} y2={-6} stroke={C('#DC2626')} strokeWidth={2} /><Line x1={-4} y1={-11} x2={4} y2={-11} stroke={C('#DC2626')} strokeWidth={2} /></>);
      if (variant === 1) return (<><Path d="M-14 -20 Q-8 -26 -3 -20 Q0 -24 3 -20 Q8 -26 14 -20 Q8 -18 6 -13 Q0 -17 -6 -13 Q-8 -18 -14 -20 Z" fill={C('#350d14')} /><Circle cx={-2} cy={-19} r={1} fill={C('#DC2626')} /><Circle cx={2} cy={-19} r={1} fill={C('#DC2626')} /></>);
      if (variant === 2) return (<><Path d="M0 0 L0 -18 M0 -12 L-8 -20 M0 -14 L7 -22 M-8 -20 L-11 -26 M7 -22 L11 -26" stroke={C('#3A1218')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 3) return (<><Line x1={0} y1={0} x2={0} y2={-12} stroke={C('#3A1218')} strokeWidth={2.5} /><Path d="M-8 -12 L-8 -20 M0 -12 L0 -22 M8 -12 L8 -20" stroke={C('#3A1218')} strokeWidth={2} fill="none" /><Path d="M-8 -12 Q0 -8 8 -12" stroke={C('#3A1218')} strokeWidth={2} fill="none" /><Circle cx={-8} cy={-22} r={2} fill={C('#F97316')} /><Circle cx={0} cy={-24} r={2} fill={C('#F97316')} /><Circle cx={8} cy={-22} r={2} fill={C('#F97316')} /></>);
      if (variant === 5) return (<><Polygon points="-6,0 -9,-8 -5,-22 5,-22 9,-8 6,0" fill={C('#1E060B')} stroke={C('#4A1018')} strokeWidth={1.5} /><Line x1={0} y1={-18} x2={0} y2={-10} stroke={C('#DC2626')} strokeWidth={1.8} /><Line x1={-3} y1={-15} x2={3} y2={-15} stroke={C('#DC2626')} strokeWidth={1.8} /></>);
      return (<><Rect x={-12} y={-44} width={24} height={44} fill={C('#1E060B')} /><Rect x={-12} y={-44} width={8} height={44} fill={C('#2E0A12')} /><Polygon points="-13,-44 0,-62 13,-44" fill={C('#350d14')} /><Polygon points="-13,-44 0,-62 0,-44" fill={C('#48121C')} /><Rect x={-4} y={-36} width={8} height={11} rx={4} fill={C('#DC2626')} opacity={0.9} /><Rect x={-3} y={-16} width={6} height={8} rx={3} fill={C('#DC2626')} opacity={0.7} /><Line x1={0} y1={-62} x2={0} y2={-72} stroke={C('#3A1218')} strokeWidth={2} /><Polygon points="0,-72 12,-68 0,-64" fill={C('#DC2626')} /></>);
    case 'royal': // gilded: pillar / crown / banner / chest / fountain / palace gate
      if (variant === 0) return (<><Rect x={-5} y={-24} width={10} height={24} fill={C('#3A3330')} /><Rect x={-5} y={-24} width={4} height={24} fill={C('#4C443E')} /><Rect x={-8} y={-28} width={16} height={5} fill={C('#D4AF37')} /><Rect x={-8} y={-2} width={16} height={3} fill={C('#D4AF37')} /></>);
      if (variant === 1) return (<><Path d="M-10 -8 L-7 -16 L-2 -10 L2 -18 L6 -10 L10 -16 L9 -4 L-9 -4 Z" fill={C('#FFD700')} /><Path d="M-10 -8 L-7 -16 L-2 -10 L0 -14 L0 -4 L-9 -4 Z" fill={C('#FFE55C')} /><Circle cx={-7} cy={-17} r={1.6} fill={C('#D4AF37')} /><Circle cx={2} cy={-19} r={1.6} fill={C('#D4AF37')} /><Circle cx={10} cy={-17} r={1.6} fill={C('#D4AF37')} /></>);
      if (variant === 2) return (<><Line x1={0} y1={0} x2={0} y2={-26} stroke={C('#3A3330')} strokeWidth={2.5} /><Polygon points="0,-26 16,-22 0,-16" fill={C('#D4AF37')} /><Polygon points="0,-26 16,-22 0,-22" fill={C('#F0CB52')} /></>);
      if (variant === 3) return (<><Rect x={-11} y={-12} width={22} height={12} rx={2} fill={C('#3A3330')} /><Path d="M-11 -12 A11 8 0 0 1 11 -12 Z" fill={C('#D4AF37')} /><Path d="M-11 -12 A11 8 0 0 1 0 -20 L0 -12 Z" fill={C('#F0CB52')} /><Rect x={-2.5} y={-13} width={5} height={6} rx={1} fill={C('#FFD700')} /></>);
      if (variant === 5) return (<><Rect x={-12} y={-4} width={24} height={4} rx={2} fill={C('#3A3330')} /><Rect x={-7} y={-10} width={14} height={6} rx={2} fill={C('#211D1A')} /><Rect x={-2.5} y={-18} width={5} height={8} fill={C('#3A3330')} /><Path d="M0 -18 Q-7 -22 -9 -12 M0 -18 Q7 -22 9 -12" stroke={C('#7DD3FC')} strokeWidth={1.6} fill="none" /><Circle cx={0} cy={-20} r={2} fill={C('#FFD700')} /></>);
      return (<><Rect x={-20} y={-34} width={8} height={34} fill={C('#211D1A')} /><Rect x={-20} y={-34} width={3.5} height={34} fill={C('#332C26')} /><Rect x={12} y={-34} width={8} height={34} fill={C('#211D1A')} /><Rect x={12} y={-34} width={3.5} height={34} fill={C('#332C26')} /><Polygon points="-22,-34 -16,-44 -10,-34" fill={C('#D4AF37')} /><Polygon points="10,-34 16,-44 22,-34" fill={C('#D4AF37')} /><Path d="M-12 0 L-12 -22 A12 12 0 0 1 12 -22 L12 0" fill="none" stroke={C('#FFD700')} strokeWidth={2.5} /><Line x1={-6} y1={0} x2={-6} y2={-28} stroke={C('#D4AF37')} strokeWidth={1.6} /><Line x1={0} y1={0} x2={0} y2={-32} stroke={C('#D4AF37')} strokeWidth={1.6} /><Line x1={6} y1={0} x2={6} y2={-28} stroke={C('#D4AF37')} strokeWidth={1.6} /></>);
    case 'solo': // shadow realm: crystals / rune circle / gate / orb / soldier / monarch arch
      if (variant === 0) return (<><Polygon points="-10,0 -5,-18 1,0" fill={C('#6D46C4')} /><Polygon points="-10,0 -5,-18 -4,0" fill={C('#8B62DC')} /><Polygon points="-1,0 5,-24 11,0" fill={C('#8B5CF6')} /><Polygon points="-1,0 5,-24 6,0" fill={C('#A57FFF')} /><Circle cx={5} cy={-26} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-11} r={10} fill="none" stroke={C('#8B5CF6')} strokeWidth={1.6} /><Circle cx={0} cy={-11} r={5.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} /><Circle cx={0} cy={-11} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 2) return (<><Path d="M-9 0 L-9 -16 A9 9 0 0 1 9 -16 L9 0" fill="none" stroke={C('#8B5CF6')} strokeWidth={2.5} /><Line x1={0} y1={-6} x2={0} y2={-14} stroke={C('#22D3EE')} strokeWidth={1.5} /></>);
      if (variant === 3) return (<><Circle cx={0} cy={-16} r={7} fill={C('#121530')} stroke={C('#8B5CF6')} strokeWidth={1.6} /><Ellipse cx={0} cy={-16} rx={12} ry={3.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} opacity={0.8} /><Circle cx={0} cy={-16} r={2} fill={C('#8B5CF6')} /></>);
      if (variant === 5) return (<><Circle cx={0} cy={-20} r={4.5} fill={C('#121530')} /><Path d="M-6 0 Q-6 -14 0 -14 Q6 -14 6 0 Z" fill={C('#121530')} /><Circle cx={-1.6} cy={-20} r={1} fill={C('#8B5CF6')} /><Circle cx={1.6} cy={-20} r={1} fill={C('#8B5CF6')} /><Path d="M6 -10 L11 -24" stroke={C('#22D3EE')} strokeWidth={1.6} /></>);
      return (<><Path d="M-16 0 L-16 -34 Q-16 -50 0 -52 Q16 -50 16 -34 L16 0" fill="none" stroke={C('#6D46C4')} strokeWidth={5} /><Path d="M-8 0 L-8 -28 Q-8 -38 0 -40 Q8 -38 8 -28 L8 0 Z" fill={C('#121530')} opacity={0.9} /><Circle cx={0} cy={-46} r={2.5} fill={C('#22D3EE')} /><Circle cx={-13} cy={-24} r={1.6} fill={C('#22D3EE')} /><Circle cx={13} cy={-24} r={1.6} fill={C('#22D3EE')} /><Line x1={0} y1={-6} x2={0} y2={-30} stroke={C('#8B5CF6')} strokeWidth={1.6} opacity={0.8} /></>);
    case 'inferno': // hellscape: flame / lava pool / spikes / geyser / demon skull / mini volcano
      if (variant === 0) return (<><Path d="M0 0 Q-8 -8 -4 -16 Q-1 -10 2 -14 Q6 -20 4 -8 Q8 -6 5 -2 Z" fill={C('#DC2626')} /><Path d="M0 -2 Q-3 -7 0 -11 Q3 -7 2 -3 Z" fill={C('#FB923C')} /></>);
      if (variant === 1) return (<><Ellipse cx={0} cy={-3} rx={13} ry={5} fill={C('#DC2626')} /><Ellipse cx={2} cy={-3} rx={6} ry={2.4} fill={C('#FB923C')} /><Circle cx={-6} cy={-8} r={1.6} fill={C('#FB923C')} /></>);
      if (variant === 2) return (<><Polygon points="-12,0 -7,-16 -2,0" fill={C('#3F3F46')} /><Polygon points="-12,0 -7,-16 -6,0" fill={C('#55555E')} /><Polygon points="0,0 6,-22 12,0" fill={C('#27272A')} /><Polygon points="0,0 6,-22 7,0" fill={C('#3A3A40')} /><Polygon points="4,-14 6,-22 8,-14" fill={C('#DC2626')} /></>);
      if (variant === 3) return (<><Ellipse cx={0} cy={-2} rx={9} ry={3.5} fill={C('#DC2626')} /><Path d="M0 -4 Q-3 -14 0 -22 Q3 -14 0 -4" fill={C('#FB923C')} /><Circle cx={-4} cy={-24} r={1.6} fill={C('#FB923C')} /><Circle cx={4} cy={-27} r={1.4} fill={C('#DC2626')} /></>);
      if (variant === 5) return (<><Circle cx={0} cy={-10} r={8} fill={C('#3F3F46')} /><Path d="M-6 -16 Q-11 -20 -10 -26 M6 -16 Q11 -20 10 -26" stroke={C('#3F3F46')} strokeWidth={3} fill="none" /><Ellipse cx={-3} cy={-10} rx={1.8} ry={2.4} fill={C('#DC2626')} /><Ellipse cx={3} cy={-10} rx={1.8} ry={2.4} fill={C('#DC2626')} /><Path d="M-3 -3 L-1.5 -5 L0 -3 L1.5 -5 L3 -3" stroke={C('#18181B')} strokeWidth={1.2} fill="none" /></>);
      return (<><Polygon points="-24,0 -6,-34 6,-34 24,0" fill={C('#3F3F46')} /><Polygon points="-24,0 -6,-34 -1,-34 -10,0" fill={C('#55555E')} /><Polygon points="-6,-34 6,-34 3,-38 -3,-38" fill={C('#DC2626')} /><Path d="M-2 -34 Q-8 -18 -6 0" stroke={C('#DC2626')} strokeWidth={4} fill="none" /><Path d="M4 -34 Q10 -20 8 0" stroke={C('#FB923C')} strokeWidth={3} fill="none" /><Circle cx={0} cy={-44} r={2.5} fill={C('#FB923C')} /><Circle cx={8} cy={-40} r={1.8} fill={C('#DC2626')} /></>);
    case 'galaxy': // cosmos: ringed planet / stars / comet / crescent / satellite / rocket
      if (variant === 0) return (<><Circle cx={0} cy={-12} r={8} fill={C('#4338CA')} /><Circle cx={-2.5} cy={-14.5} r={4} fill={C('#5B4FE8')} /><Ellipse cx={0} cy={-12} rx={14} ry={4} fill="none" stroke={C('#22D3EE')} strokeWidth={1.8} /></>);
      if (variant === 1) return (<><Circle cx={-8} cy={-16} r={2} fill={C('#E0E7FF')} /><Circle cx={2} cy={-8} r={1.5} fill={C('#E0E7FF')} /><Circle cx={8} cy={-20} r={2.4} fill={C('#22D3EE')} /><Circle cx={-2} cy={-24} r={1.3} fill={C('#E0E7FF')} /></>);
      if (variant === 2) return (<><Circle cx={6} cy={-18} r={3.5} fill={C('#22D3EE')} /><Path d="M6 -18 L-14 -6" stroke={C('#22D3EE')} strokeWidth={2} opacity={0.6} /><Path d="M6 -16 L-9 -7" stroke={C('#E0E7FF')} strokeWidth={1.2} opacity={0.5} /></>);
      if (variant === 3) return (<><Path d="M0 -24 A10 10 0 1 0 0 -4 A7.5 7.5 0 0 1 0 -24 Z" fill={C('#C7D2FE')} /></>);
      if (variant === 5) return (<><Rect x={-4} y={-18} width={8} height={10} rx={1.5} fill={C('#C7D2FE')} /><Rect x={-14} y={-16} width={8} height={6} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={0.8} /><Rect x={6} y={-16} width={8} height={6} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={0.8} /><Line x1={0} y1={-18} x2={0} y2={-23} stroke={C('#E0E7FF')} strokeWidth={1.2} /><Circle cx={0} cy={-24} r={1.4} fill={C('#22D3EE')} /></>);
      return (<><Path d="M0 -52 Q10 -40 10 -22 L10 -8 L-10 -8 L-10 -22 Q-10 -40 0 -52 Z" fill={C('#E0E7FF')} /><Path d="M0 -52 Q-10 -40 -10 -22 L-10 -8 L-4 -8 L-4 -24 Q-4 -42 0 -52 Z" fill={C('#FFFFFF')} /><Circle cx={0} cy={-30} r={5} fill={C('#4338CA')} stroke={C('#22D3EE')} strokeWidth={1.5} /><Circle cx={-1.5} cy={-31.5} r={2} fill={C('#5B4FE8')} /><Polygon points="-10,-20 -18,0 -10,-8" fill={C('#4338CA')} /><Polygon points="10,-20 18,0 10,-8" fill={C('#4338CA')} /><Polygon points="-6,-8 6,-8 0,4" fill={C('#F97316')} /><Polygon points="-3,-8 3,-8 0,-1" fill={C('#FCD34D')} /></>);
    case 'cyberpunk': // neon city: tower / robot firing / drone / billboard / hover car / mega tower
      if (variant === 0) return (<><Rect x={-9} y={-32} width={18} height={32} fill={C('#23245A')} /><Rect x={-9} y={-32} width={6} height={32} fill={C('#31337A')} /><Line x1={-9} y1={-32} x2={9} y2={-32} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={0} y1={-32} x2={0} y2={-40} stroke={C('#FF00FF')} strokeWidth={1.6} /><Circle cx={0} cy={-41} r={1.6} fill={C('#FF00FF')} /><Rect x={-5} y={-26} width={3.6} height={4} fill={C('#00FFFF')} /><Rect x={2} y={-19} width={3.6} height={4} fill={C('#FF00FF')} /><Rect x={-5} y={-12} width={3.6} height={4} fill={C('#00FFFF')} /></>);
      if (variant === 1) return (<><Rect x={-7} y={-16} width={14} height={12} rx={2} fill={C('#3A3B7A')} /><Rect x={-7} y={-16} width={5} height={12} rx={2} fill={C('#4B4C96')} /><Rect x={-5} y={-24} width={10} height={8} rx={2} fill={C('#23245A')} /><Rect x={-3} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={1} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={-11} y={-13} width={4} height={2.6} fill={C('#3A3B7A')} /><Rect x={7} y={-14} width={5} height={2.6} fill={C('#3A3B7A')} /><Line x1={12} y1={-12.7} x2={24} y2={-12.7} stroke={C('#FF00FF')} strokeWidth={1.8} /><Circle cx={26} cy={-12.7} r={1.4} fill={C('#FF00FF')} /><Rect x={-6} y={-4} width={4} height={4} fill={C('#23245A')} /><Rect x={2} y={-4} width={4} height={4} fill={C('#23245A')} /></>);
      if (variant === 2) return (<><Ellipse cx={0} cy={-22} rx={9} ry={4} fill={C('#3A3B7A')} /><Ellipse cx={-2} cy={-23} rx={6} ry={2.6} fill={C('#4B4C96')} /><Rect x={-3} y={-21} width={6} height={3} fill={C('#00FFFF')} /><Line x1={0} y1={-18} x2={0} y2={-6} stroke={C('#00FFFF')} strokeWidth={1.2} opacity={0.7} /><Polygon points="-4,-6 4,-6 0,0" fill={C('#00FFFF')} opacity={0.4} /></>);
      if (variant === 3) return (<><Rect x={-13} y={-30} width={26} height={16} rx={2} fill={C('#15163A')} stroke={C('#FF00FF')} strokeWidth={1.5} /><Line x1={-8} y1={-25} x2={8} y2={-25} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={-8} y1={-20} x2={4} y2={-20} stroke={C('#00FFFF')} strokeWidth={2} opacity={0.6} /><Line x1={-6} y1={-14} x2={-6} y2={0} stroke={C('#2A2A5E')} strokeWidth={2.5} /><Line x1={6} y1={-14} x2={6} y2={0} stroke={C('#2A2A5E')} strokeWidth={2.5} /></>);
      if (variant === 5) return (<><Ellipse cx={0} cy={-10} rx={12} ry={4.5} fill={C('#3A3B7A')} /><Ellipse cx={-3} cy={-11} rx={8} ry={3} fill={C('#4B4C96')} /><Path d="M-6 -12 Q0 -17 6 -12" stroke={C('#00FFFF')} strokeWidth={1.6} fill="none" /><Rect x={-9} y={-11} width={4} height={2} fill={C('#FF00FF')} /><Line x1={-12} y1={-6} x2={-18} y2={-4} stroke={C('#00FFFF')} strokeWidth={1.4} opacity={0.7} /><Line x1={12} y1={-6} x2={18} y2={-4} stroke={C('#00FFFF')} strokeWidth={1.4} opacity={0.7} /></>);
      return (<><Rect x={-16} y={-56} width={32} height={56} fill={C('#1E1F4E')} /><Rect x={-16} y={-56} width={10} height={56} fill={C('#2B2C66')} /><Line x1={-16} y1={-56} x2={16} y2={-56} stroke={C('#00FFFF')} strokeWidth={2.5} /><Line x1={0} y1={-56} x2={0} y2={-70} stroke={C('#FF00FF')} strokeWidth={2} /><Circle cx={0} cy={-71} r={2} fill={C('#FF00FF')} /><Rect x={-11} y={-50} width={5} height={6} fill={C('#00FFFF')} /><Rect x={-2} y={-50} width={5} height={6} fill={C('#FF00FF')} opacity={0.8} /><Rect x={7} y={-50} width={5} height={6} fill={C('#00FFFF')} opacity={0.7} /><Rect x={-11} y={-38} width={5} height={6} fill={C('#FF00FF')} opacity={0.7} /><Rect x={7} y={-38} width={5} height={6} fill={C('#00FFFF')} /><Rect x={-2} y={-26} width={5} height={6} fill={C('#00FFFF')} opacity={0.8} /><Rect x={-11} y={-26} width={5} height={6} fill={C('#2A2A5E')} /><Rect x={-10} y={-16} width={20} height={9} fill={C('#0D0D2B')} stroke={C('#00FFFF')} strokeWidth={1.2} /><Line x1={-6} y1={-11.5} x2={6} y2={-11.5} stroke={C('#FF00FF')} strokeWidth={2} /></>);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Landscape layer: big full-width background features. Ridge bands
// land every ~3 levels; rivers meander across select biomes.
// ---------------------------------------------------------------------------

function ridgeArt(id: ThemeId, w: number, C: Cfn) {
  switch (id) {
    case 'default': // rolling hills with sunlit crests
      return (<><Path d={`M-10 8 Q ${w * 0.25} -22 ${w * 0.55} 4 L ${w * 0.55} 24 L -10 24 Z`} fill={C('#48A238')} opacity={0.5} /><Path d={`M-10 8 Q ${w * 0.25} -22 ${w * 0.55} 4`} stroke={C('#74CC5D')} strokeWidth={2.6} fill="none" opacity={0.7} /><Path d={`M ${w * 0.4} 10 Q ${w * 0.7} -18 ${w + 10} 6 L ${w + 10} 26 L ${w * 0.4} 26 Z`} fill={C('#54B242')} opacity={0.45} /></>);
    case 'paper': // folded mountain range
      return (<><Polygon points={`-10,10 ${w * 0.2},-24 ${w * 0.4},2 ${w * 0.6},-18 ${w * 0.8},6 ${w + 10},-10 ${w + 10},18 -10,18`} fill={C('#FFFFFF')} opacity={0.55} /><Line x1={w * 0.2} y1={-24} x2={w * 0.28} y2={2} stroke={C('#2563EB')} strokeWidth={1} opacity={0.35} /><Line x1={w * 0.6} y1={-18} x2={w * 0.66} y2={4} stroke={C('#2563EB')} strokeWidth={1} opacity={0.35} /></>);
    case 'calm': // sand mountains: dune crests with a lit edge
      return (<><Path d={`M-10 6 Q ${w * 0.22} -30 ${w * 0.5} -4 Q ${w * 0.75} 16 ${w + 10} -12 L ${w + 10} 26 L -10 26 Z`} fill={C('#E3AC2C')} opacity={0.6} /><Path d={`M-10 6 Q ${w * 0.22} -30 ${w * 0.5} -4`} stroke={C('#FFD45E')} strokeWidth={3} fill="none" opacity={0.8} /><Path d={`M ${w * 0.4} 12 Q ${w * 0.68} -14 ${w + 10} 4 L ${w + 10} 28 L ${w * 0.4} 28 Z`} fill={C('#EDB637')} opacity={0.55} /><Path d={`M ${w * 0.4} 12 Q ${w * 0.68} -14 ${w + 10} 4`} stroke={C('#FFCE52')} strokeWidth={2.4} fill="none" opacity={0.7} /></>);
    case 'slate': // jagged moonlit ridge
      return (<><Polygon points={`-10,10 ${w * 0.18},-20 ${w * 0.34},-2 ${w * 0.52},-26 ${w * 0.7},0 ${w * 0.86},-14 ${w + 10},6 ${w + 10},20 -10,20`} fill={C('#3A4C66')} opacity={0.6} /><Circle cx={w * 0.52} cy={-30} r={1.6} fill={C('#38BDF8')} opacity={0.7} /></>);
    case 'green': // dense canopy band
      return (<>{[0.05, 0.22, 0.4, 0.58, 0.76, 0.94].map((f, i) => (<Circle key={f} cx={w * f} cy={-4 - (i % 2) * 6} r={14 + (i % 3) * 4} fill={C(i % 2 === 0 ? '#4FA92F' : '#57B237')} opacity={0.45} />))}</>);
    case 'vapor': // retro grid horizon + distant sun
      return (<><Line x1={-10} y1={-4} x2={w + 10} y2={-4} stroke={C('#01CDFE')} strokeWidth={1.2} opacity={0.45} /><Line x1={-10} y1={-12} x2={w + 10} y2={-12} stroke={C('#01CDFE')} strokeWidth={1} opacity={0.3} /><Line x1={-10} y1={-20} x2={w + 10} y2={-20} stroke={C('#01CDFE')} strokeWidth={1} opacity={0.2} /><Circle cx={w * 0.8} cy={-26} r={10} fill={C('#FF71CE')} opacity={0.4} /></>);
    case 'sunset': // canyon mesa silhouettes
      return (<><Rect x={w * 0.06} y={-22} width={w * 0.14} height={26} rx={5} fill={C('#AC5E2C')} opacity={0.55} /><Rect x={w * 0.55} y={-16} width={w * 0.1} height={20} rx={4} fill={C('#AC5E2C')} opacity={0.5} /><Rect x={w * 0.78} y={-26} width={w * 0.16} height={30} rx={6} fill={C('#96501E')} opacity={0.5} /></>);
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
      return (<>{[0.05, 0.2, 0.38, 0.55, 0.7, 0.85].map((f, i) => (<Rect key={f} x={w * f} y={-(14 + (i % 3) * 10)} width={w * 0.1} height={14 + (i % 3) * 10} fill={C('#0A0A22')} opacity={0.75} />))}<Rect x={w * 0.22} y={-18} width={3} height={3} fill={C('#00FFFF')} opacity={0.8} /><Rect x={w * 0.57} y={-24} width={3} height={3} fill={C('#FF00FF')} opacity={0.8} /></>);
    default:
      return null;
  }
}

/** Small ground-texture marks (ripples, tufts, pebbles...), scattered
 *  under the road so the terrain never looks empty. */
function detailArt(id: ThemeId, C: Cfn) {
  switch (id) {
    case 'calm':
      return <Path d="M-7 0 Q0 -4 7 0 M-3 4 Q4 1 9 4" stroke={C('#DFA928')} strokeWidth={1.6} fill="none" />;
    case 'sunset':
      return <Path d="M-7 0 Q0 -4 7 0 M-3 4 Q4 1 9 4" stroke={C('#96501E')} strokeWidth={1.6} fill="none" />;
    case 'default':
      return <Path d="M0 0 L-3 -7 M0 0 L0 -8 M0 0 L3 -7" stroke={C('#3E8E2E')} strokeWidth={1.6} fill="none" />;
    case 'green':
      return <Path d="M0 0 L-3 -7 M0 0 L0 -8 M0 0 L3 -7" stroke={C('#3E8E2E')} strokeWidth={1.6} fill="none" />;
    case 'paper':
      return <Path d="M-5 0 L0 -4 L5 0" stroke={C('#A0B6CC')} strokeWidth={1.4} fill="none" />;
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

/** Soft white cloud cluster (bright worlds only). */
function cloudArt(C: Cfn) {
  return (
    <>
      <Ellipse cx={0} cy={0} rx={26} ry={11} fill={C('#FFFFFF')} />
      <Circle cx={-12} cy={-6} r={10} fill={C('#FFFFFF')} />
      <Circle cx={4} cy={-8} r={12} fill={C('#FFFFFF')} />
      <Circle cx={16} cy={-3} r={8} fill={C('#FFFFFF')} />
      <Ellipse cx={2} cy={3} rx={22} ry={7} fill={C('#E8F2FA')} opacity={0.7} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Road geometry
// ---------------------------------------------------------------------------

const SPACING  = 64;    // vertical px per level step
const NODE     = 38;    // level candy-button size
const NODE_CUR = 48;    // player's button size
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
    track('map_opened', { level });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const C: Cfn = (c) => (unlocked ? c : toGrey(c));

  const H = zoneHeight(zone);
  const yFor = (lvl: number) => stepY(zone, lvl);

  // Road spline. TWO neighbor steps beyond each edge are included at
  // their true global positions so the Catmull-Rom curve is identical
  // in adjacent zones — the seam is invisible.
  const gx = (lvl: number) => xForLevel(lvl, width);
  const pts: Array<[number, number]> = [];
  if (hasBelow) {
    pts.push([gx(zone.start - 2), H + SPACING * 1.5]);
    pts.push([gx(zone.start - 1), H + SPACING / 2]);
  }
  for (let lvl = zone.start; lvl <= zone.end; lvl++) pts.push([gx(lvl), yFor(lvl)]);
  if (hasAbove) {
    pts.push([gx(zone.end + 1), -(BANNER + SPACING / 2)]);
    pts.push([gx(zone.end + 2), -(BANNER + SPACING * 1.5)]);
  }
  const roadPath = smoothPath(pts);

  // Scenery, all inside the one SVG, painted back-to-front:
  //   ground gradient -> patches -> ridges -> details -> rivers ->
  //   road (shadow/outline/fill/pebbles) -> props (with contact
  //   shadows) -> clouds -> specks. Level buttons are RN views above.
  const POOL = [0, 1, 2, 3, 5];   // non-hero prop rotation
  const patches = [];
  const rivers = [];
  const pebbles = [];
  const props = [];
  const clouds = [];
  const specks = [];
  const riverSpec = RIVER[zone.id];
  const shadowFor = (s: number) => (
    <Ellipse cx={0} cy={1.5} rx={13 * s} ry={4 * s} fill="#000000" opacity={0.16} />
  );
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const rel = lvl - zone.start;
    const nx = gx(lvl);
    const y = yFor(lvl);

    // Organic ground patch + sunlit rim.
    const pcx = jitter(lvl, 8) * width;
    const pcy = y + (jitter(lvl, 9) - 0.5) * SPACING;
    const prx = 46 + jitter(lvl, 10) * 60;
    const pry = 12 + jitter(lvl, 11) * 10;
    patches.push(
      <Ellipse key={`g-${lvl}`} cx={pcx} cy={pcy} rx={prx} ry={pry} fill={C(lvl % 2 === 0 ? T.patchA : T.patchB)} opacity={0.5} />,
    );
    if (lvl % 2 === 0) {
      patches.push(
        <Ellipse key={`gh-${lvl}`} cx={pcx} cy={pcy - 3} rx={prx * 0.7} ry={pry * 0.6} fill={C(T.groundHi)} opacity={0.35} />,
      );
    }

    // Full-width terrain band every ~3 levels.
    if (rel % 3 === 1) {
      patches.push(
        <G key={`r-${lvl}`} transform={`translate(0 ${y + SPACING * 0.45 + jitter(lvl, 24) * 10})`}>
          {ridgeArt(zone.id, width, C)}
        </G>,
      );
    }

    // Ground texture marks (2 per level).
    patches.push(
      <G key={`d1-${lvl}`} transform={`translate(${jitter(lvl, 18) * width} ${y + (jitter(lvl, 19) - 0.5) * SPACING}) scale(${0.8 + jitter(lvl, 20) * 0.6})`} opacity={0.6}>
        {detailArt(zone.id, C)}
      </G>,
      <G key={`d2-${lvl}`} transform={`translate(${jitter(lvl, 21) * width} ${y + (jitter(lvl, 22) - 0.5) * SPACING}) scale(${0.7 + jitter(lvl, 23) * 0.6})`} opacity={0.55}>
        {detailArt(zone.id, C)}
      </G>,
    );

    // Meandering river every ~6 levels (biomes that have one), with a
    // foam edge. The road bridges over it.
    if (riverSpec && rel % 6 === 2) {
      const cy = y + SPACING / 2;
      const d = `M -20 ${cy} C ${width * 0.18} ${cy - 24}, ${width * 0.3} ${cy + 16}, ${width * 0.52} ${cy - 4} S ${width * 0.8} ${cy + 16}, ${width + 20} ${cy - 12}`;
      rivers.push(
        <Path key={`wf-${lvl}`} d={d} stroke={C(riverSpec.foam)} strokeWidth={17} fill="none" strokeLinecap="round" opacity={0.4} />,
        <Path key={`w-${lvl}`} d={d} stroke={C(riverSpec.base)} strokeWidth={13} fill="none" strokeLinecap="round" opacity={0.95} />,
        <Path key={`wc-${lvl}`} d={d} stroke={C(riverSpec.core)} strokeWidth={5.5} fill="none" strokeLinecap="round" opacity={0.85} />,
      );
    }

    // Pebble ovals on the road between this step and the previous one.
    if (lvl > zone.start || hasBelow) {
      const y0 = y + SPACING;
      const x0 = gx(lvl - 1);
      for (const t of [0.3, 0.68]) {
        const px = x0 + (nx - x0) * t + (jitter(lvl, 30 + t * 10) - 0.5) * 6;
        const py = y0 + (y - y0) * t;
        pebbles.push(
          <Ellipse key={`pb-${lvl}-${t}`} cx={px} cy={py} rx={3.4 + jitter(lvl, 33) * 2.4} ry={2 + jitter(lvl, 34) * 1.4} fill={C(T.pebble)} opacity={0.8} />,
        );
      }
    }

    // Big prop on the open side of the road (hero every ~4 levels,
    // skipped near the zone top so tall art doesn't clip).
    const off = 78 + jitter(lvl, 1) * 40;
    const px = nx < width / 2 ? Math.min(nx + off, width - 36) : Math.max(nx - off, 36);
    const py = y + 14 + (jitter(lvl, 2) - 0.5) * 20;
    const hero = rel % 4 === 2 && y > 110;
    const sA = hero ? 1.05 + jitter(lvl, 3) * 0.2 : 0.9 + jitter(lvl, 3) * 0.45;
    props.push(
      <G key={`p-${lvl}`} transform={`translate(${px} ${py})`}>
        {shadowFor(sA)}
        <G transform={`scale(${sA})`}>{propArt(zone.id, hero ? 4 : POOL[lvl % 5]!, C)}</G>
      </G>,
    );

    // Edge prop + a cluster buddy right next to it (forest-edge feel).
    const ex = nx < width / 2 ? 20 + jitter(lvl, 7) * 26 : width - 20 - jitter(lvl, 7) * 26;
    const ey = y + 30 + (jitter(lvl, 12) - 0.5) * 24;
    const sB = 0.55 + jitter(lvl, 13) * 0.3;
    props.push(
      <G key={`e-${lvl}`} transform={`translate(${ex} ${ey})`}>
        {shadowFor(sB)}
        <G transform={`scale(${sB})`}>{propArt(zone.id, POOL[(lvl + 2) % 5]!, C)}</G>
      </G>,
      <G key={`eb-${lvl}`} transform={`translate(${ex + (nx < width / 2 ? 26 : -26)} ${ey + 8})`}>
        {shadowFor(sB * 0.8)}
        <G transform={`scale(${sB * 0.8})`}>{propArt(zone.id, POOL[(lvl + 4) % 5]!, C)}</G>
      </G>,
    );

    // Mid-size prop between road and edge every other level.
    if (lvl % 2 === 0) {
      const mx = nx < width / 2
        ? Math.min(nx + 42 + jitter(lvl, 17) * 24, width - 26)
        : Math.max(nx - 42 - jitter(lvl, 17) * 24, 26);
      props.push(
        <G key={`m-${lvl}`} transform={`translate(${mx} ${y + 44})`}>
          {shadowFor(0.6)}
          <G transform="scale(0.6)">{propArt(zone.id, POOL[(lvl + 3) % 5]!, C)}</G>
        </G>,
      );
    }

    // Clouds drift over bright worlds.
    if (T.clouds && rel % 5 === 2) {
      const cx2 = rel % 10 < 5 ? 30 + jitter(lvl, 40) * 40 : width - 40 - jitter(lvl, 40) * 40;
      clouds.push(
        <G key={`c-${lvl}`} transform={`translate(${cx2} ${y - 10}) scale(${0.8 + jitter(lvl, 41) * 0.4})`} opacity={0.92}>
          {cloudArt(C)}
        </G>,
      );
    }

    // Themed ambient particles.
    specks.push(
      <Circle key={`a-${lvl}`} cx={jitter(lvl, 4) * width} cy={y + (jitter(lvl, 5) - 0.5) * SPACING} r={1.2 + jitter(lvl, 6) * 1.4} fill={C(T.speckA)} opacity={0.5} />,
      <Circle key={`b-${lvl}`} cx={jitter(lvl, 14) * width} cy={y + (jitter(lvl, 15) - 0.5) * SPACING} r={1 + jitter(lvl, 16) * 1.2} fill={C(T.speckB)} opacity={0.45} />,
    );
  }

  // Level steps: 3D candy buttons (RN views over the SVG).
  // gold = passed/current, white = ahead, fog = locked zone.
  const steps = [];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const x = gx(lvl);
    const y = yFor(lvl);
    const isCurrent = lvl === level;
    const size = isCurrent ? NODE_CUR : NODE;
    const r = size * 0.28;

    let face: string, bevel: string, num: string;
    if (!unlocked) {
      face = FOG_NODE; bevel = FOG_BEVEL; num = GREY_TEXT;
    } else if (lvl <= level) {
      face = '#FFD75E'; bevel = '#C8912B'; num = '#7A4E10';
    } else {
      face = '#FDFBF4'; bevel = '#B8AC94'; num = '#8D8467';
    }

    steps.push(
      <View
        key={lvl}
        pointerEvents="none"
        style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size + 4 }}
      >
        {isCurrent ? (
          <View
            style={{
              position: 'absolute', left: -4, top: -4, width: size + 8, height: size + 8,
              borderRadius: r + 5, borderWidth: 3.5, borderColor: '#FFFFFF',
            }}
          />
        ) : null}
        <View style={{ position: 'absolute', top: 4, width: size, height: size, borderRadius: r, backgroundColor: bevel }} />
        <View
          style={{
            position: 'absolute', top: 0, width: size, height: size - 3, borderRadius: r,
            backgroundColor: face, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <View
            style={{
              position: 'absolute', top: 2.5, left: 3.5, right: 3.5, height: (size - 3) * 0.42,
              borderRadius: r * 0.7, backgroundColor: '#FFFFFF', opacity: unlocked ? 0.55 : 0.06,
            }}
          />
          <Text style={[styles.stepNum, { color: num, fontSize: lvl >= 100 ? 11.5 : isCurrent ? 16 : 13.5 }]}>
            {lvl}
          </Text>
        </View>
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
              top: y - size / 2 - 34,
              width: chipW,
            },
          ]}
        >
          <Text style={[styles.hereText, { color: OCEAN }]}>YOU ARE HERE</Text>
        </View>,
      );
    }
  }

  // Candy-button contact shadows live in the SVG so they sit under the
  // RN button views.
  const stepShadows = [];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const size = lvl === level ? NODE_CUR : NODE;
    stepShadows.push(
      <Ellipse key={`ss-${lvl}`} cx={gx(lvl)} cy={yFor(lvl) + size / 2 + 4} rx={size / 2 + 3} ry={4.5} fill="#000000" opacity={0.22} />,
    );
  }

  const decos = DECORATIONS.filter(
    (d) => d.id !== 'none' && d.unlockLevel >= zone.start && d.unlockLevel <= zone.end,
  );

  return (
    <View style={{ height: H, backgroundColor: unlocked ? T.ground : FOG_BG }}>
      {/* Ground, road and all scenery in ONE svg. */}
      <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`ground-${zone.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C(T.groundHi)} />
            <Stop offset="0.5" stopColor={C(T.ground)} />
            <Stop offset="1" stopColor={C(T.ground)} />
          </LinearGradient>
        </Defs>
        {unlocked ? (
          <Rect x={0} y={0} width={width} height={H} fill={`url(#ground-${zone.id})`} />
        ) : null}
        {patches}
        {rivers}
        <Path d={roadPath} fill="none" stroke="#000000" strokeOpacity={0.14} strokeWidth={30} strokeLinecap="round" transform="translate(0 5)" />
        <Path d={roadPath} fill="none" stroke={C(T.edge)} strokeWidth={28} strokeLinecap="round" />
        <Path d={roadPath} fill="none" stroke={C(T.road)} strokeWidth={21} strokeLinecap="round" />
        {pebbles}
        {props}
        {clouds}
        {specks}
        {stepShadows}
      </Svg>

      {steps}

      {decos.map((d) => {
        const nx = gx(d.unlockLevel);
        const y = yFor(d.unlockLevel);
        const x = nx < width / 2 ? nx + 48 : nx - 48 - 30;
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
                borderColor: isUnlocked ? '#C8912B' : FOG_BORDER,
                backgroundColor: unlocked ? '#FDFBF4' : FOG_NODE,
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
        style={({ pressed }) => [styles.banner, { top: H - BANNER + 14, opacity: pressed ? 0.85 : 1 }]}
      >
        <View
          style={[
            styles.bannerCard,
            {
              backgroundColor: unlocked ? '#FFF8E8' : FOG_NODE,
              borderColor: unlocked ? '#E8D9B4' : FOG_BORDER,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.bannerGloss, { opacity: unlocked ? 0.6 : 0.05 }]}
          />
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
            <Text style={[styles.bannerRange, { color: unlocked ? '#8D8467' : GREY_TEXT }]}>
              {zone.end > zone.start ? `LEVEL ${zone.start}–${zone.end}` : `LEVEL ${zone.start}`}
            </Text>
          </View>
          {conquered ? (
            <Ionicons name="checkmark-circle" size={17} color="#C8912B" />
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

  stepNum:       { fontWeight: '900', includeFontPadding: false },

  hereChip:      { position: 'absolute', height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  hereText:      { fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },

  decoSquare:    {
    position: 'absolute', width: 30, height: 30, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  decoEmoji:     { fontSize: 13 },

  banner:        { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bannerCard:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingVertical: 10, borderRadius: 14, borderWidth: 2,
    maxWidth: '86%', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  bannerGloss:   {
    position: 'absolute', top: 0, left: 0, right: 0, height: 20,
    backgroundColor: '#FFFFFF',
  },
  bannerTextWrap:{ alignItems: 'center' },
  bannerName:    { fontSize: 19, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  bannerRange:   { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 1 },
});
