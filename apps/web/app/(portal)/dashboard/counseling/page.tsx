'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { APPOINTMENT_TYPES, type Appointment, type Slot } from '@acee/shared';
import { formatDateTime, formatTime, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { Alert, Badge, Button, Card, ChoiceGroup, ConfirmButton, EmptyState, Input, Loading, PageHeader, Select, Textarea, cx } from '@/components/ui';

const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function SlotPicker({ date, counselorId, mode, selected, onSelect }: { date: string; counselorId: string; mode: string; selected: Slot | null; onSelect: (s: Slot) => void }) {
  const { t, i18n } = useTranslation();
  const slots = useQuery({
    queryKey: ['slots', date, counselorId],
    queryFn: () => api.get<{ items: Slot[] }>(`/counseling/slots?date=${date}${counselorId ? `&counselorId=${counselorId}` : ''}`),
  });
  if (slots.isLoading) return <Loading rows={1} />;
  const usable = (slots.data?.items ?? []).filter((s) => s.mode === 'BOTH' || s.mode === mode);
  if (!usable.length) return <EmptyState>{t('counseling:noSlots')}</EmptyState>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t('counseling:chooseSlot')}>
      {usable.map((s) => {
        const on = selected?.startsAt === s.startsAt && selected.counselorId === s.counselorId;
        return (
          <li key={`${s.counselorId}${s.startsAt}`}>
            <button type="button" aria-pressed={on} onClick={() => onSelect(s)} data-testid="slot"
              className={cx('flex min-h-12 w-full flex-col items-center justify-center rounded-xl border px-2 py-1 text-sm', on ? 'border-royal bg-royal text-white' : 'border-line bg-white hover:border-royal')}>
              <span className="font-bold">{formatTime(s.startsAt, i18n.language as Lang)}</span>
              {!counselorId && <span className="text-xs opacity-80">{s.counselorName}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function StudentCounselingPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>(null);
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [date, setDate] = useState(istToday());
  const [counselorId, setCounselorId] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [questions, setQuestions] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const counselors = useQuery({ queryKey: ['counselors'], queryFn: () => api.get<{ items: { id: string; fullName: string }[] }>('/counselors') });
  const mine = useQuery({ queryKey: ['appointments'], queryFn: () => api.get<{ items: Appointment[] }>('/appointments/mine') });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['slots'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const book = useMutation({
    mutationFn: () => rescheduling
      ? api.post(`/appointments/${rescheduling.id}/reschedule`, { startsAt: slot!.startsAt })
      : api.post('/appointments', { counselorId: slot!.counselorId, startsAt: slot!.startsAt, type, mode, questions }),
    onSuccess: () => { setMsg({ tone: 'success', text: t(rescheduling ? 'counseling:rescheduled' : 'counseling:booked') }); setSlot(null); setRescheduling(null); setQuestions(''); refresh(); },
    onError: (e) => { setMsg({ tone: 'danger', text: errorText(t, e) }); qc.invalidateQueries({ queryKey: ['slots'] }); },
  });
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/appointments/${id}/cancel`), onSuccess: refresh });

  const startReschedule = (a: Appointment) => { setRescheduling(a); setType(a.type); setMode(a.mode as 'ONLINE' | 'OFFLINE'); setCounselorId(a.counselor.id); setSlot(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('counseling:title')} subtitle={t('counseling:subtitle')} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title={rescheduling ? `${t('counseling:reschedule')} — ${formatDateTime(rescheduling.startsAt, lang)}` : undefined}>
        <div className="flex flex-col gap-6">
          {!rescheduling && (
            <>
              <ChoiceGroup name="type" legend={t('counseling:chooseType')} value={type} onChange={setType} options={APPOINTMENT_TYPES.map((k) => ({ value: k, label: t(`counseling:types.${k}`) }))} />
              <ChoiceGroup name="mode" legend={t('counseling:chooseMode')} value={mode} onChange={(v) => { setMode(v); setSlot(null); }} options={[{ value: 'ONLINE', label: t('common:online') }, { value: 'OFFLINE', label: t('common:offline') }]} />
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('counseling:chooseDate')} type="date" min={istToday()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
            {!rescheduling && (
              <Select label={t('counseling:counselor')} value={counselorId} onChange={(e) => { setCounselorId(e.target.value); setSlot(null); }}
                options={[{ value: '', label: t('counseling:anyCounselor') }, ...(counselors.data?.items ?? []).map((c) => ({ value: c.id, label: c.fullName }))]} />
            )}
          </div>
          <div>
            <p className="mb-2 text-base font-semibold text-navy">{t('counseling:chooseSlot')}</p>
            {date && <SlotPicker date={date} counselorId={counselorId} mode={mode} selected={slot} onSelect={setSlot} />}
          </div>
          {!rescheduling && <Textarea label={t('counseling:questions')} value={questions} onChange={(e) => setQuestions(e.target.value)} maxLength={2000} />}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!slot || !type} loading={book.isPending} onClick={() => book.mutate()} data-testid="book">{rescheduling ? t('counseling:reschedule') : t('counseling:book')}</Button>
            {rescheduling && <Button variant="outline" onClick={() => setRescheduling(null)}>{t('common:cancel')}</Button>}
          </div>
        </div>
      </Card>

      <Card title={t('counseling:myAppointments')}>
        {mine.isLoading ? <Loading rows={2} /> : !mine.data?.items.length ? <EmptyState>{t('counseling:noAppointmentsYet')}</EmptyState> : (
          <ul className="flex flex-col gap-3">
            {mine.data.items.map((a) => {
              const upcoming = a.status === 'BOOKED' && new Date(a.startsAt) > new Date();
              return (
                <li key={a.id} className="rounded-xl border border-line p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-navy">{formatDateTime(a.startsAt, lang)}</span>
                    <Badge tone={a.status === 'BOOKED' ? 'info' : a.status === 'COMPLETED' ? 'success' : 'neutral'}>{t(`counseling:statuses.${a.status}`)}</Badge>
                  </div>
                  <p className="mt-1">{t(`counseling:types.${a.type}`)} · {a.mode === 'ONLINE' ? t('common:online') : t('common:offline')} · {a.counselor.fullName}</p>
                  {upcoming && (a.mode === 'ONLINE'
                    ? (a.meetingLink ? <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-royal underline">{t('counseling:meetingLink')} ↗</a> : <p className="mt-2 text-muted">{t('counseling:meetingLinkPending')}</p>)
                    : <p className="mt-2 text-muted">{t('counseling:officeVisit')}</p>)}
                  {upcoming && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => startReschedule(a)}>{t('counseling:reschedule')}</Button>
                      <ConfirmButton message={t('counseling:cancelConfirm')} onConfirm={() => cancel.mutate(a.id)}>{t('counseling:cancel')}</ConfirmButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
