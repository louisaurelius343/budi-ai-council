# Kantor AI

Pemantau visual untuk agen-agen Budi. Ruangan 2D berisi karakter mini yang berjalan ke ruangan sesuai tugas yang sedang dikerjakan. Error tampil merah lengkap dengan penyebabnya. Semuanya berjalan lokal di `http://127.0.0.1:7777`.

## Menjalankan
```bash
node D:\labs\kantor-ai\server.mjs
```
Lalu buka http://127.0.0.1:7777. Bisa juga dengan klik dua kali `start-kantor.cmd`.

Server berhenti dengan Ctrl+C di jendelanya. Tidak butuh `npm install`, cukup Node.js.

## Ruangan dan agen
| Ruangan | Agen | Sumber event |
|---|---|---|
| Ruang Dewan | Ketua Dewan, Kritikus A–D, Budi | `D:\labs\council\council.py` |
| Perpustakaan (RAG) | Pustakawan | `D:\labs\rag\rag.py` (index, ask) |
| Pantry & Kafe | Pencari Kafe | `D:\labs\kafe\kafe.py` |
| Lab Riset | Hermes | belum terhubung |
| Studio Sosmed | Kurir Sosmed | belum terhubung |
| Ruang Server | 9router, Budi Gateway | dicek otomatis setiap 15 detik |
| Lobi | semua agen yang sedang menganggur | – |

Tombol **Simulasi** memutar skenario contoh: dewan bersidang, satu kritikus error, RAG, dan cari-kafe. Gunanya untuk demo atau rekaman video portofolio.

## Format event
Setiap baris di `events.jsonl` berisi satu event JSON:
```json
{"ts":"2026-11-15T11:10:15Z","agent":"pustakawan","status":"start","task":"Cari di dokumen: ...","room":"perpustakaan","detail":"opsional"}
```
- `status`: `start`, `progress`, `done`, `error`, atau `idle`
- `room`: `lobi`, `dewan`, `perpustakaan`, `kafe`, `riset`, `sosmed`, atau `server`

Dari Python:
```python
import sys; sys.path.insert(0, r"D:\labs\kantor-ai")
from kantor import event, tugas
event("hermes", "start", "Riset sejarah bot WA", room="riset")
with tugas("kurir", "Draf balasan Bluesky", room="sosmed"):
    ...  # otomatis 'done', atau 'error' beserta pesannya
```
Dari skrip lain, kirim `POST /api/event` dengan `Content-Type: application/json`.

## Desain dan keamanan
- `kantor.py` **tidak pernah membuat skrip pemanggil gagal**. Kalau pencatatan gagal, kesalahannya diabaikan. Kalau kantor tidak dipasang, dewan, RAG, dan kafe tetap jalan.
- Server hanya mendengarkan di `127.0.0.1`, karena teks tugas bisa berisi isi pesan pribadi.
- `POST` wajib berformat JSON dan berasal dari halaman kantor sendiri. Situs lain yang terbuka di browser tidak bisa menyuntikkan event.
- Teks dibatasi panjangnya (tugas 120 karakter, detail 300 karakter). Semua teks di-escape sebelum tampil, dan CSP tidak mengizinkan skrip atau style inline.
- Tanpa dependensi: Node bawaan untuk server, Canvas 2D untuk gambar, dan Server-Sent Events untuk update live.
