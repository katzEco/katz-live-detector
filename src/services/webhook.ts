import { config } from '../config';
import { dbService } from '../db';
import type { TikTokRoomDetails } from '../types';

export interface WebhookPayload {
  event: 'live_started' | 'live_ended' | 'test_ping';
  username: string;
  isLive: boolean;
  timestamp: string;
  room?: TikTokRoomDetails & { liveUrl: string };
  meta?: Record<string, unknown>;
}

export class WebhookService {
  /**
   * Dispatch webhook to n8n endpoint with retry (defaults to GET)
   */
  public async dispatch(params: {
    webhookUrl: string;
    username: string;
    event: 'live_started' | 'live_ended' | 'test_ping';
    isLive: boolean;
    room?: TikTokRoomDetails;
    meta?: Record<string, unknown>;
    method?: 'GET' | 'POST';
  }): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const { webhookUrl, username, event, isLive, room, meta } = params;
    const method = params.method || config.webhookMethod || 'GET';

    if (!webhookUrl) {
      const err = 'No webhook URL provided';
      console.warn(`[webhook] failed for ${username}: ${err}`);
      return { success: false, error: err };
    }

    const payload: WebhookPayload = {
      event,
      username,
      isLive,
      timestamp: new Date().toISOString(),
      ...(room
        ? {
            room: {
              ...room,
              liveUrl: `https://www.tiktok.com/@${username}/live`,
            },
          }
        : {}),
      ...(meta ? { meta } : {}),
    };

    const headers: Record<string, string> = {
      'User-Agent': 'katz-tiktok-live-detector/1.0',
    };

    if (config.webhookSecret) {
      headers['X-Webhook-Secret'] = config.webhookSecret;
    }

    // ponytail: pure ping on GET without any query params
    const requestUrl = webhookUrl;
    let requestBody: string | undefined;

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(payload);
    }

    let lastError: string | undefined;
    let statusCode: number | undefined;
    let responseBody = '';

    // Attempt up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(requestUrl, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        statusCode = res.status;
        responseBody = await res.text();

        if (res.ok) {
          await dbService.logWebhookDelivery({
            username,
            event,
            webhookUrl,
            payload: payload as unknown as Record<string, unknown>,
            statusCode,
            responseBody,
          });

          console.log(`[webhook] ${method} delivered ${event} for @${username} to ${webhookUrl} (status ${statusCode})`);
          return { success: true, statusCode };
        }

        lastError = `HTTP ${res.status}: ${responseBody.slice(0, 200)}`;
      } catch (err: any) {
        lastError = err.message || 'Network error';
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    await dbService.logWebhookDelivery({
      username,
      event,
      webhookUrl,
      payload: payload as unknown as Record<string, unknown>,
      statusCode,
      responseBody,
      error: lastError,
    });

    console.error(`[webhook] ${method} delivery failed for @${username} (${event}): ${lastError}`);
    return { success: false, statusCode, error: lastError };
  }
}

export const webhookService = new WebhookService();
