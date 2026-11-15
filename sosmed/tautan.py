import urllib.parse
teks = open(r"D:\labs\sosmed\draf.txt", encoding="utf-8-sig").read().strip()
if len(teks) > 280:
    raise SystemExit("Terlalu panjang: " + str(len(teks)) + " karakter (maks 280).")
print("https://x.com/intent/post?text=" + urllib.parse.quote(teks))
