import type { Metadata } from 'next';
import { CmsDoc } from '@/components/cms-doc';

export const metadata: Metadata = { title: 'Terms and conditions', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return <CmsDoc cmsKey="terms" titleKey="navigation:terms" />;
}
