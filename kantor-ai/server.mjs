// Server lokal Kantor AI: menyajikan tampilan + meneruskan event secara live (Server-Sent Events).
//   node server.mjs        -> http://127.0.0.1:7777
// Sumber event:
//   1. events.jsonl  (ditulis skrip Python lewat kantor.py)
//   2. POST /api/event  (hanya dari localhost)
//   3. Cek kesehatan berkala: 9router & Budi Gateway (event hanya saat status berubah)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.KANTOR_PORT || 7777);
const EVENTS = process.env.KANTOR_EVENTS || path.join(HERE, 'events.jsonl');
const PUBLIC = path.join(HERE, 'public');
const ROOMS = new Set(['lobi', 'dewan', 'perpustakaan', 'kafe', 'riset', 'sosmed', 'server']);
const STATUSES = new Set(['start', 'progress', 'done', 'error', 'idle']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const recent = [];      // 300 event terakhir di memori
const clients = new Set();

function push(ev) {
  recent.push(ev);
  if (recent.length > 300) recent.shift();
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) res.write(line);
}

function clean(raw) {
  if (!raw || typeof raw !== 'object' || !raw.agent) return null;
  const ev = {
    ts: typeof raw.ts === 'string' ? raw.ts : new Date().toISOString(),
    agent: String(raw.agent).slice(0, 40),
    status: STATUSES.has(raw.status) ? raw.status : 'progress',
    task: String(raw.task ?? '').slice(0, 120),
  };
  if (ROOMS.has(raw.room)) ev.room = raw.room;
  if (raw.detail) ev.detail = String(raw.detail).slice(0, 300);
  return ev;
}

function append(ev) {
  fs.appendFileSync(EVENTS, JSON.stringify(ev) + '\n', 'utf8');
}

// ---------- ikuti events.jsonl ----------
let offset = 0;
let partial = '';
function readNew(initial = false) {
  let size;
  try { size = fs.statSync(EVENTS).size; } catch { return; }
  if (size < offset) { offset = 0; partial = ''; } // file dirotasi/dihapus
  if (size === offset) return;
  const fd = fs.openSync(EVENTS, 'r');
  const buf = Buffer.alloc(size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  offset = size;
  const lines = (partial + buf.toString('utf8')).split('\n');
  partial = lines.pop();
  const evs = lines.map((l) => { try { return clean(JSON.parse(l)); } catch { return null; } }).filter(Boolean);
  for (const ev of initial ? evs.slice(-300) : evs) push(ev);
}
fs.mkdirSync(path.dirname(EVENTS), { recursive: true });
if (!fs.existsSync(EVENTS)) fs.writeFileSync(EVENTS, '');
readNew(true);
fs.watchFile(EVENTS, { interval: 400 }, () => readNew());

// ---------- cek kesehatan (event hanya saat berubah) ----------
const health = {};
function report(agent, up, task, detail) {
  if (health[agent] === up) return;
  const first = health[agent] === undefined;
  health[agent] = up;
  if (first && up) return; // saat server baru jalan: tidak perlu bising kalau sehat
  append({ ts: new Date().toISOString(), agent, status: up ? 'done' : 'error', task, room: 'server', detail });
}
async function checkHealth() {
  try {
    const r = await fetch('http://127.0.0.1:20128/v1/models', { signal: AbortSignal.timeout(3000) });
    report('router', r.ok, r.ok ? '9router menyala' : '9router bermasalah', r.ok ? '' : `HTTP ${r.status}`);
  } catch {
    report('router', false, '9router mati', 'Tidak ada yang menjawab di 127.0.0.1:20128. Nyalakan: wscript D:\\9router\\start-9router.vbs');
  }
  execFile('powershell.exe', ['-NoProfile', '-Command',
    "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'openclaw' -and $_.CommandLine -match 'gateway' } | Measure-Object).Count"],
  { timeout: 15000, windowsHide: true }, (err, out) => {
    if (err) return;
    const up = Number(String(out).trim()) > 0;
    report('budi', up, up ? 'Budi Gateway menyala' : 'Budi Gateway mati', up ? '' : 'Proses gateway OpenClaw tidak ditemukan');
  });
}
checkHealth();
setInterval(checkHealth, 15000);

// ---------- HTTP ----------
function sendFile(res, file) {
  const p = path.normalize(path.join(PUBLIC, file));
  if (!p.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404).end('tidak ditemukan'); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(p)] || 'application/octet-stream',
      'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    });
    res.end(data);
  });
}

// Tolak POST lintas situs: wajib JSON (memicu preflight CORS yang tidak kita jawab) dan Origin sendiri/kosong.
function trustedWrite(req) {
  const ct = req.headers['content-type'] || '';
  const origin = req.headers.origin;
  return ct.startsWith('application/json') && (!origin || origin === `http://127.0.0.1:${PORT}` || origin === `http://localhost:${PORT}`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'POST' && !trustedWrite(req)) { res.writeHead(403).end('ditolak'); return; }
  if (url.pathname === '/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`event: snapshot\ndata: ${JSON.stringify({ events: recent.slice(-150), health })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  if (url.pathname === '/api/event' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4000) req.destroy(); });
    req.on('end', () => {
      try {
        const ev = clean(JSON.parse(body));
        if (!ev) throw new Error('event tidak valid');
        append(ev);
        res.writeHead(204).end();
      } catch (e) { res.writeHead(400).end(e.message); }
    });
    return;
  }
  if (url.pathname === '/api/clear' && req.method === 'POST') {
    fs.writeFileSync(EVENTS, '');
    recent.length = 0;
    offset = 0; partial = '';
    for (const c of clients) c.write(`event: snapshot\ndata: ${JSON.stringify({ events: [], health })}\n\n`);
    res.writeHead(204).end();
    return;
  }
  sendFile(res, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
});

// Hanya localhost: log tugas bisa berisi isi pesan pribadi.
server.listen(PORT, '127.0.0.1', () => console.log(`Kantor AI: http://127.0.0.1:${PORT}`));
