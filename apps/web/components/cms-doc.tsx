import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { getCms, type Localized } from '@/lib/cms';

/** Server-rendered page for an admin-editable `{ body: {en,te,hi} }` CMS block. */
export async function CmsDoc({ cmsKey, titleKey, children }: { cmsKey: string; titleKey: string; children?: React.ReactNode }) {
  const { t, lang } = await getT();
  const doc = await getCms<{ body: Localized }>(cmsKey);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{t(titleKey)}</h1>
      <p className="mt-6 whitespace-pre-line text-lg leading-relaxed">{doc ? pickLocalized(doc.content.body, lang) : ''}</p>
      {children}
    </article>
  );
}
