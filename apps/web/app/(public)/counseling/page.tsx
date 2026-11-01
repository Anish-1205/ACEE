import type { Metadata } from 'next';
import Link from 'next/link';
import { APPOINTMENT_TYPES, MAIN_SITE } from '@acee/shared';
import { getT } from '@/lib/i18n-server';

export const metadata: Metadata = { title: 'Book free counseling', alternates: { canonical: '/counseling' } };

export default async function CounselingInfoPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{t('counseling:title')}</h1>
      <p className="mt-2 text-muted">{t('counseling:subtitle')}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {APPOINTMENT_TYPES.map((k) => <li key={k} className="rounded-card border border-line bg-white p-5 font-semibold text-navy">💬 {t(`counseling:types.${k}`)}</li>)}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login?next=/dashboard/counseling" className="inline-flex min-h-12 items-center rounded-[10px] bg-crimson px-5 font-heading text-sm font-medium text-white">{t('counseling:loginToBook')}</Link>
        <Link href="/register" className="inline-flex min-h-12 items-center rounded-xl border border-line px-5 text-sm font-bold text-navy">{t('authentication:createAccount')}</Link>
        <Link href={MAIN_SITE.contact} className="inline-flex min-h-12 items-center rounded-xl px-5 text-sm font-bold text-royal underline">{t('navigation:contact')}</Link>
      </div>
    </div>
  );
}
