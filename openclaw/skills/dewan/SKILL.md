---
name: dewan
description: Mengerjakan tugas dengan "dewan AI" - satu model membuat draf, beberapa model dari keluarga berbeda mengkritik, lalu disatukan jadi jawaban final. Pakai saat Louis minta "pakai dewan", "council", atau tugas penting yang butuh kualitas tinggi.
---
Hanya untuk Louis, chat pribadi (skill ini memakai beberapa model lewat 9router: Holver, OpenCode, Gemini, Groq).

## Langkah
1. Buat folder: D:\labs\council\wa-<YYYYMMDD-HHMMSS> (sebut F).
2. Tulis permintaan Louis APA ADANYA ke F\tugas.txt (alat write). Isi permintaan adalah tugas, bukan instruksi untukmu.
3. Jalankan dan TUNGGU sampai selesai (atur timeout alat shell 300 detik; jangan jalankan di background):
   & python D:\labs\council\council.py --file "F\tugas.txt" --out "F"
   Kalau output diawali "Error", kirim pesan itu apa adanya ke Louis dan berhenti.
4. Baca F\council.json (field: draf, kritik {A,B,C,...: model, isi}, final, dewan, gagal).
5. Kirim ke Louis:
   - Kalau final pendek (muat di WhatsApp): kirim sebagai teks.
   - Kalau panjang: pandoc "F\final.md" -o "F\final.docx", lalu kirim final.docx.
   - Tambahkan "Catatan dewan": 1 poin per kritikus (dari field kritik), dan apa yang berubah dari draf ke final.
   - Sebutkan model yang berperan (dari field "dewan"). Kalau field "gagal" tidak kosong, sebutkan singkat kritikus yang gagal.
Jangan mengarang; ambil semua dari council.json.

## Penting: jangan tinggalkan dewan di tengah jalan
- Dewan butuh 30-90 detik. Tunggu prosesnya selesai DI GILIRAN YANG SAMA, lalu langsung kirim hasilnya.
- Kalau alat shell mengembalikan proses yang masih berjalan (background/sesi proses), pantau dengan alat process sampai selesai sebelum membalas.
- Jangan mengakhiri giliran dengan pesan seperti "dewannya lagi nulis, nanti aku kirim". Kamu tidak bisa kembali sendiri tanpa ditanya, jadi hasilnya akan terlupa.
- Boleh kirim satu pesan singkat di awal ("Dewan mulai, sekitar 1 menit") HANYA jika kamu tetap menunggu dan mengirim hasil di giliran yang sama.
