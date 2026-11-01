import type { Metadata, Viewport } from 'next';
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Telugu } from 'next/font/google';
import { LOCALE_TAG } from '@acee/i18n';
import { Providers } from '@/components/providers';
import { getLang } from '@/lib/i18n-server';
import './globals.css';

// Noto fonts are licensed under the SIL Open Font License 1.1.
const noto = Noto_Sans({ subsets: ['latin'], variable: '--font-noto', display: 'swap' });
const notoTe = Noto_Sans_Telugu({ subsets: ['telugu'], variable: '--font-noto-telugu', display: 'swap' });
const notoHi = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto-deva', display: 'swap' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'ACEE Global Education — From Our Village to a Global Future', template: '%s | ACEE Global Education' },
  description: 'Free coaching for IELTS, PTE, TOEFL, GRE and GMAT, overseas study counseling and guidance on the Dr. B.R. Ambedkar Overseas Vidya Nidhi scheme for SC & ST students of Telangana. Operated by ACEE Review Consultants Pvt. Ltd.',
  openGraph: { type: 'website', siteName: 'ACEE Global Education', locale: 'en_IN' },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#102E5C', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={LOCALE_TAG[lang]} className={`${noto.variable} ${notoTe.variable} ${notoHi.variable}`}>
      <body className="font-sans">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
