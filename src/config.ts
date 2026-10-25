// ponytail: standard env config, no unrequested parsing libraries
export const config = {
  port: Number(process.env.PORT || 3030),
  databaseUrl: process.env.DATABASE_URL || 'postgres://dethz:dethz198@localhost:5431/app',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  defaultWebhookUrl: process.env.N8N_DEFAULT_WEBHOOK_URL || '',
  defaultIntervalSeconds: Math.max(10, Number(process.env.CHECK_INTERVAL_SECONDS || 60)),
  apiKey: process.env.API_KEY || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  webhookMethod: (process.env.WEBHOOK_METHOD || 'GET').toUpperCase() as 'GET' | 'POST',
  initialUsernames: (process.env.INITIAL_USERNAMES || '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean),
};
