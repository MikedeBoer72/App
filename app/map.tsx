// YourLevel Roadmap — the world map.
//
// Candy-Crush-style level road: EVERY level is a numbered square step
// on a serpentine path that winds upward through full-bleed theme
// ZONES. You are inside each world as you walk it — the zone is
// painted in its theme's palette with its island landmark art at the
// entrance — and you unlock the next world by walking to the end of
// the current one. Short ocean bridges of stepping-stones connect
// the zones.
//
// Zone states:
//   unlocked  — full theme color, passed steps filled in accent,
//               upcoming steps hollow
//   locked    — fog-grey: structure, numbers and name all visible,
//               zero color, lock on the sign
//
// The player is a bigger SQUARE on their current level step with a
// YOU ARE HERE chip. Decorations are ✨ squares parked beside the
// step that unlocks them ("???" until reached). Auto-scrolls to the
// player on mount.

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
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { DECORATIONS, type Decoration } from '@/constants/decorations';
import { getTheme, THEMES, type ThemeId } from '@/constants/themes';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Ocean + fog palette (the map has its own fixed identity)
// ---------------------------------------------------------------------------

const OCEAN       = '#06131D';
const OCEAN_WAVE  = '#16293A';
const FOG_BG      = '#0C141C';   // locked-zone ground
const FOG_PATH    = '#1A242E';
const FOG_NODE    = '#151C24';
const FOG_BORDER  = '#232E39';
const GREY_TEXT   = '#5E6B77';
const TILE_OFF    = '#1D3040';

/** Luminance-matched grey for locked-island art: structure stays,
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
// Road geometry
// ---------------------------------------------------------------------------

const SPACING      = 56;   // vertical px per level step
const NODE         = 34;   // level square size
const NODE_CURRENT = 46;   // player's square size
const PAD_V        = 20;   // breathing room above/below a zone's steps

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

  // The zone the player stands in + their step's y within it, so the
  // wrapper's onLayout can convert to an absolute scroll offset.
  const hostZone = zones.find((z) => level >= z.start && level <= z.end) ?? null;
  const nodeYWithin = (zone: ZoneInfo) => {
    const stepsH = (zone.end - zone.start + 1) * SPACING + PAD_V * 2;
    return stepsH - PAD_V - SPACING / 2 - (level - zone.start) * SPACING;
  };

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
        {descending.map((zone, di) => {
          const zoneBelow = descending[di + 1] ?? null;
          return (
            <View
              key={zone.id}
              onLayout={
                hostZone?.id === zone.id
                  ? (e) => setCurrentY(e.nativeEvent.layout.y + nodeYWithin(zone))
                  : undefined
              }
            >
              <Zone
                zone={zone}
                level={level}
                width={width}
                accent={theme.colors.accent}
                onPressSign={(unlocked) => {
                  if (unlocked) router.push('/settings/fonts');
                  else Alert.alert(zone.name, `Reach Level ${zone.start} to enter this world.`);
                }}
                onPressDeco={(d, unlocked) => {
                  if (unlocked) router.push('/settings/decorations');
                  else Alert.alert('Mystery unlock', `Reach Level ${d.unlockLevel} to reveal it.`);
                }}
              />
              {zoneBelow ? (
                <Bridge
                  atLevel={zone.start}
                  width={width}
                  crossed={level >= zone.start}
                  litColor={getTheme(zone.id).colors.accent}
                />
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Zone: one full-bleed world. Steps wind upward over the theme's
// ground color; the island landmark + name sign sit at the entrance
// (bottom). The road and passed steps light up in the world's accent.
// ---------------------------------------------------------------------------

function Zone({
  zone,
  level,
  width,
  accent,
  onPressSign,
  onPressDeco,
}: {
  zone:        ZoneInfo;
  level:       number;
  width:       number;
  accent:      string;
  onPressSign: (unlocked: boolean) => void;
  onPressDeco: (d: Decoration, unlocked: boolean) => void;
}) {
  const wt = getTheme(zone.id);
  const unlocked = level >= zone.start;
  const conquered = level > zone.end;

  const count = zone.end - zone.start + 1;
  const stepsH = count * SPACING + PAD_V * 2;
  const yFor = (lvl: number) =>
    stepsH - PAD_V - SPACING / 2 - (lvl - zone.start) * SPACING;

  // Road polyline through every step, extended past both edges so it
  // meets the bridges/sign visually.
  const points: string[] = [`${xForLevel(zone.start - 1, width)},${stepsH + 30}`];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    points.push(`${xForLevel(lvl, width)},${yFor(lvl)}`);
  }
  points.push(`${xForLevel(zone.end + 1, width)},${-30}`);

  // Lit portion: entrance -> current step (full once conquered).
  const litPoints: string[] = [];
  if (unlocked) {
    litPoints.push(points[0]!);
    for (let lvl = zone.start; lvl <= Math.min(level, zone.end); lvl++) {
      litPoints.push(`${xForLevel(lvl, width)},${yFor(lvl)}`);
    }
    if (conquered) litPoints.push(points[points.length - 1]!);
  }

  const decos = DECORATIONS.filter(
    (d) => d.id !== 'none' && d.unlockLevel >= zone.start && d.unlockLevel <= zone.end,
  );

  const steps = [];
  for (let lvl = zone.start; lvl <= zone.end; lvl++) {
    const x = xForLevel(lvl, width);
    const y = yFor(lvl);
    const passed = lvl < level;
    const isCurrent = lvl === level;
    const size = isCurrent ? NODE_CURRENT : NODE;

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

  return (
    <View style={{ backgroundColor: unlocked ? wt.colors.background : FOG_BG }}>
      {/* Steps area */}
      <View style={{ height: stepsH }}>
        <Svg
          width={width}
          height={stepsH}
          viewBox={`0 0 ${width} ${stepsH}`}
          style={StyleSheet.absoluteFill}
        >
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
          const x = nx < width / 2 ? nx + 58 : nx - 58 - 30;
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
      </View>

      {/* Entrance sign: landmark art + world name */}
      <Pressable
        accessibilityRole="button"
        onPress={() => onPressSign(unlocked)}
        style={({ pressed }) => [styles.sign, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={styles.signArt}>
          <IslandArt id={zone.id} unlocked={unlocked} />
        </View>
        <View style={styles.signLabel}>
          {!unlocked ? <Ionicons name="lock-closed" size={13} color={GREY_TEXT} /> : null}
          <Text
            style={[
              styles.signName,
              {
                color: unlocked ? wt.colors.accent : GREY_TEXT,
                fontFamily: wt.fonts.heavy,
              },
            ]}
            numberOfLines={1}
          >
            {zone.name.toUpperCase()}
          </Text>
          {conquered ? (
            <Ionicons name="checkmark-circle" size={15} color={wt.colors.accent} />
          ) : null}
        </View>
        <Text style={[styles.signRange, { color: unlocked ? wt.colors.secondary : GREY_TEXT }]}>
          {zone.end > zone.start ? `LV ${zone.start} – ${zone.end}` : `LV ${zone.start}`}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bridge: a short strip of open ocean with square stepping-stones
// linking two worlds. Lights up once the upper world is reached.
// ---------------------------------------------------------------------------

function Bridge({
  atLevel,
  width,
  crossed,
  litColor,
}: {
  atLevel:  number;
  width:    number;
  crossed:  boolean;
  litColor: string;
}) {
  const H = 66;
  const tiles = [0.25, 0.5, 0.75];
  return (
    <View style={{ height: H, backgroundColor: OCEAN }}>
      {tiles.map((t, i) => (
        <View
          key={i}
          style={[
            styles.bridgeTile,
            {
              left: xForLevel(atLevel - 1 + t, width) - 7,
              top: H * (1 - t) - 7,
              backgroundColor: crossed ? litColor : TILE_OFF,
            },
          ]}
        />
      ))}
      <Text style={[styles.wave, { left: width * 0.16 }]}>≈</Text>
      <Text style={[styles.wave, { left: width * 0.74, top: 14 }]}>≈</Text>
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

  sign:          { alignItems: 'center', paddingBottom: 14, paddingTop: 2 },
  signArt:       { width: 230 },
  signLabel:     { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '92%' },
  signName:      { fontSize: 20, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  signRange:     { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 3 },

  bridgeTile:    { position: 'absolute', width: 14, height: 14, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  wave:          { position: 'absolute', top: 34, fontSize: 16, color: OCEAN_WAVE, fontWeight: '700' },
});
