import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, type ApplicationDto, type Stage } from '@acee/shared';
import { formatDate, formatDateTime, pickLocalized } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, ErrorView, H2, Loading, Notice, P, Screen, s } from '@/components/ui';

export default function Application() {
  const { t } = useTranslation();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api.get<{ items: ApplicationDto[] }>('/applications/mine') });
  const stages = useQuery({ queryKey: ['stages'], queryFn: () => api.get<{ items: Stage[] }>('/applications/stages') });
  const start = useMutation({ mutationFn: () => api.post('/applications/mine'), onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }) });
  const name = (st: Stage) => t(`applications:stages.${st.code}`, { defaultValue: pickLocalized(st.name, lang) });
  if (apps.isLoading) return <Screen><Loading /></Screen>;
  if (apps.error) return <Screen><ErrorView onRetry={() => apps.refetch()} /></Screen>;
  const app = apps.data!.items[0];
  return (
    <Screen onRefresh={() => apps.refetch()} refreshing={apps.isRefetching}>
      <Notice text={t('applications:internalNote')} />
      {!app ? (
        <Card><P>{t('applications:none')}</P><Button title={t('applications:start')} onPress={() => start.mutate()} loading={start.isPending} /></Card>
      ) : (
        <>
          <Card>
            <P muted>{t('applications:currentStage')}</P>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.navy }}>{name(app.stage)}</Text>
            <P muted>{t('applications:lastUpdated', { date: formatDate(app.updatedAt, lang) })}</P>
            <P>{t('applications:assignedCounselor')}: {app.assignedCounselor?.fullName ?? t('applications:notAssigned')}</P>
            {app.pendingActions ? <Notice tone="warning" text={`${t('applications:pendingActions')}: ${app.pendingActions}`} /> : null}
          </Card>
          <Card>
            <H2>{t('applications:history')}</H2>
            {(stages.data?.items ?? []).map((st) => {
              const done = app.history.find((h) => h.toStage.id === st.id);
              const current = st.id === app.stage.id;
              return (
                <View key={st.id} style={[s.row, { justifyContent: 'flex-start', paddingVertical: 4 }]}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: current ? colors.gold : done ? colors.success : colors.border }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.p, { fontWeight: current ? '800' : done ? '600' : '400', color: done || current ? colors.ink : colors.muted }]}>{name(st)}</Text>
                    {done && <Text style={{ fontSize: 12, color: colors.muted }}>{formatDateTime(done.createdAt, lang)}</Text>}
                  </View>
                </View>
              );
            })}
          </Card>
          <Card>
            <H2>{t('applications:messages')}</H2>
            {app.notes.length ? app.notes.map((n) => <View key={n.id}><P>{n.body}</P><P muted>{n.author.fullName} · {formatDateTime(n.createdAt, lang)}</P></View>) : <P muted>{t('common:emptyTitle')}</P>}
          </Card>
        </>
      )}
    </Screen>
  );
}
