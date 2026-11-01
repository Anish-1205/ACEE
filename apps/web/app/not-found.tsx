import Link from 'next/link';
import { getT } from '@/lib/i18n-server';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-black text-royal">404</p>
      <h1 className="text-xl font-bold text-navy">{t('common:notFound')}</h1>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-royal px-4 text-sm font-bold text-white">{t('common:goHome')}</Link>
    </main>
  );
}
