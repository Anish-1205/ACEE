import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { APPOINTMENT_TYPES, colors, type Appointment, type Slot } from '@acee/shared';
import { formatDate, formatDateTime, formatTime } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Choice, Empty, Field, H2, Loading, Notice, P, Screen, s, useErrorText } from '@/components/ui';

/** Next 7 IST calendar days as YYYY-MM-DD. */
const nextDays = () => Array.from({ length: 7 }, (_, i) => new Date(Date.now() + 5.5 * 3600_000 + i * 86_400_000).toISOString().slice(0, 10));

export default function Counseling() {
  const { t } = useTranslation();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const days = nextDays();
  const [type, setType] = useState<string | null>(null);
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [date, setDate] = useState(days[0]!);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [questions, setQuestions] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const slots = useQuery({ queryKey: ['slots', date], queryFn: () => api.get<{ items: Slot[] }>(`/counseling/slots?date=${date}`) });
  const mine = useQuery({ queryKey: ['appointments'], queryFn: () => api.get<{ items: Appointment[] }>('/appointments/mine') });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['slots'] }); qc.invalidateQueries({ queryKey: ['appointments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const book = useMutation({
    mutationFn: () => api.post('/appointments', { counselorId: slot!.counselorId, startsAt: slot!.startsAt, type, mode, questions }),
    onSuccess: () => { setMsg({ tone: 'success', text: t('counseling:booked') }); setSlot(null); setQuestions(''); refresh(); },
    onError: (e) => { setMsg({ tone: 'danger', text: errorText(e) }); refresh(); },
  });
  const cancel = useMutation({ mutationFn: (id: string) => api.post(`/appointments/${id}/cancel`), onSuccess: refresh });
  const usable = (slots.data?.items ?? []).filter((x) => x.mode === 'BOTH' || x.mode === mode);

  return (
    <Screen onRefresh={refresh} refreshing={slots.isRefetching}>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Card>
        <Choice label={t('counseling:chooseType')} value={type} onChange={setType} options={APPOINTMENT_TYPES.map((k) => ({ value: k, label: t(`counseling:types.${k}`) }))} />
        <Choice label={t('counseling:chooseMode')} value={mode} onChange={(v) => { setMode(v); setSlot(null); }} options={[{ value: 'ONLINE', label: t('common:online') }, { value: 'OFFLINE', label: t('common:offline') }]} />
        <Text style={s.label}>{t('counseling:chooseDate')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {days.map((d) => (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: d === date }} onPress={() => { setDate(d); setSlot(null); }}
              style={{ paddingHorizontal: 10, minHeight: 44, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: d === date ? colors.royal : colors.border, backgroundColor: d === date ? colors.royal : colors.white }}>
              <Text style={{ color: d === date ? colors.white : colors.ink, fontWeight: '600' }}>{formatDate(`${d}T12:00:00+05:30`, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>{t('counseling:chooseSlot')}</Text>
        {slots.isLoading ? <Loading /> : !usable.length ? <Empty text={t('counseling:noSlots')} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {usable.map((x) => {
              const on = slot?.startsAt === x.startsAt && slot.counselorId === x.counselorId;
              return (
                <Pressable key={`${x.counselorId}${x.startsAt}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSlot(x)}
                  style={{ width: '31%', minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: on ? colors.royal : colors.border, backgroundColor: on ? colors.royal : colors.white }}>
                  <Text style={{ fontWeight: '700', color: on ? colors.white : colors.ink }}>{formatTime(x.startsAt, lang)}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: on ? colors.white : colors.muted }}>{x.counselorName}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Field label={t('counseling:questions')} multiline value={questions} onChangeText={setQuestions} maxLength={2000} />
        <Button title={t('counseling:book')} onPress={() => book.mutate()} disabled={!slot || !type} loading={book.isPending} />
      </Card>
      <Card>
        <H2>{t('counseling:myAppointments')}</H2>
        {!mine.data?.items.length ? <P muted>{t('counseling:noAppointmentsYet')}</P> : mine.data.items.map((a) => {
          const upcoming = a.status === 'BOOKED' && new Date(a.startsAt) > new Date();
          return (
            <View key={a.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.surface }}>
              <View style={s.row}><Text style={[s.p, { fontWeight: '700' }]}>{formatDateTime(a.startsAt, lang)}</Text><Badge tone={a.status === 'BOOKED' ? 'info' : 'neutral'} label={t(`counseling:statuses.${a.status}`)} /></View>
              <P muted>{t(`counseling:types.${a.type}`)} · {a.counselor.fullName}</P>
              {upcoming && <P muted>{a.mode === 'ONLINE' ? (a.meetingLink ?? t('counseling:meetingLinkPending')) : t('counseling:officeVisit')}</P>}
              {upcoming && <Button variant="danger" title={t('counseling:cancel')} onPress={() => cancel.mutate(a.id)} loading={cancel.isPending && cancel.variables === a.id} />}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
