// Ruang Rapat Dewan: ruang 3D + suara + kolom chat + lampiran. Update live lewat SSE.
import { Ruang3D } from './ruang3d.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jam = (ts) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

let anggota = [];
let moderator = null;
let daftarSuara = [];
let aktif = false;     // ada rapat
let selesai = false;
let sibuk = false;

const warnaDari = (id) => (id === 'louis' ? null : id === moderator?.id ? moderator.warna : anggota.find((a) => a.id === id)?.warna || '#888');
const inisial = (n) => (n || '?').slice(0, 1).toUpperCase();

async function post(path, body = {}, diam = false) {
  let d;
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const teks = await r.text();
    try { d = JSON.parse(teks); } catch {
      d = { error: r.status === 404 ? 'Fitur ini belum ada di server yang sedang jalan. Restart server rapat (tutup jendelanya, lalu jalankan start-rapat.cmd lagi).' : `server membalas ${r.status}: ${teks.slice(0, 120)}` };
    }
  } catch (e) {
    d = { error: `server rapat tidak bisa dihubungi (${e.message})` };
  }
  if (d.error && !diam) alert(d.error);
  return d;
}

// ---------- ruang 3D ----------
let ruang = null;
try {
  ruang = new Ruang3D($('#ruang3d'));
} catch (e) {
  $('#ruang3d').innerHTML = `<p class="kecil">Ruang 3D tidak bisa ditampilkan (${esc(e.message)}). Rapat tetap bisa lewat kolom chat.</p>`;
}
let kunciAvatar = '';
function perbaruiAvatar() {
  if (!ruang || !moderator) return;
  const kunci = JSON.stringify([moderator, ...anggota].map((a) => [a.id, a.nama, a.warna, a.keluarga]));
  if (kunci === kunciAvatar) return;
  kunciAvatar = kunci;
  ruang.setAnggota(moderator, anggota);
}

// ---------- laci anggota & lampiran ----------
$('#buka-laci').addEventListener('click', () => { $('#laci').hidden = false; });
$('#tutup-laci').addEventListener('click', () => { $('#laci').hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#laci').hidden = true; });

function pilihanSuara(id, sekarang) {
  return `<select data-suara="${esc(id)}" title="Suara">${daftarSuara.map((v) => `<option value="${esc(v)}"${v === sekarang ? ' selected' : ''}>🔊 ${esc(v.replace('Neural', ''))}</option>`).join('')}</select>`;
}

function gambarKursi() {
  const semua = moderator ? [moderator, ...anggota] : anggota;
  $('#kursi').innerHTML = semua.map((a) => `
    <div class="anggota" data-id="${esc(a.id)}">
      <div class="avatar" data-warna="${esc(a.warna)}">${esc(inisial(a.nama))}</div>
      <div><b>${esc(a.nama)}</b><span class="model">${esc(a.keluarga || 'moderator')} · ${esc(a.model)}</span>
        ${a.id === moderator?.id ? '' : `<input type="text" data-model="${esc(a.id)}" value="${esc(a.model)}" list="daftar-model" title="Model anggota ini (pilih atau ketik penyedia/model)" maxlength="120">`}
        ${daftarSuara.length ? pilihanSuara(a.id, a.suara) : ''}
        ${a.id === moderator?.id ? '' : `<input type="text" data-peran="${esc(a.id)}" value="${esc(a.peran || '')}" placeholder="peran (opsional), mis. advokat setan" maxlength="200">`}
      </div>
    </div>`).join('');
  $('#kursi').querySelectorAll('[data-warna]').forEach((el) => { el.style.background = el.dataset.warna; });
  perbaruiAvatar();
}

// daftar model dari 9router untuk kolom pilihan model
fetch('/api/model').then((r) => r.json()).then((d) => {
  const dl = document.createElement('datalist');
  dl.id = 'daftar-model';
  dl.innerHTML = (d.model || []).map((m) => `<option value="${esc(m)}">`).join('');
  document.body.append(dl);
}).catch(() => {});

$('#kursi').addEventListener('change', async (e) => {
  const idModel = e.target.dataset.model;
  if (idModel) {
    const model = e.target.value.trim();
    const a = anggota.find((x) => x.id === idModel);
    if (!model || model === a?.model) return;
    const d = await post('/api/model', { id: idModel, model });
    if (d.error) e.target.value = a?.model || '';
    return;
  }
  const idSuara = e.target.dataset.suara;
  if (idSuara) { post('/api/suara', { id: idSuara, suara: e.target.value }); return; }
  const id = e.target.dataset.peran;
  if (!id) return;
  const a = anggota.find((x) => x.id === id);
  if (a) a.peran = e.target.value.trim() || null;
  if (aktif && !selesai) post('/api/peran', { id, peran: e.target.value });
});

// ---------- kolom chat ----------
function tambahLog(m) {
  const li = document.createElement('li');
  if (m.tipe === 'info') {
    li.className = 'info'; li.textContent = m.teks;
  } else if (m.tipe === 'error') {
    li.className = 'error'; li.textContent = `⚠ ${m.nama} tidak bisa menjawab (${m.teks}). Dilewati.`;
  } else {
    const louis = m.id === 'louis';
    li.className = `pesan${louis ? ' louis' : ''}${m.tipe === 'kesimpulan' ? ' kesimpulan' : ''}`;
    const sumber = (m.sumber || []).map((s) => `<span title="${esc(s.cuplik)}…">📎 ${esc(s.file)} #${s.n}</span>`).join('');
    li.innerHTML = `<div class="avatar">${esc(inisial(m.nama))}</div>
      <div><div class="kepala"><b>${esc(m.tipe === 'kesimpulan' ? 'Kesimpulan rapat' : m.nama)}</b>${esc(jam(m.ts))}${m.detik ? ` · ${m.detik.toFixed(0)} dtk` : ''}</div>
      <div class="isi">${esc(m.teks)}</div>${sumber ? `<div class="sumber" title="Potongan dokumen yang diberikan kepada pembicara ini">${sumber}</div>` : ''}</div>`;
    const w = warnaDari(m.id);
    if (w) li.querySelector('.avatar').style.background = w;
  }
  $('#log').append(li);
  li.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

// ---------- pemutar suara: ucapan tampil saat suaranya mulai, berurutan ----------
let suaraOn = $('#saklar-suara').checked;
let audioCtx = null;
let analyser = null;
let dataAmp = null;
const antrean = [];        // [{ m, url, gagal }]
let memutar = false;
let statusServer = { teks: '', pembicara: null };

function siapkanAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    dataAmp = new Uint8Array(analyser.fftSize);
    analyser.connect(audioCtx.destination);
  } catch { audioCtx = null; }
  $('#aktifkan-suara').hidden = true;
}
// Browser butuh satu interaksi sebelum boleh memutar suara.
document.addEventListener('pointerdown', siapkanAudio, { once: true });
$('#aktifkan-suara').addEventListener('click', siapkanAudio);

function ukurLevel() {
  if (analyser && memutar) {
    analyser.getByteTimeDomainData(dataAmp);
    let jumlah = 0;
    for (const v of dataAmp) jumlah += ((v - 128) / 128) ** 2;
    ruang?.setLevel(Math.sqrt(jumlah / dataAmp.length));
  } else {
    ruang?.setLevel(0);
  }
  requestAnimationFrame(ukurLevel);
}
requestAnimationFrame(ukurLevel);

function tampilkanSubtitle(m) {
  $('#sub-nama').textContent = m.tipe === 'kesimpulan' ? 'Kesimpulan rapat' : m.nama;
  $('#sub-nama').style.color = warnaDari(m.id) || '#fff';
  $('#sub-teks').textContent = m.teks.length > 420 ? `${m.teks.slice(0, 420)}…` : m.teks;
  $('#subtitle').hidden = false;
}
function sembunyikanSubtitle() { $('#subtitle').hidden = true; ruang?.setPembicara(null); tampilkanStatus(); }

function tampilkanStatus() {
  // Selama antrean belum habis, status "sedang berpikir" dari server menyangkut giliran yang belum diputar.
  const tenang = !memutar && !antrean.length;
  $('#status').textContent = tenang ? statusServer.teks : (statusServer.teks ? 'Giliran berikutnya sedang disiapkan…' : '');
  ruang?.setBerpikir(tenang ? statusServer.pembicara : null);
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

let audioSekarang = null;

// Memutar satu klip. Selalu selesai: saat audio berakhir, gagal, macet, suara dimatikan, atau batas waktu habis.
async function putarSatu(item) {
  // Pastikan konteks audio benar-benar jalan; kalau tidak, putar biasa tanpa analisis (mulut tetap bergerak pelan).
  let pakaiAnalisis = false;
  if (audioCtx) {
    if (audioCtx.state !== 'running') await Promise.race([audioCtx.resume().catch(() => {}), tunggu(1500)]);
    pakaiAnalisis = audioCtx.state === 'running';
  }
  await new Promise((selesai) => {
    let beres = false;
    const a = new Audio(item.url);
    audioSekarang = a;
    const akhiri = () => {
      if (beres) return;
      beres = true;
      clearTimeout(jaga); clearInterval(cek);
      try { a.pause(); } catch { /* abaikan */ }
      audioSekarang = null;
      selesai();
    };
    // Batas waktu: durasi klip + 3 dtk, atau 60 dtk kalau durasi belum diketahui.
    let jaga = setTimeout(akhiri, 60000);
    a.onloadedmetadata = () => { if (isFinite(a.duration)) { clearTimeout(jaga); jaga = setTimeout(akhiri, (a.duration + 3) * 1000); } };
    // Suara dimatikan di tengah ucapan: bisukan saja, subtitle tetap tampil sampai sisa waktu bacanya habis.
    const mulai = Date.now();
    const waktuBaca = Math.min(9000, 1200 + item.m.teks.split(/\s+/).length * 280);
    const cek = setInterval(() => {
      if (suaraOn || a.muted) return;
      a.muted = true;
      clearTimeout(jaga);
      jaga = setTimeout(akhiri, Math.max(0, waktuBaca - (Date.now() - mulai)));
    }, 200);
    a.onended = a.onerror = akhiri;
    if (pakaiAnalisis) {
      try { audioCtx.createMediaElementSource(a).connect(analyser); } catch { /* tetap diputar tanpa analisis */ }
    }
    a.play().catch(() => { $('#aktifkan-suara').hidden = false; akhiri(); });
  });
}

async function putarAntrean() {
  if (memutar) return;
  memutar = true;
  while (antrean.length) {
    const item = antrean[0];
    if (item.info) { antrean.shift(); tambahLog(item.m); continue; } // info/error: tampil tanpa subtitle
    const batas = Date.now() + 30000;
    while (suaraOn && !item.url && !item.gagal && !item.ditarik && Date.now() < batas) await tunggu(200);
    antrean.shift();
    if (item.ditarik) continue;
    tambahLog(item.m);
    post('/api/diputar', { nomor: item.m.nomor }, true); // server baru menyusun giliran berikutnya setelah ini
    ruang?.setPembicara(item.m.id);
    tampilkanSubtitle(item.m);
    tampilkanStatus();
    if (suaraOn && item.url) {
      await putarSatu(item);
      await tunggu(250);
    } else {
      await tunggu(Math.min(9000, 1200 + item.m.teks.split(/\s+/).length * 280)); // waktu baca tanpa suara
    }
    sembunyikanSubtitle();
  }
  memutar = false;
  tampilkanStatus();
}

function terimaLog(m) {
  const pakaiAntrean = (m.tipe === 'ucapan' || m.tipe === 'kesimpulan') && m.id !== 'louis';
  if (pakaiAntrean) {
    antrean.push({ m, url: null, gagal: !m.suaraMenyusul });
    putarAntrean();
  } else if (antrean.length && m.tipe !== 'ucapan') {
    antrean.push({ m: { ...m }, url: null, gagal: true, info: true }); // jaga urutan info/error di antara ucapan
  } else {
    tambahLog(m);
  }
}

$('#saklar-suara').addEventListener('change', (e) => {
  suaraOn = e.target.checked;
  if (suaraOn) siapkanAudio();
  post('/api/suara', { aktif: suaraOn }, true);
});

function aturTombol() {
  $('#form-mulai').hidden = aktif && !selesai;
  $('#form-pesan').hidden = !aktif || selesai;
  $('#lanjut').disabled = !aktif || selesai || sibuk;
  $('#selesai').disabled = !aktif || selesai;
  if (selesai) $('#topik').value = '';
}

// ---------- form ----------
$('#form-mulai').addEventListener('submit', async (e) => {
  e.preventDefault();
  siapkanAudio();
  const peran = Object.fromEntries(anggota.filter((a) => a.peran).map((a) => [a.id, a.peran]));
  await post('/api/mulai', { topik: $('#topik').value, ronde: Number($('#ronde').value), peran });
});
async function kirimPesan() {
  const t = $('#pesan').value.trim();
  if (!t) return;
  $('#pesan').value = '';
  await post('/api/pesan', { teks: t });
}
$('#form-pesan').addEventListener('submit', (e) => { e.preventDefault(); kirimPesan(); });
$('#pesan').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirimPesan(); } });
$('#lanjut').addEventListener('click', () => post('/api/lanjut'));
$('#selesai').addEventListener('click', () => post('/api/selesai'));

// ---------- lampiran ----------
const EKST = /\.(pdf|docx|txt|md|markdown|csv|tsv|json|jsonl|ya?ml|xml|html?|py|m?js|tsx?|jsx|css|java|c|cpp|h|cs|go|rs|php|rb|sh|ps1|bat|sql|ini|toml|log|tex|rst)$/i;
const LEWATI = /(^|\/)(\.git|node_modules|__pycache__|\.venv|venv|dist|build|\.next)(\/|$)/;
const MAKS = 10 * 1024 * 1024;
const MAKS_FILE_FOLDER = 150;

function gambarDokumen(s) {
  const docs = s.dokumen || [];
  $('#jml-dok').textContent = docs.length;
  $('#jml-dok-atas').textContent = docs.length || '';
  $('#daftar-dok').innerHTML = docs.map((d) => `<li title="${esc(d.nama)} · ${d.bagian} bagian · ${(d.ukuran / 1024).toFixed(0)} KB">
    <span class="nama">${esc(d.nama)}</span><span class="kecil">${d.bagian}</span>
    <button type="button" data-hapus="${esc(d.id)}" aria-label="Hapus ${esc(d.nama)}">×</button></li>`).join('');
  $('#tepercaya').checked = Boolean(s.hanyaTepercaya);
  if ('suaraAktif' in s) { suaraOn = s.suaraAktif; $('#saklar-suara').checked = suaraOn; }
  if (s.daftarSuara && !daftarSuara.length) { daftarSuara = s.daftarSuara; gambarKursi(); }
}

function keBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function unggah(files) {
  const nama = (f) => f.webkitRelativePath || f.relativePath || f.name;
  let calon = [...files].filter((f) => !LEWATI.test(nama(f)));
  const ditolak = calon.filter((f) => !EKST.test(f.name) || f.size > MAKS || f.size === 0);
  calon = calon.filter((f) => !ditolak.includes(f)).slice(0, MAKS_FILE_FOLDER);
  const info = $('#info-unggah');
  let ok = 0;
  const gagal = [];
  for (const [i, f] of calon.entries()) {
    info.textContent = `Mengunggah ${i + 1}/${calon.length}: ${nama(f)}…`;
    try {
      const d = await post('/api/unggah', { nama: nama(f), data: await keBase64(f) }, true);
      if (d.ok) ok += 1; else gagal.push(d.error);
    } catch (e) { gagal.push(`${nama(f)}: ${e.message}`); }
  }
  info.textContent = `${ok} file terlampir.` + (ditolak.length ? ` ${ditolak.length} dilewati (jenis tidak didukung, kosong, atau > 10 MB).` : '')
    + (gagal.length ? ` Gagal: ${gagal.slice(0, 3).join('; ')}${gagal.length > 3 ? '…' : ''}` : '');
}

$('#pilih-file').addEventListener('change', (e) => { unggah(e.target.files); e.target.value = ''; });
$('#pilih-folder').addEventListener('change', (e) => { unggah(e.target.files); e.target.value = ''; });
$('#daftar-dok').addEventListener('click', (e) => { const id = e.target.dataset.hapus; if (id) post('/api/dokumen/hapus', { id }); });
$('#hapus-semua').addEventListener('click', () => { if (confirm('Hapus semua lampiran dari rapat?')) post('/api/dokumen/hapus', {}); });
$('#tepercaya').addEventListener('change', (e) => post('/api/dokumen/tepercaya', { aktif: e.target.checked }));

// seret-lepas file atau folder ke kolom chat
async function isiEntri(entri, awalan = '') {
  if (entri.isFile) {
    return new Promise((resolve) => entri.file((f) => { f.relativePath = awalan + f.name; resolve([f]); }, () => resolve([])));
  }
  if (entri.isDirectory) {
    const pembaca = entri.createReader();
    const semua = [];
    for (;;) {
      const batch = await new Promise((resolve) => pembaca.readEntries(resolve, () => resolve([])));
      if (!batch.length) break;
      for (const e of batch) semua.push(...await isiEntri(e, `${awalan}${entri.name}/`));
    }
    return semua;
  }
  return [];
}
const area = $('#area-chat');
area.addEventListener('dragover', (e) => { e.preventDefault(); $('#lapisan-seret').hidden = false; });
area.addEventListener('dragleave', (e) => { if (!area.contains(e.relatedTarget)) $('#lapisan-seret').hidden = true; });
area.addEventListener('drop', async (e) => {
  e.preventDefault();
  $('#lapisan-seret').hidden = true;
  const entri = [...e.dataTransfer.items].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  const files = entri.length ? (await Promise.all(entri.map((x) => isiEntri(x)))).flat() : [...e.dataTransfer.files];
  unggah(files);
});

// ---------- live ----------
function terapkan(s) {
  gambarDokumen(s);
  anggota = s.anggota || anggota;
  moderator = s.moderator || moderator;
  aktif = Boolean(s.topik);
  selesai = Boolean(s.selesai);
  sibuk = Boolean(s.sibuk);
  antrean.length = 0;
  $('#log').innerHTML = '';
  (s.log || []).forEach(tambahLog);   // riwayat (mis. setelah refresh) tampil langsung, tanpa suara
  gambarKursi();
  statusServer = { teks: s.status || '', pembicara: s.pembicara || null };
  tampilkanStatus();
  $('#info-arsip').innerHTML = s.arsip ? `Transkrip: <a href="/${esc(s.arsip)}" target="_blank">${esc(s.arsip)}</a>` : '';
  aturTombol();
}

const es = new EventSource('/stream');
es.addEventListener('open', () => { $('#conn').className = 'conn on'; });
es.addEventListener('error', () => { $('#conn').className = 'conn off'; });
es.addEventListener('snapshot', (m) => {
  const s = JSON.parse(m.data);
  terapkan(s);
  // Halaman dimuat ulang di tengah rapat: semua yang ada di snapshot dianggap sudah diputar.
  const akhir = Math.max(0, ...(s.log || []).map((x) => x.nomor || 0));
  if (akhir) post('/api/diputar', { nomor: akhir }, true);
});
es.addEventListener('message', (m) => {
  const ev = JSON.parse(m.data);
  if (ev.jenis === 'mulai') { terapkan(ev); return; }
  if (ev.jenis === 'log') terimaLog(ev);
  if (ev.jenis === 'tarik') {
    // Jawaban yang belum diputar ditarik server karena Louis menyela; akan diganti jawaban baru.
    const item = antrean.find((x) => x.m.nomor === ev.nomor);
    if (item) item.ditarik = true; // ditandai saja; pemutar melewatinya (jangan diubah urutannya di sini)
  }
  if (ev.jenis === 'suara') {
    const item = antrean.find((x) => x.m.nomor === ev.nomor);
    if (item) { if (ev.url) item.url = `/${ev.url}`; else item.gagal = true; }
  }
  if (ev.jenis === 'status') { statusServer = { teks: ev.teks, pembicara: ev.pembicara }; tampilkanStatus(); }
  if (ev.jenis === 'anggota') { anggota = ev.anggota; if (ev.moderator) moderator = ev.moderator; gambarKursi(); }
  if (ev.jenis === 'dokumen') gambarDokumen(ev);
  if (ev.jenis === 'sibuk') { sibuk = ev.sibuk; if (ev.selesai) selesai = true; aturTombol(); }
  if (ev.jenis === 'arsip') $('#info-arsip').innerHTML = `Transkrip: <a href="/${esc(ev.file)}" target="_blank">${esc(ev.file)}</a>`;
});

// ---------- tahap 4: Louis bicara (tahan untuk bicara) ----------
// Memakai pengenal suara bawaan browser (Chrome/Edge). Audio diproses oleh layanan pengenal suara browser.
const PengenalSuara = window.SpeechRecognition || window.webkitSpeechRecognition;
let dengar = null;        // { rec, sasaran, teksAwal, final, tombol }

function mulaiDengar(sasaran, tombol) {
  if (!PengenalSuara || dengar) return;
  const el = $(`#${sasaran}`);
  if (!el || el.closest('form').hidden) return;
  const rec = new PengenalSuara();
  rec.lang = 'id-ID';
  rec.interimResults = true;
  rec.continuous = true;
  dengar = { rec, sasaran, el, teksAwal: el.value.trim(), final: '', tombol, lepas: false };
  rec.onresult = (ev) => {
    let sementara = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) dengar.final += `${r[0].transcript} `;
      else sementara += r[0].transcript;
    }
    const gabung = `${dengar.teksAwal ? `${dengar.teksAwal} ` : ''}${dengar.final}${sementara}`.trim();
    el.value = gabung;
    $('#teks-dengar').textContent = gabung.slice(-140);
  };
  rec.onerror = (ev) => {
    if (ev.error === 'no-speech' || ev.error === 'aborted') return; // jeda biasa; onend akan mendengarkan lagi
    if (dengar) dengar.galat = true;
    const pesan = ev.error === 'not-allowed' ? 'izin mikrofon ditolak' : ev.error === 'network' ? 'pengenal suara butuh internet' : ev.error === 'no-speech' ? 'tidak terdengar suara' : ev.error;
    tampilkanError(`Mikrofon: ${pesan}`);
  };
  // Chrome kadang berhenti sendiri saat Louis jeda sejenak; selama tombol masih ditahan, dengarkan lagi.
  rec.onend = () => {
    if (dengar && !dengar.lepas && !dengar.galat) {
      dengar.teksAwal = dengar.el.value.trim();
      dengar.final = '';
      try { rec.start(); return; } catch { /* jatuh ke selesai */ }
    }
    selesaiDengar();
  };
  try { rec.start(); } catch { dengar = null; return; }
  tombol?.classList.add('aktif');
  $('#mendengar').hidden = false;
  $('#teks-dengar').textContent = '';
  if (audioSekarang) audioSekarang.volume = 0.15; // kecilkan anggota yang sedang bicara
}

function lepasDengar() {
  if (!dengar || dengar.lepas) return;
  dengar.lepas = true;
  try { dengar.rec.stop(); } catch { selesaiDengar(); } // hasil terakhir masih menyusul lewat onresult, lalu onend
}

function selesaiDengar() {
  if (!dengar) return;
  const { sasaran, el, tombol } = dengar;
  dengar = null;
  tombol?.classList.remove('aktif');
  $('#mendengar').hidden = true;
  if (audioSekarang) audioSekarang.volume = 1;
  // Selaan langsung dikirim; topik rapat dibiarkan untuk diperiksa dulu.
  if (sasaran === 'pesan' && el.value.trim()) kirimPesan();
  else el.focus();
}

function tampilkanError(t) {
  $('#status').textContent = t;
  setTimeout(() => { if ($('#status').textContent === t) tampilkanStatus(); }, 4000);
}

for (const b of document.querySelectorAll('.mik')) {
  if (!PengenalSuara) { b.disabled = true; b.title = 'Browser ini belum mendukung pengenal suara (pakai Chrome atau Edge)'; continue; }
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); siapkanAudio(); mulaiDengar(b.dataset.sasaran, b); });
  b.addEventListener('pointerup', lepasDengar);
  b.addEventListener('pointerleave', lepasDengar);
  b.addEventListener('pointercancel', lepasDengar);
}

// Tahan Spasi (saat tidak sedang mengetik) untuk menyela dengan suara.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || !PengenalSuara) return;
  if (e.target.closest('textarea, input, select, button')) return;
  e.preventDefault();
  const sasaran = $('#form-pesan').hidden ? 'topik' : 'pesan';
  mulaiDengar(sasaran, document.querySelector(`.mik[data-sasaran="${sasaran}"]`));
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') lepasDengar(); });
