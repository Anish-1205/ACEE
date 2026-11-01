import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { colors, type AnnouncementDto, type Appointment, type Enrollment, type Stage } from '@acee/shared';
import { formatDate, formatDateTime, pickLocalized } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Card, ErrorView, H1, H2, Loading, P, Screen, s, type Tone } from '@/components/ui';

const OUTCOME_TONE: Record<string, Tone> = { ELIGIBLE: 'success', REVIEW: 'warning', NOT_MET: 'danger' };

type Dashboard = {
  profileCompletion: number; latestAssessment: { outcome: string; createdAt: string } | null;
  enrollments: Enrollment[]; appointments: Appointment[]; documents: { category: string; status: string }[];
  application: { stage: Stage; updatedAt: string } | null; unreadNotifications: number; announcements: AnnouncementDto[];
};

export default function Home() {
  const { t } = useTranslation();
  const { user, lang } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/me/dashboard') });
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><ErrorView onRetry={() => q.refetch()} /></Screen>;
  const d = q.data;
  const actions: [string, Href][] = [
    [t('navigation:checkEligibility'), '/eligibility'], [t('students:joinCoaching'), '/(tabs)/coaching'], [t('navigation:bookCounseling'), '/(tabs)/counseling'],
    [t('students:uploadDocuments'), '/(tabs)/documents'], [t('students:trackApplication'), '/application'], [`${t('navigation:notifications')}${d.unreadNotifications ? ` (${d.unreadNotifications})` : ''}`, '/notifications'],
  ];
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <H1>{t('students:welcome', { name: user?.fullName.split(' ')[0] })}</H1>
      <Card>
        <Text style={s.label}>{t('students:profileCompletion', { pct: d.profileCompletion })}</Text>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: d.profileCompletion }}>
          <View style={{ height: 10, borderRadius: 5, width: `${d.profileCompletion}%`, backgroundColor: colors.gold }} />
        </View>
      </Card>
      <H2>{t('students:quickActions')}</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {actions.map(([label, href]) => (
          <Pressable key={label} accessibilityRole="button" onPress={() => router.push(href)} style={{ width: '48%', minHeight: 64, padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' }}>
            <Text style={{ fontWeight: '700', color: colors.navy }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <H2>{t('students:latestEligibility')}</H2>
        {d.latestAssessment ? <Badge tone={OUTCOME_TONE[d.latestAssessment.outcome]} label={`${t(`eligibility:outcome${d.latestAssessment.outcome}`)} · ${formatDate(d.latestAssessment.createdAt, lang)}`} /> : <P muted>{t('eligibility:noHistory')}</P>}
      </Card>
      <Card>
        <H2>{t('applications:currentStage')}</H2>
        <P>{d.application ? t(`applications:stages.${d.application.stage.code}`, { defaultValue: pickLocalized(d.application.stage.name, lang) }) : t('applications:none')}</P>
      </Card>
      <Card>
        <H2>{t('students:upcomingAppointments')}</H2>
        {d.appointments.length ? d.appointments.map((a) => <P key={a.id}>{formatDateTime(a.startsAt, lang)} · {t(`counseling:types.${a.type}`)}</P>) : <P muted>{t('students:noAppointments')}</P>}
      </Card>
      {d.announcements.length > 0 && (
        <Card>
          <H2>{t('students:announcements')}</H2>
          {d.announcements.map((a) => <View key={a.id}><Text style={[s.p, { fontWeight: '700' }]}>{pickLocalized(a.title, lang)}</Text><P muted>{pickLocalized(a.body, lang)}</P></View>)}
        </Card>
      )}
    </Screen>
  );
}
