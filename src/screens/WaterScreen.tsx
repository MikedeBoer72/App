import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { BarChart } from '../components/BarChart';
import { useStore } from '../store';
import { theme } from '../theme';
import { lastNDays, shortLabel, todayISO } from '../dates';
import { usePostHog } from 'posthog-react-native';

export function WaterScreen() {
  const { state, dispatch } = useStore();
  const posthog = usePostHog();
  const today = todayISO();
  const current = state.water.find((w) => w.date === today)?.glasses ?? 0;
  const goal = state.goals.waterGlasses;

  const set = (n: number) => {
    const next = Math.max(0, n);
    const wasGoalMet = current >= goal;
    const nowGoalMet = next >= goal;
    dispatch({ type: 'SET_WATER', date: today, glasses: next });
    if (!wasGoalMet && nowGoalMet) {
      posthog.capture('water_goal_reached', {
        glasses: next,
        goal_glasses: goal,
        water_streak: state.streaks.water.count,
      });
    }
  };

  const week = lastNDays(7);
  const values = week.map((d) => state.water.find((w) => w.date === d)?.glasses ?? 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionHeader title="Hydration" subtitle={`${current} / ${goal} glasses`} />
      <Card>
        <View style={styles.glassesRow}>
          {Array.from({ length: Math.max(goal, current) }).map((_, i) => {
            const filled = i < current;
            return (
              <Pressable
                key={i}
                onPress={() => set(filled ? i : i + 1)}
                style={[styles.glass, filled && styles.glassFilled]}
              >
                <Text style={[styles.glassText, filled && styles.glassTextFilled]}>{i + 1}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.controlRow}>
          <Pressable style={styles.ctlBtn} onPress={() => set(current - 1)}>
            <Text style={styles.ctlBtnText}>−</Text>
          </Pressable>
          <Text style={styles.bigCount}>{current}</Text>
          <Pressable style={styles.ctlBtn} onPress={() => set(current + 1)}>
            <Text style={styles.ctlBtnText}>+</Text>
          </Pressable>
        </View>
        {current >= goal && (
          <Text style={styles.metBanner}>Goal reached — you're hydrated, hero.</Text>
        )}
      </Card>

      <SectionHeader title="Last 7 days" />
      <Card>
        <BarChart values={values} labels={week.map(shortLabel)} goal={goal} color={theme.colors.water} unit="glasses" />
      </Card>

      <View style={{ height: theme.spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  glassesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center' },
  glass: {
    width: 48,
    height: 60,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  glassFilled: { backgroundColor: theme.colors.water, borderColor: theme.colors.water },
  glassText: { color: theme.colors.textMuted, fontSize: theme.font.tiny },
  glassTextFilled: { color: theme.colors.bg, fontWeight: '700' },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl, marginTop: theme.spacing.lg },
  ctlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctlBtnText: { color: theme.colors.text, fontSize: 24, fontWeight: '700' },
  bigCount: { color: theme.colors.water, fontSize: 48, fontWeight: '800', minWidth: 60, textAlign: 'center' },
  metBanner: { color: theme.colors.success, textAlign: 'center', marginTop: theme.spacing.md, fontWeight: '600' },
});
