import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { NumberInput } from '../components/NumberInput';
import { Button } from '../components/Button';
import { BarChart } from '../components/BarChart';
import { useStore } from '../store';
import { theme } from '../theme';
import { lastNDays, shortLabel, todayISO } from '../dates';
import { XP_REWARDS } from '../gamification';
import { usePostHog } from 'posthog-react-native';

export function SleepScreen() {
  const { state, dispatch } = useStore();
  const posthog = usePostHog();
  const today = todayISO();
  const todays = state.sleep.find((s) => s.date === today);

  const [hours, setHours] = useState(todays ? String(todays.hours) : '');
  const [quality, setQuality] = useState(todays ? todays.quality : 7);

  const week = lastNDays(7);
  const values = week.map((d) => state.sleep.find((s) => s.date === d)?.hours ?? 0);
  const labels = week.map(shortLabel);

  const onSave = () => {
    const h = parseFloat(hours);
    if (!isFinite(h) || h <= 0) return;
    const wasMet = (todays?.hours ?? 0) >= state.goals.sleepHours;
    const nowMet = h >= state.goals.sleepHours;
    dispatch({ type: 'ADD_SLEEP', entry: { date: today, hours: h, quality } });
    if (!wasMet && nowMet) dispatch({ type: 'AWARD_XP', xp: XP_REWARDS.sleepGoal });
    posthog.capture('sleep_logged', {
      hours: h,
      quality,
      goal_hours: state.goals.sleepHours,
      goal_met: nowMet,
    });
    if (!wasMet && nowMet) {
      posthog.capture('sleep_goal_met', {
        hours: h,
        goal_hours: state.goals.sleepHours,
        sleep_streak: state.streaks.sleep.count,
      });
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionHeader title="Last 7 nights" subtitle="Sleep duration" />
      <Card>
        <BarChart values={values} labels={labels} goal={state.goals.sleepHours} color={theme.colors.sleep} unit="h" />
      </Card>

      <SectionHeader title="Log tonight's sleep" subtitle={`Goal: ${state.goals.sleepHours}h — +${XP_REWARDS.sleepGoal} XP`} />
      <Card>
        <NumberInput label="Hours slept" value={hours} onChangeText={setHours} placeholder="7.5" unit="h" />
        <View style={{ height: theme.spacing.md }} />
        <Text style={styles.qLabel}>Sleep quality</Text>
        <View style={styles.qRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable
              key={n}
              onPress={() => setQuality(n)}
              style={[styles.qDot, quality >= n && styles.qDotActive]}
            >
              <Text style={[styles.qNum, quality >= n && styles.qNumActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: theme.spacing.md }} />
        <Button title={todays ? 'Update sleep' : 'Save sleep'} onPress={onSave} />
      </Card>

      <SectionHeader title="History" />
      {state.sleep.length === 0 ? (
        <Card>
          <Text style={styles.empty}>No sleep logged yet. Tonight's the night.</Text>
        </Card>
      ) : (
        <Card>
          {[...state.sleep]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 14)
            .map((s, i) => (
              <View key={s.date} style={[styles.hist, i > 0 && styles.histBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histDate}>{s.date}</Text>
                  <Text style={styles.histMeta}>Quality {s.quality}/10</Text>
                </View>
                <Text style={styles.histVal}>{s.hours.toFixed(1)}h</Text>
              </View>
            ))}
        </Card>
      )}

      <View style={{ height: theme.spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  qLabel: { color: theme.colors.textDim, fontSize: theme.font.tiny, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  qRow: { flexDirection: 'row', justifyContent: 'space-between' },
  qDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qDotActive: { backgroundColor: theme.colors.sleep, borderColor: theme.colors.sleep },
  qNum: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  qNumActive: { color: theme.colors.bg },
  empty: { color: theme.colors.textDim, textAlign: 'center', paddingVertical: theme.spacing.lg },
  hist: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md },
  histBorder: { borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  histDate: { color: theme.colors.text, fontSize: theme.font.body },
  histMeta: { color: theme.colors.textDim, fontSize: theme.font.tiny },
  histVal: { color: theme.colors.sleep, fontSize: theme.font.heading, fontWeight: '700' },
});
