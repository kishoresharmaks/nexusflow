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
  shopify: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    scopes: string;
    apiVersion: string;
    frontendUrl: string;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
  email: {
    provider: string;
    from: string;
    apiKey: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
    msg91: {
      authKey: string;
      domain: string;
    };
    brevo: {
      apiKey: string;
    };
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
    clientId:
      process.env['META_APP_ID'] ||
      process.env['META_CLIENT_ID'] ||
      process.env['INSTAGRAM_CLIENT_ID'] ||
      '',
    clientSecret:
      process.env['META_APP_SECRET'] ||
      process.env['META_CLIENT_SECRET'] ||
      process.env['INSTAGRAM_CLIENT_SECRET'] ||
      '',
    callbackUrl:
      process.env['INSTAGRAM_CALLBACK_URL'] ||
      process.env['META_REDIRECT_URI'] ||
      'http://localhost:4000/api/integrations/instagram/callback',
    graphApiVersion: process.env['META_GRAPH_API_VERSION'] || 'v21.0',
    frontendUrl:
      process.env['FRONTEND_URL'] || process.env['WEB_URL'] || 'http://localhost:3000',
  },
  shopify: {
    clientId: process.env['SHOPIFY_CLIENT_ID'] || '',
    clientSecret: process.env['SHOPIFY_CLIENT_SECRET'] || '',
    callbackUrl:
      process.env['SHOPIFY_REDIRECT_URI'] ||
      process.env['SHOPIFY_CALLBACK_URL'] ||
      'http://localhost:3000/api/auth/shopify/callback',
    scopes: process.env['SHOPIFY_SCOPES'] || 'read_products,read_inventory',
    apiVersion: process.env['SHOPIFY_API_VERSION'] || '2026-01',
    frontendUrl:
      process.env['FRONTEND_URL'] || process.env['WEB_URL'] || 'http://localhost:3000',
  },
  razorpay: {
    keyId: process.env['RAZORPAY_KEY_ID'] || '',
    keySecret: process.env['RAZORPAY_KEY_SECRET'] || '',
    webhookSecret: process.env['RAZORPAY_WEBHOOK_SECRET'] || '',
  },
  email: {
    provider: (process.env['EMAIL_PROVIDER'] || 'local').toLowerCase(),
    from: process.env['EMAIL_FROM'] || 'NexusFlow <noreply@example.test>',
    apiKey: process.env['EMAIL_API_KEY'] || '',
    smtp: {
      host: process.env['SMTP_HOST'] || '',
      port: parseInt(process.env['SMTP_PORT'] || '587', 10),
      secure: process.env['SMTP_SECURE'] === 'true' || process.env['SMTP_PORT'] === '465',
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
    },
    msg91: {
      authKey: process.env['MSG91_AUTH_KEY'] || '',
      domain: process.env['MSG91_DOMAIN'] || '',
    },
    brevo: {
      apiKey: process.env['BREVO_API_KEY'] || '',
    },
  },
});
