// Account screen.
//
// Top section: large tappable avatar + username with edit button.
// Tapping the avatar opens the photo library; the picked image is
// pushed to Supabase Storage under <userId>/avatar.jpg and the
// public URL is written back to profile.avatar_url.
//
// Below: read-only email + OAuth provider, then Switch Account and
// Delete Account.

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function AccountScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const reset = useAppStore((s) => s.reset);
  const uploadAvatar = useAppStore((s) => s.uploadAvatar);
  const setUsername = useAppStore((s) => s.setUsername);

  const [email, setEmail] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setProvider(data.user?.app_metadata?.provider ?? null);
    });
  }, []);

  async function pickAvatar() {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Photo access denied',
        'Allow YourLevel access to your photos in iOS Settings to change your picture.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.6,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // Bail before the upload if the picked image is huge — quality:0.6
    // already compresses, but a giant input photo briefly costs
    // memory and uploads slowly on bad connections.
    const MAX_BYTES = 5 * 1024 * 1024;
    if (asset.fileSize != null && asset.fileSize > MAX_BYTES) {
      Alert.alert('Photo too large', 'Please pick a photo smaller than 5 MB.');
      return;
    }
    setUploading(true);
    const ok = await uploadAvatar(asset.uri);
    setUploading(false);
    if (!ok) Alert.alert('Upload failed', 'Could not save your picture. Please try again.');
  }

  function startEditName() {
    setDraftName(profile?.username ?? '');
    setEditingName(true);
  }

  async function commitName() {
    setSavingName(true);
    await setUsername(draftName);
    setSavingName(false);
    setEditingName(false);
  }

  async function signOut() {
    try {
      // Sign out FIRST: reset() sets hydrated:false, which renders the
      // splash. Doing it before the await blanks the app, and a slow or
      // failed signOut would leave it stuck there.
      await supabase.auth.signOut();
      reset();
    } catch (err) {
      Alert.alert('Sign out failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteAccount() {
    if (!profile) return;
    setDeleting(true);
    try {
      // Full deletion (profile + storage + the auth identity itself)
      // via the delete-account Edge Function — Apple 5.1.1(v) requires
      // the account to really be gone. If the function isn't reachable
      // (not deployed yet / offline), fall back to wiping the profile
      // so the user's data is removed either way.
      const { error: fnErr } = await supabase.functions.invoke('delete-account');
      if (fnErr) {
        console.warn('[account] delete-account function failed, falling back', fnErr);
        const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
        if (error) throw error;
      }
      await supabase.auth.signOut();
      reset();
    } catch (err) {
      Alert.alert('Could not delete account', err instanceof Error ? err.message : String(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const initial = (profile?.username ?? 'Guest').trim().slice(0, 1).toUpperCase();

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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Account</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        {/* Avatar + name */}
        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            onPress={pickAvatar}
            disabled={uploading}
            style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.8 : 1 }]}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.colors.accent }]}>
                <Text style={[styles.avatarLetter, { color: theme.colors.background }]}>{initial}</Text>
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.background }]}>
              {uploading ? (
                <ActivityIndicator color={theme.colors.primary} size="small" />
              ) : (
                <Ionicons name="camera" size={16} color={theme.colors.primary} />
              )}
            </View>
          </Pressable>

          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                autoFocus
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Name"
                placeholderTextColor={theme.colors.muted}
                maxLength={32}
                style={[
                  styles.nameInput,
                  { color: theme.colors.primary, borderColor: theme.colors.muted, backgroundColor: theme.colors.surface },
                ]}
              />
              <View style={styles.nameEditButtons}>
                <Pressable
                  onPress={() => setEditingName(false)}
                  disabled={savingName}
                  style={({ pressed }) => [
                    styles.nameBtn,
                    { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.nameBtnText, { color: theme.colors.primary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={commitName}
                  disabled={savingName || !draftName.trim()}
                  style={({ pressed }) => [
                    styles.nameBtn,
                    {
                      backgroundColor: theme.colors.accent,
                      borderColor:     'transparent',
                      opacity: !draftName.trim() ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {savingName
                    ? <ActivityIndicator color={theme.colors.background} />
                    : <Text style={[styles.nameBtnText, { color: theme.colors.background }]}>Save</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={startEditName}
              style={({ pressed }) => [styles.nameDisplay, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.nameText, { color: theme.colors.primary, fontFamily: theme.fonts.bold }]}>
                {profile?.username ?? 'Set a name'}
              </Text>
              <Ionicons name="pencil" size={14} color={theme.colors.secondary} />
            </Pressable>
          )}
        </View>

        {/* Read-only fields */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Field label="Email" value={email ?? '—'} theme={theme} />
          <Divider color={theme.colors.muted} />
          <Field
            label="Signed in with"
            value={provider ? capitalize(provider) : '—'}
            theme={theme}
          />
        </View>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            styles.btn,
            { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.btnText, { color: theme.colors.primary }]}>Switch account</Text>
        </Pressable>

        <Pressable
          onPress={() => setConfirmDelete(true)}
          style={({ pressed }) => [
            styles.btn,
            styles.dangerBtn,
            { borderColor: theme.colors.danger, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          <Text style={[styles.btnText, { color: theme.colors.danger }]}>Delete account</Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={confirmDelete}
        title="Delete your account?"
        message="Your profile, tasks, bad habits, daily logs, and referrals will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        colors={theme.colors}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}

function Field({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useAppStore.getState>['theme'] }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.secondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.colors.primary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color }} />;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  root:           { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:          { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  body:           { flex: 1, padding: 24, gap: 16 },

  identity:       { alignItems: 'center', gap: 12, marginBottom: 8 },
  avatarWrap:     { width: 112, height: 112 },
  avatarImage:    { width: 112, height: 112, borderRadius: 56 },
  avatarFallback: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:   { fontSize: 48, fontWeight: '800' },
  avatarBadge:    { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },

  nameDisplay:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 4 },
  nameText:       { fontSize: 22, fontWeight: '800' },
  nameEdit:       { alignItems: 'center', gap: 10, width: '100%' },
  nameInput:      { width: '70%', height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, borderWidth: 1, textAlign: 'center' },
  nameEditButtons: { flexDirection: 'row', gap: 10 },
  nameBtn:        { paddingHorizontal: 18, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  nameBtnText:    { fontSize: 14, fontWeight: '700' },

  card:           { borderRadius: 16, paddingVertical: 4 },
  field:          { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  fieldValue:     { fontSize: 16, fontWeight: '600' },
  btn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1 },
  dangerBtn:      { marginTop: 'auto' },
  btnText:        { fontSize: 15, fontWeight: '700' },
});
