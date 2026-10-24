import { config } from '../config';
import { dbService } from '../db';
import { redisService } from '../redis';
import { tiktokDetector } from './tiktok';
import { webhookService } from './webhook';
import type { MonitorRecord, TikTokCheckResult } from '../types';

export class MonitorSchedulerService {
  private isRunning = false;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.seedInitialMonitors().catch(console.error);

    console.log('[monitor-service] started background monitor daemon (Postgres + Redis)');

    // Run tick every 5 seconds
    this.intervalTimer = setInterval(() => {
      this.tick().catch((err) => console.error('[monitor-service] tick error:', err));
    }, 5000);

    this.tick().catch((err) => console.error('[monitor-service] initial tick error:', err));
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[monitor-service] stopped background monitor daemon');
  }

  private async seedInitialMonitors() {
    if (config.initialUsernames.length === 0) return;
    for (const username of config.initialUsernames) {
      const existing = await dbService.getMonitor(username);
      if (!existing) {
        await dbService.upsertMonitor({
          username,
          webhookUrl: config.defaultWebhookUrl,
          intervalSeconds: config.defaultIntervalSeconds,
          enabled: true,
        });
        console.log(`[monitor-service] auto-seeded monitor: @${username}`);
      }
    }
  }

  private async tick() {
    const monitors = await dbService.getActiveMonitors();
    const now = Date.now();

    for (const monitor of monitors) {
      const lastChecked = monitor.last_checked_at ? new Date(monitor.last_checked_at).getTime() : 0;
      const intervalMs = monitor.interval_seconds * 1000;

      if (now - lastChecked >= intervalMs) {
        this.runCheck(monitor).catch((err) => {
          console.error(`[monitor-service] error checking @${monitor.username}:`, err);
        });
      }
    }
  }

  public async runCheck(monitor: MonitorRecord): Promise<TikTokCheckResult> {
    const username = monitor.username;

    // ponytail: redis distributed lock prevents duplicate concurrent checks
    const acquired = await redisService.acquireLock(username, 15);
    if (!acquired) {
      return {
        username,
        isLive: monitor.is_live === 1,
        source: 'error',
        error: 'Check already in progress',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      // Skip cache during scheduled tick to get fresh TikTok status
      const result = await tiktokDetector.checkLiveStatus(username, true);
      const wasLive = monitor.is_live === 1;
      const isLiveNow = result.isLive;

      await dbService.updateMonitorStatus({
        username,
        isLive: isLiveNow,
        roomId: result.room?.roomId,
        title: result.room?.title,
        coverUrl: result.room?.coverUrl,
        error: result.error || null,
      });

      // State Transition: Offline -> Live
      if (!wasLive && isLiveNow) {
        console.log(`[monitor-service] 🔴 @${username} went LIVE! Triggering live_started webhook...`);
        await webhookService.dispatch({
          webhookUrl: monitor.webhook_url,
          username,
          event: 'live_started',
          isLive: true,
          room: result.room,
          meta: {
            previousState: 'offline',
            detectedAt: result.checkedAt,
          },
        });
      }

      // State Transition: Live -> Offline
      if (wasLive && !isLiveNow) {
        console.log(`[monitor-service] ⚪ @${username} ended stream. Triggering live_ended webhook...`);
        await webhookService.dispatch({
          webhookUrl: monitor.webhook_url,
          username,
          event: 'live_ended',
          isLive: false,
          room: monitor.last_room_id
            ? {
                roomId: monitor.last_room_id,
                title: monitor.last_room_title || undefined,
                coverUrl: monitor.last_room_cover || undefined,
              }
            : undefined,
          meta: {
            previousState: 'live',
            lastRoomId: monitor.last_room_id,
            streamEndedAt: result.checkedAt,
          },
        });
      }

      return result;
    } finally {
      await redisService.releaseLock(username);
    }
  }
}

export const monitorScheduler = new MonitorSchedulerService();
