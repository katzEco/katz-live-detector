import { Hono } from 'hono';
import { dbService } from '../db';

export const logsRoute = new Hono();

logsRoute.get('/', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10))) : 50;
  const logs = await dbService.getRecentLogs(limit);

  return c.json({
    success: true,
    count: logs.length,
    data: logs,
  });
});
