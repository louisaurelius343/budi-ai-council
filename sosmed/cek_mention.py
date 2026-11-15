import json
from atproto import Client
ENV = r"D:\budi\.openclaw\.env"
INBOX = r"D:\labs\sosmed\inbox.json"
SEEN = r"D:\labs\sosmed\seen.json"

def envv():
    d = {}
    for l in open(ENV, encoding="utf-8-sig"):
        l = l.strip()
        if "=" in l and not l.startswith("#"):
            k, v = l.split("=", 1); d[k.strip()] = v.strip().strip('"').strip("'")
    return d

def load(p, default):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return default

import sys
try:  # Kantor AI (opsional)
    sys.path.insert(0, r"D:\labs\kantor-ai")
    from kantor import event as kantor
except Exception:
    def kantor(*a, **k):
        pass

kantor("kurir", "start", "Cek mention Bluesky", room="sosmed")
try:
    e = envv()
    c = Client(); c.login(e["BSKY_HANDLE"], e["BSKY_APP_PASSWORD"])
    res = c.app.bsky.notification.list_notifications()
except Exception as ex:
    kantor("kurir", "error", "Cek mention Bluesky", room="sosmed", detail=f"{type(ex).__name__}: {ex}")
    raise
me = e["BSKY_HANDLE"]
seen = set(load(SEEN, [])); inbox = load(INBOX, [])
antre = {it["id"] for it in inbox}

baru = 0
for n in res.notifications:
    if n.reason not in ("mention", "reply"): continue
    if n.uri in seen or n.uri in antre: continue
    if n.author.handle == me: seen.add(n.uri); continue   # jangan balas diri sendiri
    rec = n.record
    rep = getattr(rec, "reply", None)
    root_uri, root_cid = (rep.root.uri, rep.root.cid) if rep else (n.uri, n.cid)
    inbox.append({"id": n.uri, "cid": n.cid, "author": n.author.handle,
                  "text": getattr(rec, "text", "") or "",
                  "root_uri": root_uri, "root_cid": root_cid})
    seen.add(n.uri); baru += 1

json.dump(sorted(seen), open(SEEN, "w", encoding="utf-8"))
json.dump(inbox, open(INBOX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
kantor("kurir", "done", "Cek mention Bluesky", detail=f"{baru} baru, {len(inbox)} antre belum dibalas")
print(f"{baru} mention baru. Antre belum dibalas: {len(inbox)}")
for it in inbox:
    print(f"- [{it['author']}] {it['text'][:120]}  (id={it['id']})")
