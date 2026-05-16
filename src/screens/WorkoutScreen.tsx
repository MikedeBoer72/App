import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { NumberInput } from '../components/NumberInput';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { useStore } from '../store';
import { theme } from '../theme';
import { lastNDays, shortLabel, todayISO } from '../dates';
import { ExerciseEntry, WorkoutSet } from '../types';
import { BarChart } from '../components/BarChart';

const TEMPLATES: { name: string; exercises: string[] }[] = [
  { name: 'Push day', exercises: ['Bench press', 'Overhead press', 'Tricep pushdown'] },
  { name: 'Pull day', exercises: ['Deadlift', 'Pull-up', 'Bicep curl'] },
  { name: 'Leg day', exercises: ['Squat', 'Romanian deadlift', 'Leg press'] },
  { name: 'Cardio', exercises: ['Run', 'Cycle'] },
];

type Intensity = 'light' | 'moderate' | 'intense';

export function WorkoutScreen() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);

  const today = todayISO();
  const week = lastNDays(7);
  const dailyWorkouts = week.map((d) => state.workouts.filter((w) => w.date === d).length);

  const applyTemplate = (t: { name: string; exercises: string[] }) => {
    setName(t.name);
    setExercises(t.exercises.map((e) => ({ name: e, sets: [{ reps: 10, weight: 0 }] })));
  };

  const addExercise = () => setExercises((x) => [...x, { name: 'Exercise', sets: [{ reps: 10, weight: 0 }] }]);
  const removeExercise = (idx: number) => setExercises((x) => x.filter((_, i) => i !== idx));

  const updateExercise = (idx: number, updater: (e: ExerciseEntry) => ExerciseEntry) => {
    setExercises((x) => x.map((e, i) => (i === idx ? updater(e) : e)));
  };

  const addSet = (idx: number) =>
    updateExercise(idx, (e) => ({
      ...e,
      sets: [...e.sets, e.sets[e.sets.length - 1] ?? { reps: 10, weight: 0 }],
    }));

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) =>
    updateExercise(exIdx, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)),
    }));

  const onSave = () => {
    const d = parseFloat(duration);
    if (!name.trim() || !isFinite(d) || d <= 0) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({
      type: 'ADD_WORKOUT',
      entry: {
        id,
        date: today,
        name: name.trim(),
        durationMin: d,
        intensity,
        exercises,
      },
    });
    setName('');
    setDuration('');
    setExercises([]);
    setIntensity('moderate');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionHeader title="This week" subtitle={`Goal: ${state.goals.workoutsPerWeek} workouts`} />
      <Card>
        <BarChart
          values={dailyWorkouts}
          labels={week.map(shortLabel)}
          color={theme.colors.workout}
        />
        <Text style={styles.weekTotal}>
          {dailyWorkouts.reduce((a, b) => a + b, 0)} workouts this week
        </Text>
      </Card>

      <SectionHeader title="Templates" />
      <View style={styles.templateRow}>
        {TEMPLATES.map((t) => (
          <Pressable key={t.name} onPress={() => applyTemplate(t)} style={styles.template}>
            <Text style={styles.templateName}>{t.name}</Text>
            <Text style={styles.templateMeta}>{t.exercises.length} exercises</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Log workout" subtitle="+100 XP per completed session" />
      <Card>
        <TextField label="Workout name" value={name} onChangeText={setName} placeholder="Push day" />
        <View style={{ height: theme.spacing.md }} />
        <View style={styles.row}>
          <NumberInput label="Duration" value={duration} onChangeText={setDuration} placeholder="45" unit="min" />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <Text style={styles.intLabel}>Intensity</Text>
        <View style={styles.intRow}>
          {(['light', 'moderate', 'intense'] as Intensity[]).map((i) => (
            <Pressable
              key={i}
              onPress={() => setIntensity(i)}
              style={[styles.intBtn, intensity === i && styles.intBtnActive]}
            >
              <Text style={[styles.intText, intensity === i && styles.intTextActive]}>{i}</Text>
            </Pressable>
          ))}
        </View>

        {exercises.length > 0 && (
          <View style={{ marginTop: theme.spacing.lg }}>
            <Text style={styles.intLabel}>Exercises</Text>
            {exercises.map((ex, exIdx) => (
              <View key={exIdx} style={styles.exercise}>
                <View style={styles.exHead}>
                  <TextField
                    label=""
                    value={ex.name}
                    onChangeText={(v) => updateExercise(exIdx, (e) => ({ ...e, name: v }))}
                  />
                  <Pressable onPress={() => removeExercise(exIdx)}>
                    <Text style={styles.del}>×</Text>
                  </Pressable>
                </View>
                {ex.sets.map((s, setIdx) => (
                  <View key={setIdx} style={[styles.row, { marginTop: theme.spacing.sm }]}>
                    <NumberInput
                      label={`Set ${setIdx + 1} reps`}
                      value={String(s.reps)}
                      onChangeText={(v) => updateSet(exIdx, setIdx, { reps: parseInt(v) || 0 })}
                    />
                    <View style={{ width: theme.spacing.md }} />
                    <NumberInput
                      label="Weight"
                      value={String(s.weight)}
                      onChangeText={(v) => updateSet(exIdx, setIdx, { weight: parseFloat(v) || 0 })}
                      unit="kg"
                    />
                  </View>
                ))}
                <Pressable onPress={() => addSet(exIdx)} style={styles.addSet}>
                  <Text style={styles.addSetText}>+ Add set</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: theme.spacing.md }} />
        <Button title="+ Add exercise" variant="secondary" onPress={addExercise} />
        <View style={{ height: theme.spacing.md }} />
        <Button title="Save workout" onPress={onSave} />
      </Card>

      <SectionHeader title="History" />
      {state.workouts.length === 0 ? (
        <Card>
          <Text style={styles.empty}>No workouts yet. Begin your saga.</Text>
        </Card>
      ) : (
        <Card>
          {[...state.workouts]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((w, i) => (
              <View key={w.id} style={[styles.hist, i > 0 && styles.histBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histName}>{w.name}</Text>
                  <Text style={styles.histMeta}>
                    {w.date} · {w.durationMin} min · {w.intensity}
                  </Text>
                </View>
                <Pressable onPress={() => dispatch({ type: 'DELETE_WORKOUT', id: w.id })}>
                  <Text style={styles.del}>Remove</Text>
                </Pressable>
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
  row: { flexDirection: 'row' },
  weekTotal: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: theme.spacing.md, textAlign: 'center' },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  template: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    flexBasis: '48%',
    flexGrow: 1,
  },
  templateName: { color: theme.colors.text, fontWeight: '600' },
  templateMeta: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 2 },
  intLabel: { color: theme.colors.textDim, fontSize: theme.font.tiny, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  intRow: { flexDirection: 'row', gap: theme.spacing.sm },
  intBtn: {
    flex: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  intBtnActive: { backgroundColor: theme.colors.workout, borderColor: theme.colors.workout },
  intText: { color: theme.colors.textDim, fontSize: theme.font.small, fontWeight: '600', textTransform: 'capitalize' },
  intTextActive: { color: theme.colors.bg },
  exercise: { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.sm },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  addSet: { marginTop: theme.spacing.sm, alignItems: 'center', paddingVertical: 6 },
  addSetText: { color: theme.colors.accent, fontSize: theme.font.small, fontWeight: '600' },
  empty: { color: theme.colors.textDim, textAlign: 'center', paddingVertical: theme.spacing.lg },
  hist: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md },
  histBorder: { borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  histName: { color: theme.colors.text, fontWeight: '600' },
  histMeta: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 2 },
  del: { color: theme.colors.danger, fontSize: theme.font.heading, paddingHorizontal: 8 },
});
