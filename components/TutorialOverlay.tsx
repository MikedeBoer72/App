// Coach-mark overlay for the first-run walkthrough.
//
// Renders a dark scrim with a rectangular "hole" cut over the target
// element. The hole is genuinely interactive: the scrim is built from
// four opaque pieces around it, so taps inside the hole fall through
// to the real UI underneath (that's how the forced-tap steps work).
// A tooltip card sits above or below the hole, whichever half of the
// screen has room. When `hole` is null the card centers and the scrim
// covers everything (intro-style step).
//
// Coordinates are in the overlay's own space — the parent converts
// from window coords (measureInWindow) before passing them in.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import type { useAppStore } from '@/store/useAppStore';

const SCRIM = 'rgba(0,0,0,0.78)';
const HOLE_PAD = 8;
/** Fallback card height used before the card has measured itself. */
const CARD_H_GUESS = 190;

export interface HoleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TutorialOverlayProps {
  hole:       HoleRect | null;
  title:      string;
  body:       string;
  /** Label for the advance button. Omit for forced-tap steps. */
  nextLabel?: string;
  stepIndex:  number;
  stepCount:  number;
  theme:      ReturnType<typeof useAppStore.getState>['theme'];
  onNext?:    () => void;
  onSkip:     () => void;
}

export function TutorialOverlay({
  hole,
  title,
  body,
  nextLabel,
  stepIndex,
  stepCount,
  theme,
  onNext,
  onSkip,
}: TutorialOverlayProps) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fade, stepIndex]);

  // Live dimensions: iPad compatibility mode can resize the window at
  // runtime (the 1x/2x scale toggle), which would permanently desync a
  // value captured once at module load.
  const { height: winH } = useWindowDimensions();
  const [cardH, setCardH] = useState(CARD_H_GUESS);
  const onCardLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0 && Math.abs(next - cardH) > 1) setCardH(next);
  };

  const h = hole
    ? {
        x: hole.x - HOLE_PAD,
        y: hole.y - HOLE_PAD,
        w: hole.w + HOLE_PAD * 2,
        h: hole.h + HOLE_PAD * 2,
      }
    : null;

  // Card above the hole when the hole sits in the lower half.
  const cardBelow = !h || h.y + h.h / 2 < winH / 2;

  // The card carries the ONLY Next / Skip buttons, so it must never be
  // pushed off-screen — which is exactly what happened for a target
  // below the fold, leaving the walkthrough unescapable. Always clamp
  // into the viewport, whichever side we prefer.
  const MARGIN = 16;
  const maxTop = Math.max(MARGIN, winH - cardH - MARGIN);
  const cardTop = h
    ? Math.min(
        Math.max(MARGIN, cardBelow ? h.y + h.h + MARGIN : h.y - cardH - MARGIN),
        maxTop,
      )
    : Math.max(MARGIN, Math.min(winH * 0.32, maxTop));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 100 }]} pointerEvents="box-none">
      {h ? (
        <>
          {/* Four scrim pieces; the gap between them is the hole. */}
          <View style={[styles.scrim, { left: 0, right: 0, top: 0, height: Math.max(0, h.y) }]} />
          <View style={[styles.scrim, { left: 0, right: 0, top: h.y + h.h, bottom: 0 }]} />
          <View style={[styles.scrim, { left: 0, width: Math.max(0, h.x), top: h.y, height: h.h }]} />
          <View style={[styles.scrim, { left: h.x + h.w, right: 0, top: h.y, height: h.h }]} />
          {/* Accent ring around the hole (visual only). */}
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: h.x - 2,
                top: h.y - 2,
                width: h.w + 4,
                height: h.h + 4,
                borderColor: theme.colors.accent,
              },
            ]}
          />
        </>
      ) : (
        <View style={[styles.scrim, StyleSheet.absoluteFill]} />
      )}

      {/* Tooltip card */}
      <View pointerEvents="box-none" style={[styles.cardWrap, { top: cardTop }]}>
        <View
          onLayout={onCardLayout}
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent }]}
        >
          <Text style={[styles.kicker, { color: theme.colors.accent, fontFamily: theme.fonts.bold }]}>
            {stepIndex + 1} / {stepCount}
          </Text>
          <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.bold }]}>
            {title}
          </Text>
          <Text style={[styles.body, { color: theme.colors.secondary }]}>{body}</Text>

          <View style={styles.actions}>
            <Pressable onPress={onSkip} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={[styles.skip, { color: theme.colors.muted }]}>Skip tutorial</Text>
            </Pressable>
            {/* A forced-tap step whose target has vanished (the user
                deleted the very task we spotlighted, or it scrolled out
                of the tree) would otherwise be a dead end: no highlight
                to tap and no button. Fall back to an explicit Continue
                so the walkthrough can always be finished. */}
            {(nextLabel || !h) && onNext ? (
              <Pressable
                onPress={onNext}
                style={({ pressed }) => [
                  styles.nextBtn,
                  { backgroundColor: theme.colors.accent, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.nextText, { color: theme.colors.background }]}>
                  {nextLabel ?? 'Continue'}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.forced, { color: theme.colors.accent }]}>Tap the highlighted spot</Text>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim:    { position: 'absolute', backgroundColor: SCRIM },
  ring:     { position: 'absolute', borderWidth: 2.5, borderRadius: 14 },
  cardWrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  card:     { borderRadius: 18, borderWidth: 1.5, padding: 18, gap: 6, width: '100%', maxWidth: 400 },
  kicker:   { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title:    { fontSize: 19, fontWeight: '800' },
  body:     { fontSize: 14.5, lineHeight: 21 },
  actions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  skip:     { fontSize: 13, fontWeight: '600' },
  nextBtn:  { paddingHorizontal: 20, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 14, fontWeight: '700' },
  forced:   { fontSize: 12.5, fontWeight: '700' },
});
