import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@acee/shared';
import type { Lang } from '@acee/i18n';
import { useAuth } from '@/lib/auth';
import { Card, Choice, H2, P, Screen } from '@/components/ui';

export default function Settings() {
  const { t } = useTranslation();
  const { lang, setLang } = useAuth();
  return (
    <Screen>
      <Card>
        <H2>{t('common:language')}</H2>
        <Choice value={lang} onChange={(l: Lang) => setLang(l)} options={LANGUAGES.map((l) => ({ value: l, label: t(`common:languages.${l}`) }))} />
      </Card>
      <P muted>{t('common:disclaimerPrivate')}</P>
    </Screen>
  );
}
