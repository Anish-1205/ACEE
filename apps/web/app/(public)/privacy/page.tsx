import type { Metadata } from 'next';
import { CmsDoc } from '@/components/cms-doc';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return <CmsDoc cmsKey="privacy" titleKey="navigation:privacy" />;
}
