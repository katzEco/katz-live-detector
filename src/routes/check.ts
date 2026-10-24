import { Hono } from 'hono';
import { tiktokDetector } from '../services/tiktok';
import { webhookService } from '../services/webhook';
import { config } from '../config';

export const checkRoute = new Hono();

// GET /api/check/:username - Quick check via GET
checkRoute.get('/:username', async (c) => {
  const username = c.req.param('username');
  const result = await tiktokDetector.checkLiveStatus(username);
  return c.json({
    success: true,
    data: result,
  });
});

// POST /api/check - Comprehensive check with optional webhook dispatch
checkRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = body.username ? String(body.username) : '';

  if (!username) {
    return c.json({ success: false, error: 'Field "username" is required' }, 400);
  }

  const result = await tiktokDetector.checkLiveStatus(username);

  let webhookResult: any = null;
  const sendWebhook = Boolean(body.sendWebhook);
  const webhookUrl = body.webhookUrl ? String(body.webhookUrl) : config.defaultWebhookUrl;

  if (sendWebhook && webhookUrl) {
    webhookResult = await webhookService.dispatch({
      webhookUrl,
      username: result.username,
      event: result.isLive ? 'live_started' : 'live_ended',
      isLive: result.isLive,
      room: result.room,
      meta: { manualAdHocCheck: true },
    });
  }

  return c.json({
    success: true,
    data: result,
    webhook: webhookResult,
  });
});
