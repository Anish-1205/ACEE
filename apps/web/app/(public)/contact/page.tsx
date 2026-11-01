import type { Metadata } from 'next';
import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { getCms, type Company } from '@/lib/cms';
import { InquiryForm } from './inquiry-form';

export const metadata: Metadata = { title: 'Contact ACEE', alternates: { canonical: '/contact' } };

export default async function ContactPage() {
  const { t, lang } = await getT();
  const company = await getCms<Company>('company');
  const c = company?.content;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
      <div>
        <h1 className="text-3xl font-extrabold text-navy">{t('common:contactPage.title')}</h1>
        {c && (
          <address className="mt-6 space-y-3 not-italic">
            <p className="font-semibold">{c.name}</p>
            <p>{pickLocalized(c.address, lang)}</p>
            <p>{t('common:hours')}: {pickLocalized(c.hours, lang)}</p>
            <div className="flex flex-wrap gap-2">
              {c.phones.map((p) => <a key={p} href={`tel:+91${p}`} className="inline-flex min-h-11 items-center rounded-xl bg-royal px-4 text-sm font-bold text-white">📞 {p}</a>)}
            </div>
            <p><a href={c.website} className="text-royal underline" target="_blank" rel="noopener noreferrer">{c.website}</a></p>
            {!company.confirmed && <p className="text-xs text-warning">{t('common:unconfirmedDetails')}</p>}
          </address>
        )}
      </div>
      <InquiryForm />
    </div>
  );
}
