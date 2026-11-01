import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, type Batch, type Course, type Enrollment } from '@acee/shared';
import { formatDate, pickLocalized } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Empty, ErrorView, H2, Loading, Notice, P, Screen, s, useErrorText } from '@/components/ui';

const schedule = (t: (k: string) => string, b: Batch) => `${b.days.map((d) => t(`coaching:days.${d}`)).join(', ')} · ${b.startTime}–${b.endTime}`;

function CourseBatches({ code }: { code: string }) {
  const { t } = useTranslation();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const q = useQuery({ queryKey: ['course', code], queryFn: () => api.get<{ course: Course; batches: Batch[] }>(`/courses/${code}`) });
  const [msg, setMsg] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();
  const enroll = useMutation({
    mutationFn: (b: Batch) => api.post<Enrollment>('/enrollments', { batchId: b.id, preferredMode: b.mode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE' }),
    onSuccess: (e) => { setMsg(e.status === 'CONFIRMED' ? { tone: 'success', text: t('coaching:enrollSuccess') } : { tone: 'warning', text: t('coaching:waitlistSuccess') }); qc.invalidateQueries({ queryKey: ['enrollments'] }); qc.invalidateQueries({ queryKey: ['course', code] }); },
    onError: (e) => setMsg({ tone: 'danger', text: errorText(e) }),
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView onRetry={() => q.refetch()} />;
  return (
    <View style={{ gap: 10 }}>
      <P>{pickLocalized(q.data.course.description, lang)}</P>
      <P muted>{t('coaching:feeStatus')}: {q.data.course.isFree ? t('common:free') : t('coaching:paid', { amount: q.data.course.feeAmount ?? 0 })} — {pickLocalized(q.data.course.feeNote, lang)}</P>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {!q.data.batches.length ? <Empty text={t('coaching:noBatches')} /> : q.data.batches.map((b) => {
        const left = Math.max(0, b.capacity - b.seatsTaken);
        return (
          <View key={b.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 6 }}>
            <Text style={[s.p, { fontWeight: '700' }]}>{b.name}</Text>
            <P muted>{schedule(t, b)} · {t('coaching:startsOn', { date: formatDate(b.startDate, lang) })}</P>
            <Badge tone={left ? 'success' : 'warning'} label={left ? t('coaching:seatsLeft', { count: left }) : t('coaching:full')} />
            <Button title={t('coaching:register')} onPress={() => enroll.mutate(b)} loading={enroll.isPending && enroll.variables?.id === b.id} />
          </View>
        );
      })}
    </View>
  );
}

export default function Coaching() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api.get<{ items: Course[] }>('/courses') });
  const mine = useQuery({ queryKey: ['enrollments'], queryFn: () => api.get<{ items: Enrollment[] }>('/enrollments/mine') });
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/enrollments/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments'] }) });
  const active = mine.data?.items.filter((e) => e.status !== 'CANCELLED') ?? [];
  return (
    <Screen onRefresh={() => { void courses.refetch(); void mine.refetch(); }} refreshing={courses.isRefetching}>
      <Card>
        <H2>{t('students:myEnrollments')}</H2>
        {!active.length ? <P muted>{t('students:noEnrollments')}</P> : active.map((e) => (
          <View key={e.id} style={{ gap: 6, paddingVertical: 6 }}>
            <View style={s.row}><Text style={[s.p, { fontWeight: '700', flex: 1 }]}>{e.batch.course?.code} · {e.batch.name}</Text><Badge tone={e.status === 'CONFIRMED' ? 'success' : 'warning'} label={t(`coaching:statuses.${e.status}`)} /></View>
            <P muted>{schedule(t, e.batch)}</P>
            <Button variant="danger" title={t('coaching:cancelEnrollment')} onPress={() => cancel.mutate(e.id)} loading={cancel.isPending && cancel.variables === e.id} />
          </View>
        ))}
      </Card>
      <H2>{t('coaching:title')}</H2>
      {courses.isLoading ? <Loading /> : (courses.data?.items ?? []).map((c) => (
        <Card key={c.id}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === c.code }} onPress={() => setOpen(open === c.code ? null : c.code)} style={s.row}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.royal }}>{c.code}</Text>
            <Text style={s.p}>{t('coaching:weeks', { count: c.durationWeeks })} {open === c.code ? '▲' : '▼'}</Text>
          </Pressable>
          {open === c.code && <CourseBatches code={c.code} />}
        </Card>
      ))}
    </Screen>
  );
}
