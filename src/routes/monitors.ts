import { Hono } from 'hono';
import { dbService } from '../db';
import { monitorScheduler } from '../services/monitor';
import { webhookService } from '../services/webhook';

export const monitorsRoute = new Hono();

// GET /api/monitors - List all monitors
monitorsRoute.get('/', async (c) => {
  const monitors = await dbService.getAllMonitors();
  return c.json({
    success: true,
    count: monitors.length,
    data: monitors,
  });
});

// POST /api/monitors - Register or update monitor
monitorsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = body.username ? String(body.username) : '';

  if (!username) {
    return c.json({ success: false, error: 'Field "username" is required' }, 400);
  }

  const webhookUrl = body.webhookUrl ? String(body.webhookUrl) : undefined;
  const intervalSeconds = body.intervalSeconds ? Number(body.intervalSeconds) : undefined;
  const enabled = body.enabled !== undefined ? Boolean(body.enabled) : true;

  const monitor = await dbService.upsertMonitor({
    username,
    webhookUrl,
    intervalSeconds,
    enabled,
  });

  // Trigger check in background
  monitorScheduler.runCheck(monitor).catch(console.error);

  return c.json(
    {
      success: true,
      message: `Monitor for @${monitor.username} registered successfully`,
      data: monitor,
    },
    201
  );
});

// GET /api/monitors/:username - Get single monitor
monitorsRoute.get('/:username', async (c) => {
  const username = c.req.param('username');
  const monitor = await dbService.getMonitor(username);

  if (!monitor) {
    return c.json({ success: false, error: `Monitor @${username} not found` }, 404);
  }

  return c.json({
    success: true,
    data: monitor,
  });
});

// DELETE /api/monitors/:username - Remove monitor
monitorsRoute.delete('/:username', async (c) => {
  const username = c.req.param('username');
  const deleted = await dbService.deleteMonitor(username);

  if (!deleted) {
    return c.json({ success: false, error: `Monitor @${username} not found` }, 404);
  }

  return c.json({
    success: true,
    message: `Monitor @${username} deleted successfully`,
  });
});

// POST /api/monitors/:username/check - Force check now
monitorsRoute.post('/:username/check', async (c) => {
  const username = c.req.param('username');
  const monitor = await dbService.getMonitor(username);

  if (!monitor) {
    return c.json({ success: false, error: `Monitor @${username} not found` }, 404);
  }

  const forceWebhook = c.req.query('forceWebhook') === 'true';
  const result = await monitorScheduler.runCheck(monitor);

  if (forceWebhook && monitor.webhook_url) {
    await webhookService.dispatch({
      webhookUrl: monitor.webhook_url,
      username: monitor.username,
      event: result.isLive ? 'live_started' : 'live_ended',
      isLive: result.isLive,
      room: result.room,
      meta: { manualTrigger: true },
    });
  }

  const updated = await dbService.getMonitor(username);
  return c.json({
    success: true,
    check: result,
    monitor: updated,
  });
});
