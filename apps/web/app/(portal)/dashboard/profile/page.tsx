'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COUNTRIES, LANGUAGES, TELANGANA_DISTRICTS, profileSchema, type Me, type StudentProfile } from '@acee/shared';
import { api, apiFieldErrors, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { useSetLanguage } from '@/components/providers';
import type { Lang } from '@acee/i18n';
import { Alert, Button, Card, ErrorState, Input, Loading, PageHeader, Progress, Select } from '@/components/ui';

type Resp = { user: Me; profile: StudentProfile };
type Form = { fullName: string; district: string; preferredLanguage: string; qualification: string; fieldOfStudy: string; graduationYear: string; intendedCountry: string; intendedLevel: string; intendedIntake: string };

export default function ProfilePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const setLanguage = useSetLanguage();
  const q = useQuery({ queryKey: ['profile'], queryFn: () => api.get<Resp>('/me/profile') });
  const [f, setF] = useState<Form | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (q.data && !f) {
      const { user: u, profile: p } = q.data;
      setF({ fullName: u.fullName, district: u.district ?? '', preferredLanguage: u.preferredLanguage, qualification: p.qualification ?? '', fieldOfStudy: p.fieldOfStudy ?? '', graduationYear: p.graduationYear?.toString() ?? '', intendedCountry: p.intendedCountry ?? '', intendedLevel: p.intendedLevel ?? '', intendedIntake: p.intendedIntake ?? '' });
    }
  }, [q.data, f]);

  const save = useMutation({
    mutationFn: (body: unknown) => api.put<Resp>('/me/profile', body),
    onSuccess: async (r) => {
      qc.setQueryData(['profile'], r);
      qc.setQueryData(['me'], r.user);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (r.user.preferredLanguage !== q.data?.user.preferredLanguage) await setLanguage(r.user.preferredLanguage as Lang);
    },
    onError: (e) => setErrors(apiFieldErrors(t, e)),
  });

  if (q.isLoading || (!f && !q.error)) return <Loading />;
  if (q.error || !f) return <ErrorState onRetry={() => q.refetch()} />;

  const nul = (v: string) => (v === '' ? null : v);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...f!, qualification: nul(f!.qualification), fieldOfStudy: nul(f!.fieldOfStudy), graduationYear: f!.graduationYear ? Number(f!.graduationYear) : null, intendedCountry: nul(f!.intendedCountry), intendedLevel: nul(f!.intendedLevel), intendedIntake: nul(f!.intendedIntake) };
    const parsed = profileSchema.safeParse(body);
    setErrors(fieldErrors(t, parsed));
    if (parsed.success) save.mutate(parsed.data);
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader title={t('students:profileTitle')} />
      <Card>
        <div className="mb-4"><Progress value={q.data!.profile.completion} label={t('students:profileCompletion', { pct: q.data!.profile.completion })} /></div>
        <p className="mb-4 text-sm text-muted">{q.data!.user.email} · {q.data!.user.mobile}</p>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
          <Input label={t('authentication:fullName')} value={f.fullName} onChange={set('fullName')} error={errors.fullName} />
          <Select label={t('authentication:district')} value={f.district} onChange={set('district')} error={errors.district} options={TELANGANA_DISTRICTS.map((d) => ({ value: d, label: d }))} placeholder={t('authentication:selectDistrict')} />
          <Select label={t('authentication:preferredLanguage')} value={f.preferredLanguage} onChange={set('preferredLanguage')} options={LANGUAGES.map((l) => ({ value: l, label: t(`common:languages.${l}`) }))} />
          <Select label={t('students:qualification')} value={f.qualification} onChange={set('qualification')} placeholder="—"
            options={[['UG_PURSUING', 'qualUgPursuing'], ['UG_COMPLETED', 'qualUgCompleted'], ['PG_COMPLETED', 'qualPgCompleted'], ['OTHER', 'qualOther']].map(([v, k]) => ({ value: v!, label: t(`eligibility:${k}`) }))} />
          <Input label={t('students:fieldOfStudy')} value={f.fieldOfStudy} onChange={set('fieldOfStudy')} />
          <Input label={t('students:graduationYear')} type="number" inputMode="numeric" value={f.graduationYear} onChange={set('graduationYear')} error={errors.graduationYear} />
          <Select label={t('students:intendedCountry')} value={f.intendedCountry} onChange={set('intendedCountry')} placeholder="—" options={COUNTRIES.map((c) => ({ value: c.code, label: t(`common:countries.${c.code}`) }))} />
          <Select label={t('students:intendedLevel')} value={f.intendedLevel} onChange={set('intendedLevel')} placeholder="—"
            options={[['MASTERS', 'levelMasters'], ['PHD', 'levelPhd'], ['OTHER', 'levelOther']].map(([v, k]) => ({ value: v!, label: t(`students:${k}`) }))} />
          <Input label={t('students:intendedIntake')} value={f.intendedIntake} onChange={set('intendedIntake')} />
          <div className="flex flex-col gap-3 md:col-span-2">
            {save.isSuccess && <Alert tone="success">{t('students:profileSaved')}</Alert>}
            {save.error && <Alert tone="danger">{errorText(t, save.error)}</Alert>}
            <Button type="submit" loading={save.isPending} className="md:w-fit">{t('common:save')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
