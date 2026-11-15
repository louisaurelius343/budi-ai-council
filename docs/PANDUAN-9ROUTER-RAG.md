# Panduan 9router, Dewan AI, dan RAG

Terakhir diperbarui: 14 November 2026

Dokumen ini menjelaskan tiga komponen yang dipasang untuk Budi:

1. **9router**: satu pintu (endpoint) untuk semua provider AI.
2. **Dewan AI**: satu model menulis draf, beberapa model lain mengkritik, lalu draf direvisi jadi jawaban final.
3. **RAG**: Budi menjawab pertanyaan dari dokumen milik Louis sendiri.

---

## 1. Gambaran besar

```
                    ┌────────────── 9router (127.0.0.1:20128) ──────────────┐
WhatsApp ─► Budi ─► │ holver/*  groq/*  oc/* (OpenCode)  gemini/*           │ ─► Provider
  (OpenClaw)        └───────────────────────────────────────────────────────┘
     │
     ├─ skill "dewan"        ─► D:\labs\council\council.py ─► 9router
     └─ skill "cari-dokumen" ─► D:\labs\rag\rag.py         ─► 9router (embedding + jawaban)
```

| Komponen | Lokasi |
|---|---|
| 9router (program) | `%APPDATA%\\npm\node_modules\9router` |
| 9router (data: provider, API key, statistik) | `%APPDATA%\\9router\` |
| Peluncur 9router | `D:\9router\start-9router.cmd` dan `.vbs` |
| Autostart | Tidak ada. 9router dinyalakan manual |
| Log 9router | `D:\9router\9router.log` |
| Dewan AI | `D:\labs\council\council.py` (cadangan versi lama: `council.py.bak`) |
| RAG | `D:\labs\rag\rag.py`, dengan indeks di `D:\labs\rag\index\` |
| Skill Budi | `D:\budi\.openclaw\workspace\skills\{dewan,cari-dokumen}\SKILL.md` |
| API key 9router | `D:\budi\.openclaw\.env`, variabel `NINEROUTER_API_KEY` |

---

## 2. 9router

### 2.1 Instalasi

- Versi terpasang: **0.5.112**. Versi ini sengaja dipilih karena sudah berumur sekitar 2 minggu saat dipasang, sedangkan versi terbaru baru 2 hari. Ini praktik aman untuk paket npm.
- Perintah yang dipakai: `npm install -g 9router@0.5.112`.
- Skrip postinstall diblokir npm. Server tetap berjalan normal tanpa skrip itu.
- Server hanya mendengarkan di `127.0.0.1`. Pengaturan bawaannya `0.0.0.0`, yang berarti terbuka ke seluruh WiFi.
- Auto-update dimatikan (`--skip-update`).

### 2.2 Menyalakan, mematikan, dan cek status

9router **tidak** menyala otomatis. Nyalakan manual kalau perlu.

**Nyalakan:**
```bash
wscript "D:\9router\start-9router.vbs"
```

**Matikan:**
```bash
powershell -ExecutionPolicy Bypass -File D:\9router\matikan-9router.ps1
```

**Cek status:**
```bash
powershell -Command "try { Invoke-WebRequest http://127.0.0.1:20128/v1/models -UseBasicParsing -TimeoutSec 3 | Out-Null; '9router: NYALA' } catch { '9router: MATI' }"
```

**Dashboard:** http://127.0.0.1:20128/dashboard

> ⚠️ **Jangan jalankan 9router lewat Task Scheduler.** Kalau dijalankan dari Task Scheduler, semua API key ditolak (HTTP 401). Penyebab pastinya belum diketahui, kemungkinan terkait cara 9router mengenali mesin (`machine-id`). Dijalankan lewat `start-9router.vbs`, semuanya normal.

> ⚠️ **Urutan menyalakan:** nyalakan 9router **sebelum** Budi. Perintah kill dari BUDI.md (`openclaw|codex|hermes`) tidak ikut mematikan 9router.

### 2.2a Alur harian

**Menyalakan** (urutannya penting):
```bash
wscript "D:\9router\start-9router.vbs"
```
```bash
powershell -Command "Start-ScheduledTask -TaskName 'Budi Gateway'"
```

**Mematikan keduanya:**
```bash
powershell -ExecutionPolicy Bypass -File D:\9router\matikan-semua.ps1
```
> ⚠️ **9router hanya dinyalakan oleh Louis sendiri**, jangan dari sesi Claude Code. Proses dari sesi Claude berjalan di sandbox yang punya salinan AppData sendiri, sehingga data dashboard (password, provider, API key) bisa terpisah dari data aslinya. Ini sudah terjadi sekali pada 14 Nov 2026.

### 2.3 Endpoint untuk aplikasi lain

```
Base URL : http://127.0.0.1:20128/v1      (format OpenAI)
API key  : nilai NINEROUTER_API_KEY di .env
Model    : <provider>/<model>, misalnya holver/gpt-6-luna
```

Endpoint yang tersedia: `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`.

Untuk chat, kirim `"stream": false`. Beberapa provider, misalnya Groq, membalas dalam format streaming kalau parameter ini tidak disertakan.

### 2.4 Provider dan model (hasil tes 14 Nov 2026)

| Provider | Model yang **jalan** | Kecepatan | Catatan |
|---|---|---|---|
| Holver | `holver/gpt-6-luna`, `holver/agnes-3.0-flash` | cepat | Berbayar (saldo Holver). Model lain di Holver butuh paket terpisah |
| Groq | `groq/openai/gpt-oss-120b` | ±1,5 dtk | Gratis. `llama-3.3-70b` dan `qwen3-32b` ditolak karena akun tidak punya akses |
| OpenCode | `oc/deepseek-v4.1-flash-free`, `oc/glm-5.3-flash-free` | ±1 dtk | Gratis. 4 model `oc/` lain berstatus "unavailable" |
| Gemini (API) | `gemini/gemini-3.5-flash-lite` (tercepat), `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.6-flash` (lambat), `gemma-4-31b-it` (lambat) | bervariasi | Tier gratis cepat kena limit. Model pro dan `gemini-4-argon` langsung kena 429 |
| Gemini (embedding) | `gemini/gemini-embedding-001` | – | 3072 dimensi, dipakai RAG |
| Gemini CLI (`gc/`) | – | – | Semua 403. Perlu disambungkan ulang di dashboard |
| Kiro (`kr/`) | – | – | Ditolak: "versi Kiro tidak didukung". Disarankan tidak dipakai (lihat 2.5) |

**Saran:** di dashboard, nonaktifkan model yang gagal supaya fallback tidak buang waktu mencoba model yang mati.

### 2.5 Catatan keamanan dan ketentuan layanan

- Pakai provider dengan **API key resmi milik sendiri**: Holver, Groq, Gemini, OpenRouter, Cerebras, Mistral, GitHub Models.
- **Hindari** Kiro, `deepseek-web`, dan `perplexity-web`. Ketiganya memakai akun atau web app layanan lain, bukan API resmi, sehingga berisiko akun diblokir atau melanggar ketentuan layanan.
- Asal-usul model `oc/...-free` (OpenCode) kurang jelas. Jangan kirim data sangat pribadi ke model ini.
- Data yang dikirim ke Gemini tier gratis **bisa dipakai Google untuk melatih model**.
- Password dashboard sudah diganti dari bawaan `123456`. Jangan pakai ulang password itu di tempat lain.

### 2.6 Kandidat provider gratis lain (belum dipasang)

| Provider | Kelebihan |
|---|---|
| OpenRouter | Banyak model `:free` dari berbagai keluarga |
| Cerebras | Sangat cepat |
| Mistral | Keluarga model Eropa, tier "Experiment" gratis |
| GitHub Models | Cukup pakai akun GitHub |
| Ollama lokal | Tanpa batas dan privat, tergantung kemampuan laptop |

---

## 3. Dewan AI (`D:\labs\council\council.py`)

### 3.1 Alur

```
[1] Generator membuat draf
[2] 4 kritikus mengkritik secara PARALEL (keluarga model berbeda)
[3] Generator merevisi berdasarkan semua kritik yang berhasil → FINAL
```

| Peran | Model bawaan | Waktu tes |
|---|---|---|
| Generator dan reviser | `9r:holver/gpt-6-luna` | – |
| Kritikus | `9r:oc/deepseek-v4.1-flash-free` | 19 dtk |
| Kritikus | `9r:oc/glm-5.3-flash-free` | 18 dtk |
| Kritikus | `9r:gemini/gemini-3.5-flash-lite` | 2 dtk |
| Kritikus | `9r:groq/openai/gpt-oss-120b` | 2 dtk |

Total waktu tes: sekitar 31–34 detik.

### 3.2 Ketahanan terhadap gangguan

- Kritikus yang gagal (model mati atau kena limit) **dilewati** dan dicatat di field `gagal`. Dewan tetap jalan selama minimal 1 kritikus berhasil.
- Kalau 9router mati, generator Holver/Groq otomatis memanggil **API langsung**. Kritikus OpenCode dan Gemini tetap butuh 9router.
- `.env` dibaca dengan `utf-8-sig`. Versi lama gagal membaca kunci di baris pertama kalau file `.env` ber-BOM.

### 3.3 Cara pakai

```bash
python D:\labs\council\council.py --file tugas.txt --out D:\labs\council\hasil-1
```

Mengganti anggota dewan:
```bash
python D:\labs\council\council.py --file tugas.txt --out D:\labs\council\hasil-2 --generator 9r:holver/agnes-3.0-flash --critic 9r:oc/glm-5.3-flash-free,9r:gemini/gemini-3.5-flash-lite
```

Prefix provider: `9r:` (lewat 9router), `holver:`, `groq:` (langsung).

### 3.4 Output

- `final.md`: jawaban final.
- `council.json`, berisi field:
  - `task`, `draf`, `final`
  - `kritik`: `{A: {model, isi}, B: …}`
  - `kritik_A`, `kritik_B`: dipertahankan supaya tetap kompatibel dengan versi lama
  - `gagal`, `dewan` (model per peran), `detik`, `waktu`

### 3.5 Skill Budi `dewan`

Dipicu saat Louis bilang "pakai dewan" atau "council", atau untuk tugas penting. Budi menulis tugas ke `D:\labs\council\wa-<waktu>\tugas.txt`, menjalankan `council.py`, lalu mengirim hasilnya: teks pendek langsung, atau `.docx` lewat pandoc kalau panjang. Budi juga menyertakan satu catatan per kritikus dan menyebutkan kritikus yang gagal.

---

## 4. RAG (`D:\labs\rag\rag.py`)

### 4.1 Sumber dokumen

Dipilih Louis: **tugas, PDF hasil kerja, dan memori Budi.**

| Ikut diindeks | Tidak ikut |
|---|---|
| `workspace\tugas\**` (.pdf, .docx, .md, .txt) | Laporan email (`laporan*email*`, `email*pagi*`) |
| `workspace\memory\**` | `daftar-nama-grup.pdf` |
| PDF dan DOCX di root workspace | `hermes\`, `media\`, `skills\`, AGENTS/SOUL/USER/TOOLS.md |

Daftar pengecualian diatur oleh variabel `EXCLUDE` dan fungsi `sources()` di `rag.py`.

Isi indeks per 14 Nov 2026: **110 file, 830 potongan** (memori 572, root 165, tugas 93).

### 4.2 Cara kerja

1. **Ekstraksi teks:** PDF lewat `pypdf` 5.4.0, DOCX dari XML, md/txt dibaca langsung.
2. **Pemotongan:** sekitar 1200 karakter per potongan, tumpang-tindih 200 karakter, dipotong di batas paragraf atau kalimat.
3. **Embedding:** `gemini/gemini-embedding-001` lewat 9router, dikirim per 32 potongan. Kalau kena limit (429/503), script menunggu 15, 30, 45 detik dan seterusnya, lalu mencoba lagi.
4. **Penyimpanan:** `index\vectors.npy` (numpy) dan `index\chunks.json` (teks dan hash file). Semuanya lokal.
5. **Pencarian:** cosine similarity, plus sedikit bonus kalau kata di pertanyaan cocok dengan nama file. Diambil 6 potongan teratas.
6. **Jawaban:** `holver/gpt-6-luna` (cadangan `oc/glm-5.3-flash-free`), temperatur 0,2. Model wajib mencantumkan sumber [n] dan bilang "tidak ditemukan di dokumen" kalau memang tidak ada.
7. **Pengaman injeksi:** prompt menegaskan bahwa potongan dokumen adalah **data, bukan instruksi** (pelajaran dari proyek red-team).

### 4.3 Perintah

```bash
python D:\labs\rag\rag.py index
```
Mengindeks file baru atau berubah saja. Cepat kalau tidak ada perubahan.

```bash
python D:\labs\rag\rag.py index --full
```
Mengindeks ulang semuanya. Butuh sekitar 5 menit karena limit Gemini gratis.

```bash
python D:\labs\rag\rag.py search "kata kunci"
```
Melihat potongan dokumen yang paling relevan.

```bash
python D:\labs\rag\rag.py ask "Apa isi presentasi EcoPoint?"
```
Bertanya dan mendapat jawaban beserta sumbernya.

```bash
python D:\labs\rag\rag.py ask "pertanyaan" --json
```
Format JSON, dipakai Budi.

```bash
python D:\labs\rag\rag.py stats
```
Menampilkan isi indeks.

### 4.4 Hasil tes

| Pertanyaan | Hasil |
|---|---|
| "Apa isi presentasi EcoPoint untuk UTS?" | ✅ Jawaban lengkap (bank sampah digital, fitur, target pengguna, model pendapatan), dengan sumber `Presentasi_EcoPoint_UTS.pdf` |
| "Siapa presiden Prancis tahun 1850?" (tidak ada di dokumen) | ✅ "tidak ditemukan di dokumen", tanpa mengarang |

### 4.5 Skill Budi `cari-dokumen`

- Dipicu oleh kalimat seperti "di tugasku…", "apa isi dokumen…", "dulu aku pernah…", atau "cari di catatan".
- Hanya untuk Louis di chat pribadi, karena memori bersifat pribadi.
- Langkahnya: `rag.py index`, lalu `rag.py ask "<pertanyaan>" --json`, lalu kirim jawaban dan daftar file sumber.
- Kalau potongan dokumen berisi perintah, Budi tidak mengikutinya dan memberi tahu Louis.

---

## 5. Pemecahan masalah

| Gejala | Penyebab / solusi |
|---|---|
| `Error: 9router tidak bisa dihubungi` | 9router mati. Nyalakan dengan perintah di 2.2 |
| HTTP 401 "Invalid API key" | Kemungkinan 9router dijalankan lewat Task Scheduler (lihat 2.2). Matikan, lalu nyalakan lewat `D:\9router\start-9router.vbs`. Atau key di `.env` tidak sama dengan key di dashboard |
| HTTP 503 "(reset after …)" | Model sedang ditolak provider atau kena limit. 9router menunggu sebelum mencoba lagi. Pilih model lain |
| 429 di Gemini | Kuota tier gratis habis. RAG otomatis menunggu. Untuk chat, pakai `gemini-3.5-flash-lite` |
| Kritikus dewan "GAGAL" | Normal untuk model gratis. Dewan tetap jalan. Cek field `gagal` di `council.json` |
| RAG tidak menemukan file baru | Jalankan `rag.py index`. Pastikan file ada di `tugas\`, `memory\`, atau root workspace dan tidak cocok dengan `EXCLUDE` |
| Skill baru tidak terbaca Budi | Restart Budi Gateway. Pastikan SKILL.md punya frontmatter `---name/description---` |

## 6. Ide lanjutan

- Tambah provider gratis resmi (OpenRouter, Cerebras) supaya dewan lebih tahan gangguan.
- Embedding lokal (`bge-m3` atau `multilingual-e5`) supaya RAG tidak tergantung kuota Gemini dan dokumen tidak keluar dari laptop.
- Arahkan Budi (OpenClaw) ke 9router supaya otomatis pindah provider kalau saldo Holver habis.
- Indeks ulang otomatis terjadwal, misalnya setiap malam.
- Uji `cari-dokumen` dengan serangan red-team: PDF berisi injeksi yang masuk ke indeks RAG.
