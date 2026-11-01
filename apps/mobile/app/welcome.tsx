import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, LANGUAGES, colors } from '@acee/shared';
import { useAuth } from '@/lib/auth';
import { Button, Notice } from '@/components/ui';

export default function Welcome() {
  const { t } = useTranslation();
  const { lang, setLang, user, logout } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }} accessibilityRole="radiogroup" accessibilityLabel={t('common:language')}>
          {LANGUAGES.map((l) => (
            <Pressable key={l} testID={`lang-${l}`} accessibilityRole="radio" accessibilityState={{ checked: l === lang }} onPress={() => setLang(l)}
              style={{ paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', borderRadius: 999, backgroundColor: l === lang ? colors.gold : 'rgba(255,255,255,0.12)' }}>
              <Text style={{ color: l === lang ? colors.navy : colors.white, fontWeight: '700' }}>{t(`common:languages.${l}`)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: colors.navy }}>A</Text>
          </View>
          <Text style={{ color: colors.gold, fontWeight: '700', letterSpacing: 1 }}>{t('common:taglineSub')}</Text>
          <Text style={{ color: colors.white, fontSize: 32, fontWeight: '900', lineHeight: 42 }} accessibilityRole="header">{t('common:tagline')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 24 }}>{t('common:home.heroBody')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {COUNTRIES.slice(0, 6).map((c) => <Text key={c.code} style={{ color: colors.white, backgroundColor: colors.royal, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '700', fontSize: 12 }}>{t(`common:countries.${c.code}`)}</Text>)}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          {user && user.role !== 'STUDENT' ? (
            <>
              <Notice tone="warning" text={t('common:forbidden')} />
              <Button variant="outline" title={t('navigation:logout')} onPress={logout} />
            </>
          ) : (
            <>
              <Button variant="gold" testID="go-login" title={t('navigation:studentLogin')} onPress={() => router.push('/login')} />
              <Button variant="outline" title={t('authentication:createAccount')} onPress={() => router.push('/register')} />
              <Button variant="primary" title={t('navigation:checkEligibility')} onPress={() => router.push('/eligibility')} />
            </>
          )}
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 8 }}>{t('common:disclaimerPrivate')}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
