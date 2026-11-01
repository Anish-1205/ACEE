import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Devanagari, Noto_Sans_Telugu, Open_Sans, Poppins } from 'next/font/google';
import { LOCALE_TAG } from '@acee/i18n';
import { Providers } from '@/components/providers';
import { getLang } from '@/lib/i18n-server';
import './globals.css';

// Same fonts as the main ACEE site (Poppins headings, Open Sans text); Noto covers Telugu/Hindi. All SIL OFL 1.1.
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' });
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
export const viewport: Viewport = { themeColor: '#003A66', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={LOCALE_TAG[lang]} className={`${openSans.variable} ${poppins.variable} ${notoTe.variable} ${notoHi.variable}`}>
      <body className="font-sans">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
