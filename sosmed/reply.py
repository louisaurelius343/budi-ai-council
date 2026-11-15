import argparse, json, sys
from atproto import Client, models
ENV = r"D:\budi\.openclaw\.env"
INBOX = r"D:\labs\sosmed\inbox.json"

try:  # Kantor AI (opsional; kalau tidak ada, balasan tetap jalan)
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
ap.add_argument("--id", required=True); ap.add_argument("--file", required=True)
ap.add_argument("--yes", action="store_true")
a = ap.parse_args()

inbox = json.load(open(INBOX, encoding="utf-8"))
item = next((x for x in inbox if x["id"] == a.id), None)
if item is None:
    kantor("kurir", "error", "Membalas mention", room="sosmed", detail="ID tidak ada di antre")
    raise SystemExit("ID tak ada di antre. Jalankan cek_mention.py dulu.")

text = open(a.file, encoding="utf-8-sig").read().strip()
siapa = "@" + item["author"]
if len(text) > 300:
    kantor("kurir", "error", "Balasan untuk " + siapa, room="sosmed", detail=f"terlalu panjang ({len(text)} karakter)")
    raise SystemExit("Terlalu panjang: " + str(len(text)) + " karakter (maks 300).")

if not a.yes:
    print("DRY-RUN balasan untuk [" + item["author"] + "]:\n" + text + "\n[" + str(len(text)) + " karakter]")
    kantor("kurir", "done", "Draf balasan untuk " + siapa + " menunggu persetujuan", detail=" ".join(text.split())[:60])
    raise SystemExit(0)

kantor("kurir", "start", "Membalas " + siapa, room="sosmed")
try:
    e = envv()
    c = Client(); c.login(e["BSKY_HANDLE"], e["BSKY_APP_PASSWORD"])
    parent = models.ComAtprotoRepoStrongRef.Main(uri=item["id"], cid=item["cid"])
    root = models.ComAtprotoRepoStrongRef.Main(uri=item["root_uri"], cid=item["root_cid"])
    post = c.send_post(text=text, reply_to=models.AppBskyFeedPost.ReplyRef(parent=parent, root=root))
except Exception as ex:
    kantor("kurir", "error", "Membalas " + siapa, room="sosmed", detail=f"{type(ex).__name__}: {ex}")
    raise

inbox = [x for x in inbox if x["id"] != a.id]
json.dump(inbox, open(INBOX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
url = "https://bsky.app/profile/" + e["BSKY_HANDLE"] + "/post/" + post.uri.split("/")[-1]
kantor("kurir", "done", "Membalas " + siapa, detail=url)
print("DIBALAS: " + url)
