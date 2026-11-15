import argparse, tweepy
ENV = r"D:\budi\.openclaw\.env"
def envv():
    d = {}
    for l in open(ENV, encoding="utf-8"):
        l = l.strip()
        if "=" in l and not l.startswith("#"):
            k, v = l.split("=", 1); d[k.strip()] = v.strip().strip('"').strip("'")
    return d
ap = argparse.ArgumentParser(); ap.add_argument("--file", required=True); ap.add_argument("--yes", action="store_true")
a = ap.parse_args()
text = open(a.file, encoding="utf-8").read().strip()
if len(text) > 280:
    raise SystemExit("Terlalu panjang: " + str(len(text)) + " karakter (maks 280).")
if not a.yes:
    print("DRY-RUN (tidak diposting). Isi:\n" + text + "\n[" + str(len(text)) + " karakter]"); raise SystemExit(0)
e = envv()
c = tweepy.Client(consumer_key=e["X_API_KEY"], consumer_secret=e["X_API_SECRET"],
                  access_token=e["X_ACCESS_TOKEN"], access_token_secret=e["X_ACCESS_SECRET"])
r = c.create_tweet(text=text)
print("DIPOSTING: https://x.com/i/web/status/" + str(r.data["id"]))
