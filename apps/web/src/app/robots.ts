import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://nexusflow.ai';

  // Common sensitive and token-flow paths that must not be crawled by any user agent
  const privateDisallows = [
    '/api/',
    '/super-admin/',
    '/settings/',
    '/verify-email',
    '/activate-account',
    '/ownership-transfers/',
    '/invitations/',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privateDisallows,
      },
      {
        // LLM training and search crawlers + user-triggered search agents
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-User',
          'PerplexityBot',
          'Perplexity-User',
          'OAI-SearchBot',
          'Google-Extended',
          'Applebot-Extended',
          'CCBot',
        ],
        allow: ['/', '/llms.txt'],
        disallow: privateDisallows,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
