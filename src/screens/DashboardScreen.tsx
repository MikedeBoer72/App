import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { theme } from '../theme';
import { Card } from '../components/Card';
import { XPBar } from '../components/XPBar';
import { StatTile } from '../components/StatTile';
import { SectionHeader } from '../components/SectionHeader';
import { greeting, todayISO } from '../dates';
import { getDailyQuests } from '../gamification';
import { usePostHog } from 'posthog-react-native';

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { state, dispatch } = useStore();
  const posthog = usePostHog();
  const today = todayISO();

  const sleepToday = state.sleep.find((s) => s.date === today);
  const caloriesToday = state.food.filter((f) => f.date === today).reduce((a, b) => a + b.calories, 0);
  const proteinToday = state.food.filter((f) => f.date === today).reduce((a, b) => a + b.protein, 0);
  const waterToday = state.water.find((w) => w.date === today)?.glasses ?? 0;
  const workoutsToday = state.workouts.filter((w) => w.date === today).length;

  const quests = getDailyQuests(state);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        {greeting()}, <Text style={styles.name}>{state.profile.name}</Text>
      </Text>
      <Text style={styles.sub}>Today's quest log — let's earn some XP.</Text>

      <Card style={{ marginTop: theme.spacing.lg }}>
        <XPBar totalXp={state.totalXp} />
      </Card>

      <SectionHeader title="Today" subtitle="Your live stats" />
      <View style={styles.row}>
        <StatTile
          label="Sleep"
          value={sleepToday ? sleepToday.hours.toFixed(1) : '–'}
          unit="hrs"
          accent={theme.colors.sleep}
          hint={`Goal ${state.goals.sleepHours}h`}
        />
        <View style={{ width: theme.spacing.md }} />
        <StatTile
          label="Calories"
          value={caloriesToday > 0 ? String(caloriesToday) : '–'}
          unit="kcal"
          accent={theme.colors.nutrition}
          hint={`Goal ${state.goals.calories}`}
        />
      </View>
      <View style={[styles.row, { marginTop: theme.spacing.md }]}>
        <StatTile
          label="Water"
          value={String(waterToday)}
          unit={`/${state.goals.waterGlasses}`}
          accent={theme.colors.water}
          hint="glasses"
        />
        <View style={{ width: theme.spacing.md }} />
        <StatTile
          label="Workouts"
          value={String(workoutsToday)}
          accent={theme.colors.workout}
          hint={workoutsToday > 0 ? 'Crushed it' : 'Awaiting hero'}
        />
      </View>

      <SectionHeader title="Quick log" />
      <View style={styles.quickRow}>
        <QuickAction label="Sleep" color={theme.colors.sleep} onPress={() => navigation.navigate('Sleep')} />
        <QuickAction label="Food" color={theme.colors.nutrition} onPress={() => navigation.navigate('Nutrition')} />
        <QuickAction label="Workout" color={theme.colors.workout} onPress={() => navigation.navigate('Workout')} />
        <QuickAction label="Water" color={theme.colors.water} onPress={() => navigation.navigate('Water')} />
      </View>

      <SectionHeader title="Daily quests" subtitle="Claim XP when complete" />
      <Card>
        {quests.map((q, idx) => {
          const done = q.check(state);
          const claimed = state.quests.completedIds.includes(q.id);
          return (
            <View key={q.id} style={[styles.questRow, idx > 0 && styles.questBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.questTitle}>{q.title}</Text>
                <Text style={styles.questXp}>+{q.xp} XP</Text>
              </View>
              {claimed ? (
                <View style={styles.claimedPill}>
                  <Text style={styles.claimedText}>Claimed</Text>
                </View>
              ) : done ? (
                <Pressable
                  style={styles.claimBtn}
                  onPress={() => {
                    dispatch({ type: 'CLAIM_QUEST', id: q.id });
                    posthog.capture('quest_claimed', {
                      quest_id: q.id,
                      quest_title: q.title,
                      xp_earned: q.xp,
                    });
                  }}
                >
                  <Text style={styles.claimBtnText}>Claim</Text>
                </Pressable>
              ) : (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              )}
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Streaks" />
      <View style={styles.row}>
        <StatTile label="Sleep" value={String(state.streaks.sleep.count)} unit="d" accent={theme.colors.sleep} />
        <View style={{ width: theme.spacing.md }} />
        <StatTile label="Workout" value={String(state.streaks.workout.count)} unit="d" accent={theme.colors.workout} />
      </View>
      <View style={[styles.row, { marginTop: theme.spacing.md }]}>
        <StatTile label="Water" value={String(state.streaks.water.count)} unit="d" accent={theme.colors.water} />
        <View style={{ width: theme.spacing.md }} />
        <StatTile label="Nutrition" value={String(state.streaks.nutrition.count)} unit="d" accent={theme.colors.nutrition} />
      </View>

      <View style={{ height: theme.spacing.xxl }} />
    </ScrollView>
  );
}

function QuickAction({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.8 }]}>
      <View style={[styles.quickDot, { backgroundColor: color }]} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
  greeting: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '700' },
  name: { color: theme.colors.accent },
  sub: { color: theme.colors.textDim, marginTop: 4 },
  row: { flexDirection: 'row' },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  quickBtn: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  quickDot: { width: 22, height: 22, borderRadius: 11, marginBottom: 6 },
  quickLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600' },
  questRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md },
  questBorder: { borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  questTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  questXp: { color: theme.colors.xp, fontSize: theme.font.tiny, marginTop: 2, fontWeight: '700' },
  claimBtn: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  claimBtnText: { color: '#0b0b1a', fontWeight: '700' },
  claimedPill: {
    backgroundColor: theme.colors.bgElevated,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  claimedText: { color: theme.colors.success, fontWeight: '600', fontSize: theme.font.small },
  pendingPill: {
    backgroundColor: theme.colors.bgElevated,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  pendingText: { color: theme.colors.textMuted, fontSize: theme.font.small },
});
