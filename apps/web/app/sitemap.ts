import { listAllPages } from '@/lib/docs';
import type { MetadataRoute } from 'next';

const SITE = 'https://keynv.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const docs: MetadataRoute.Sitemap = listAllPages().map((p) => ({
    url: `${SITE}/docs/${p.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...docs,
  ];
}
