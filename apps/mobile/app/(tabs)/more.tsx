import { router, type Href } from 'expo-router';
import { Linking, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OFFICIAL_PORTAL_URL, colors } from '@acee/shared';
import { useAuth } from '@/lib/auth';
import { Button, Card, P, Screen, s } from '@/components/ui';

export default function More() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const items: [string, Href][] = [
    [t('navigation:checkEligibility'), '/eligibility'], [t('navigation:application'), '/application'],
    [t('navigation:notifications'), '/notifications'], [t('navigation:settings'), '/settings'],
  ];
  return (
    <Screen>
      <Card>
        <Text style={[s.p, { fontWeight: '700' }]}>{user?.fullName}</Text>
        <P muted>{user?.email} · {user?.mobile}</P>
      </Card>
      <Card style={{ padding: 0 }}>
        {items.map(([label, href]) => (
          <Pressable key={label} accessibilityRole="button" onPress={() => router.push(href)} style={{ minHeight: 56, paddingHorizontal: 16, justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.surface }}>
            <Text style={[s.p, { fontWeight: '600' }]}>{label} ›</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(OFFICIAL_PORTAL_URL)} style={{ minHeight: 56, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={[s.p, { fontWeight: '600', color: colors.royal }]}>{t('common:officialPortal')} ↗</Text>
        </Pressable>
      </Card>
      <P muted>{t('common:disclaimerPrivate')}</P>
      <Button variant="danger" title={t('navigation:logout')} onPress={async () => { await logout(); router.replace('/welcome'); }} />
    </Screen>
  );
}
