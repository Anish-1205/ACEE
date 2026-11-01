import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@acee/shared';
import { useAuth } from '@/lib/auth';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (user?.role !== 'STUDENT') return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.navy }, headerTintColor: colors.white,
      tabBarActiveTintColor: colors.royal, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarStyle: { minHeight: 60, paddingBottom: 6 },
    }}>
      <Tabs.Screen name="index" options={{ title: t('navigation:dashboard'), tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="coaching" options={{ title: t('navigation:coaching'), tabBarIcon: icon('📘') }} />
      <Tabs.Screen name="counseling" options={{ title: t('navigation:counseling'), tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="documents" options={{ title: t('navigation:documents'), tabBarIcon: icon('📄') }} />
      <Tabs.Screen name="more" options={{ title: t('common:menu'), tabBarIcon: icon('☰') }} />
    </Tabs>
  );
}
