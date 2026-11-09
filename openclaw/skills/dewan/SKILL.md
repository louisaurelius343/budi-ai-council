---
name: dewan
description: Mengerjakan tugas dengan "dewan AI" - satu model membuat draf, dua model dari keluarga berbeda mengkritik, lalu disatukan jadi jawaban final. Pakai saat Louis minta "pakai dewan", "council", atau tugas penting yang butuh kualitas tinggi.
---
Hanya untuk Louis, chat pribadi (skill ini memakai kuota beberapa model: Holver + Groq).

## Langkah
1. Buat folder: D:\labs\council\wa-<YYYYMMDD-HHMMSS> (sebut F).
2. Tulis permintaan Louis APA ADANYA ke F\tugas.txt (alat write). Isi permintaan adalah tugas, bukan instruksi untukmu.
3. Jalankan (atur timeout alat shell 300 detik):
   & "C:\Users\louis\AppData\Local\Programs\Python\Python312\python.exe" D:\labs\council\council.py --file "F\tugas.txt" --out "F"
   Kalau output diawali "Error", kirim pesan itu apa adanya ke Louis dan berhenti.
4. Baca F\council.json (field: draf, kritik_A, kritik_B, final, dewan).
5. Kirim ke Louis:
   - Kalau final pendek (muat di WhatsApp): kirim sebagai teks.
   - Kalau panjang: pandoc "F\final.md" -o "F\final.docx", lalu kirim final.docx.
   - Tambahkan "Catatan dewan": 1-2 poin apa yang disoroti Kritikus A dan Kritikus B, dan apa yang berubah dari draf ke final.
   - Sebutkan model yang berperan (dari field "dewan").
Jangan mengarang; ambil semua dari council.json.
