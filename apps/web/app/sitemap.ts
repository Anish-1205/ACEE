import type { MetadataRoute } from 'next';
import { COURSE_CODES } from '@acee/shared';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/scholarships', '/eligibility', '/coaching', '/counseling', '/register', '/login', '/privacy', '/terms'];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 })),
    ...COURSE_CODES.map((c) => ({ url: `${SITE_URL}/coaching/${c.toLowerCase()}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ];
}
