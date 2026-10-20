export interface AppConfig {
  nodeEnv: string;
  port: number;
  webUrl: string;
  corsOrigins: string[];
  databaseUrl: string;
  redisUrl: string;
  linkedin: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    frontendUrl: string;
  };
  instagram: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    graphApiVersion: string;
    frontendUrl: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '4000', 10),
  webUrl: process.env['WEB_URL'] || 'http://localhost:3000',
  corsOrigins: (process.env['CORS_ORIGINS'] || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim()),
  databaseUrl: process.env['DATABASE_URL'] || '',
  redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
  linkedin: {
    clientId: process.env['LINKEDIN_CLIENT_ID'] || '',
    clientSecret: process.env['LINKEDIN_CLIENT_SECRET'] || '',
    callbackUrl:
      process.env['LINKEDIN_CALLBACK_URL'] ||
      'http://localhost:4000/api/integrations/linkedin/callback',
    frontendUrl:
      process.env['FRONTEND_URL'] || process.env['WEB_URL'] || 'http://localhost:3000',
  },
  instagram: {
    clientId: process.env['META_APP_ID'] || process.env['INSTAGRAM_CLIENT_ID'] || '',
    clientSecret:
      process.env['META_APP_SECRET'] || process.env['INSTAGRAM_CLIENT_SECRET'] || '',
    callbackUrl:
      process.env['INSTAGRAM_CALLBACK_URL'] ||
      'http://localhost:4000/api/integrations/instagram/callback',
    graphApiVersion: process.env['META_GRAPH_API_VERSION'] || 'v19.0',
    frontendUrl:
      process.env['FRONTEND_URL'] || process.env['WEB_URL'] || 'http://localhost:3000',
  },
});
