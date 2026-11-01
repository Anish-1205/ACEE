import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ApiError, colors, radii, spacing } from '@acee/shared';
import { errorKeyFor } from '@acee/i18n';

export function useErrorText() {
  const { t } = useTranslation();
  return (e: unknown) => {
    if (e instanceof ApiError) { const k = errorKeyFor(e.code); return k ? t(k) : e.message; }
    return t('common:errorBody');
  };
}

export function Screen({ children, onRefresh, refreshing = false }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <SafeAreaView style={s.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2} accessibilityRole="header">{children}</Text>;
export const P = ({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) => <Text style={[s.p, muted && { color: colors.muted }, style]}>{children}</Text>;

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'gold' | 'outline' | 'danger';
export function Button({ title, onPress, variant = 'primary', loading, disabled, testID }: { title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; testID?: string }) {
  const bg = { primary: colors.navy, gold: colors.crimson, outline: colors.white, danger: colors.white }[variant];
  const fg = { primary: colors.white, gold: colors.white, outline: colors.navy, danger: colors.danger }[variant];
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, (variant === 'outline' || variant === 'danger') && { borderWidth: 1, borderColor: variant === 'danger' ? colors.danger : colors.border }]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, hint, ...p }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[s.input, error ? { borderColor: colors.danger } : null]} {...p} />
      {hint && !error ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

/** Big tappable options, used instead of dropdowns. */
export function Choice<T extends string>({ label, value, options, onChange }: { label?: string; value: T | null | undefined; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      {label ? <Text style={s.label}>{label}</Text> : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
            style={[s.choice, on && { borderColor: colors.royal, backgroundColor: '#E8EEF8' }]}>
            <View style={[s.radio, on && { borderColor: colors.royal, backgroundColor: colors.royal }]} />
            <Text style={[s.p, on && { fontWeight: '700' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tones = { neutral: [colors.surface, colors.muted], info: ['#E3ECF8', colors.royal], success: ['#E1F2E9', colors.success], warning: ['#FCF1D2', colors.warning], danger: ['#F7E1DF', colors.danger] } as const;
export type Tone = keyof typeof tones;
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return <View style={[s.badge, { backgroundColor: tones[tone][0] }]}><Text style={[s.badgeText, { color: tones[tone][1] }]}>{label}</Text></View>;
}
export function Notice({ text, tone = 'info' }: { text: string; tone?: Tone }) {
  return <View style={[s.notice, { backgroundColor: tones[tone][0] }]}><Text style={{ color: tones[tone][1], fontSize: 14 }}>{text}</Text></View>;
}

export function Loading() {
  const { t } = useTranslation();
  return <View style={{ padding: spacing.xl }} accessibilityLabel={t('common:loading')}><ActivityIndicator color={colors.royal} size="large" /></View>;
}
export function ErrorView({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={[s.h2, { color: colors.danger }]}>{t('common:errorTitle')}</Text>
      <P>{t('common:errorBody')}</P>
      {onRetry && <Button variant="outline" title={t('common:retry')} onPress={onRetry} />}
    </Card>
  );
}
export const Empty = ({ text }: { text: string }) => <P muted style={{ textAlign: 'center', padding: spacing.lg }}>{text}</P>;

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  screen: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.navy },
  h2: { fontSize: 18, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
  p: { fontSize: 15, color: colors.ink, lineHeight: 23 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  btn: { minHeight: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  btnText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16, backgroundColor: colors.white, color: colors.ink },
  hint: { fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  choice: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.white },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  badge: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: { borderRadius: radii.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
