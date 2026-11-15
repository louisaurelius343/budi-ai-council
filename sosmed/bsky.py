import argparse, sys
from atproto import Client
ENV = r"D:\budi\.openclaw\.env"

try:  # Kantor AI (opsional; kalau tidak ada, posting tetap jalan)
    sys.path.insert(0, r"D:\labs\kantor-ai")
    from kantor import event as kantor
except Exception:
    def kantor(*a, **k):
        pass

def envv():
    d = {}
    for l in open(ENV, encoding="utf-8-sig"):
        l = l.strip()
        if "=" in l and not l.startswith("#"):
            k, v = l.split("=", 1); d[k.strip()] = v.strip().strip('"').strip("'")
    return d

ap = argparse.ArgumentParser()
ap.add_argument("--file", required=True)
ap.add_argument("--image")
ap.add_argument("--alt", default="gambar")
ap.add_argument("--yes", action="store_true")
a = ap.parse_args()

text = open(a.file, encoding="utf-8-sig").read().strip()
cuplik = " ".join(text.split())[:60]
if len(text) > 300:
    kantor("kurir", "error", "Draf posting: " + cuplik, room="sosmed", detail=f"terlalu panjang ({len(text)} karakter, maks 300)")
    raise SystemExit("Terlalu panjang: " + str(len(text)) + " karakter (maks 300 di Bluesky).")

if not a.yes:
    print("DRY-RUN (tidak diposting). Isi:\n" + text + "\n[" + str(len(text)) + " karakter]" +
          ("\nGambar: " + a.image if a.image else ""))
    kantor("kurir", "done", "Draf siap, menunggu persetujuan Louis", detail=cuplik)
    raise SystemExit(0)

kantor("kurir", "start", "Memposting ke Bluesky: " + cuplik, room="sosmed", detail="dengan gambar" if a.image else None)
try:
    e = envv()
    c = Client()
    c.login(e["BSKY_HANDLE"], e["BSKY_APP_PASSWORD"])
    if a.image:
        with open(a.image, "rb") as f:
            post = c.send_image(text=text, image=f.read(), image_alt=a.alt)
    else:
        post = c.send_post(text=text)
except Exception as ex:
    kantor("kurir", "error", "Memposting ke Bluesky: " + cuplik, room="sosmed", detail=f"{type(ex).__name__}: {ex}")
    raise
url = "https://bsky.app/profile/" + e["BSKY_HANDLE"] + "/post/" + post.uri.split("/")[-1]
kantor("kurir", "done", "Terposting di Bluesky", detail=url)
print("DIPOSTING: " + url)
