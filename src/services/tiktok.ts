import { TikTokLiveConnection } from 'tiktok-live-connector';
import { redisService } from '../redis';
import type { TikTokCheckResult, TikTokRoomDetails } from '../types';

export class TikTokDetectorService {
  private static userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  public static normalizeUsername(raw: string): string {
    return raw.replace(/^@/, '').toLowerCase().trim();
  }

  /**
   * Check if creator is live (with Redis caching)
   */
  public async checkLiveStatus(username: string, skipCache = false): Promise<TikTokCheckResult> {
    const cleanUsername = TikTokDetectorService.normalizeUsername(username);
    const checkedAt = new Date().toISOString();

    if (!cleanUsername) {
      return {
        username: cleanUsername,
        isLive: false,
        source: 'error',
        error: 'Empty username provided',
        checkedAt,
      };
    }

    // ponytail: check redis cache before scraping
    if (!skipCache) {
      try {
        const cached = await redisService.getCachedStatus(cleanUsername);
        if (cached) return cached;
      } catch (err) {
        console.warn(`[tiktok-detector] redis cache read error:`, err);
      }
    }

    let result: TikTokCheckResult | null = null;

    // Attempt 1: TikTokLiveConnection
    try {
      const conn = new TikTokLiveConnection(cleanUsername, {});
      const isLive = await Promise.race([
        conn.fetchIsLive(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Connector timeout')), 8000)
        ),
      ]);

      let roomDetails: TikTokRoomDetails | undefined;
      if (isLive) {
        try {
          const roomInfo = (await Promise.race([
            conn.fetchRoomInfo(),
            new Promise<any>((_, reject) =>
              setTimeout(() => reject(new Error('fetchRoomInfo timeout')), 5000)
            ),
          ])) as any;

          const data = roomInfo?.data;
          if (data) {
            roomDetails = {
              roomId: String(data.id_str || data.id || ''),
              title: data.title || '',
              coverUrl: data.cover?.url_list?.[0] || '',
              userCount: data.stats?.user_count || 0,
              totalUser: data.stats?.total_user || 0,
              hlsUrl: data.stream_url?.hls_pull_url || '',
              streamUrl: data.stream_url?.rtmp_pull_url || '',
              startedAt: data.create_time || data.start_time || undefined,
              owner: {
                id: String(data.owner?.id_str || data.owner?.id || ''),
                nickname: data.owner?.nickname || '',
                avatar: data.owner?.avatar_thumb?.url_list?.[0] || '',
              },
            };
          }
        } catch (roomErr) {
          console.warn(`[tiktok-detector] could not fetch extra room info for ${cleanUsername}:`, roomErr);
        }
      }

      result = {
        username: cleanUsername,
        isLive,
        source: 'connector',
        room: roomDetails,
        checkedAt,
      };
    } catch (connectorErr: any) {
      console.warn(`[tiktok-detector] connector failed for ${cleanUsername}: ${connectorErr.message}. Trying direct scrape...`);
    }

    // Attempt 2: Direct scrape fallback
    if (!result) {
      try {
        const scrapeResult = await this.scrapeDirectLive(cleanUsername);
        result = {
          username: cleanUsername,
          isLive: scrapeResult.isLive,
          statusCode: scrapeResult.statusCode,
          source: 'direct_scrape',
          room: scrapeResult.room,
          checkedAt,
        };
      } catch (scrapeErr: any) {
        result = {
          username: cleanUsername,
          isLive: false,
          source: 'error',
          error: scrapeErr.message || 'Failed all live detection methods',
          checkedAt,
        };
      }
    }

    // ponytail: cache result in redis (30s ttl)
    if (result && result.source !== 'error') {
      try {
        await redisService.setCachedStatus(cleanUsername, result, 30);
      } catch (err) {
        console.warn(`[tiktok-detector] redis cache write error:`, err);
      }
    }

    return result;
  }

  private async scrapeDirectLive(username: string): Promise<{
    isLive: boolean;
    statusCode?: number;
    room?: TikTokRoomDetails;
  }> {
    const targetUrl = `https://www.tiktok.com/@${username}/live`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': TikTokDetectorService.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok) {
        throw new Error(`TikTok HTTP ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();

      const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
      if (sigiMatch) {
        try {
          const parsed = JSON.parse(sigiMatch[1]);
          const liveRoom = parsed?.LiveRoom?.liveRoomUserInfo?.liveRoom;
          if (liveRoom) {
            const isLive = liveRoom.status === 2;
            let streamDataObj: any = {};
            if (typeof liveRoom.streamData?.pull_data?.stream_data === 'string') {
              try {
                streamDataObj = JSON.parse(liveRoom.streamData.pull_data.stream_data);
              } catch {}
            }

            return {
              isLive,
              statusCode: liveRoom.status,
              room: {
                roomId: String(streamDataObj?.common?.room_id || ''),
                title: liveRoom.title || '',
                coverUrl: liveRoom.coverUrl || '',
                userCount: liveRoom.liveRoomStats?.userCount || 0,
                startedAt: liveRoom.startTime || undefined,
              },
            };
          }
        } catch {}
      }

      const statusRegex = /"status":\s*([0-9]+)/;
      const match = html.match(statusRegex);
      if (match) {
        const code = parseInt(match[1], 10);
        return {
          isLive: code === 2,
          statusCode: code,
        };
      }

      return {
        isLive: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const tiktokDetector = new TikTokDetectorService();
