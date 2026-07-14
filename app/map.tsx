// YourLevel Roadmap — the world map.
//
// Candy-Crush-style level road: EVERY level is a numbered square step
// on ONE continuous serpentine road that winds from level 1 to the
// summit without a single break. The road passes THROUGH each theme's
// biome zone — full-bleed in that world's palette, dressed with
// themed scenery you walk past (palms on Golden Shores, tombstones
// and bats in the Crimson Keep, neon towers and robots in the Neon
// City...). Each zone's island landmark + name sign sits at its
// entrance, and the road runs right past it into the world.
//
// Zone states:
//   unlocked  — full theme color; passed steps + road fill in accent
//   locked    — fog-grey: scenery, numbers and name all visible,
//               zero color, lock on the sign
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
// Ocean + fog palette (the map has its own fixed identity)
// ---------------------------------------------------------------------------

const OCEAN       = '#06131D';
const FOG_BG      = '#0C141C';   // locked-zone ground
const FOG_PATH    = '#1A242E';
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

/** Deterministic 0..1 jitter from a level number (stable across
 *  renders — no Math.random so the map never reshuffles). */
const frac = (n: number) => n - Math.floor(n);
const jitter = (lvl: number, salt: number) => frac(Math.abs(Math.sin(lvl * 12.9898 + salt * 78.233)) * 43758.5453);

// ---------------------------------------------------------------------------
// Island landmark art. One SVG per theme, 240x130 viewBox. `C()` maps
// every color to grey while the zone is locked.
// ---------------------------------------------------------------------------

function IslandArt({ id, unlocked }: { id: ThemeId; unlocked: boolean }) {
  const C = (c: string) => (unlocked ? c : toGrey(c));

  // Shared water shadow + island base blob.
  const base = (land: string, landDark: string) => (
    <>
      <Ellipse cx={120} cy={108} rx={100} ry={16} fill={C('#0E2434')} />
      <Path
        d="M28 100 Q40 74 78 70 Q100 52 140 58 Q186 54 202 78 Q220 92 208 102 Q170 116 120 114 Q60 116 28 100 Z"
        fill={C(landDark)}
      />
      <Path
        d="M40 96 Q52 76 84 72 Q106 58 142 63 Q182 60 196 80 Q208 90 198 98 Q164 108 120 107 Q68 109 40 96 Z"
        fill={C(land)}
      />
    </>
  );

  switch (id) {
    case 'default': // Starter Isle — grass, dirt path, a planted flag
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#3E8E4F', '#2C6B3A')}
          <Path d="M96 106 Q112 92 128 96 Q140 99 148 106" stroke={C('#8A6A45')} strokeWidth={7} fill="none" />
          <Line x1={132} y1={92} x2={132} y2={48} stroke={C('#E8E8E8')} strokeWidth={4} />
          <Polygon points="132,48 168,58 132,68" fill={C('#4A90E2')} />
          <Circle cx={78} cy={88} r={9} fill={C('#357945')} />
          <Circle cx={166} cy={94} r={7} fill={C('#357945')} />
        </Svg>
      );
    case 'paper': // Origami Isle — folded white mountain, crease lines
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#F5F5F5', '#D9D9D9')}
          <Polygon points="82,96 120,38 158,96" fill={C('#FFFFFF')} />
          <Polygon points="120,38 158,96 120,96" fill={C('#E3E8F2')} />
          <Line x1={120} y1={38} x2={120} y2={96} stroke={C('#2563EB')} strokeWidth={2} />
          <Line x1={101} y1={67} x2={120} y2={78} stroke={C('#2563EB')} strokeWidth={1.5} />
          <Polygon points="120,38 110,54 130,54" fill={C('#FFFFFF')} />
        </Svg>
      );
    case 'calm': // Golden Shores — sand, two palms, low sun
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          <Circle cx={186} cy={44} r={16} fill={C('#D4A843')} />
          {base('#EFD9A7', '#D9BC82')}
          <Path d="M92 96 Q88 70 96 52" stroke={C('#8A6A45')} strokeWidth={5} fill="none" />
          <Path d="M96 52 Q78 44 66 50 M96 52 Q96 36 84 30 M96 52 Q112 40 122 46 M96 52 Q114 52 122 62"
            stroke={C('#5B9C6E')} strokeWidth={4} fill="none" />
          <Path d="M148 100 Q152 80 146 66" stroke={C('#8A6A45')} strokeWidth={4} fill="none" />
          <Path d="M146 66 Q132 60 124 66 M146 66 Q148 52 138 48 M146 66 Q160 56 168 62"
            stroke={C('#5B9C6E')} strokeWidth={3.5} fill="none" />
        </Svg>
      );
    case 'slate': // Blue Moon Isle — dark rock, huge moon, water pools
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          <Circle cx={120} cy={46} r={30} fill={C('#BFE7FB')} />
          <Circle cx={110} cy={38} r={6} fill={C('#93CBE8')} />
          <Circle cx={130} cy={52} r={4.5} fill={C('#93CBE8')} />
          <Circle cx={121} cy={60} r={3} fill={C('#93CBE8')} />
          {base('#475569', '#334155')}
          <Ellipse cx={95} cy={96} rx={17} ry={6} fill={C('#38BDF8')} />
          <Ellipse cx={152} cy={92} rx={12} ry={4.5} fill={C('#38BDF8')} />
          <Path d="M120 84 L128 68 L136 84 Z" fill={C('#64748B')} />
        </Svg>
      );
    case 'green': // Kiwi Jungle — dense canopy + a giant kiwi slice
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#65A30D', '#4D7C0F')}
          <Circle cx={88} cy={72} r={20} fill={C('#3F6212')} />
          <Circle cx={116} cy={62} r={24} fill={C('#4D7C0F')} />
          <Circle cx={148} cy={72} r={19} fill={C('#3F6212')} />
          <Circle cx={172} cy={86} r={13} fill={C('#4D7C0F')} />
          <Circle cx={120} cy={94} r={17} fill={C('#84CC16')} />
          <Circle cx={120} cy={94} r={12} fill={C('#F7FEE7')} />
          <Circle cx={120} cy={94} r={3} fill={C('#365314')} />
          <Line x1={120} y1={82} x2={120} y2={86} stroke={C('#365314')} strokeWidth={1.5} />
          <Line x1={120} y1={102} x2={120} y2={106} stroke={C('#365314')} strokeWidth={1.5} />
          <Line x1={112} y1={94} x2={108} y2={94} stroke={C('#365314')} strokeWidth={1.5} />
          <Line x1={128} y1={94} x2={132} y2={94} stroke={C('#365314')} strokeWidth={1.5} />
        </Svg>
      );
    case 'vapor': // Neon Grid Isle — striped retro sun + glowing grid
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          <Circle cx={120} cy={52} r={26} fill={C('#FF71CE')} />
          <Rect x={90} y={54} width={60} height={4} fill={OCEAN} />
          <Rect x={90} y={62} width={60} height={5} fill={OCEAN} />
          <Rect x={90} y={71} width={60} height={6} fill={OCEAN} />
          {base('#2E1A47', '#221238')}
          <Line x1={60} y1={104} x2={100} y2={72} stroke={C('#01CDFE')} strokeWidth={1.5} />
          <Line x1={100} y1={108} x2={120} y2={72} stroke={C('#01CDFE')} strokeWidth={1.5} />
          <Line x1={144} y1={108} x2={140} y2={72} stroke={C('#01CDFE')} strokeWidth={1.5} />
          <Line x1={184} y1={100} x2={160} y2={74} stroke={C('#01CDFE')} strokeWidth={1.5} />
          <Line x1={70} y1={92} x2={180} y2={92} stroke={C('#01CDFE')} strokeWidth={1.5} />
          <Line x1={82} y1={82} x2={166} y2={82} stroke={C('#01CDFE')} strokeWidth={1.5} />
        </Svg>
      );
    case 'sunset': // Ember Dunes — layered dunes, half-sunk sun
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          <Circle cx={120} cy={70} r={24} fill={C('#F97316')} />
          <Line x1={78} y1={46} x2={92} y2={54} stroke={C('#FCD34D')} strokeWidth={3} />
          <Line x1={162} y1={46} x2={148} y2={54} stroke={C('#FCD34D')} strokeWidth={3} />
          <Line x1={120} y1={30} x2={120} y2={42} stroke={C('#FCD34D')} strokeWidth={3} />
          {base('#A05A2C', '#7C4A24')}
          <Path d="M52 98 Q92 78 132 94 Q176 106 196 94" stroke={C('#7C4A24')} strokeWidth={6} fill="none" />
          <Path d="M70 104 Q110 92 150 102" stroke={C('#C77B3F')} strokeWidth={4} fill="none" />
        </Svg>
      );
    case 'vampire': // Crimson Keep — gothic towers, blood moon
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          <Circle cx={182} cy={40} r={15} fill={C('#FCA5A5')} />
          {base('#1A0408', '#12030a')}
          <Rect x={96} y={52} width={16} height={46} fill={C('#2A0A10')} />
          <Polygon points="96,52 104,34 112,52" fill={C('#2A0A10')} />
          <Rect x={126} y={44} width={20} height={54} fill={C('#350d14')} />
          <Polygon points="126,44 136,22 146,44" fill={C('#350d14')} />
          <Rect x={156} y={58} width={14} height={40} fill={C('#2A0A10')} />
          <Polygon points="156,58 163,42 170,58" fill={C('#2A0A10')} />
          <Rect x={101} y={62} width={5} height={8} fill={C('#DC2626')} />
          <Rect x={133} y={54} width={6} height={9} fill={C('#DC2626')} />
          <Rect x={160} y={68} width={5} height={7} fill={C('#DC2626')} />
        </Svg>
      );
    case 'royal': // Gilded Court — golden palace + crown
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#1C1917', '#141110')}
          <Rect x={92} y={60} width={56} height={38} fill={C('#292524')} />
          <Rect x={84} y={52} width={14} height={46} fill={C('#3A3330')} />
          <Rect x={142} y={52} width={14} height={46} fill={C('#3A3330')} />
          <Polygon points="84,52 91,40 98,52" fill={C('#D4AF37')} />
          <Polygon points="142,52 149,40 156,52" fill={C('#D4AF37')} />
          <Rect x={112} y={74} width={16} height={24} fill={C('#D4AF37')} />
          <Path d="M104 34 L110 44 L120 30 L130 44 L136 34 L134 50 L106 50 Z" fill={C('#FFD700')} />
        </Svg>
      );
    case 'solo': // Shadow Spires — violet crystals, cyan runes
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#0E1020', '#090a16')}
          <Polygon points="100,98 112,30 124,98" fill={C('#8B5CF6')} />
          <Polygon points="82,100 90,58 100,100" fill={C('#6D46C4')} />
          <Polygon points="126,98 140,48 152,98" fill={C('#6D46C4')} />
          <Polygon points="154,100 164,68 172,100" fill={C('#8B5CF6')} />
          <Circle cx={112} cy={54} r={2.5} fill={C('#22D3EE')} />
          <Circle cx={140} cy={66} r={2.5} fill={C('#22D3EE')} />
          <Circle cx={90} cy={76} r={2} fill={C('#22D3EE')} />
          <Circle cx={163} cy={82} r={2} fill={C('#22D3EE')} />
        </Svg>
      );
    case 'inferno': // The Volcano — lava streams + embers
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#27272A', '#18181B')}
          <Polygon points="80,100 120,28 162,100" fill={C('#3F3F46')} />
          <Polygon points="110,40 120,28 131,40 126,46 114,46" fill={C('#DC2626')} />
          <Path d="M118 42 Q112 66 118 98" stroke={C('#DC2626')} strokeWidth={6} fill="none" />
          <Path d="M126 44 Q136 70 132 98" stroke={C('#FB923C')} strokeWidth={4} fill="none" />
          <Circle cx={104} cy={26} r={3} fill={C('#FB923C')} />
          <Circle cx={136} cy={18} r={2.5} fill={C('#DC2626')} />
          <Circle cx={122} cy={12} r={2} fill={C('#FB923C')} />
        </Svg>
      );
    case 'galaxy': // Star Isle — floating rock, ringed planet, stars
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          <Circle cx={70} cy={30} r={2} fill={C('#E0E7FF')} />
          <Circle cx={180} cy={22} r={2.5} fill={C('#E0E7FF')} />
          <Circle cx={206} cy={62} r={1.8} fill={C('#E0E7FF')} />
          <Circle cx={44} cy={66} r={1.8} fill={C('#E0E7FF')} />
          <Circle cx={162} cy={44} r={13} fill={C('#4338CA')} />
          <Ellipse cx={162} cy={44} rx={22} ry={6} fill="none" stroke={C('#22D3EE')} strokeWidth={2.5} />
          {base('#312E81', '#242263')}
          <Polygon points="92,108 100,122 112,110" fill={C('#242263')} />
          <Polygon points="136,110 146,124 156,108" fill={C('#312E81')} />
          <Circle cx={100} cy={80} r={3} fill={C('#22D3EE')} />
          <Circle cx={128} cy={72} r={2.5} fill={C('#E0E7FF')} />
        </Svg>
      );
    case 'cyberpunk': // Neon City — skyline, glowing windows
      return (
        <Svg width="100%" height={130} viewBox="0 0 240 130">
          {base('#15163A', '#0D0D2B')}
          <Rect x={86} y={46} width={18} height={52} fill={C('#1D1E4A')} />
          <Rect x={110} y={32} width={22} height={66} fill={C('#23245A')} />
          <Rect x={138} y={52} width={16} height={46} fill={C('#1D1E4A')} />
          <Rect x={160} y={64} width={14} height={34} fill={C('#23245A')} />
          <Rect x={90} y={52} width={4} height={5} fill={C('#00FFFF')} />
          <Rect x={97} y={62} width={4} height={5} fill={C('#FF00FF')} />
          <Rect x={115} y={40} width={4} height={5} fill={C('#FF00FF')} />
          <Rect x={123} y={50} width={4} height={5} fill={C('#00FFFF')} />
          <Rect x={115} y={62} width={4} height={5} fill={C('#00FFFF')} />
          <Rect x={142} y={58} width={4} height={5} fill={C('#FF00FF')} />
          <Rect x={148} y={70} width={4} height={5} fill={C('#00FFFF')} />
          <Rect x={163} y={70} width={4} height={5} fill={C('#FF00FF')} />
          <Line x1={110} y1={32} x2={132} y2={32} stroke={C('#00FFFF')} strokeWidth={2} />
        </Svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Roadside scenery. 3 prop variants per theme, drawn around origin
// (base at 0,0, art extends upward to about -44). Rendered inside the
// zone's single SVG so hundreds of props stay cheap.
// ---------------------------------------------------------------------------

function propArt(id: ThemeId, variant: number, C: (c: string) => string) {
  switch (id) {
    case 'default':
      if (variant === 0) return (<><Rect x={-3} y={-16} width={6} height={16} fill={C('#7A5A3A')} /><Circle cx={0} cy={-24} r={12} fill={C('#3E8E4F')} /><Circle cx={-8} cy={-18} r={7} fill={C('#357945')} /></>);
      if (variant === 1) return (<><Ellipse cx={0} cy={-5} rx={11} ry={7} fill={C('#5B6B75')} /><Ellipse cx={9} cy={-3} rx={5} ry={4} fill={C('#48545D')} /></>);
      return (<><Rect x={-2} y={-22} width={4} height={22} fill={C('#8A6A45')} /><Rect x={-13} y={-30} width={26} height={10} rx={2} fill={C('#4A90E2')} /></>);
    case 'paper': // origami crane / folded hill / paper plane
      if (variant === 0) return (<><Polygon points="-12,0 0,-18 4,-6" fill={C('#FFFFFF')} /><Polygon points="4,-6 14,-14 10,0" fill={C('#E3E8F2')} /><Line x1={-12} y1={0} x2={10} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      if (variant === 1) return (<><Polygon points="-16,0 0,-20 16,0" fill={C('#FFFFFF')} /><Line x1={0} y1={-20} x2={0} y2={0} stroke={C('#2563EB')} strokeWidth={1.2} /></>);
      return (<><Polygon points="-14,-6 14,-14 -2,0" fill={C('#FFFFFF')} /><Polygon points="-2,0 14,-14 2,-4" fill={C('#CBD5E1')} /></>);
    case 'calm': // palm / shell / umbrella
      if (variant === 0) return (<><Path d="M0 0 Q-3 -14 2 -24" stroke={C('#8A6A45')} strokeWidth={4} fill="none" /><Path d="M2 -24 Q-10 -30 -16 -24 M2 -24 Q0 -36 -8 -38 M2 -24 Q12 -32 18 -26 M2 -24 Q14 -22 18 -14" stroke={C('#5B9C6E')} strokeWidth={3} fill="none" /></>);
      if (variant === 1) return (<><Path d="M-8 0 A8 8 0 0 1 8 0 Z" fill={C('#D4A843')} /><Line x1={0} y1={0} x2={0} y2={-7} stroke={C('#B8923A')} strokeWidth={1.2} /><Line x1={-4} y1={0} x2={-3} y2={-5} stroke={C('#B8923A')} strokeWidth={1.2} /><Line x1={4} y1={0} x2={3} y2={-5} stroke={C('#B8923A')} strokeWidth={1.2} /></>);
      return (<><Line x1={0} y1={0} x2={0} y2={-22} stroke={C('#8A6A45')} strokeWidth={2.5} /><Path d="M-16 -22 A16 9 0 0 1 16 -22 Z" fill={C('#C95B5B')} /><Path d="M-16 -22 A16 9 0 0 1 0 -22 Z" fill={C('#F0EFE2')} /></>);
    case 'slate': // crystal / mini moon / pool
      if (variant === 0) return (<><Polygon points="-8,0 -4,-20 2,0" fill={C('#64748B')} /><Polygon points="0,0 6,-14 12,0" fill={C('#38BDF8')} opacity={0.85} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-14} r={10} fill={C('#BFE7FB')} /><Circle cx={-3} cy={-17} r={2.5} fill={C('#93CBE8')} /><Circle cx={4} cy={-11} r={1.8} fill={C('#93CBE8')} /></>);
      return (<><Ellipse cx={0} cy={-3} rx={14} ry={5} fill={C('#38BDF8')} opacity={0.8} /><Ellipse cx={0} cy={-3} rx={8} ry={2.6} fill={C('#7DD3FC')} opacity={0.7} /></>);
    case 'green': // bush / kiwi slice / sprout
      if (variant === 0) return (<><Circle cx={-6} cy={-8} r={9} fill={C('#4D7C0F')} /><Circle cx={6} cy={-9} r={10} fill={C('#65A30D')} /><Circle cx={0} cy={-14} r={8} fill={C('#3F6212')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-10} r={10} fill={C('#84CC16')} /><Circle cx={0} cy={-10} r={7} fill={C('#F7FEE7')} /><Circle cx={0} cy={-10} r={2} fill={C('#365314')} /></>);
      return (<><Path d="M0 0 Q0 -10 0 -14" stroke={C('#4D7C0F')} strokeWidth={2.5} fill="none" /><Path d="M0 -14 Q-8 -16 -10 -22" stroke={C('#65A30D')} strokeWidth={3} fill="none" /><Path d="M0 -14 Q8 -18 9 -24" stroke={C('#65A30D')} strokeWidth={3} fill="none" /></>);
    case 'vapor': // neon palm / cassette / grid pyramid
      if (variant === 0) return (<><Path d="M0 0 Q-2 -14 2 -22" stroke={C('#FF71CE')} strokeWidth={3} fill="none" /><Path d="M2 -22 Q-8 -28 -14 -22 M2 -22 Q2 -34 -6 -36 M2 -22 Q12 -30 16 -24" stroke={C('#01CDFE')} strokeWidth={2.5} fill="none" /></>);
      if (variant === 1) return (<><Rect x={-13} y={-16} width={26} height={16} rx={2} fill={C('#2E1A47')} /><Rect x={-13} y={-16} width={26} height={16} rx={2} fill="none" stroke={C('#FF71CE')} strokeWidth={1.5} /><Circle cx={-6} cy={-8} r={3} fill={C('#01CDFE')} /><Circle cx={6} cy={-8} r={3} fill={C('#01CDFE')} /></>);
      return (<><Polygon points="-14,0 0,-22 14,0" fill="none" stroke={C('#01CDFE')} strokeWidth={1.5} /><Line x1={-7} y1={-11} x2={7} y2={-11} stroke={C('#01CDFE')} strokeWidth={1.2} /><Line x1={0} y1={-22} x2={0} y2={0} stroke={C('#FF71CE')} strokeWidth={1.2} /></>);
    case 'sunset': // cactus / dune / soaring bird
      if (variant === 0) return (<><Rect x={-3} y={-24} width={6} height={24} rx={3} fill={C('#5B7C3A')} /><Rect x={-12} y={-18} width={5} height={10} rx={2.5} fill={C('#5B7C3A')} /><Rect x={-12} y={-11} width={9} height={4} fill={C('#5B7C3A')} /><Rect x={7} y={-21} width={5} height={9} rx={2.5} fill={C('#5B7C3A')} /><Rect x={3} y={-15} width={9} height={4} fill={C('#5B7C3A')} /></>);
      if (variant === 1) return (<><Path d="M-18 0 Q-4 -12 18 0 Z" fill={C('#C77B3F')} /><Path d="M-8 0 Q4 -7 18 0 Z" fill={C('#A05A2C')} /></>);
      return (<><Path d="M-10 -22 Q-4 -28 0 -22 Q4 -28 10 -22" stroke={C('#292524')} strokeWidth={2.5} fill="none" /><Path d="M2 -14 Q6 -18 9 -14" stroke={C('#292524')} strokeWidth={2} fill="none" /></>);
    case 'vampire': // tombstone / bat / dead tree
      if (variant === 0) return (<><Path d="M-8 0 L-8 -14 A8 8 0 0 1 8 -14 L8 0 Z" fill={C('#2A0A10')} /><Line x1={0} y1={-14} x2={0} y2={-6} stroke={C('#DC2626')} strokeWidth={2} /><Line x1={-4} y1={-11} x2={4} y2={-11} stroke={C('#DC2626')} strokeWidth={2} /></>);
      if (variant === 1) return (<><Path d="M-14 -20 Q-8 -26 -3 -20 Q0 -24 3 -20 Q8 -26 14 -20 Q8 -18 6 -13 Q0 -17 -6 -13 Q-8 -18 -14 -20 Z" fill={C('#350d14')} /><Circle cx={-2} cy={-19} r={1} fill={C('#DC2626')} /><Circle cx={2} cy={-19} r={1} fill={C('#DC2626')} /></>);
      return (<><Path d="M0 0 L0 -18 M0 -12 L-8 -20 M0 -14 L7 -22 M-8 -20 L-11 -26 M7 -22 L11 -26" stroke={C('#3A1218')} strokeWidth={2.5} fill="none" /></>);
    case 'royal': // pillar / crown / banner
      if (variant === 0) return (<><Rect x={-5} y={-24} width={10} height={24} fill={C('#3A3330')} /><Rect x={-8} y={-28} width={16} height={5} fill={C('#D4AF37')} /><Rect x={-8} y={-2} width={16} height={3} fill={C('#D4AF37')} /></>);
      if (variant === 1) return (<><Path d="M-10 -8 L-7 -16 L-2 -10 L2 -18 L6 -10 L10 -16 L9 -4 L-9 -4 Z" fill={C('#FFD700')} /><Circle cx={-7} cy={-17} r={1.6} fill={C('#D4AF37')} /><Circle cx={2} cy={-19} r={1.6} fill={C('#D4AF37')} /><Circle cx={10} cy={-17} r={1.6} fill={C('#D4AF37')} /></>);
      return (<><Line x1={0} y1={0} x2={0} y2={-26} stroke={C('#3A3330')} strokeWidth={2.5} /><Polygon points="0,-26 16,-22 0,-16" fill={C('#D4AF37')} /></>);
    case 'solo': // crystal cluster / rune circle / shadow gate
      if (variant === 0) return (<><Polygon points="-10,0 -5,-18 1,0" fill={C('#6D46C4')} /><Polygon points="-1,0 5,-24 11,0" fill={C('#8B5CF6')} /><Circle cx={5} cy={-26} r={1.6} fill={C('#22D3EE')} /></>);
      if (variant === 1) return (<><Circle cx={0} cy={-11} r={10} fill="none" stroke={C('#8B5CF6')} strokeWidth={1.6} /><Circle cx={0} cy={-11} r={5.5} fill="none" stroke={C('#22D3EE')} strokeWidth={1.2} /><Circle cx={0} cy={-11} r={1.6} fill={C('#22D3EE')} /></>);
      return (<><Path d="M-9 0 L-9 -16 A9 9 0 0 1 9 -16 L9 0" fill="none" stroke={C('#8B5CF6')} strokeWidth={2.5} /><Line x1={0} y1={-6} x2={0} y2={-14} stroke={C('#22D3EE')} strokeWidth={1.5} /></>);
    case 'inferno': // flame / lava pool / rock spikes
      if (variant === 0) return (<><Path d="M0 0 Q-8 -8 -4 -16 Q-1 -10 2 -14 Q6 -20 4 -8 Q8 -6 5 -2 Z" fill={C('#DC2626')} /><Path d="M0 -2 Q-3 -7 0 -11 Q3 -7 2 -3 Z" fill={C('#FB923C')} /></>);
      if (variant === 1) return (<><Ellipse cx={0} cy={-3} rx={13} ry={5} fill={C('#DC2626')} /><Ellipse cx={2} cy={-3} rx={6} ry={2.4} fill={C('#FB923C')} /><Circle cx={-6} cy={-8} r={1.6} fill={C('#FB923C')} /></>);
      return (<><Polygon points="-12,0 -7,-16 -2,0" fill={C('#3F3F46')} /><Polygon points="0,0 6,-22 12,0" fill={C('#27272A')} /><Polygon points="4,-14 6,-22 8,-14" fill={C('#DC2626')} /></>);
    case 'galaxy': // ringed planet / star cluster / comet
      if (variant === 0) return (<><Circle cx={0} cy={-12} r={8} fill={C('#4338CA')} /><Ellipse cx={0} cy={-12} rx={14} ry={4} fill="none" stroke={C('#22D3EE')} strokeWidth={1.8} /></>);
      if (variant === 1) return (<><Circle cx={-8} cy={-16} r={2} fill={C('#E0E7FF')} /><Circle cx={2} cy={-8} r={1.5} fill={C('#E0E7FF')} /><Circle cx={8} cy={-20} r={2.4} fill={C('#22D3EE')} /><Circle cx={-2} cy={-24} r={1.3} fill={C('#E0E7FF')} /></>);
      return (<><Circle cx={6} cy={-18} r={3.5} fill={C('#22D3EE')} /><Path d="M6 -18 L-14 -6" stroke={C('#22D3EE')} strokeWidth={2} opacity={0.6} /><Path d="M6 -16 L-9 -7" stroke={C('#E0E7FF')} strokeWidth={1.2} opacity={0.5} /></>);
    case 'cyberpunk': // neon tower / robot firing / hover drone
      if (variant === 0) return (<><Rect x={-9} y={-32} width={18} height={32} fill={C('#23245A')} /><Line x1={-9} y1={-32} x2={9} y2={-32} stroke={C('#00FFFF')} strokeWidth={2} /><Line x1={0} y1={-32} x2={0} y2={-40} stroke={C('#FF00FF')} strokeWidth={1.6} /><Circle cx={0} cy={-41} r={1.6} fill={C('#FF00FF')} /><Rect x={-5} y={-26} width={3.6} height={4} fill={C('#00FFFF')} /><Rect x={2} y={-19} width={3.6} height={4} fill={C('#FF00FF')} /><Rect x={-5} y={-12} width={3.6} height={4} fill={C('#00FFFF')} /></>);
      if (variant === 1) return (<><Rect x={-7} y={-16} width={14} height={12} rx={2} fill={C('#3A3B7A')} /><Rect x={-5} y={-24} width={10} height={8} rx={2} fill={C('#23245A')} /><Rect x={-3} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={1} y={-21} width={2.6} height={2.6} fill={C('#00FFFF')} /><Rect x={-11} y={-13} width={4} height={2.6} fill={C('#3A3B7A')} /><Rect x={7} y={-14} width={5} height={2.6} fill={C('#3A3B7A')} /><Line x1={12} y1={-12.7} x2={24} y2={-12.7} stroke={C('#FF00FF')} strokeWidth={1.8} /><Circle cx={26} cy={-12.7} r={1.4} fill={C('#FF00FF')} /><Rect x={-6} y={-4} width={4} height={4} fill={C('#23245A')} /><Rect x={2} y={-4} width={4} height={4} fill={C('#23245A')} /></>);
      return (<><Ellipse cx={0} cy={-22} rx={9} ry={4} fill={C('#3A3B7A')} /><Rect x={-3} y={-21} width={6} height={3} fill={C('#00FFFF')} /><Line x1={0} y1={-18} x2={0} y2={-6} stroke={C('#00FFFF')} strokeWidth={1.2} opacity={0.7} /><Polygon points="-4,-6 4,-6 0,0" fill={C('#00FFFF')} opacity={0.4} /></>);
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
const ENTRANCE = 172;   // zone-entrance strip (landmark + name sign)

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

/** Zone height: steps live in the top portion, the entrance strip
 *  (landmark + sign) fills the bottom. */
const zoneHeight = (z: ZoneInfo) => (z.end - z.start + 1) * SPACING + ENTRANCE;
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
// Zone: one full-bleed world. The continuous road enters at the
// bottom (past the landmark + sign), winds up through the scenery,
// and exits at the top into the next world.
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
  if (hasAbove) points.push(pt(zone.end + 1, -(ENTRANCE + SPACING / 2)));

  // Lit portion: same line, stopped at the player's step.
  const litPoints: string[] = [];
  if (unlocked) {
    if (hasBelow) litPoints.push(pt(zone.start - 1, H + SPACING / 2));
    for (let lvl = zone.start; lvl <= Math.min(level, zone.end); lvl++) {
      litPoints.push(pt(lvl, yFor(lvl)));
    }
    if (conquered && hasAbove) litPoints.push(pt(zone.end + 1, -(ENTRANCE + SPACING / 2)));
  }

  // Roadside scenery: one themed prop per level on the free side of
  // the road, plus faint ambient specks. All inside the one SVG.
  const scenery = [];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const nx = xForLevel(lvl, width);
    const y = yFor(lvl);
    const off = 84 + jitter(lvl, 1) * 42;
    const px = nx < width / 2
      ? Math.min(nx + off, width - 30)
      : Math.max(nx - off, 30);
    const py = y + 12 + (jitter(lvl, 2) - 0.5) * 22;
    const s = 0.8 + jitter(lvl, 3) * 0.5;
    scenery.push(
      <G key={`p-${lvl}`} transform={`translate(${px} ${py}) scale(${s})`} opacity={0.95}>
        {propArt(zone.id, lvl % 3, C)}
      </G>,
    );
    // Ambient speck on the road side for texture.
    scenery.push(
      <Circle
        key={`a-${lvl}`}
        cx={jitter(lvl, 4) * width}
        cy={y + (jitter(lvl, 5) - 0.5) * SPACING}
        r={1.2 + jitter(lvl, 6) * 1.4}
        fill={C(wt.colors.muted)}
        opacity={0.55}
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
      bg = unlocked ? wt.colors.surface : FOG_NODE;
      border = unlocked ? wt.colors.muted : FOG_BORDER;
      num = unlocked ? wt.colors.secondary : GREY_TEXT;
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
    <View style={{ height: H, backgroundColor: unlocked ? wt.colors.background : FOG_BG }}>
      {/* Landmark art at the entrance (bottom), behind the road. */}
      <View pointerEvents="none" style={[styles.signArt, { top: H - ENTRANCE + 2, left: (width - 230) / 2 }]}>
        <IslandArt id={zone.id} unlocked={unlocked} />
      </View>

      {/* Scenery + road in ONE svg. */}
      <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={StyleSheet.absoluteFill}>
        {scenery}
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke={unlocked ? wt.colors.muted : FOG_PATH}
          strokeWidth={9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {litPoints.length > 1 ? (
          <Polyline
            points={litPoints.join(' ')}
            fill="none"
            stroke={wt.colors.accent}
            strokeWidth={9}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />
        ) : null}
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
                backgroundColor: unlocked ? wt.colors.surface : FOG_NODE,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.decoEmoji}>✨</Text>
          </Pressable>
        );
      })}

      {/* Name sign under the landmark. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => onPressSign(unlocked)}
        style={({ pressed }) => [styles.sign, { top: H - 42, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={styles.signLabel}>
          {!unlocked ? <Ionicons name="lock-closed" size={13} color={GREY_TEXT} /> : null}
          <Text
            style={[
              styles.signName,
              { color: unlocked ? wt.colors.accent : GREY_TEXT, fontFamily: wt.fonts.heavy },
            ]}
            numberOfLines={1}
          >
            {zone.name.toUpperCase()}
          </Text>
          {conquered ? (
            <Ionicons name="checkmark-circle" size={15} color={wt.colors.accent} />
          ) : null}
          <Text style={[styles.signRange, { color: unlocked ? wt.colors.secondary : GREY_TEXT }]}>
            {zone.end > zone.start ? ` LV ${zone.start}–${zone.end}` : ` LV ${zone.start}`}
          </Text>
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

  signArt:       { position: 'absolute', width: 230 },
  sign:          { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  signLabel:     { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '92%' },
  signName:      { fontSize: 20, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  signRange:     { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
});
