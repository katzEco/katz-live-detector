export interface TikTokRoomDetails {
  roomId?: string;
  title?: string;
  coverUrl?: string;
  userCount?: number;
  totalUser?: number;
  streamUrl?: string;
  hlsUrl?: string;
  startedAt?: number;
  owner?: {
    id?: string;
    nickname?: string;
    avatar?: string;
  };
}

export interface TikTokCheckResult {
  username: string;
  isLive: boolean;
  statusCode?: number;
  source: 'connector' | 'direct_scrape' | 'error';
  room?: TikTokRoomDetails;
  error?: string;
  checkedAt: string;
}

export interface MonitorRecord {
  username: string;
  webhook_url: string;
  interval_seconds: number;
  enabled: number;
  is_live: number;
  last_checked_at: string | null;
  last_status_change_at: string | null;
  last_room_id: string | null;
  last_room_title: string | null;
  last_room_cover: string | null;
  error_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLogRecord {
  id: number;
  username: string;
  event: 'live_started' | 'live_ended' | 'test_ping';
  webhook_url: string;
  payload: string;
  status_code: number | null;
  response_body: string | null;
  error: string | null;
  delivered_at: string;
}
