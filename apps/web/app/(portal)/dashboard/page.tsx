'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MAIN_SITE, REQUIRED_DOCUMENTS, missingRequiredDocuments, type AnnouncementDto, type Appointment, type Enrollment, type Me, type Stage } from '@acee/shared';
import { formatDate, formatDateTime, pickLocalized, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { OUTCOME_TONE } from '@/components/eligibility-wizard';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader, Progress } from '@/components/ui';

type Dashboard = {
  user: Me; profileCompletion: number;
  latestAssessment: { outcome: string; createdAt: string } | null;
  enrollments: Enrollment[]; appointments: Appointment[];
  documents: { category: string; status: string }[];
  application: { id: string; stage: Stage; updatedAt: string } | null;
  unreadNotifications: number; announcements: AnnouncementDto[];
};

export default function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/me/dashboard') });
  if (q.isLoading) return <Loading rows={4} />;
  if (q.error || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const d = q.data;

  const missingDocs = missingRequiredDocuments(d.documents).length;
  const steps = [
    d.profileCompletion < 100 && { href: '/dashboard/profile', text: t('students:stepProfile') },
    !d.latestAssessment && { href: '/dashboard/eligibility', text: t('students:stepEligibility') },
    d.enrollments.length === 0 && { href: '/coaching', text: t('students:stepCoaching') },
    d.appointments.length === 0 && { href: '/dashboard/counseling', text: t('students:stepCounseling') },
    missingDocs > 0 && { href: '/dashboard/documents', text: t('students:stepDocuments', { count: missingDocs }) },
    !d.application && { href: '/dashboard/application', text: t('students:stepApplication') },
  ].filter(Boolean) as { href: string; text: string }[];

  const actions: [string, string, string][] = [
    ['/dashboard/profile', 'students:completeProfile', '👤'], ['/dashboard/eligibility', 'navigation:checkEligibility', '✅'],
    ['/coaching', 'students:joinCoaching', '📘'], ['/dashboard/counseling', 'navigation:bookCounseling', '💬'],
    ['/dashboard/documents', 'students:uploadDocuments', '📄'], ['/dashboard/application', 'students:trackApplication', '🧭'],
    [MAIN_SITE.contact, 'students:contactAcee', '📞'],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('students:welcome', { name: d.user.fullName.split(' ')[0] })} subtitle={t('students:welcomeSub')} />

      <Card>
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{t('students:profileCompletion', { pct: d.profileCompletion })}</span>
          {d.profileCompletion < 100 && <Link href="/dashboard/profile" className="text-royal underline">{t('students:completeProfile')}</Link>}
        </div>
        <div className="mt-2"><Progress value={d.profileCompletion} label={t('students:profileCompletion', { pct: d.profileCompletion })} /></div>
      </Card>

      <section aria-label={t('students:quickActions')}>
        <h2 className="mb-3 text-lg font-bold text-navy">{t('students:quickActions')}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {actions.map(([href, key, icon]) => (
            <li key={href}>
              <Link href={href} className="flex min-h-20 flex-col items-start justify-center gap-1 rounded-card border border-line bg-white p-3 text-sm font-semibold text-navy shadow-sm hover:border-royal">
                <span className="text-xl" aria-hidden>{icon}</span>{t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card title={t('students:nextSteps')}>
        {steps.length === 0 ? <p className="text-sm text-success">{t('students:allDone')}</p> : (
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.href}><Link href={s.href} className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm hover:bg-crimson/10"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-crimson font-bold text-white">{i + 1}</span>{s.text}</Link></li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t('students:latestEligibility')}>
          {d.latestAssessment ? (
            <div className="flex items-center justify-between gap-2">
              <Badge tone={OUTCOME_TONE[d.latestAssessment.outcome]}>{t(`eligibility:outcome${d.latestAssessment.outcome}`)}</Badge>
              <span className="text-xs text-muted">{formatDate(d.latestAssessment.createdAt, lang)}</span>
            </div>
          ) : <EmptyState>{t('eligibility:noHistory')}</EmptyState>}
        </Card>

        <Card title={t('applications:currentStage')}>
          {d.application ? (
            <Link href="/dashboard/application" className="block">
              <p className="font-bold text-navy">{t(`applications:stages.${d.application.stage.code}`, { defaultValue: pickLocalized(d.application.stage.name, lang) })}</p>
              <p className="text-xs text-muted">{t('applications:lastUpdated', { date: formatDate(d.application.updatedAt, lang) })}</p>
            </Link>
          ) : <EmptyState>{t('applications:none')}</EmptyState>}
        </Card>

        <Card title={t('students:upcomingAppointments')}>
          {d.appointments.length === 0 ? <EmptyState>{t('students:noAppointments')}</EmptyState> : (
            <ul className="flex flex-col gap-2 text-sm">
              {d.appointments.map((a) => <li key={a.id} className="rounded-xl bg-surface p-3"><b>{formatDateTime(a.startsAt, lang)}</b> · {t(`counseling:types.${a.type}`)} · {a.counselor.fullName}</li>)}
            </ul>
          )}
        </Card>

        <Card title={t('students:myEnrollments')}>
          {d.enrollments.length === 0 ? <EmptyState>{t('students:noEnrollments')}</EmptyState> : (
            <ul className="flex flex-col gap-2 text-sm">
              {d.enrollments.map((e) => <li key={e.id} className="flex items-center justify-between rounded-xl bg-surface p-3"><span>{e.batch.course?.code} · {e.batch.name}</span><Badge tone={e.status === 'CONFIRMED' ? 'success' : 'warning'}>{t(`coaching:statuses.${e.status}`)}</Badge></li>)}
            </ul>
          )}
        </Card>

        <Card title={t('students:documentChecklist')}>
          <ul className="flex flex-col gap-1 text-sm">
            {REQUIRED_DOCUMENTS.map((c) => {
              const s = d.documents.find((x) => x.category === c)?.status ?? 'MISSING';
              return <li key={c} className="flex items-center justify-between gap-2 py-1"><span>{t(`documents:categories.${c}`)}</span><Badge tone={s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : s === 'PENDING' ? 'info' : 'neutral'}>{t(`documents:statuses.${s}`)}</Badge></li>;
            })}
          </ul>
        </Card>

        <Card title={t('students:announcements')}>
          {d.announcements.length === 0 ? <EmptyState /> : (
            <ul className="flex flex-col gap-3 text-sm">
              {d.announcements.map((a) => <li key={a.id}><p className="font-semibold">{pickLocalized(a.title, lang)}</p><p className="text-muted">{pickLocalized(a.body, lang)}</p></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
