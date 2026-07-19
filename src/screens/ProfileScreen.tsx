import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { TextField } from '../components/TextField';
import { NumberInput } from '../components/NumberInput';
import { Button } from '../components/Button';
import { XPBar } from '../components/XPBar';
import { useStore } from '../store';
import { theme } from '../theme';
import { ACHIEVEMENTS } from '../gamification';
import { usePostHog } from 'posthog-react-native';

export function ProfileScreen() {
  const { state, dispatch, reset } = useStore();
  const posthog = usePostHog();
  const [name, setName] = useState(state.profile.name);
  const [goals, setGoals] = useState({
    sleepHours: String(state.goals.sleepHours),
    calories: String(state.goals.calories),
    protein: String(state.goals.protein),
    carbs: String(state.goals.carbs),
    fats: String(state.goals.fats),
    waterGlasses: String(state.goals.waterGlasses),
    workoutsPerWeek: String(state.goals.workoutsPerWeek),
  });

  const saveProfile = () => {
    const savedName = name.trim() || 'Champion';
    const savedGoals = {
      sleepHours: parseFloat(goals.sleepHours) || 8,
      calories: parseInt(goals.calories) || 2000,
      protein: parseInt(goals.protein) || 120,
      carbs: parseInt(goals.carbs) || 220,
      fats: parseInt(goals.fats) || 60,
      waterGlasses: parseInt(goals.waterGlasses) || 8,
      workoutsPerWeek: parseInt(goals.workoutsPerWeek) || 3,
    };
    dispatch({ type: 'SET_NAME', name: savedName });
    dispatch({ type: 'UPDATE_GOALS', goals: savedGoals });
    posthog.identify(savedName, {
      $set: { name: savedName },
    });
    posthog.capture('profile_saved', {
      name_set: savedName !== 'Champion',
      sleep_goal_hours: savedGoals.sleepHours,
      calorie_goal: savedGoals.calories,
      protein_goal: savedGoals.protein,
      water_goal_glasses: savedGoals.waterGlasses,
      workouts_per_week_goal: savedGoals.workoutsPerWeek,
    });
  };

  const confirmReset = () => {
    Alert.alert('Reset all data?', 'This wipes XP, streaks, logs, and goals. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          posthog.capture('data_reset_confirmed', {
            total_xp_lost: state.totalXp,
            workouts_logged: state.workouts.length,
            sleep_entries: state.sleep.length,
            food_entries: state.food.length,
            achievements_earned: state.achievements.length,
          });
          posthog.reset();
          reset();
        },
      },
    ]);
  };

  const earned = new Set(state.achievements);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Card>
        <XPBar totalXp={state.totalXp} />
        <Text style={styles.totalXp}>{state.totalXp} total XP earned</Text>
      </Card>

      <SectionHeader title="Profile" />
      <Card>
        <TextField label="Name" value={name} onChangeText={setName} />
      </Card>

      <SectionHeader title="Daily goals" />
      <Card>
        <View style={styles.row}>
          <NumberInput
            label="Sleep"
            value={goals.sleepHours}
            onChangeText={(v) => setGoals((g) => ({ ...g, sleepHours: v }))}
            unit="h"
          />
          <View style={{ width: theme.spacing.md }} />
          <NumberInput
            label="Water"
            value={goals.waterGlasses}
            onChangeText={(v) => setGoals((g) => ({ ...g, waterGlasses: v }))}
            unit="glasses"
            keyboardType="numeric"
          />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <View style={styles.row}>
          <NumberInput
            label="Calories"
            value={goals.calories}
            onChangeText={(v) => setGoals((g) => ({ ...g, calories: v }))}
            unit="kcal"
            keyboardType="numeric"
          />
          <View style={{ width: theme.spacing.md }} />
          <NumberInput
            label="Protein"
            value={goals.protein}
            onChangeText={(v) => setGoals((g) => ({ ...g, protein: v }))}
            unit="g"
            keyboardType="numeric"
          />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <View style={styles.row}>
          <NumberInput
            label="Carbs"
            value={goals.carbs}
            onChangeText={(v) => setGoals((g) => ({ ...g, carbs: v }))}
            unit="g"
            keyboardType="numeric"
          />
          <View style={{ width: theme.spacing.md }} />
          <NumberInput
            label="Fats"
            value={goals.fats}
            onChangeText={(v) => setGoals((g) => ({ ...g, fats: v }))}
            unit="g"
            keyboardType="numeric"
          />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <NumberInput
          label="Workouts / week"
          value={goals.workoutsPerWeek}
          onChangeText={(v) => setGoals((g) => ({ ...g, workoutsPerWeek: v }))}
          keyboardType="numeric"
        />
        <View style={{ height: theme.spacing.md }} />
        <Button title="Save changes" onPress={saveProfile} />
      </Card>

      <SectionHeader title="Achievements" subtitle={`${earned.size} / ${ACHIEVEMENTS.length} unlocked`} />
      <Card>
        {ACHIEVEMENTS.map((a, i) => {
          const got = earned.has(a.id);
          return (
            <View key={a.id} style={[styles.ach, i > 0 && styles.achBorder]}>
              <View style={[styles.badge, got && styles.badgeOn]}>
                <Text style={[styles.badgeText, got && styles.badgeTextOn]}>{got ? '★' : '·'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.achTitle, !got && styles.achLocked]}>{a.title}</Text>
                <Text style={styles.achDesc}>{a.desc}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Data" />
      <Card>
        <Button title="Reset all data" variant="secondary" onPress={confirmReset} />
      </Card>

      <View style={{ height: theme.spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
  row: { flexDirection: 'row' },
  totalXp: { color: theme.colors.xp, marginTop: theme.spacing.md, fontWeight: '700', textAlign: 'center' },
  ach: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, gap: theme.spacing.md },
  achBorder: { borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: { backgroundColor: theme.colors.xp, borderColor: theme.colors.xp },
  badgeText: { color: theme.colors.textMuted, fontSize: 18 },
  badgeTextOn: { color: theme.colors.bg },
  achTitle: { color: theme.colors.text, fontWeight: '600' },
  achLocked: { color: theme.colors.textDim },
  achDesc: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 2 },
});
