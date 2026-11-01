import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, OFFICIAL_SCHEME_URL, colors, type EligibilityInput, type EligibilityResponse } from '@acee/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Choice, Field, H1, H2, Notice, P, Screen, s, useErrorText, type Tone } from '@/components/ui';

const STEPS = ['telanganaResident', 'category', 'annualFamilyIncome', 'graduationPercentage', 'qualification', 'intendedCountry', 'admissionStatus', 'examStatus', 'priorFamilyBenefit'] as const;
type Draft = Partial<{ [K in keyof EligibilityInput]: EligibilityInput[K] }>;
const TONE: Record<string, Tone> = { ELIGIBLE: 'success', REVIEW: 'warning', NOT_MET: 'danger' };

export default function Eligibility() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({});
  const [numText, setNumText] = useState<Record<string, string>>({});
  const check = useMutation({
    mutationFn: (input: EligibilityInput) => api.post<EligibilityResponse>('/eligibility/check', { schemeCode: 'AMBEDKAR_OVN', input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const key = STEPS[step]!;
  const set = (k: keyof Draft, v: unknown) => setD((p) => ({ ...p, [k]: v }));
  const tri = [{ value: 'yes', label: t('common:yes') }, { value: 'no', label: t('common:no') }, { value: 'unsure', label: t('common:notSure') }];

  if (check.data) {
    const r = check.data;
    return (
      <Screen>
        <H1>{t('eligibility:resultTitle')}</H1>
        <Card>
          <Badge tone={TONE[r.outcome]} label={t(`eligibility:outcome${r.outcome}`)} />
          <P>{t(`eligibility:outcome${r.outcome}Body`)}</P>
        </Card>
        <Card>
          <H2>{t('eligibility:reasons')}</H2>
          {r.reasonCodes.filter((c) => !c.includes('.')).map((c) => <P key={c}>{t(`eligibility:codes.${c}`)}</P>)}
          {r.results.map((x) => (
            <View key={x.ruleId} style={[s.row, { paddingVertical: 6 }]}>
              <Text style={[s.p, { flex: 1 }]}>{t(`eligibility:criteria.${x.criterion}`)}</Text>
              <Badge tone={x.status === 'PASS' ? 'success' : x.effect === 'NOT_MET' ? 'danger' : 'warning'}
                label={x.status === 'PASS' ? t('eligibility:reasonPass') : x.status === 'UNKNOWN' ? t('eligibility:reasonUnknown') : x.effect === 'REVIEW' ? t('eligibility:reasonReview') : t('eligibility:reasonFail')} />
            </View>
          ))}
          {r.ruleVersion && <P muted>{t('eligibility:rulesUsed', { version: r.ruleVersion.version, reference: r.ruleVersion.goReference })}</P>}
        </Card>
        {r.ruleVersion?.goReference.startsWith('UNVERIFIED') && <Notice tone="warning" text={t('eligibility:unverifiedRules')} />}
        <Notice text={t('common:disclaimerDecision')} />
        {user && r.assessmentId && <Notice tone="success" text={t('eligibility:savedResult')} />}
        <Button variant="gold" title={t('navigation:bookCounseling')} onPress={() => router.push(user ? '/(tabs)/counseling' : '/register')} />
        <Button variant="outline" title={t('scholarships:applyOfficial')} onPress={() => Linking.openURL(OFFICIAL_SCHEME_URL)} />
        <Button variant="outline" title={t('eligibility:startOver')} onPress={() => { check.reset(); setD({}); setNumText({}); setStep(0); }} />
      </Screen>
    );
  }

  const numberStep = (k: 'annualFamilyIncome' | 'graduationPercentage', label: string, hint: string, unknown: string) => (
    <View style={{ gap: 12 }}>
      <Field label={label} hint={hint} keyboardType="decimal-pad" editable={d[k] !== null} value={numText[k] ?? ''}
        onChangeText={(v) => { setNumText({ ...numText, [k]: v }); const n = Number(v); set(k, v === '' || Number.isNaN(n) ? undefined : n); }} />
      <Button variant={d[k] === null ? 'primary' : 'outline'} title={unknown} onPress={() => set(k, d[k] === null ? undefined : null)} />
    </View>
  );
  const pctInvalid = key === 'graduationPercentage' && typeof d.graduationPercentage === 'number' && (d.graduationPercentage < 0 || d.graduationPercentage > 100);

  return (
    <Screen>
      <H1>{t('eligibility:title')}</H1>
      <P muted>{t('eligibility:step', { current: step + 1, total: STEPS.length })}</P>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border }}><View style={{ height: 8, borderRadius: 4, width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: colors.gold }} /></View>
      <Card>
        {key === 'telanganaResident' && <Choice label={t('eligibility:qResidency')} value={d[key]} onChange={(v) => set(key, v)} options={tri as { value: 'yes' | 'no' | 'unsure'; label: string }[]} />}
        {key === 'category' && <Choice label={t('eligibility:qCategory')} value={d[key]} onChange={(v) => set(key, v)} options={[{ value: 'SC', label: t('eligibility:categorySC') }, { value: 'ST', label: t('eligibility:categoryST') }, { value: 'OTHER', label: t('eligibility:categoryOther') }]} />}
        {key === 'annualFamilyIncome' && numberStep(key, t('eligibility:qIncome'), t('eligibility:incomeHint'), t('eligibility:incomeUnknown'))}
        {key === 'graduationPercentage' && numberStep(key, t('eligibility:qGraduation'), t('eligibility:graduationHint'), t('common:notSure'))}
        {key === 'qualification' && <Choice label={t('eligibility:qQualification')} value={d[key]} onChange={(v) => set(key, v)} options={[{ value: 'UG_PURSUING', label: t('eligibility:qualUgPursuing') }, { value: 'UG_COMPLETED', label: t('eligibility:qualUgCompleted') }, { value: 'PG_COMPLETED', label: t('eligibility:qualPgCompleted') }, { value: 'OTHER', label: t('eligibility:qualOther') }]} />}
        {key === 'intendedCountry' && <Choice label={t('eligibility:qCountry')} value={d[key] === null ? 'XX' : d[key]} onChange={(v) => set(key, v === 'XX' ? null : v)} options={[...COUNTRIES.map((c) => ({ value: c.code as string, label: t(`common:countries.${c.code}`) })), { value: 'XX', label: t('eligibility:countryOther') }]} />}
        {key === 'admissionStatus' && <Choice label={t('eligibility:qAdmission')} value={d[key]} onChange={(v) => set(key, v)} options={[{ value: 'OFFER_RECEIVED', label: t('eligibility:admOffer') }, { value: 'APPLIED', label: t('eligibility:admApplied') }, { value: 'NOT_STARTED', label: t('eligibility:admNotStarted') }]} />}
        {key === 'examStatus' && <Choice label={t('eligibility:qExam')} value={d[key]} onChange={(v) => set(key, v)} options={[{ value: 'SCORE_AVAILABLE', label: t('eligibility:examScore') }, { value: 'SCHEDULED', label: t('eligibility:examScheduled') }, { value: 'NOT_STARTED', label: t('eligibility:examNotStarted') }]} />}
        {key === 'priorFamilyBenefit' && <Choice label={t('eligibility:qPriorBenefit')} value={d[key]} onChange={(v) => set(key, v)} options={tri as { value: 'yes' | 'no' | 'unsure'; label: string }[]} />}
        {pctInvalid && <Notice tone="danger" text={t('validation:percentage')} />}
        {check.error && <Notice tone="danger" text={errorText(check.error)} />}
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button variant="outline" title={t('common:back')} disabled={step === 0} onPress={() => setStep(step - 1)} /></View>
        <View style={{ flex: 1 }}>
          <Button title={step === STEPS.length - 1 ? t('eligibility:seeResult') : t('common:next')} disabled={d[key] === undefined || pctInvalid} loading={check.isPending}
            onPress={() => (step < STEPS.length - 1 ? setStep(step + 1) : check.mutate(d as EligibilityInput))} />
        </View>
      </View>
      {!user && <P muted>{t('eligibility:privacyNote')}</P>}
    </Screen>
  );
}
