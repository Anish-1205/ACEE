import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, TELANGANA_DISTRICTS, colors, profileSchema, type Me, type StudentProfile } from '@acee/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, Choice, ErrorView, Field, Loading, Notice, Screen, s, useErrorText } from '@/components/ui';

type Resp = { user: Me; profile: StudentProfile };
type Form = { fullName: string; district: string; qualification: string; fieldOfStudy: string; graduationYear: string; intendedCountry: string; intendedLevel: string; intendedIntake: string };

export default function Profile() {
  const { t } = useTranslation();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const q = useQuery({ queryKey: ['profile'], queryFn: () => api.get<Resp>('/me/profile') });
  const [f, setF] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [districtOpen, setDistrictOpen] = useState(false);
  useEffect(() => {
    if (q.data && !f) {
      const { user: u, profile: p } = q.data;
      setF({ fullName: u.fullName, district: u.district ?? '', qualification: p.qualification ?? '', fieldOfStudy: p.fieldOfStudy ?? '', graduationYear: p.graduationYear?.toString() ?? '', intendedCountry: p.intendedCountry ?? '', intendedLevel: p.intendedLevel ?? '', intendedIntake: p.intendedIntake ?? '' });
    }
  }, [q.data, f]);
  const save = useMutation({
    mutationFn: (body: unknown) => api.put<Resp>('/me/profile', body),
    onSuccess: (r) => { qc.setQueryData(['profile'], r); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });

  if (q.isLoading || (!f && !q.error)) return <Screen><Loading /></Screen>;
  if (q.error || !f) return <Screen><ErrorView onRetry={() => q.refetch()} /></Screen>;
  const nul = (v: string) => (v === '' ? null : v);
  const submit = () => {
    const parsed = profileSchema.safeParse({ ...f, preferredLanguage: lang, qualification: nul(f.qualification), fieldOfStudy: nul(f.fieldOfStudy), graduationYear: f.graduationYear ? Number(f.graduationYear) : null, intendedCountry: nul(f.intendedCountry), intendedLevel: nul(f.intendedLevel), intendedIntake: nul(f.intendedIntake) });
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message.includes(':') ? t(i.message) : t('validation:required');
    setErrors(e);
    if (parsed.success) save.mutate(parsed.data);
  };
  const completion = save.data?.profile.completion ?? q.data!.profile.completion;

  return (
    <Screen>
      <Card>
        <Text style={s.label}>{t('students:profileCompletion', { pct: completion })}</Text>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border }}><View style={{ height: 10, borderRadius: 5, width: `${completion}%`, backgroundColor: colors.crimson }} /></View>
      </Card>
      <Card>
        <Field label={t('authentication:fullName')} value={f.fullName} onChangeText={(v) => setF({ ...f, fullName: v })} error={errors.fullName} />
        <Text style={s.label}>{t('authentication:district')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setDistrictOpen(!districtOpen)} style={[s.input, { justifyContent: 'center' }]}><Text style={s.p}>{f.district || t('authentication:selectDistrict')}</Text></Pressable>
        {districtOpen && TELANGANA_DISTRICTS.map((d) => (
          <Pressable key={d} accessibilityRole="button" onPress={() => { setF({ ...f, district: d }); setDistrictOpen(false); }} style={{ padding: 12, borderBottomWidth: 1, borderColor: colors.surface }}><Text style={s.p}>{d}</Text></Pressable>
        ))}
        <Choice label={t('students:qualification')} value={f.qualification} onChange={(v) => setF({ ...f, qualification: v })}
          options={[['UG_PURSUING', 'qualUgPursuing'], ['UG_COMPLETED', 'qualUgCompleted'], ['PG_COMPLETED', 'qualPgCompleted'], ['OTHER', 'qualOther']].map(([v, k]) => ({ value: v!, label: t(`eligibility:${k}`) }))} />
        <Field label={t('students:fieldOfStudy')} value={f.fieldOfStudy} onChangeText={(v) => setF({ ...f, fieldOfStudy: v })} />
        <Field label={t('students:graduationYear')} keyboardType="number-pad" maxLength={4} value={f.graduationYear} onChangeText={(v) => setF({ ...f, graduationYear: v })} error={errors.graduationYear} />
        <Choice label={t('students:intendedCountry')} value={f.intendedCountry} onChange={(v) => setF({ ...f, intendedCountry: v })} options={COUNTRIES.map((c) => ({ value: c.code as string, label: t(`common:countries.${c.code}`) }))} />
        <Choice label={t('students:intendedLevel')} value={f.intendedLevel} onChange={(v) => setF({ ...f, intendedLevel: v })}
          options={[['MASTERS', 'levelMasters'], ['PHD', 'levelPhd'], ['OTHER', 'levelOther']].map(([v, k]) => ({ value: v!, label: t(`students:${k}`) }))} />
        <Field label={t('students:intendedIntake')} value={f.intendedIntake} onChangeText={(v) => setF({ ...f, intendedIntake: v })} />
        {save.isSuccess && <Notice tone="success" text={t('students:profileSaved')} />}
        {save.error && <Notice tone="danger" text={errorText(save.error)} />}
        <Button title={t('common:save')} onPress={submit} loading={save.isPending} />
      </Card>
    </Screen>
  );
}
