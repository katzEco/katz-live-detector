# TikTok Live Detector API (PostgreSQL + Redis + n8n)

Real-time TikTok Live status detector built with **Bun**, **Hono**, **PostgreSQL** (port `5431`), and **Redis** (port `6380`). Dispatches webhooks to your **n8n** webhook endpoint whenever a creator goes live or ends a stream.

---

## ⚡ Quick Start

### 1. Install & Run
```bash
bun install
bun run dev
```

Server starts at `http://localhost:3030`. Open URL in your browser for the built-in UI Dashboard.

### 2. Environment Variables (.env)
```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3030` | Server listening port |
| `DATABASE_URL` | `postgres://dethz:dethz198@localhost:5431/app` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6380` | Redis connection string |
| `N8N_DEFAULT_WEBHOOK_URL` | `""` | Default n8n webhook URL |
| `CHECK_INTERVAL_SECONDS` | `60` | Default poll interval in seconds (min 10) |
| `INITIAL_USERNAMES` | `""` | Comma-separated usernames to seed on startup |
| `API_KEY` | `""` | Optional secret to protect `/api/*` endpoints |
| `WEBHOOK_SECRET` | `""` | Optional token sent in `X-Webhook-Secret` header |

---

## 🚀 Architecture (Ponytail Ultra)

- **PostgreSQL (`5431`)**: Stores monitors and webhook delivery logs using native `Bun.SQL` (zero npm dependencies).
- **Redis (`6380`)**: In-memory status caching (30s TTL, 1ms latency) and distributed locks using native `Bun.RedisClient`.
- **TikTok Detection**: Dual-engine detection with `tiktok-live-connector` + native HTML scraper fallback.
- **n8n Webhook Dispatcher**: Delivers `live_started` and `live_ended` event payloads with automatic retry.

---

## 🔗 n8n Webhook Payloads

#### Event: `live_started`
```json
{
  "event": "live_started",
  "username": "creator_name",
  "isLive": true,
  "timestamp": "2026-10-24T15:30:00.000Z",
  "room": {
    "roomId": "7693676830666705678",
    "title": "Playing Games with Chat!",
    "coverUrl": "https://p16-webcast.tiktokcdn.com/...",
    "userCount": 450,
    "liveUrl": "https://www.tiktok.com/@creator_name/live",
    "startedAt": 1791323812
  }
}
```

#### Event: `live_ended`
```json
{
  "event": "live_ended",
  "username": "creator_name",
  "isLive": false,
  "timestamp": "2026-10-24T17:00:00.000Z"
}
```

---

## 📡 Essential cURL Commands

```bash
# Register creator to monitor
curl -X POST http://localhost:3030/api/monitors \
  -H "Content-Type: application/json" \
  -d '{"username": "tiktok", "webhookUrl": "https://n8n.yourdomain.com/webhook/tiktok-live", "intervalSeconds": 60}'

# Check creator live status (cached in Redis for 30s)
curl http://localhost:3030/api/check/tiktok

# Test n8n webhook connection
curl -X POST http://localhost:3030/api/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://n8n.yourdomain.com/webhook/tiktok-live"}'
```
