'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Batch, Enrollment } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { useMe } from './providers';
import { Alert, Badge, Button, EmptyState, LinkButton } from './ui';

export function batchSchedule(t: (k: string) => string, b: Pick<Batch, 'days' | 'startTime' | 'endTime'>) {
  return `${b.days.map((d) => t(`coaching:days.${d}`)).join(', ')} · ${b.startTime}–${b.endTime}`;
}

export function BatchList({ batches, courseCode }: { batches: Batch[]; courseCode: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isStudent = me?.role === 'STUDENT';
  const mine = useQuery({ queryKey: ['enrollments'], queryFn: () => api.get<{ items: Enrollment[] }>('/enrollments/mine'), enabled: isStudent });
  const [modes, setModes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();
  const enroll = useMutation({
    mutationFn: (b: { batchId: string; preferredMode: string }) => api.post<Enrollment>('/enrollments', b),
    onSuccess: (e) => {
      setMsg(e.status === 'CONFIRMED' ? { tone: 'success', text: t('coaching:enrollSuccess') } : { tone: 'warning', text: t('coaching:waitlistSuccess') });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setMsg({ tone: 'danger', text: errorText(t, err) }),
  });

  if (batches.length === 0) return <EmptyState>{t('coaching:noBatches')}</EmptyState>;
  const statusFor = (id: string) => mine.data?.items.find((e) => e.batch.id === id && e.status !== 'CANCELLED')?.status;

  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {batches.map((b) => {
        const left = Math.max(0, b.capacity - b.seatsTaken);
        const status = statusFor(b.id);
        const modeOptions = b.mode === 'HYBRID' ? ['ONLINE', 'OFFLINE'] : [b.mode];
        const mode = modes[b.id] ?? modeOptions[0]!;
        return (
          <article key={b.id} className="rounded-card border border-line bg-white p-5 shadow-sm" data-testid="batch">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-navy">{b.name}</h3>
                <p className="text-sm text-muted">{batchSchedule(t, b)} (IST)</p>
                <p className="text-sm text-muted">{t('coaching:startsOn', { date: formatDate(b.startDate, lang) })}{b.location ? ` · ${b.location}` : ''}</p>
                {b.trainer && <p className="text-sm text-muted">{t('coaching:trainer')}: {b.trainer.fullName}</p>}
              </div>
              <Badge tone={left > 0 ? 'success' : 'warning'}>{left > 0 ? t('coaching:seatsLeft', { count: left }) : t('coaching:full')}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {status ? (
                <Badge tone={status === 'CONFIRMED' ? 'success' : 'warning'}>{t(`coaching:statuses.${status}`)}</Badge>
              ) : !me ? (
                <LinkButton href={`/login?next=/coaching/${courseCode.toLowerCase()}`} variant="outline">{t('coaching:loginToRegister')}</LinkButton>
              ) : isStudent ? (
                <>
                  {modeOptions.length > 1 && (
                    <label className="flex items-center gap-2 text-sm">
                      {t('coaching:preferredMode')}
                      <select className="min-h-11 rounded-xl border border-line px-2" value={mode} onChange={(e) => setModes({ ...modes, [b.id]: e.target.value })}>
                        {modeOptions.map((m) => <option key={m} value={m}>{t(m === 'ONLINE' ? 'common:online' : 'common:offline')}</option>)}
                      </select>
                    </label>
                  )}
                  <Button loading={enroll.isPending && enroll.variables?.batchId === b.id} onClick={() => enroll.mutate({ batchId: b.id, preferredMode: mode })} data-testid="enroll">
                    {t('coaching:register')}
                  </Button>
                </>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
