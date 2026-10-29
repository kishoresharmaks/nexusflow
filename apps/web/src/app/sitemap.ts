import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://nexusflow.ai';

  return [
    {
      url: `${baseUrl}`,
      lastModified: '2026-10-29',
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/developers`,
      lastModified: '2026-10-29',
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];
}
