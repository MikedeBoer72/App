// The Journey — YourLevel's island world map.
//
// One tall ocean. Every theme is an ISLAND with its own hand-drawn
// SVG biome (Calm = golden beach, Slate = blue moon over water,
// Inferno = volcano, ...). Islands alternate left/right up the map
// and are connected by square stepping-stone tiles — the road lights
// up tile by tile as the player levels through the current island's
// range. Decorations appear as ✨ square nodes on the road, "???"
// until reached.
//
// Every island is visible from level 1: locked ones keep their full
// structure and name but render in fog-grey (toGrey maps each biome
// color to a luminance-matched grey). Unlocking an island colors it
// in. The player is a SQUARE marker (games-style) on their current
// island, with progress toward the next island underneath.
//
// Auto-scrolls to the player's island on mount.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

import { getTheme, THEMES, type ThemeId } from '@/constants/themes';
import { getJourneyTimeline } from '@/lib/unlocks';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Ocean + fog palette (the map has its own fixed identity)
// ---------------------------------------------------------------------------

const OCEAN      = '#06131D';
const OCEAN_WAVE = '#16293A';
const TILE_OFF   = '#1D3040';
const GREY_TEXT  = '#5E6B77';

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
// Island biome art. One SVG per theme, 240x130 viewBox. `C()` maps
// every color to grey while the island is locked.
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
// Map data shaping
// ---------------------------------------------------------------------------

interface IslandInfo {
  id:          ThemeId;
  name:        string;
  unlockLevel: number;
  /** First level of the NEXT island (null on the summit). */
  nextLevel:   number | null;
  side:        'left' | 'right';
}

interface RouteDeco {
  id:    string;
  name:  string;
  level: number;
}

/** Islands ascending + the decorations that sit on the road ABOVE
 *  each island (between it and the next one). */
function buildWorld() {
  const timeline = getJourneyTimeline();
  const worlds = THEMES.map((t, i) => ({
    id:          t.id,
    name:        t.name,
    unlockLevel: t.unlockLevel,
    nextLevel:   THEMES[i + 1]?.unlockLevel ?? null,
    side:        (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
  }));
  const decosAbove = new Map<ThemeId, RouteDeco[]>();
  for (const item of timeline) {
    if (item.kind !== 'decoration') continue;
    // The road segment a decoration belongs to: between the island
    // whose range contains its level and the island above.
    const host = [...worlds].reverse().find((w) => w.unlockLevel < item.level);
    if (!host) continue;
    const list = decosAbove.get(host.id) ?? [];
    list.push({ id: item.id, name: item.name, level: item.level });
    decosAbove.set(host.id, list);
  }
  for (const list of decosAbove.values()) list.sort((a, b) => a.level - b.level);
  return { worlds: worlds as IslandInfo[], decosAbove };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const TILES_PER_ROAD = 5;

export default function MapScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const scrollRef = useRef<ScrollView>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);

  const level = profile?.level ?? 1;

  const { worlds, decosAbove } = useMemo(buildWorld, []);
  const currentIsland = useMemo(
    () => [...worlds].reverse().find((w) => w.unlockLevel <= level) ?? worlds[0]!,
    [worlds, level],
  );

  useEffect(() => {
    if (currentY == null) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, currentY - 160), animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [currentY]);

  // Progress through the current island's level range (0..1).
  const islandFrac = useMemo(() => {
    if (currentIsland.nextLevel == null) return 1;
    const span = Math.max(1, currentIsland.nextLevel - currentIsland.unlockLevel);
    return Math.min(1, (level - currentIsland.unlockLevel) / span);
  }, [currentIsland, level]);

  function openIsland(w: IslandInfo, unlocked: boolean) {
    if (unlocked) router.push('/settings/fonts');
    else Alert.alert(w.name, `Reach Level ${w.unlockLevel} to unlock this island.`);
  }

  // Render top (summit) -> bottom (level 1): island, then the road
  // segment BELOW it (connecting to the previous island).
  const descending = [...worlds].reverse();

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
        <Text style={[styles.title, { fontFamily: theme.fonts.bold }]}>The Journey</Text>
        <View style={styles.levelChip}>
          <Text style={[styles.levelChipText, { color: theme.colors.accent }]}>LV {level}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} ref={scrollRef} contentContainerStyle={styles.scroll}>
        <Text style={styles.beyond}>··· uncharted waters ···</Text>

        {descending.map((w, di) => {
          const unlocked = w.unlockLevel <= level;
          const isCurrent = w.id === currentIsland.id;
          const worldTheme = getTheme(w.id);
          const below = descending[di + 1] ?? null; // island geographically below

          // Road segment below this island = between `below` and `w`.
          // Lit tiles show progress while `below` is the current island;
          // fully lit once `w` itself is unlocked.
          const roadDecos = below ? (decosAbove.get(below.id) ?? []) : [];
          let lit = 0;
          if (below) {
            if (unlocked) lit = TILES_PER_ROAD;
            else if (below.id === currentIsland.id) lit = Math.floor(islandFrac * TILES_PER_ROAD);
          }

          const rangeLabel =
            w.nextLevel != null ? `LV ${w.unlockLevel}–${w.nextLevel - 1}` : `LV ${w.unlockLevel}+`;

          return (
            <View
              key={w.id}
              onLayout={isCurrent ? (e) => setCurrentY(e.nativeEvent.layout.y) : undefined}
            >
              {/* ---- Island ---- */}
              <Pressable
                accessibilityRole="button"
                onPress={() => openIsland(w, unlocked)}
                style={({ pressed }) => [
                  styles.island,
                  w.side === 'left' ? styles.islandLeft : styles.islandRight,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IslandArt id={w.id} unlocked={unlocked} />
                <View style={styles.islandLabel}>
                  {!unlocked ? (
                    <Ionicons name="lock-closed" size={13} color={GREY_TEXT} />
                  ) : null}
                  <Text
                    style={[
                      styles.islandName,
                      {
                        color: unlocked ? worldTheme.colors.accent : GREY_TEXT,
                        fontFamily: worldTheme.fonts.heavy,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {w.name.toUpperCase()}
                  </Text>
                  {unlocked && !isCurrent ? (
                    <Ionicons name="checkmark-circle" size={15} color={worldTheme.colors.accent} />
                  ) : null}
                </View>
                <Text style={[styles.islandRange, { color: unlocked ? '#9FB2C2' : GREY_TEXT }]}>
                  {rangeLabel}
                </Text>

                {isCurrent ? (
                  <View style={styles.hereWrap}>
                    <View style={styles.hereRow}>
                      <View
                        style={[
                          styles.playerSquare,
                          { backgroundColor: theme.colors.accent },
                        ]}
                      />
                      <View style={[styles.hereChip, { backgroundColor: theme.colors.accent }]}>
                        <Text style={[styles.hereText, { color: OCEAN }]}>
                          YOU ARE HERE · LV {level}
                        </Text>
                      </View>
                    </View>
                    {w.nextLevel != null ? (
                      <View style={styles.hereTrack}>
                        <View
                          style={[
                            styles.hereFill,
                            {
                              backgroundColor: theme.colors.accent,
                              width: `${Math.max(4, Math.round(islandFrac * 100))}%`,
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>

              {/* ---- Road below, down to the previous island ---- */}
              {below ? (
                <Road
                  from={below.side}
                  to={w.side}
                  lit={lit}
                  litColor={worldTheme.colors.accent}
                  decos={roadDecos}
                  level={level}
                  onDecoPress={(d, isUnlocked) => {
                    if (isUnlocked) router.push('/settings/decorations');
                    else Alert.alert('Mystery unlock', `Reach Level ${d.level} to reveal it.`);
                  }}
                />
              ) : null}
            </View>
          );
        })}

        <Text style={styles.origin}>LEVEL 1 · where it all began</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Road: a diagonal run of square stepping-stones between two islands,
// with ✨ decoration squares mixed in. Rendered top -> bottom, but lit
// bottom-up (progress climbs FROM the lower island).
// ---------------------------------------------------------------------------

function Road({
  from,
  to,
  lit,
  litColor,
  decos,
  level,
  onDecoPress,
}: {
  from:        'left' | 'right';
  to:          'left' | 'right';
  lit:         number;
  litColor:    string;
  decos:       RouteDeco[];
  level:       number;
  onDecoPress: (d: RouteDeco, unlocked: boolean) => void;
}) {
  const xFor = (side: 'left' | 'right') => (side === 'left' ? -52 : 52);
  const x0 = xFor(from);
  const x1 = xFor(to);

  // Slot list bottom -> top: tiles with decorations evenly spliced in.
  type Slot = { kind: 'tile' } | { kind: 'deco'; deco: RouteDeco };
  const interleaved: Slot[] = [];
  let decoIdx = 0;
  for (let i = 0; i < TILES_PER_ROAD; i++) {
    interleaved.push({ kind: 'tile' });
    const want = Math.round(((i + 1) / TILES_PER_ROAD) * decos.length);
    while (decoIdx < want && decoIdx < decos.length) {
      interleaved.push({ kind: 'deco', deco: decos[decoIdx]! });
      decoIdx++;
    }
  }

  // Render top -> bottom, so reverse; index from the bottom drives x
  // interpolation and lit state.
  const total = interleaved.length;
  const rendered = [...interleaved].reverse();
  let tileFromBottom = interleaved.filter((s) => s.kind === 'tile').length;

  return (
    <View style={styles.road}>
      {rendered.map((slot, i) => {
        const fromBottom = total - 1 - i;
        const t = (fromBottom + 1) / (total + 1);
        const x = x0 + (x1 - x0) * t;
        if (slot.kind === 'deco') {
          const unlocked = slot.deco.level <= level;
          return (
            <Pressable
              key={`d-${slot.deco.id}`}
              accessibilityRole="button"
              onPress={() => onDecoPress(slot.deco, unlocked)}
              style={({ pressed }) => [
                styles.decoSquare,
                {
                  transform: [{ translateX: x }],
                  borderColor: unlocked ? litColor : TILE_OFF,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.decoEmoji}>✨</Text>
            </Pressable>
          );
        }
        tileFromBottom--;
        const isLit = tileFromBottom < lit;
        return (
          <View
            key={`t-${i}`}
            style={[
              styles.tile,
              {
                transform: [{ translateX: x }, { rotate: '45deg' }],
                backgroundColor: isLit ? litColor : TILE_OFF,
              },
            ]}
          />
        );
      })}
      <Text style={[styles.wave, { transform: [{ translateX: -x1 }] }]}>≈</Text>
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
  scroll:        { paddingVertical: 16, paddingHorizontal: 8, paddingBottom: 48 },

  beyond:        { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 10, letterSpacing: 2, color: '#33475A' },
  origin:        { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 18, letterSpacing: 1.5, color: '#33475A' },

  island:        { width: '74%', alignItems: 'center', paddingVertical: 4 },
  islandLeft:    { alignSelf: 'flex-start' },
  islandRight:   { alignSelf: 'flex-end' },
  islandLabel:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, maxWidth: '96%' },
  islandName:    { fontSize: 19, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  islandRange:   { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 3 },

  hereWrap:      { marginTop: 8, gap: 7, alignItems: 'center', width: '86%' },
  hereRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerSquare:  { width: 15, height: 15, borderRadius: 3, borderWidth: 2, borderColor: '#FFFFFF' },
  hereChip:      { paddingHorizontal: 10, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  hereText:      { fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  hereTrack:     { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#1D3040', alignSelf: 'stretch' },
  hereFill:      { height: 6, borderRadius: 3 },

  road:          { alignItems: 'center', paddingVertical: 6, gap: 11 },
  tile:          { width: 13, height: 13, borderRadius: 3 },
  decoSquare:    {
    width: 30, height: 30, borderRadius: 7, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1D2B',
  },
  decoEmoji:     { fontSize: 13 },
  wave:          { position: 'absolute', bottom: 8, fontSize: 16, color: OCEAN_WAVE, fontWeight: '700' },
});
