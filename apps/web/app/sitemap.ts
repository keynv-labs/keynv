import type { MetadataRoute } from 'next';

const SITE = 'https://keynv.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
