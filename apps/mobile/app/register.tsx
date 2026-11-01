import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TELANGANA_DISTRICTS, colors, registerSchema } from '@acee/shared';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, H1, Notice, P, Screen, s, useErrorText } from '@/components/ui';

export default function Register() {
  const { t } = useTranslation();
  const { register, lang } = useAuth();
  const errorText = useErrorText();
  const [f, setF] = useState({ fullName: '', mobile: '', email: '', district: '', password: '', acceptTerms: false, consentSms: false, consentWhatsapp: false, consentEmail: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);

  const submit = async () => {
    const parsed = registerSchema.safeParse({ ...f, preferredLanguage: lang });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message.includes(':') ? t(i.message) : t('validation:required');
      return setErrors(e);
    }
    setErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
      router.replace('/');
    } catch (e) {
      setFormError(errorText(e));
      setBusy(false);
    }
  };
  const toggle = (k: 'acceptTerms' | 'consentSms' | 'consentWhatsapp' | 'consentEmail', label: string, error?: string) => (
    <View>
      <View style={s.row}>
        <Text style={[s.p, { flex: 1 }]}>{label}</Text>
        <Switch accessibilityLabel={label} value={f[k]} onValueChange={(v) => setF({ ...f, [k]: v })} trackColor={{ true: colors.royal, false: colors.border }} />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );

  return (
    <Screen>
      <H1>{t('authentication:registerTitle')}</H1>
      <P muted>{t('authentication:registerSubtitle')}</P>
      <Card>
        {formError && <Notice tone="danger" text={formError} />}
        <Field label={t('authentication:fullName')} value={f.fullName} onChangeText={(v) => setF({ ...f, fullName: v })} error={errors.fullName} autoComplete="name" />
        <Field label={t('authentication:mobile')} hint={t('authentication:mobileHint')} keyboardType="number-pad" maxLength={10} value={f.mobile} onChangeText={(v) => setF({ ...f, mobile: v })} error={errors.mobile} />
        <Field label={t('authentication:email')} keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} error={errors.email} />
        <Text style={s.label}>{t('authentication:district')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setDistrictOpen(!districtOpen)} style={[s.input, { justifyContent: 'center' }, errors.district ? { borderColor: colors.danger } : null]}>
          <Text style={s.p}>{f.district || t('authentication:selectDistrict')}</Text>
        </Pressable>
        {errors.district ? <Text style={s.error}>{errors.district}</Text> : null}
        {districtOpen && (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
            {TELANGANA_DISTRICTS.map((d) => (
              <Pressable key={d} accessibilityRole="button" onPress={() => { setF({ ...f, district: d }); setDistrictOpen(false); }} style={{ padding: 12, borderBottomWidth: 1, borderColor: colors.surface }}>
                <Text style={s.p}>{d}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Field label={t('authentication:newPassword')} hint={t('authentication:passwordHint')} secureTextEntry value={f.password} onChangeText={(v) => setF({ ...f, password: v })} error={errors.password} autoComplete="new-password" />
        <Text style={s.label}>{t('authentication:consentTitle')}</Text>
        {toggle('consentSms', t('authentication:consentSms'))}
        {toggle('consentWhatsapp', t('authentication:consentWhatsapp'))}
        {toggle('consentEmail', t('authentication:consentEmail'))}
        {toggle('acceptTerms', t('authentication:acceptTerms'), errors.acceptTerms)}
        <Button title={t('authentication:registerButton')} onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}
