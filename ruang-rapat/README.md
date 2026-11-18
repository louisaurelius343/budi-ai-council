# Ruang Rapat Dewan

Rapat debat antara Louis dan beberapa model AI dari keluarga berbeda. Model-model itu berpendapat bebas, saling membantah dengan menyebut nama, dan dipandu seorang moderator. Ini **tahap 1**: debat dan kolom chat dalam halaman web. Ruangan 3D dan suara menyusul.

## Menjalankan
1. Nyalakan **9router** dulu. Semua model dipanggil lewat 9router.
2. Klik dua kali `start-rapat.cmd`, atau jalankan:
   ```bash
   node D:\labs\ruang-rapat\server.mjs
   ```
3. Buka http://127.0.0.1:7788.

Tidak butuh `npm install`.

## Anggota

| Nama | Model | Keluarga |
|---|---|---|
| Moderator | `holver/gpt-6-luna` | GPT |
| Dipa | `oc/deepseek-v4.1-flash-free` | DeepSeek |
| Gita | `oc/glm-5.3-flash-free` | GLM |
| Gema | `gemini/gemini-3.5-flash-lite` | Gemini |
| Oskar | `groq/openai/gpt-oss-120b` | GPT-OSS |

Daftar ini bisa diubah di `ANGGOTA_AWAL` dan `MODERATOR` di `server.mjs`.

## Alur rapat
1. Tulis masalah, pilih jumlah ronde (1–4), lalu klik **Mulai rapat**.
2. Moderator membuka rapat dan menyebut 2–3 pertanyaan kunci.
3. Tiap ronde, anggota bicara bergiliran. Mereka diminta tidak sekadar setuju, dan menanggapi anggota lain dengan menyebut nama. Setelah ronde, moderator merangkum titik perbedaan, dan kalau semua terlalu cepat sepakat, moderator meminta salah satu anggota membantah.
4. **Menyela:** tulis di kolom chat kapan saja. Pembicara berikutnya menanggapi selaanmu lebih dulu. Kalau rapat sedang diam, selaan memicu satu ronde tanggapan.
5. **Peran:** kosong berarti bebas berpendapat. Isi kolom peran (misalnya "advokat setan") sebelum atau selama rapat. Perubahan berlaku mulai giliran berikutnya.
6. Gunakan **+ Satu ronde lagi** untuk melanjutkan, atau **Selesaikan rapat** untuk kesimpulan moderator: hal yang disepakati, perbedaan yang tersisa, rekomendasi, dan hal yang belum pasti.
7. Transkrip tersimpan di `rapat/<waktu>.md`.

Anggota yang gagal menjawab (limit, model mati) dilewati, dan penyebabnya tampil di chat.

## Lampiran (tahap 2)
- **Cara unggah:** tombol **📄 File** atau **📁 Folder**, atau seret file/folder ke kolom chat. Bisa sebelum maupun di tengah rapat.
- **Jenis yang didukung:** PDF (yang berisi teks), Word (`.docx`), teks, Markdown, kode, CSV/JSON. Maksimal 10 MB per file dan 150 file per folder. Folder `.git`, `node_modules`, dan sejenisnya dilewati. PDF hasil scan (gambar) dan gambar belum didukung.
- **Cara berbagi isi:** dokumen dipotong per bagian sekitar 1.100 karakter. Tiap giliran, anggota hanya diberi 4 potongan yang paling relevan dengan topik dan percakapan terakhir. Pencariannya kata kunci (ala BM25), bukan embedding, jadi gratis, lokal, dan seluruh dokumen tidak pernah dikirim ke mana pun.
- **Kutipan bersumber:** anggota diminta menyebut sumbernya secara lisan ("di proposal.pdf bagian 3…"). Di bawah setiap ucapan tampil penanda 📎 potongan yang diberikan kepadanya. Arahkan kursor ke penanda untuk melihat cuplikannya.
- **Hanya model tepercaya:** kalau dicentang, isi dokumen hanya diberikan ke model Holver/OpenAI (saat ini Moderator). Anggota lain diberi tahu ada lampiran tapi tidak melihat isinya.
- **Masa simpan:** lampiran disimpan di memori server dan tetap ada antar-rapat sampai dihapus atau server dimatikan. File aslinya tidak disimpan ke disk.
- Isi dokumen selalu diperlakukan sebagai **data, bukan instruksi**.

## Ruang 3D dan suara (tahap 3)

- Panggung 3D (Three.js, disertakan lokal di `public/vendor/`): meja oval, Moderator di ujung, anggota duduk di seberang Louis.
- Setiap ucapan dibacakan dengan edge-tts; suara per anggota bisa dipilih di laci "Anggota & lampiran". File audio sementara ada di `suara/` dan dihapus saat rapat baru dimulai.
- Saat audio diputar: subtitle muncul, avatar pembicara menyala, mulutnya bergerak mengikuti volume, dan kamera menoleh ke arahnya. Pesan di kolom chat muncul bersamaan dengan suaranya.
- Saklar "Suara" mematikan audio; teks tetap tampil berurutan dengan jeda baca.
- Contoh suara untuk dipilih ada di `contoh-suara/`.

## Louis bicara (tahap 4)

- Tahan tombol 🎤 (atau tahan **Spasi** saat tidak sedang mengetik), bicara, lalu lepas. Selaan langsung terkirim; topik rapat diisi ke kotak dulu supaya bisa diperiksa sebelum mulai.
- Saat Louis bicara, suara anggota yang sedang berbicara dikecilkan.
- Memakai pengenal suara bawaan browser (Chrome/Edge, bahasa id-ID). Butuh internet, dan audionya diproses oleh layanan pengenal suara browser (Google untuk Chrome, Microsoft untuk Edge). Kalau ingin sepenuhnya lokal, bisa diganti Whisper nanti.
- Ucapan seperti "stop", "cukup", atau "akhiri rapat" menghentikan rapat dan meminta kesimpulan.

## Keamanan dan privasi
- Server hanya mendengarkan di `127.0.0.1`. POST wajib berformat JSON dari halaman ini sendiri, dan CSP tidak mengizinkan skrip inline.
- **Isi topik dan pesan dikirim ke semua penyedia model anggota**, termasuk model gratis OpenCode. Jangan membahas data yang sangat pribadi.
- Isi transkrip diperlakukan sebagai data, bukan instruksi, oleh setiap anggota.

## Tahap berikutnya
3. Ruangan 3D dan suara berbeda per anggota.
4. Bicara dengan suara (tahan untuk bicara).
5. Integrasi dengan Budi dan Kantor AI.
