import { dbService } from '../db';
import { config } from '../config';

export async function renderDashboardHtml(): Promise<string> {
  const monitors = await dbService.getAllMonitors();
  const logs = await dbService.getRecentLogs(10);
  const activeCount = monitors.filter((m) => m.enabled === 1).length;
  const liveCount = monitors.filter((m) => m.is_live === 1).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Live Detector -> n8n Webhook</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #fe2c55;
      --primary-hover: #e02449;
      --accent: #25f4ee;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --code-bg: #090d16;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 2rem 1rem; max-width: 1100px; margin: 0 auto; line-height: 1.5; }
    h1, h2, h3 { font-weight: 700; color: #fff; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
    .badge-bar { display: flex; gap: 1rem; }
    .stat-badge { background: var(--card-bg); border: 1px solid var(--border); padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; }
    .stat-badge strong { color: var(--accent); }
    .live-badge { display: inline-flex; align-items: center; gap: 0.35rem; font-weight: bold; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; text-transform: uppercase; }
    .live-badge.live { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .live-badge.offline { background: rgba(148, 163, 184, 0.2); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.3); }
    .pulse-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

    .grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
    @media(min-width: 768px) { .grid { grid-template-columns: 1.2fr 0.8fr; } }
    
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }

    form label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem; margin-top: 0.8rem; }
    form label:first-of-type { margin-top: 0; }
    input, select { width: 100%; padding: 0.65rem 0.8rem; background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.9rem; }
    input:focus { outline: none; border-color: var(--accent); }
    .btn { background: var(--primary); color: #fff; border: none; padding: 0.65rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; font-size: 0.9rem; }
    .btn:hover { background: var(--primary-hover); }
    .btn-secondary { background: #334155; }
    .btn-secondary:hover { background: #475569; }
    .btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }

    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    .actions { display: flex; gap: 0.4rem; }

    code, pre { background: var(--code-bg); border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    code { padding: 0.2rem 0.4rem; font-size: 0.85rem; color: var(--accent); }
    pre { padding: 1rem; overflow-x: auto; font-size: 0.82rem; color: #e2e8f0; border: 1px solid var(--border); }
    .log-event { font-weight: bold; font-size: 0.8rem; padding: 0.15rem 0.4rem; border-radius: 4px; }
    .log-live_started { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .log-live_ended { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
    .log-test_ping { background: rgba(16, 185, 129, 0.2); color: #34d399; }
  </style>
</head>
<body>

  <header>
    <div>
      <h1>TikTok Live Detector -> n8n</h1>
      <p style="color: var(--text-muted); font-size: 0.9rem;">Auto-detect TikTok livestreams with Postgres + Redis</p>
    </div>
    <div class="badge-bar">
      <div class="stat-badge">Monitors: <strong>${monitors.length}</strong> (${activeCount} active)</div>
      <div class="stat-badge">Currently Live: <strong>${liveCount}</strong></div>
    </div>
  </header>

  <div class="grid">
    <div>
      <div class="card">
        <h2>Active Monitors</h2>
        ${
          monitors.length === 0
            ? '<p style="color: var(--text-muted);">No monitors registered yet. Add one using the form on the right.</p>'
            : `<table>
            <thead>
              <tr>
                <th>Creator</th>
                <th>Status</th>
                <th>Interval</th>
                <th>Last Checked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${monitors
                .map(
                  (m) => `
                <tr>
                  <td>
                    <strong>@${m.username}</strong>
                    ${m.last_room_title ? `<br><small style="color: var(--text-muted);">${escapeHtml(m.last_room_title.slice(0, 30))}</small>` : ''}
                  </td>
                  <td>
                    ${
                      m.is_live
                        ? '<span class="live-badge live"><span class="pulse-dot"></span> LIVE</span>'
                        : '<span class="live-badge offline">OFFLINE</span>'
                    }
                  </td>
                  <td>${m.interval_seconds}s</td>
                  <td><small style="color: var(--text-muted);">${m.last_checked_at ? new Date(m.last_checked_at).toLocaleTimeString() : 'Never'}</small></td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-secondary btn-sm" onclick="checkNow('${m.username}')">Check</button>
                      <button class="btn btn-danger btn-sm" onclick="deleteMonitor('${m.username}')">Del</button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>`
        }
      </div>

      <div class="card">
        <h2>Recent Webhook Dispatches</h2>
        ${
          logs.length === 0
            ? '<p style="color: var(--text-muted);">No webhooks dispatched yet.</p>'
            : `<table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Creator</th>
                <th>Event</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${logs
                .map(
                  (l) => `
                <tr>
                  <td><small style="color: var(--text-muted);">${new Date(l.delivered_at).toLocaleTimeString()}</small></td>
                  <td>@${l.username}</td>
                  <td><span class="log-event log-${l.event}">${l.event}</span></td>
                  <td>${l.status_code ? `<span style="color: ${l.status_code < 300 ? '#10b981' : '#ef4444'}">${l.status_code}</span>` : '<span style="color: #ef4444">ERR</span>'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>`
        }
      </div>
    </div>

    <div>
      <div class="card">
        <h2>Add Creator Monitor</h2>
        <form id="add-form" onsubmit="handleAddMonitor(event)">
          <label>TikTok Username (e.g. khaby.lame or @tiktok)</label>
          <input type="text" id="username" placeholder="khaby.lame" required>

          <label>n8n Webhook URL (Production or Test URL)</label>
          <input type="url" id="webhookUrl" placeholder="${config.defaultWebhookUrl || 'https://n8n.yourdomain.com/webhook/tiktok-live'}" value="${config.defaultWebhookUrl}">

          <label>Check Interval (seconds, min 10s)</label>
          <input type="number" id="intervalSeconds" value="${config.defaultIntervalSeconds}" min="10">

          <div style="margin-top: 1.2rem; display: flex; gap: 0.5rem;">
            <button type="submit" class="btn">Start Monitoring</button>
            <button type="button" class="btn btn-secondary" onclick="testWebhook()">Test Webhook</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2>n8n Webhook Setup</h2>
        <ol style="margin-left: 1.2rem; color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1rem;">
          <li>Add a <strong>Webhook</strong> trigger node in your n8n workflow.</li>
          <li>Set HTTP Method: <code>POST</code>.</li>
          <li>Copy the <strong>Webhook URL</strong> from n8n into this detector.</li>
          <li>Listen for <code>event === 'live_started'</code> or <code>'live_ended'</code>.</li>
        </ol>

        <h3 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Sample Payload to n8n</h3>
        <pre>{
  "event": "live_started",
  "username": "tiktok",
  "isLive": true,
  "timestamp": "2026-10-24T15:30:00.000Z",
  "room": {
    "roomId": "7693676830666705678",
    "title": "Stream title",
    "liveUrl": "https://www.tiktok.com/@tiktok/live",
    "viewers": 120
  }
}</pre>
      </div>
    </div>
  </div>

  <script>
    async function handleAddMonitor(e) {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const webhookUrl = document.getElementById('webhookUrl').value.trim();
      const intervalSeconds = Number(document.getElementById('intervalSeconds').value);

      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, webhookUrl, intervalSeconds })
      });

      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert('Error: ' + (data.error || 'Failed to add monitor'));
      }
    }

    async function checkNow(username) {
      const res = await fetch('/api/monitors/' + encodeURIComponent(username) + '/check', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('@' + username + ' is ' + (data.check.isLive ? '🔴 LIVE!' : '⚪ OFFLINE'));
        window.location.reload();
      } else {
        alert('Check failed: ' + data.error);
      }
    }

    async function deleteMonitor(username) {
      if (!confirm('Stop monitoring @' + username + '?')) return;
      const res = await fetch('/api/monitors/' + encodeURIComponent(username), { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert('Delete failed: ' + data.error);
      }
    }

    async function testWebhook() {
      const webhookUrl = document.getElementById('webhookUrl').value.trim();
      if (!webhookUrl) {
        alert('Please enter an n8n webhook URL first.');
        return;
      }
      const res = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, username: 'test_streamer' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Success! n8n received the test webhook (HTTP ' + data.statusCode + ')');
        window.location.reload();
      } else {
        alert('Webhook failed: ' + (data.error || 'HTTP ' + data.statusCode));
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
