import { Hono } from 'hono';
import { webhookService } from '../services/webhook';
import { config } from '../config';

export const webhookRoute = new Hono();

// POST /api/test-webhook - Test n8n webhook connection
webhookRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const webhookUrl = body.webhookUrl ? String(body.webhookUrl) : config.defaultWebhookUrl;
  const username = body.username ? String(body.username) : 'test_creator';

  if (!webhookUrl) {
    return c.json(
      {
        success: false,
        error: 'Please provide "webhookUrl" or configure N8N_DEFAULT_WEBHOOK_URL',
      },
      400
    );
  }

  const result = await webhookService.dispatch({
    webhookUrl,
    username,
    event: 'test_ping',
    isLive: false,
    meta: {
      message: 'TikTok Live Detector test ping to n8n successful!',
      n8nCompatible: true,
      sender: 'katz-live-detector',
    },
  });

  return c.json({
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
    testedWebhookUrl: webhookUrl,
  }, result.success ? 200 : 502);
});
