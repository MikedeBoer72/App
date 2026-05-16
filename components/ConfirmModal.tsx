// Generic confirm modal. Two modes:
//   - simple confirm: title + optional message + cancel/confirm
//   - typed confirm: cancel is enabled, confirm only enables once the
//     user has typed `requireTyping` exactly. Used for destructive
//     actions like Start Over and Delete Account where we want a
//     deliberate ack, not a tap-fat-finger.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export interface ConfirmModalProps {
  visible:        boolean;
  title:          string;
  message?:       string;
  confirmLabel?:  string;
  cancelLabel?:   string;
  destructive?:   boolean;
  /** When set, the confirm button only enables once the user types this word verbatim. */
  requireTyping?: string;
  loading?:       boolean;
  /** Colors are passed in so the modal matches the active theme. */
  colors: {
    background:  string;
    surface:     string;
    primary:     string;
    secondary:   string;
    accent:      string;
    danger:      string;
    muted:       string;
  };
  onConfirm:      () => void;
  onCancel:       () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  destructive  = false,
  requireTyping,
  loading      = false,
  colors,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');

  // Reset the input every time the modal opens fresh so a previous
  // typed value can't be reused.
  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const matches = requireTyping ? typed.trim() === requireTyping : true;
  const confirmColor = destructive ? colors.danger : colors.accent;
  const canConfirm = matches && !loading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Pressable
          style={styles.scrim}
          onPress={loading ? undefined : onCancel}
        >
          {/* Empty pressable scrim so taps outside the card dismiss. */}
          <View />
        </Pressable>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.secondary }]}>{message}</Text>
          ) : null}

          {requireTyping ? (
            <TextInput
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              placeholder={requireTyping}
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color:           colors.primary,
                  borderColor:     colors.muted,
                },
              ]}
            />
          ) : null}

          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [
                styles.btn,
                styles.cancel,
                { borderColor: colors.muted, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.primary }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={canConfirm ? onConfirm : undefined}
              disabled={!canConfirm}
              style={({ pressed }) => [
                styles.btn,
                styles.confirm,
                {
                  backgroundColor: confirmColor,
                  opacity: !canConfirm ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.confirmText, { color: colors.background }]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scrim:       { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000B0' },
  card:        { width: '100%', maxWidth: 360, borderRadius: 16, padding: 20, gap: 12 },
  title:       { fontSize: 18, fontWeight: '800' },
  message:     { fontSize: 14, lineHeight: 20 },
  input:       { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  row:         { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn:         { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancel:      { borderWidth: 1 },
  cancelText:  { fontSize: 15, fontWeight: '600' },
  confirm:     {},
  confirmText: { fontSize: 15, fontWeight: '700' },
});
