import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { NumberInput } from '../components/NumberInput';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { BarChart } from '../components/BarChart';
import { useStore } from '../store';
import { theme } from '../theme';
import { lastNDays, shortLabel, todayISO } from '../dates';
import { FoodEntry } from '../types';
import { XP_REWARDS } from '../gamification';
import { usePostHog } from 'posthog-react-native';

const FOOD_PRESETS: Omit<FoodEntry, 'id' | 'date'>[] = [
  { name: 'Chicken breast (150g)', calories: 247, protein: 46, carbs: 0, fats: 5 },
  { name: 'Rice bowl', calories: 350, protein: 7, carbs: 70, fats: 3 },
  { name: 'Protein shake', calories: 160, protein: 30, carbs: 6, fats: 2 },
  { name: 'Eggs (2 large)', calories: 156, protein: 12, carbs: 1, fats: 11 },
  { name: 'Banana', calories: 105, protein: 1, carbs: 27, fats: 0 },
  { name: 'Greek yogurt', calories: 130, protein: 17, carbs: 8, fats: 4 },
];

export function NutritionScreen() {
  const { state, dispatch } = useStore();
  const posthog = usePostHog();
  const today = todayISO();

  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [prot, setProt] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');

  const todays = useMemo(() => state.food.filter((f) => f.date === today), [state.food, today]);
  const totals = useMemo(
    () =>
      todays.reduce(
        (a, b) => ({
          calories: a.calories + b.calories,
          protein: a.protein + b.protein,
          carbs: a.carbs + b.carbs,
          fats: a.fats + b.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [todays]
  );

  const week = lastNDays(7);
  const dailyCalories = week.map((d) =>
    state.food.filter((f) => f.date === d).reduce((a, b) => a + b.calories, 0)
  );

  const onAdd = (entry?: Omit<FoodEntry, 'id' | 'date'>) => {
    const src = entry ?? {
      name: name.trim() || 'Meal',
      calories: parseFloat(cal) || 0,
      protein: parseFloat(prot) || 0,
      carbs: parseFloat(carb) || 0,
      fats: parseFloat(fat) || 0,
    };
    if (src.calories <= 0 && src.protein <= 0) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const wasProteinMet = totals.protein >= state.goals.protein;
    dispatch({ type: 'ADD_FOOD', entry: { id, date: today, ...src } });
    const nowProteinMet = totals.protein + src.protein >= state.goals.protein;
    if (!wasProteinMet && nowProteinMet) dispatch({ type: 'AWARD_XP', xp: XP_REWARDS.nutritionGoal });
    if (entry) {
      posthog.capture('meal_preset_used', {
        meal_name: src.name,
        calories: src.calories,
        protein: src.protein,
      });
    } else {
      posthog.capture('meal_logged', {
        meal_name: src.name,
        calories: src.calories,
        protein: src.protein,
        carbs: src.carbs,
        fats: src.fats,
      });
      setName('');
      setCal('');
      setProt('');
      setCarb('');
      setFat('');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionHeader title="Today's macros" subtitle={`${totals.calories} / ${state.goals.calories} kcal`} />
      <Card>
        <MacroRow label="Protein" value={totals.protein} goal={state.goals.protein} color={theme.colors.workout} />
        <MacroRow label="Carbs" value={totals.carbs} goal={state.goals.carbs} color={theme.colors.accent} />
        <MacroRow label="Fats" value={totals.fats} goal={state.goals.fats} color={theme.colors.nutrition} />
        <MacroRow label="Calories" value={totals.calories} goal={state.goals.calories} color={theme.colors.warning} />
      </Card>

      <SectionHeader title="Last 7 days" subtitle="Daily calories" />
      <Card>
        <BarChart
          values={dailyCalories}
          labels={week.map(shortLabel)}
          goal={state.goals.calories}
          color={theme.colors.nutrition}
          unit="kcal"
        />
      </Card>

      <SectionHeader title="Quick add" />
      <View style={styles.presetRow}>
        {FOOD_PRESETS.map((p) => (
          <Pressable key={p.name} onPress={() => onAdd(p)} style={styles.preset}>
            <Text style={styles.presetName}>{p.name}</Text>
            <Text style={styles.presetMeta}>
              {p.calories} kcal · {p.protein}P
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Log custom meal" />
      <Card>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Lunch" />
        <View style={{ height: theme.spacing.md }} />
        <View style={styles.row}>
          <NumberInput label="Calories" value={cal} onChangeText={setCal} placeholder="500" unit="kcal" />
          <View style={{ width: theme.spacing.md }} />
          <NumberInput label="Protein" value={prot} onChangeText={setProt} placeholder="30" unit="g" />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <View style={styles.row}>
          <NumberInput label="Carbs" value={carb} onChangeText={setCarb} placeholder="50" unit="g" />
          <View style={{ width: theme.spacing.md }} />
          <NumberInput label="Fats" value={fat} onChangeText={setFat} placeholder="15" unit="g" />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <Button title="Add meal" onPress={() => onAdd()} />
      </Card>

      <SectionHeader title="Today's meals" />
      {todays.length === 0 ? (
        <Card>
          <Text style={styles.empty}>No meals logged today.</Text>
        </Card>
      ) : (
        <Card>
          {todays.map((f, i) => (
            <View key={f.id} style={[styles.meal, i > 0 && styles.mealBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{f.name}</Text>
                <Text style={styles.mealMeta}>
                  {f.calories} kcal · {f.protein}P / {f.carbs}C / {f.fats}F
                </Text>
              </View>
              <Pressable onPress={() => dispatch({ type: 'DELETE_FOOD', id: f.id })}>
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

function MacroRow({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const fraction = Math.max(0, Math.min(1, value / Math.max(goal, 1)));
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <View style={styles.macroRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {Math.round(value)} / {goal}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  row: { flexDirection: 'row' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  preset: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    flexBasis: '48%',
    flexGrow: 1,
  },
  presetName: { color: theme.colors.text, fontWeight: '600', fontSize: theme.font.small },
  presetMeta: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 2 },
  empty: { color: theme.colors.textDim, textAlign: 'center', paddingVertical: theme.spacing.lg },
  meal: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md },
  mealBorder: { borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  mealName: { color: theme.colors.text, fontWeight: '600' },
  mealMeta: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 2 },
  del: { color: theme.colors.danger, fontSize: theme.font.small },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600' },
  macroValue: { color: theme.colors.textDim, fontSize: theme.font.small },
  track: { height: 8, backgroundColor: theme.colors.bgElevated, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
