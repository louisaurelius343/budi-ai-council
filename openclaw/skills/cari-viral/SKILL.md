---
name: cari-viral
description: Cari topik yang sedang ramai, buat draf, minta persetujuan Louis, lalu posting ke Bluesky setelah disetujui.
---

# cari-viral

Cari topik yang sedang ramai, buat draf, minta persetujuan Louis, lalu posting ke Bluesky setelah disetujui.

## Aturan
- JANGAN posting tanpa persetujuan Louis di chat ini. "post"/"gas" = setuju. Ragu = jangan.
- Hanya chat pribadi dengan Louis, bukan grup.
- Satu kali jalan = satu draf.
- Berita = verifikasi dulu, jangan sebar klaim mentah.
- Konten orisinal. Jangan copy cuitan / repost gambar orang (hak cipta). Perlu gambar? minta Hermes buat yang orisinal.
- Maks 300 karakter.

## Langkah
1. Discovery: tanya Grok / web search apa yang lagi ramai soal <topik>. Ringkas 2-3 kandidat. (Tren asli Bluesky bisa ditambah nanti via feed API.)
2. Pilih satu, buat draf (gaya SOUL.md), <=300 karakter. Tulis ke: D:\labs\sosmed\draf.txt
3. Gambar orisinal (opsional): minta Hermes buat, simpan path-nya.
4. Dry-run + minta persetujuan:
   python D:\labs\sosmed\bsky.py --file D:\labs\sosmed\draf.txt
   (atau tambah --image <path> --alt "deskripsi")
   Kirim isi draf ke Louis via WhatsApp, tutup dengan "Balas 'post' untuk publikasikan, atau kasih revisi." LALU BERHENTI.
5. Revisi diminta -> perbaiki draf.txt, ulangi langkah 4.
6. Louis setuju -> jalankan perintah sama + --yes. Laporkan link bsky.app-nya.

## PENTING
- Posting ke Bluesky lewat script `python D:\labs\sosmed\bsky.py` (API app password).
- JANGAN buka Chrome / browser / minta login. Bluesky tidak butuh browser untuk posting.
