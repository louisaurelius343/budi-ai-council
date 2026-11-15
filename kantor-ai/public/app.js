// Kantor AI: denah 2D, karakter agen berjalan ke ruangan sesuai tugas, panel status & error.
const W = 1200, H = 760;
const canvas = document.getElementById('office');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);

// ---------- denah ----------
const ROOMS = {
  dewan:        { x: 30,  y: 30,  w: 420, h: 300, name: 'Ruang Dewan',        icon: '⚖️', floor: '#e9dcc8', floorD: '#2c241e' },
  perpustakaan: { x: 470, y: 30,  w: 330, h: 300, name: 'Perpustakaan (RAG)', icon: '📚', floor: '#e4e0cf', floorD: '#26251d' },
  riset:        { x: 820, y: 30,  w: 350, h: 300, name: 'Lab Riset',          icon: '🔬', floor: '#dde3e4', floorD: '#1f2527' },
  lobi:         { x: 30,  y: 350, w: 560, h: 380, name: 'Lobi',               icon: '🛋️', floor: '#efe6d6', floorD: '#29221c' },
  kafe:         { x: 610, y: 350, w: 260, h: 380, name: 'Pantry & Kafe',      icon: '☕', floor: '#ecdccb', floorD: '#2d231c' },
  sosmed:       { x: 890, y: 350, w: 280, h: 180, name: 'Studio Sosmed',      icon: '📣', floor: '#ecdfe6', floorD: '#2a2127' },
  server:       { x: 890, y: 550, w: 280, h: 180, name: 'Ruang Server',       icon: '🖧', floor: '#dfe2e8', floorD: '#20232a' },
};

// Agen yang dikenal; agen baru dari event otomatis dibuat.
const KNOWN = {
  budi:         { name: 'Budi',          color: '#d9773b', home: 'lobi',  role: 'Asisten utama (OpenClaw)' },
  'dewan-ketua':{ name: 'Ketua Dewan',   color: '#3a6ea5', home: 'lobi',  role: 'Generator & reviser' },
  'dewan-A':    { name: 'Kritikus A',    color: '#6b8f4e', home: 'lobi',  role: 'Kritikus dewan' },
  'dewan-B':    { name: 'Kritikus B',    color: '#8d5fa8', home: 'lobi',  role: 'Kritikus dewan' },
  'dewan-C':    { name: 'Kritikus C',    color: '#c2a03a', home: 'lobi',  role: 'Kritikus dewan' },
  'dewan-D':    { name: 'Kritikus D',    color: '#b4565a', home: 'lobi',  role: 'Kritikus dewan' },
  pustakawan:   { name: 'Pustakawan',    color: '#2f8f83', home: 'lobi',  role: 'RAG: dokumen & memori' },
  'pencari-kafe': { name: 'Pencari Kafe', color: '#8a5a3b', home: 'lobi', role: 'Skill cari-kafe (OSM)' },
  hermes:       { name: 'Hermes',        color: '#5b55b5', home: 'lobi',  role: 'Riset mendalam' },
  kurir:        { name: 'Kurir Sosmed',  color: '#c0568a', home: 'lobi',  role: 'Draf & posting Bluesky' },
  router:       { name: '9router',       color: '#6f7a86', home: 'server', role: 'Gerbang model AI' },
};
const DEFAULT_ROOM = { budi: 'lobi', pustakawan: 'perpustakaan', 'pencari-kafe': 'kafe', hermes: 'riset', kurir: 'sosmed', router: 'server' };

const agents = new Map();
const errors = [];
let dark = matchMedia('(prefers-color-scheme: dark)').matches;
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { dark = e.matches; });

function agentFor(id) {
  if (agents.has(id)) return agents.get(id);
  const k = KNOWN[id] ?? { name: id, color: hashColor(id), home: 'lobi', role: 'Agen' };
  const a = {
    id, ...k, room: k.home, status: 'idle', task: '', detail: '', since: Date.now(),
    x: 0, y: 0, tx: 0, ty: 0, bob: Math.random() * 6, flash: 0,
  };
  agents.set(id, a);
  const p = spot(a, a.room);
  a.x = a.tx = p.x; a.y = a.ty = p.y;
  return a;
}

function hashColor(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 45% 50%)`;
}

/** Posisi berdiri agen di ruangan: grid kursi yang stabil per agen. */
function spot(a, roomId) {
  const r = ROOMS[roomId] ?? ROOMS.lobi;
  const ids = [...agents.keys()];
  const i = Math.max(0, ids.indexOf(a.id));
  const cols = Math.max(2, Math.floor((r.w - 60) / 70));
  const col = i % cols, row = Math.floor(i / cols);
  const top = roomId === 'dewan' ? r.y + 95 : r.y + 110;
  return { x: r.x + 45 + col * ((r.w - 90) / Math.max(1, cols - 1)), y: Math.min(r.y + r.h - 40, top + row * 62) };
}

// ---------- event ----------
function apply(ev, live = true) {
  const a = agentFor(ev.agent);
  const room = ev.room ?? (ev.status === 'done' || ev.status === 'idle' ? a.home : DEFAULT_ROOM[a.id] ?? a.room);
  a.status = ev.status;
  a.task = ev.task || a.task;
  a.detail = ev.detail || '';
  a.since = Date.parse(ev.ts) || Date.now();
  if (ev.status === 'error') {
    errors.unshift({ ...ev, name: a.name, color: a.color, key: `${ev.ts}|${ev.agent}` });
    if (errors.length > 50) errors.pop();
  } else if (ev.status === 'done' && a.id === 'router' || ev.status === 'done' && a.id === 'budi' && /Gateway/.test(ev.task)) {
    // layanan pulih: error lama untuk agen itu dianggap selesai
    for (let i = errors.length - 1; i >= 0; i--) if (errors[i].agent === a.id) errors.splice(i, 1);
  }
  if (ev.status !== 'error') a.room = room;
  else a.room = ev.room ?? a.room;
  const p = spot(a, a.room);
  a.tx = p.x; a.ty = p.y;
  if (!live) { a.x = a.tx; a.y = a.ty; }
  a.flash = live ? 1 : 0;
  if (ev.status === 'done') a.doneAt = live ? performance.now() : 0;
  addFeed(ev, a, live);
  renderPanels();
}

// ---------- panel ----------
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (ms) => { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? `${s} dtk` : `${Math.round(s / 60)} mnt`; };

function renderPanels() {
  const busy = [...agents.values()].filter((a) => a.status === 'start' || a.status === 'progress');
  $('#busyCount').textContent = busy.length;
  $('#busy').innerHTML = busy.length
    ? busy.map((a) => `<li><span class="dot" data-color="${a.color}"></span><span><span class="who">${esc(a.name)}</span> · ${esc(ROOMS[a.room]?.name ?? a.room)}<br><span class="what">${esc(a.task)}</span></span><span class="when">${ago(a.since)}</span></li>`).join('')
    : '<li class="empty">Semua agen santai di lobi.</li>';
  $('#errCount').textContent = errors.length;
  $('#errCount').classList.toggle('red', errors.length > 0);
  $('#errors').innerHTML = errors.length
    ? errors.map((e, i) => `<li><span class="dot" data-color="${e.color}"></span><span><span class="who">${esc(e.name)}</span> · ${esc(e.task)}<br><span class="what">${esc(e.detail || 'tanpa detail')}</span></span><span class="when">${fmtTime(e.ts)} <button type="button" data-dismiss="${i}" aria-label="Tutup error">×</button></span></li>`).join('')
    : '<li class="empty">Belum ada error. 🎉</li>';
  paintDots($('#busy'));
  paintDots($('#errors'));
}
// Warna titik diterapkan lewat CSSOM (CSP melarang atribut style inline).
function paintDots(root) { root.querySelectorAll('[data-color]').forEach((d) => { d.style.background = d.dataset.color; }); }

$('#errors').addEventListener('click', (e) => {
  const i = e.target.closest('[data-dismiss]')?.dataset.dismiss;
  if (i != null) { errors.splice(Number(i), 1); renderPanels(); }
});

const feed = $('#feed');
function addFeed(ev, a, live) {
  const verb = { start: 'mulai', progress: '…', done: 'selesai', error: 'ERROR', idle: 'istirahat' }[ev.status];
  const li = document.createElement('li');
  li.innerHTML = `<time>${fmtTime(ev.ts).slice(0, 5)}</time><span class="${ev.status}"><b>${esc(a.name)}</b> ${verb}: ${esc(ev.task)}${ev.detail && ev.status !== 'start' ? ` <span class="what">(${esc(ev.detail)})</span>` : ''}</span>`;
  feed.prepend(li);
  while (feed.children.length > 200) feed.lastChild.remove();
}

// ---------- gambar ----------
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function drawRoom(id, r) {
  roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.fillStyle = dark ? r.floorD : r.floor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark ? '#3d332b' : '#cdbfa9';
  ctx.stroke();
  // pola lantai halus
  ctx.save(); ctx.clip();
  ctx.strokeStyle = dark ? '#ffffff08' : '#00000008';
  ctx.lineWidth = 1;
  for (let gx = r.x; gx < r.x + r.w; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, r.y); ctx.lineTo(gx, r.y + r.h); ctx.stroke(); }
  ctx.restore();
  // label
  ctx.fillStyle = dark ? '#cbbdb0' : '#5c4f44';
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.fillText(`${r.icon}  ${r.name}`, r.x + 16, r.y + 28);
  drawFurniture(id, r);
}

function box(x, y, w, h, fill, rad = 6) { roundRect(x, y, w, h, rad); ctx.fillStyle = fill; ctx.fill(); }

function drawFurniture(id, r) {
  const wood = dark ? '#5a4535' : '#b98b62', soft = dark ? '#3a3f4a' : '#c9d3dc', green = dark ? '#3f5e3a' : '#7fa36a';
  if (id === 'dewan') { box(r.x + 90, r.y + 150, r.w - 180, 70, wood, 30); }
  if (id === 'perpustakaan') for (let i = 0; i < 4; i++) { box(r.x + 20 + i * 78, r.y + 48, 64, 26, wood, 4); for (let b = 0; b < 6; b++) box(r.x + 24 + i * 78 + b * 10, r.y + 51, 7, 20, ['#c0568a', '#3a6ea5', '#6b8f4e', '#c2a03a'][b % 4], 1); }
  if (id === 'riset') for (let i = 0; i < 3; i++) { box(r.x + 30 + i * 105, r.y + 220, 80, 34, wood, 4); box(r.x + 48 + i * 105, r.y + 198, 44, 26, dark ? '#1b2a3a' : '#2c3e50', 3); }
  if (id === 'lobi') { box(r.x + 40, r.y + r.h - 70, 180, 40, dark ? '#4a3a52' : '#b49cc0', 16); box(r.x + r.w - 90, r.y + 50, 40, 40, green, 20); box(r.x + r.w - 140, r.y + r.h - 60, 40, 40, green, 20); }
  if (id === 'kafe') { box(r.x + 20, r.y + 50, r.w - 40, 34, wood, 8); box(r.x + 30, r.y + 40, 30, 22, dark ? '#666' : '#555', 4); }
  if (id === 'sosmed') { box(r.x + r.w - 80, r.y + 40, 60, 40, dark ? '#1b2a3a' : '#2c3e50', 4); }
  if (id === 'server') for (let i = 0; i < 4; i++) { box(r.x + 150 + i * 30, r.y + 40, 22, 120, dark ? '#22262d' : '#3b4048', 3); for (let l = 0; l < 6; l++) box(r.x + 155 + i * 30, r.y + 50 + l * 18, 4, 4, (Date.now() / 300 + l + i) % 3 < 1 ? '#5dd36b' : '#2a6b33', 2); }
  if (id === 'server' || id === 'riset' || id === 'sosmed') box(r.x + r.w - 26, r.y + r.h - 26, 12, 12, soft, 6);
}

function drawAgent(a, t) {
  const working = a.status === 'start' || a.status === 'progress';
  const err = a.status === 'error';
  const moving = Math.hypot(a.tx - a.x, a.ty - a.y) > 1;
  const bob = moving ? Math.sin(t / 90 + a.bob) * 2.5 : working ? Math.sin(t / 400 + a.bob) * 1 : 0;
  const x = a.x, y = a.y + bob;

  // bayangan
  ctx.fillStyle = '#0000002a';
  ctx.beginPath(); ctx.ellipse(x, a.y + 20, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
  // aura status
  if (working || err) {
    const pulse = 0.5 + 0.5 * Math.sin(t / (err ? 180 : 500));
    ctx.beginPath(); ctx.arc(x, y + 2, 26 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = err ? `rgba(220,60,50,${0.18 + pulse * 0.2})` : 'rgba(224,138,82,0.16)';
    ctx.fill();
  }
  // badan & kepala
  box(x - 12, y - 4, 24, 24, a.color, 9);
  ctx.beginPath(); ctx.arc(x, y - 12, 11, 0, Math.PI * 2); ctx.fillStyle = dark ? '#e9d8c6' : '#f2dcc4'; ctx.fill();
  ctx.fillStyle = '#2a211b';
  const blink = (t / 1000 + a.bob) % 4 < 0.12;
  if (!blink) { ctx.fillRect(x - 5, y - 14, 3, 3); ctx.fillRect(x + 2, y - 14, 3, 3); }
  if (err) { ctx.fillRect(x - 4, y - 7, 8, 2); }
  // label nama
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  const tw = ctx.measureText(a.name).width;
  box(x - tw / 2 - 6, y + 24, tw + 12, 17, dark ? '#000000aa' : '#ffffffcc', 8);
  ctx.fillStyle = dark ? '#f1e9df' : '#2a211b';
  ctx.fillText(a.name, x - tw / 2, y + 36);

  // balon
  let text = null, tone = null;
  if (err) { text = `⚠ ${a.task}`; tone = 'err'; }
  else if (working) text = a.task;
  else if (a.doneAt && t - a.doneAt < 3500) { text = '✓ selesai'; tone = 'ok'; }
  if (text) bubble(x, y - 30, text, tone);
}

function bubble(x, y, text, tone) {
  ctx.font = '12px Inter, system-ui, sans-serif';
  const s = text.length > 34 ? text.slice(0, 33) + '…' : text;
  const w = ctx.measureText(s).width + 18;
  const bx = Math.max(6, Math.min(W - w - 6, x - w / 2));
  const fill = tone === 'err' ? '#c0392b' : tone === 'ok' ? '#3f7a3a' : dark ? '#f1e9df' : '#2a211b';
  box(bx, y - 26, w, 22, fill, 11);
  ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x, y + 2); ctx.fillStyle = fill; ctx.fill();
  ctx.fillStyle = tone ? '#fff' : dark ? '#14110f' : '#fff';
  ctx.fillText(s, bx + 9, y - 11);
}

function frame(t) {
  ctx.clearRect(0, 0, W, H);
  for (const [id, r] of Object.entries(ROOMS)) drawRoom(id, r);
  // gerak menuju target
  for (const a of agents.values()) {
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d > 1) { const v = Math.min(d, 3.2); a.x += (dx / d) * v; a.y += (dy / d) * v; }
  }
  [...agents.values()].sort((p, q) => p.y - q.y).forEach((a) => drawAgent(a, t));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- tooltip ----------
const tip = $('#tooltip');
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / W, r.height / H);
  const ox = (r.width - W * scale) / 2, oy = (r.height - H * scale) / 2;
  const mx = (e.clientX - r.left - ox) / scale, my = (e.clientY - r.top - oy) / scale;
  const hit = [...agents.values()].find((a) => Math.hypot(a.x - mx, a.y - 4 - my) < 22);
  if (!hit) { tip.hidden = true; return; }
  tip.hidden = false;
  tip.innerHTML = `<b>${esc(hit.name)}</b>${esc(hit.role)}<br>Status: ${esc(hit.status)} · ${esc(ROOMS[hit.room]?.name ?? hit.room)}${hit.task ? `<br>${esc(hit.task)}` : ''}${hit.detail ? `<br><i>${esc(hit.detail)}</i>` : ''}`;
  const sr = canvas.parentElement.getBoundingClientRect();
  tip.style.left = `${e.clientX - sr.left + 14}px`;
  tip.style.top = `${e.clientY - sr.top + 14}px`;
});
canvas.addEventListener('mouseleave', () => { tip.hidden = true; });

// ---------- kesehatan layanan ----------
function renderHealth(h) {
  const chips = [['router', '9router'], ['budi', 'Budi Gateway']].map(([k, label]) => {
    const up = h?.[k];
    return `<span class="chip ${up === true ? 'up' : up === false ? 'down' : ''}">${label}${up === false ? ' mati' : up === true ? '' : ' …'}</span>`;
  });
  $('#health').innerHTML = chips.join('');
}
const healthState = {};

// ---------- koneksi live ----------
function connect() {
  const es = new EventSource('/stream');
  const conn = $('#conn');
  es.addEventListener('open', () => { conn.className = 'conn on'; conn.title = 'Terhubung ke server lokal'; });
  es.addEventListener('error', () => { conn.className = 'conn off'; conn.title = 'Terputus, mencoba lagi…'; });
  es.addEventListener('snapshot', (m) => {
    const { events, health } = JSON.parse(m.data);
    agents.clear(); errors.length = 0; feed.innerHTML = '';
    for (const k of Object.keys(KNOWN)) agentFor(k);
    Object.assign(healthState, health);
    events.forEach((ev) => apply(ev, false));
    renderHealth(healthState);
    renderPanels();
  });
  es.addEventListener('message', (m) => {
    const ev = JSON.parse(m.data);
    if (ev.room === 'server' && (ev.agent === 'router' || ev.agent === 'budi')) {
      healthState[ev.agent] = ev.status !== 'error';
      renderHealth(healthState);
    }
    apply(ev, true);
  });
}
for (const k of Object.keys(KNOWN)) agentFor(k);
renderPanels();
renderHealth({});
connect();
setInterval(renderPanels, 5000); // perbarui "x dtk lalu"

// ---------- simulasi (untuk demo) ----------
const post = (ev) => fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ts: new Date().toISOString(), ...ev }) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
$('#demo').addEventListener('click', async () => {
  const btn = $('#demo'); btn.disabled = true;
  const steps = [
    [0, { agent: 'budi', status: 'start', task: 'Pesan WA: "pakai dewan, 3 paragraf AI UMKM"', room: 'dewan' }],
    [600, { agent: 'dewan-ketua', status: 'start', task: 'Menulis draf', room: 'dewan', detail: 'holver/gpt-6-luna' }],
    [2500, { agent: 'dewan-ketua', status: 'progress', task: 'Menunggu kritik', room: 'dewan' }],
    [0, { agent: 'dewan-A', status: 'start', task: 'Mengkritik draf', room: 'dewan', detail: 'oc/deepseek' }],
    [0, { agent: 'dewan-B', status: 'start', task: 'Mengkritik draf', room: 'dewan', detail: 'oc/glm' }],
    [0, { agent: 'dewan-C', status: 'start', task: 'Mengkritik draf', room: 'dewan', detail: 'gemini flash-lite' }],
    [0, { agent: 'dewan-D', status: 'start', task: 'Mengkritik draf', room: 'dewan', detail: 'groq gpt-oss' }],
    [400, { agent: 'pencari-kafe', status: 'start', task: 'Kafe buka + WiFi dekat Dago', room: 'kafe' }],
    [1400, { agent: 'dewan-C', status: 'done', task: 'Mengkritik draf', detail: '2,1 dtk' }],
    [300, { agent: 'dewan-D', status: 'done', task: 'Mengkritik draf', detail: '1,9 dtk' }],
    [900, { agent: 'pustakawan', status: 'start', task: 'Cari "EcoPoint" di dokumen', room: 'perpustakaan' }],
    [1500, { agent: 'dewan-B', status: 'error', task: 'Mengkritik draf', room: 'dewan', detail: 'HTTP 503: model sedang tidak tersedia (dilewati)' }],
    [700, { agent: 'dewan-A', status: 'done', task: 'Mengkritik draf', detail: '18,6 dtk' }],
    [500, { agent: 'pustakawan', status: 'done', task: 'Cari "EcoPoint" di dokumen', detail: '6 sumber' }],
    [600, { agent: 'dewan-ketua', status: 'progress', task: 'Merevisi dari 3 kritik', room: 'dewan' }],
    [1800, { agent: 'pencari-kafe', status: 'done', task: 'Kafe buka + WiFi dekat Dago', detail: '137 tempat' }],
    [1200, { agent: 'dewan-ketua', status: 'done', task: 'Versi final', detail: '34 dtk' }],
    [300, { agent: 'budi', status: 'progress', task: 'Mengirim hasil dewan ke WA', room: 'sosmed' }],
    [1500, { agent: 'budi', status: 'done', task: 'Hasil dewan terkirim' }],
    [400, { agent: 'dewan-B', status: 'idle', task: 'Kembali ke lobi' }],
  ];
  for (const [delay, ev] of steps) { await wait(delay); await post(ev); }
  btn.disabled = false;
});

$('#clear').addEventListener('click', async () => {
  if (!confirm('Hapus semua riwayat event?')) return;
  await fetch('/api/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
});
