import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { pickLocalized } from '@acee/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorView, Loading, P, Screen } from '@/components/ui';

/** Privacy policy / terms, loaded from the same admin-editable content as the website. */
export default function Legal() {
  const { key } = useLocalSearchParams<{ key: 'privacy' | 'terms' }>();
  const { t } = useTranslation();
  const { lang } = useAuth();
  const q = useQuery({ queryKey: ['cms', key], queryFn: () => api.get<{ content: { body: Record<string, string> } }>(`/cms/${key}`) });
  return (
    <Screen>
      <Stack.Screen options={{ title: t(key === 'terms' ? 'navigation:terms' : 'navigation:privacy') }} />
      {q.isLoading ? <Loading /> : q.error || !q.data ? <ErrorView onRetry={() => q.refetch()} /> : <P>{pickLocalized(q.data.content.body, lang)}</P>}
    </Screen>
  );
}
