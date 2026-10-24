// ponytail: native Bun.RedisClient, zero npm dependencies
import { config } from './config';
import type { TikTokCheckResult } from './types';

export const redis = new Bun.RedisClient(config.redisUrl);

export const redisService = {
  async getCachedStatus(username: string): Promise<TikTokCheckResult | null> {
    const raw = await redis.get(`tiktok:status:${username}`);
    return raw ? JSON.parse(raw) : null;
  },

  async setCachedStatus(username: string, result: TikTokCheckResult, ttlSeconds = 30): Promise<void> {
    await redis.set(`tiktok:status:${username}`, JSON.stringify(result), 'EX', String(ttlSeconds));
  },

  async acquireLock(username: string, ttlSeconds = 15): Promise<boolean> {
    const res = await redis.set(`tiktok:lock:${username}`, '1', 'EX', String(ttlSeconds), 'NX');
    return res === 'OK';
  },

  async releaseLock(username: string): Promise<void> {
    await redis.del(`tiktok:lock:${username}`);
  },
};
