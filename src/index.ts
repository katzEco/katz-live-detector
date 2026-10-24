import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config';
import { dbService, initDb, sql } from './db';
import { redis } from './redis';
import { monitorScheduler } from './services/monitor';
import { monitorsRoute } from './routes/monitors';
import { checkRoute } from './routes/check';
import { webhookRoute } from './routes/webhook';
import { logsRoute } from './routes/logs';
import { renderDashboardHtml } from './views/dashboard';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Optional API Key Authentication
app.use('/api/*', async (c, next) => {
  if (config.apiKey) {
    const authHeader = c.req.header('Authorization');
    const customHeader = c.req.header('X-API-Key');
    const token = customHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (token !== config.apiKey) {
      return c.json({ success: false, error: 'Unauthorized: invalid API key' }, 401);
    }
  }
  await next();
});

// Web UI Dashboard
app.get('/', async (c) => {
  return c.html(await renderDashboardHtml());
});

// System Status & Health
app.get('/api/status', async (c) => {
  const monitors = await dbService.getAllMonitors();
  return c.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    database: 'postgresql',
    cache: 'redis',
    activeMonitors: monitors.filter((m) => m.enabled === 1).length,
    totalMonitors: monitors.length,
    defaultIntervalSeconds: config.defaultIntervalSeconds,
    defaultWebhookConfigured: Boolean(config.defaultWebhookUrl),
  });
});

// Mount Routes
app.route('/api/monitors', monitorsRoute);
app.route('/api/check', checkRoute);
app.route('/api/test-webhook', webhookRoute);
app.route('/api/logs', logsRoute);

// Initialize DB schema & start background monitor daemon
await initDb();
monitorScheduler.start();

// Graceful shutdown
async function shutdown() {
  monitorScheduler.stop();
  try {
    redis.close();
    await sql.close();
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default {
  port: config.port,
  fetch: app.fetch,
};
