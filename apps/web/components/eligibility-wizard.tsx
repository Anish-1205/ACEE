'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, OFFICIAL_SCHEME_URL, type EligibilityInput, type EligibilityResponse } from '@acee/shared';
import { api, errorText } from '@/lib/api';
import { useMe } from './providers';
import { Alert, Badge, Button, Card, ChoiceGroup, Input, LinkButton, Progress, type Tone } from './ui';

type Draft = { [K in keyof EligibilityInput]: EligibilityInput[K] | undefined };
const empty: Draft = {
  telanganaResident: undefined, category: undefined, annualFamilyIncome: undefined, graduationPercentage: undefined,
  qualification: undefined, intendedCountry: undefined, admissionStatus: undefined, examStatus: undefined, priorFamilyBenefit: undefined,
};
const STEPS = ['telanganaResident', 'category', 'annualFamilyIncome', 'graduationPercentage', 'qualification', 'intendedCountry', 'admissionStatus', 'examStatus', 'priorFamilyBenefit'] as const;
export const OUTCOME_TONE: Record<string, Tone> = { ELIGIBLE: 'success', REVIEW: 'warning', NOT_MET: 'danger' };

export function EligibilityWizard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(empty);
  const [numError, setNumError] = useState<string>();
  const check = useMutation({
    mutationFn: (input: EligibilityInput) => api.post<EligibilityResponse>('/eligibility/check', { schemeCode: 'AMBEDKAR_OVN', input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eligibility-history'] }),
  });

  const key = STEPS[step]!;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const answered = d[key] !== undefined;

  const next = () => {
    if (key === 'graduationPercentage' && d.graduationPercentage !== null && d.graduationPercentage !== undefined && (d.graduationPercentage < 0 || d.graduationPercentage > 100)) {
      return setNumError(t('validation:percentage'));
    }
    setNumError(undefined);
    if (step < STEPS.length - 1) return setStep(step + 1);
    check.mutate(d as EligibilityInput);
  };

  if (check.data) return <EligibilityResult result={check.data} signedIn={!!me} onRestart={() => { check.reset(); setD(empty); setStep(0); }} />;

  const tri = [{ value: 'yes', label: t('common:yes') }, { value: 'no', label: t('common:no') }, { value: 'unsure', label: t('common:notSure') }] as const;
  const numberStep = (k: 'annualFamilyIncome' | 'graduationPercentage', label: string, hint: string, unknownLabel: string, max: number) => (
    <div className="flex flex-col gap-3">
      <Input
        label={<span className="text-base font-semibold text-navy">{label}</span>} hint={hint} error={numError}
        type="number" inputMode="numeric" min={0} max={max} step={k === 'graduationPercentage' ? '0.01' : '1000'}
        value={d[k] ?? ''} disabled={d[k] === null}
        onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))}
      />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-royal" checked={d[k] === null} onChange={(e) => set(k, e.target.checked ? null : undefined)} />
        {unknownLabel}
      </label>
    </div>
  );

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>{t('eligibility:step', { current: step + 1, total: STEPS.length })}</span>
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} label={t('eligibility:step', { current: step + 1, total: STEPS.length })} />
      <div className="mt-6 min-h-64">
        {key === 'telanganaResident' && <ChoiceGroup name={key} legend={t('eligibility:qResidency')} value={d[key] ?? null} onChange={(v) => set(key, v)} options={[...tri]} />}
        {key === 'category' && <ChoiceGroup name={key} legend={t('eligibility:qCategory')} value={d[key] ?? null} onChange={(v) => set(key, v)} options={[{ value: 'SC', label: t('eligibility:categorySC') }, { value: 'ST', label: t('eligibility:categoryST') }, { value: 'OTHER', label: t('eligibility:categoryOther') }]} />}
        {key === 'annualFamilyIncome' && numberStep(key, t('eligibility:qIncome'), t('eligibility:incomeHint'), t('eligibility:incomeUnknown'), 100_000_000)}
        {key === 'graduationPercentage' && numberStep(key, t('eligibility:qGraduation'), t('eligibility:graduationHint'), t('common:notSure'), 100)}
        {key === 'qualification' && <ChoiceGroup name={key} legend={t('eligibility:qQualification')} value={d[key] ?? null} onChange={(v) => set(key, v)} options={[{ value: 'UG_PURSUING', label: t('eligibility:qualUgPursuing') }, { value: 'UG_COMPLETED', label: t('eligibility:qualUgCompleted') }, { value: 'PG_COMPLETED', label: t('eligibility:qualPgCompleted') }, { value: 'OTHER', label: t('eligibility:qualOther') }]} />}
        {key === 'intendedCountry' && (
          <ChoiceGroup name={key} legend={t('eligibility:qCountry')} value={d[key] === null ? 'XX' : d[key] ?? null} onChange={(v) => set(key, v === 'XX' ? null : v)}
            options={[...COUNTRIES.map((c) => ({ value: c.code as string, label: t(`common:countries.${c.code}`) })), { value: 'XX', label: t('eligibility:countryOther') }]} />
        )}
        {key === 'admissionStatus' && <ChoiceGroup name={key} legend={t('eligibility:qAdmission')} value={d[key] ?? null} onChange={(v) => set(key, v)} options={[{ value: 'OFFER_RECEIVED', label: t('eligibility:admOffer') }, { value: 'APPLIED', label: t('eligibility:admApplied') }, { value: 'NOT_STARTED', label: t('eligibility:admNotStarted') }]} />}
        {key === 'examStatus' && <ChoiceGroup name={key} legend={t('eligibility:qExam')} value={d[key] ?? null} onChange={(v) => set(key, v)} options={[{ value: 'SCORE_AVAILABLE', label: t('eligibility:examScore') }, { value: 'SCHEDULED', label: t('eligibility:examScheduled') }, { value: 'NOT_STARTED', label: t('eligibility:examNotStarted') }]} />}
        {key === 'priorFamilyBenefit' && <ChoiceGroup name={key} legend={t('eligibility:qPriorBenefit')} value={d[key] ?? null} onChange={(v) => set(key, v)} options={[...tri]} />}
      </div>
      {check.error && <div className="mt-4"><Alert tone="danger">{errorText(t, check.error)}</Alert></div>}
      <div className="mt-6 flex justify-between gap-3">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>{t('common:back')}</Button>
        <Button onClick={next} disabled={!answered} loading={check.isPending} data-testid="eligibility-next">
          {step === STEPS.length - 1 ? t('eligibility:seeResult') : t('common:next')}
        </Button>
      </div>
      {!me && <p className="mt-4 text-xs text-muted">{t('eligibility:privacyNote')}</p>}
    </Card>
  );
}

export function EligibilityResult({ result, signedIn, onRestart }: { result: EligibilityResponse; signedIn: boolean; onRestart: () => void }) {
  const { t } = useTranslation();
  const statusLabel = (r: EligibilityResponse['results'][number]) =>
    r.status === 'PASS' ? t('eligibility:reasonPass') : r.status === 'UNKNOWN' ? t('eligibility:reasonUnknown') : r.effect === 'REVIEW' ? t('eligibility:reasonReview') : t('eligibility:reasonFail');
  const tone = (r: EligibilityResponse['results'][number]): Tone => (r.status === 'PASS' ? 'success' : r.effect === 'NOT_MET' ? 'danger' : 'warning');
  const unverified = result.ruleVersion?.goReference.startsWith('UNVERIFIED');
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{t('eligibility:resultTitle')}</p>
      <h2 className="mt-2 text-2xl font-extrabold text-navy" data-testid="eligibility-outcome">
        <Badge tone={OUTCOME_TONE[result.outcome]}>{t(`eligibility:outcome${result.outcome}`)}</Badge>
      </h2>
      <p className="mt-3">{t(`eligibility:outcome${result.outcome}Body`)}</p>

      <h3 className="mt-6 font-bold text-navy">{t('eligibility:reasons')}</h3>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
        {result.reasonCodes.filter((c) => !c.includes('.')).map((c) => <li key={c} className="p-3 text-sm">{t(`eligibility:codes.${c}`)}</li>)}
        {result.results.map((r) => (
          <li key={r.ruleId} className="flex items-start justify-between gap-3 p-3 text-sm">
            <span>
              <span className="font-semibold">{t(`eligibility:criteria.${r.criterion}`)}</span>
              {r.description && <span className="block text-xs text-muted">{r.description}</span>}
            </span>
            <Badge tone={tone(r)}>{statusLabel(r)}</Badge>
          </li>
        ))}
      </ul>

      {result.ruleVersion && <p className="mt-4 text-xs text-muted">{t('eligibility:rulesUsed', { version: result.ruleVersion.version, reference: result.ruleVersion.goReference })}</p>}
      {unverified && <div className="mt-3"><Alert tone="warning">{t('eligibility:unverifiedRules')}</Alert></div>}
      <div className="mt-4"><Alert tone="info">{t('common:disclaimerDecision')}</Alert></div>
      {signedIn && result.assessmentId && <p className="mt-3 text-sm text-success">{t('eligibility:savedResult')}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href={signedIn ? '/dashboard/counseling' : '/counseling'} variant="gold">{t('navigation:bookCounseling')}</LinkButton>
        <LinkButton href="/coaching" variant="outline">{t('navigation:registerCoaching')}</LinkButton>
        <a href={OFFICIAL_SCHEME_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-royal underline">{t('scholarships:applyOfficial')} ↗</a>
        {!signedIn && <LinkButton href="/register" variant="ghost">{t('eligibility:saveResult')}</LinkButton>}
        <Button variant="ghost" onClick={onRestart}>{t('eligibility:startOver')}</Button>
      </div>
    </Card>
  );
}
