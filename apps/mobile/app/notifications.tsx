import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, type NotificationDto } from '@acee/shared';
import { formatDateTime } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, Empty, ErrorView, Loading, P, Screen } from '@/components/ui';

export default function Notifications() {
  const { t } = useTranslation();
  const { lang } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: NotificationDto[]; unread: number }>('/me/notifications') });
  const readAll = useMutation({ mutationFn: () => api.post('/me/notifications/read', {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); } });
  // Notifications store i18n keys + params so they render in the reader's current language.
  const render = (n: NotificationDto) => {
    const p: Record<string, string> = { ...n.params };
    if (p.at) p.at = formatDateTime(p.at, lang);
    if (p.category) p.category = t(`documents:categories.${p.category}`);
    if (p.stageCode) p.stage = t(`applications:stages.${p.stageCode}`, { defaultValue: p.stageCode });
    return { title: t(`notifications:${n.titleKey}`, p), body: t(`notifications:${n.bodyKey}`, p) };
  };
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error) return <Screen><ErrorView onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.data!.unread > 0 && <Button variant="outline" title={t('notifications:markAllRead')} onPress={() => readAll.mutate()} loading={readAll.isPending} />}
      {!q.data!.items.length ? <Empty text={t('notifications:empty')} /> : q.data!.items.map((n) => {
        const { title, body } = render(n);
        return (
          <Card key={n.id} style={n.readAt ? undefined : { borderColor: colors.crimson, backgroundColor: '#FDEEF2' }}>
            <View><P style={{ fontWeight: '700' }}>{title}</P><P>{body}</P><P muted>{formatDateTime(n.createdAt, lang)}</P></View>
          </Card>
        );
      })}
    </Screen>
  );
}
