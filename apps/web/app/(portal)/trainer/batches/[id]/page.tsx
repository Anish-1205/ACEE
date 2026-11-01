'use client';
import { use, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialSchema } from '@acee/shared';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { Alert, Button, Card, EmptyState, Input, Loading, PageHeader, Textarea } from '@/components/ui';

type RosterRow = { id: string; userId: string; user: { id: string; fullName: string } };
const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export default function TrainerBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const roster = useQuery({ queryKey: ['roster', id], queryFn: () => api.get<{ items: RosterRow[] }>(`/batches/${id}/roster`) });
  const existing = useQuery({ queryKey: ['batch-attendance', id, date], queryFn: () => api.get<{ items: { userId: string; status: string }[] }>(`/batches/${id}/attendance?date=${date}`) });
  useEffect(() => { if (existing.data) setMarks(Object.fromEntries(existing.data.items.map((a) => [a.userId, a.status]))); }, [existing.data]);
  const save = useMutation({
    mutationFn: () => api.post(`/batches/${id}/attendance`, { date, records: roster.data!.items.map((r) => ({ userId: r.userId, status: marks[r.userId] ?? 'PRESENT' })) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batch-attendance', id, date] }),
  });

  const [mat, setMat] = useState({ title: '', url: '', description: '' });
  const [matErr, setMatErr] = useState<FieldErrors>({});
  const share = useMutation({ mutationFn: (b: object) => api.post(`/batches/${id}/materials`, b), onSuccess: () => setMat({ title: '', url: '', description: '' }) });
  const [ann, setAnn] = useState({ title: '', body: '' });
  const post = useMutation({ mutationFn: () => api.post(`/batches/${id}/announcements`, ann), onSuccess: () => setAnn({ title: '', body: '' }) });

  if (roster.isLoading) return <Loading />;
  if (roster.error) return <Alert tone="danger">{errorText(t, roster.error)}</Alert>;
  const rows = roster.data!.items;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('coaching:markAttendance')} />
      <Card title={t('coaching:roster')} action={<input type="date" className="min-h-11 rounded-xl border border-line px-2" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label={t('common:date')} />}>
        {!rows.length ? <EmptyState /> : (
          <>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="font-semibold">{r.user.fullName}</span>
                  <fieldset className="flex flex-wrap gap-1" aria-label={r.user.fullName}>
                    {STATUSES.map((s) => (
                      <label key={s} className={`flex min-h-10 cursor-pointer items-center rounded-lg border px-3 text-xs font-semibold ${(marks[r.userId] ?? 'PRESENT') === s ? 'border-royal bg-royal text-white' : 'border-line'}`}>
                        <input type="radio" className="sr-only" name={`att-${r.userId}`} checked={(marks[r.userId] ?? 'PRESENT') === s} onChange={() => setMarks({ ...marks, [r.userId]: s })} />
                        {t(`coaching:attendanceStatus.${s}`)}
                      </label>
                    ))}
                  </fieldset>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <Button loading={save.isPending} onClick={() => save.mutate()} data-testid="save-attendance">{t('common:save')}</Button>
              {save.isSuccess && <span className="text-sm text-success">{t('coaching:attendanceSaved')}</span>}
              {save.error && <span className="text-sm text-danger">{errorText(t, save.error)}</span>}
            </div>
          </>
        )}
      </Card>

      <Card title={t('coaching:shareMaterial')}>
        <div className="grid gap-3">
          <Input label={t('coaching:materialTitle')} value={mat.title} onChange={(e) => setMat({ ...mat, title: e.target.value })} error={matErr.title} />
          <Input label={t('coaching:materialUrl')} type="url" value={mat.url} onChange={(e) => setMat({ ...mat, url: e.target.value })} error={matErr.url} />
          <Textarea label={t('coaching:materialDescription')} value={mat.description} onChange={(e) => setMat({ ...mat, description: e.target.value })} />
          <Button className="w-fit" loading={share.isPending} onClick={() => { const p = materialSchema.safeParse(mat); setMatErr(fieldErrors(t, p)); if (p.success) share.mutate(p.data); }}>{t('common:submit')}</Button>
          {share.isSuccess && <span className="text-sm text-success">{t('coaching:posted')}</span>}
        </div>
      </Card>

      <Card title={t('coaching:postAnnouncement')}>
        <div className="grid gap-3">
          <Input label={t('coaching:announcementTitle')} value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
          <Textarea label={t('coaching:announcementBody')} value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
          <Button className="w-fit" disabled={ann.title.trim().length < 2 || !ann.body.trim()} loading={post.isPending} onClick={() => post.mutate()}>{t('common:submit')}</Button>
          {post.isSuccess && <span className="text-sm text-success">{t('coaching:posted')}</span>}
        </div>
      </Card>
    </div>
  );
}
