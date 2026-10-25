import { Hono } from 'hono';
import { webhookService } from '../services/webhook';
import { config } from '../config';

export const webhookRoute = new Hono();

// POST or GET /api/test-webhook - Test n8n webhook connection with GET ping
webhookRoute.all('/', async (c) => {
  let webhookUrl = '';
  let username = 'test_creator';
  let method: 'GET' | 'POST' = config.webhookMethod;

  if (c.req.method === 'POST') {
    const body = await c.req.json().catch(() => ({}));
    webhookUrl = body.webhookUrl ? String(body.webhookUrl) : config.defaultWebhookUrl;
    username = body.username ? String(body.username) : 'test_creator';
    if (body.method) method = String(body.method).toUpperCase() as 'GET' | 'POST';
  } else {
    webhookUrl = c.req.query('webhookUrl') || config.defaultWebhookUrl;
    username = c.req.query('username') || 'test_creator';
    if (c.req.query('method')) method = c.req.query('method')!.toUpperCase() as 'GET' | 'POST';
  }

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
    method,
    meta: {
      message: 'TikTok Live Detector test ping to n8n successful!',
      n8nCompatible: true,
      sender: 'katz-live-detector',
    },
  });

  return c.json(
    {
      success: result.success,
      statusCode: result.statusCode,
      method,
      error: result.error,
      testedWebhookUrl: webhookUrl,
    },
    result.success ? 200 : 502
  );
});
