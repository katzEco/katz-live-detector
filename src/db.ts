// ponytail: native Bun.SQL for Postgres, zero ORM/npm dependencies
import { SQL } from 'bun';
import { config } from './config';
import type { MonitorRecord, WebhookLogRecord } from './types';

export const sql = new SQL(config.databaseUrl);

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS monitors (
      username TEXT PRIMARY KEY,
      webhook_url TEXT NOT NULL,
      interval_seconds INT NOT NULL DEFAULT 60,
      enabled INT NOT NULL DEFAULT 1,
      is_live INT NOT NULL DEFAULT 0,
      last_checked_at TIMESTAMPTZ,
      last_status_change_at TIMESTAMPTZ,
      last_room_id TEXT,
      last_room_title TEXT,
      last_room_cover TEXT,
      error_count INT NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      event TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      payload JSONB NOT NULL,
      status_code INT,
      response_body TEXT,
      error TEXT,
      delivered_at TIMESTAMPTZ NOT NULL
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_monitors_enabled ON monitors(enabled);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_webhook_logs_delivered_at ON webhook_logs(delivered_at DESC);`;
}

export const dbService = {
  async getAllMonitors(): Promise<MonitorRecord[]> {
    const rows = await sql`SELECT * FROM monitors ORDER BY updated_at DESC`;
    return rows as unknown as MonitorRecord[];
  },

  async getActiveMonitors(): Promise<MonitorRecord[]> {
    const rows = await sql`SELECT * FROM monitors WHERE enabled = 1`;
    return rows as unknown as MonitorRecord[];
  },

  async getMonitor(username: string): Promise<MonitorRecord | null> {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    const rows = await sql`SELECT * FROM monitors WHERE username = ${clean} LIMIT 1`;
    return (rows[0] as unknown as MonitorRecord) || null;
  },

  async upsertMonitor(params: {
    username: string;
    webhookUrl?: string;
    intervalSeconds?: number;
    enabled?: boolean;
  }): Promise<MonitorRecord> {
    const username = params.username.replace(/^@/, '').toLowerCase().trim();
    const webhookUrl = params.webhookUrl?.trim() || config.defaultWebhookUrl;
    const intervalSeconds = Math.max(10, params.intervalSeconds ?? config.defaultIntervalSeconds);
    const enabled = params.enabled ?? true ? 1 : 0;
    const now = new Date().toISOString();

    const rows = await sql`
      INSERT INTO monitors (
        username, webhook_url, interval_seconds, enabled, is_live, created_at, updated_at
      ) VALUES (
        ${username}, ${webhookUrl}, ${intervalSeconds}, ${enabled}, 0, ${now}, ${now}
      )
      ON CONFLICT (username) DO UPDATE SET
        webhook_url = EXCLUDED.webhook_url,
        interval_seconds = EXCLUDED.interval_seconds,
        enabled = EXCLUDED.enabled,
        updated_at = EXCLUDED.updated_at
      RETURNING *;
    `;

    return rows[0] as unknown as MonitorRecord;
  },

  async updateMonitorStatus(params: {
    username: string;
    isLive: boolean;
    roomId?: string;
    title?: string;
    coverUrl?: string;
    error?: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    const current = await this.getMonitor(params.username);
    if (!current) return;

    const statusChanged = current.is_live !== (params.isLive ? 1 : 0);
    const lastStatusChangeAt = statusChanged ? now : current.last_status_change_at;

    if (params.error) {
      await sql`
        UPDATE monitors 
        SET last_checked_at = ${now},
            error_count = error_count + 1,
            last_error = ${params.error},
            updated_at = ${now}
        WHERE username = ${current.username}
      `;
    } else {
      const isLiveVal = params.isLive ? 1 : 0;
      await sql`
        UPDATE monitors 
        SET is_live = ${isLiveVal}, 
            last_checked_at = ${now},
            last_status_change_at = ${lastStatusChangeAt},
            last_room_id = COALESCE(${params.roomId || null}, last_room_id),
            last_room_title = COALESCE(${params.title || null}, last_room_title),
            last_room_cover = COALESCE(${params.coverUrl || null}, last_room_cover),
            error_count = 0,
            last_error = NULL,
            updated_at = ${now}
        WHERE username = ${current.username}
      `;
    }
  },

  async deleteMonitor(username: string): Promise<boolean> {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    const rows = await sql`DELETE FROM monitors WHERE username = ${clean} RETURNING username`;
    return rows.length > 0;
  },

  async logWebhookDelivery(params: {
    username: string;
    event: 'live_started' | 'live_ended' | 'test_ping';
    webhookUrl: string;
    payload: Record<string, unknown>;
    statusCode?: number;
    responseBody?: string;
    error?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(params.payload);
    const respBody = params.responseBody ? params.responseBody.slice(0, 500) : null;

    await sql`
      INSERT INTO webhook_logs (
        username, event, webhook_url, payload, status_code, response_body, error, delivered_at
      ) VALUES (
        ${params.username},
        ${params.event},
        ${params.webhookUrl},
        ${payloadJson}::jsonb,
        ${params.statusCode ?? null},
        ${respBody},
        ${params.error ?? null},
        ${now}
      )
    `;
  },

  async getRecentLogs(limit = 50): Promise<WebhookLogRecord[]> {
    const rows = await sql`
      SELECT * FROM webhook_logs 
      ORDER BY delivered_at DESC 
      LIMIT ${limit}
    `;
    return rows as unknown as WebhookLogRecord[];
  },
};
