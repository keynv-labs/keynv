import type { MetadataRoute } from 'next';

const SITE = 'https://keynv.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register'],
        disallow: ['/projects', '/audit', '/settings', '/admin', '/api/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
