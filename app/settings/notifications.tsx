// Notifications settings.
//
// Single toggle. When on, schedules two daily local notifications
// relative to the user's day_start_time:
//   - 13h before day-start: gentle reminder
//   - 10h before day-start: "don't lose your streak"
// When off, cancels both.
//
// First-time enable triggers the iOS permission prompt. If the user
// denies, the toggle bounces back off and we show a hint.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  disableDailyReminders,
  enableDailyReminders,
  getNotificationsEnabled,
  reminderTimeFor,
} from '@/lib/notifications';
import { useAppStore } from '@/store/useAppStore';

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getNotificationsEnabled().then(setEnabled);
  }, []);

  // Preview the wall-clock times for the current day_start_time.
  const preview = useMemo(() => {
    const hms = profile?.day_start_time ?? '06:00:00';
    return {
      soft:   reminderTimeFor(hms, 13),
      urgent: reminderTimeFor(hms, 10),
    };
  }, [profile?.day_start_time]);

  async function onToggle(next: boolean) {
    if (!profile) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await enableDailyReminders(profile.day_start_time);
        if (!ok) {
          Alert.alert(
            'Notifications blocked',
            'You denied notifications for YourLevel. To turn them on, open the iOS Settings app → YourLevel → Notifications, and allow them.',
          );
          setEnabled(false);
        } else {
          setEnabled(true);
        }
      } else {
        await disableDailyReminders();
        setEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.primary }]}>Notifications</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Toggle card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={[styles.toggleTitle, { color: theme.colors.primary }]}>
                Daily reminders
              </Text>
              <Text style={[styles.toggleSub, { color: theme.colors.secondary }]}>
                Two nudges a day so you don't lose your streak.
              </Text>
            </View>
            {enabled === null || busy ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Switch
                value={enabled}
                onValueChange={onToggle}
                trackColor={{ false: theme.colors.muted, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>
        </View>

        {/* Preview times */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            When they'll fire
          </Text>
          <Text style={[styles.previewLine, { color: theme.colors.secondary }]}>
            Soft reminder:{'  '}
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {fmt(preview.soft)}
            </Text>
          </Text>
          <Text style={[styles.previewLine, { color: theme.colors.secondary }]}>
            Last warning:{'  '}
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {fmt(preview.urgent)}
            </Text>
          </Text>
          <Text style={[styles.note, { color: theme.colors.muted }]}>
            Times update automatically when you change your day-start time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmt(r: { hour: number; minute: number }): string {
  // Device-locale time: 24h on Dutch phones, AM/PM on US ones.
  const d = new Date();
  d.setHours(r.hour, r.minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:      { padding: 20, gap: 12 },
  card:        { borderRadius: 16, padding: 16, gap: 8 },
  cardTitle:   { fontSize: 14, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleText:  { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 16, fontWeight: '700' },
  toggleSub:   { fontSize: 13, lineHeight: 18 },
  previewLine: { fontSize: 14 },
  note:        { fontSize: 12, marginTop: 4 },
});
