"""Cari kafe / tempat nongkrong terdekat untuk Budi (data OpenStreetMap, sama dengan ruangseduh.cloud).

Pakai:
  python kafe.py "Dago, Bandung"                 # area dalam teks
  python kafe.py --lat -6.885 --lon 107.613       # koordinat (mis. lokasi yang dibagikan di WhatsApp)
  python kafe.py "Dago" --buka --wifi --radius 1000 --makan --limit 5 --json

Keluaran --json: {"area", "radius", "jumlah", "tempat": [{nama, jarak_m, jarak, alamat, jam, status, wifi, outdoor, arahkan}]}
"""
import argparse, json, math, os, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeout
from datetime import datetime, timedelta, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UA = "ruangseduh-budi/1.0 (+https://ruangseduh.cloud)"  # kebijakan Nominatim/Overpass: UA yang jelas
NOMINATIM = "https://nominatim.openstreetmap.org/search"
OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://overpass.private.coffee/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
WIB = timezone(timedelta(hours=7))
CATS = {"kafe": ['["amenity"="cafe"]', '["shop"="coffee"]'],
        "makan": ['["amenity"="restaurant"]', '["amenity"="fast_food"]']}


def http(url, data=None, timeout=40):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def geocode(q):
    url = NOMINATIM + "?" + urllib.parse.urlencode(
        {"format": "jsonv2", "limit": 1, "countrycodes": "id", "accept-language": "id", "q": q})
    hits = http(url, timeout=20)
    if not hits:
        sys.exit(f"Error: area '{q}' tidak ditemukan. Coba tulis lebih lengkap, mis. 'Dago, Bandung'.")
    h = hits[0]
    return float(h["lat"]), float(h["lon"]), ", ".join(p.strip() for p in h["display_name"].split(",")[:2])


CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache.json")


API = os.environ.get("RUANGSEDUH_API", "https://ruangseduh.cloud/api")
RADII = (500, 1000, 2000, 5000)


def via_api(lat, lon, radius, cats):
    """Lewat Worker ruangseduh.cloud: cache bersama dengan situs. None kalau gagal."""
    r = min(RADII, key=lambda x: abs(x - radius))
    q = urllib.parse.urlencode({"lat": f"{lat:.3f}", "lon": f"{lon:.3f}", "r": r, "cats": ",".join(cats), "cache": "only"})
    try:
        d = http(f"{API}/places?{q}", timeout=6)
        return d if isinstance(d.get("elements"), list) else None
    except Exception:  # noqa: BLE001
        return None


def overpass(lat, lon, radius, cats):
    """Urutan: cache lokal (24 jam) -> API ruangseduh.cloud (cache bersama) -> Overpass langsung."""
    key = f"{lat:.3f},{lon:.3f}|{radius}|{'+'.join(cats)}"
    try:
        with open(CACHE, encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, ValueError):
        cache = {}
    hit = cache.get(key)
    if hit and datetime.now().timestamp() - hit["t"] < 86400:
        return hit["osm"]
    osm = via_api(lat, lon, radius, cats) or _overpass_live(lat, lon, radius, cats)
    cache[key] = {"t": datetime.now().timestamp(), "osm": osm}
    keep = sorted(cache, key=lambda k: cache[k]["t"], reverse=True)[:30]
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump({k: cache[k] for k in keep}, f, ensure_ascii=False)
    return osm


def _overpass_live(lat, lon, radius, cats):
    parts = "".join(f"nwr{f}(around:{radius},{lat:.6f},{lon:.6f});" for c in cats for f in CATS[c])
    body = urllib.parse.urlencode({"data": f"[out:json][timeout:25];({parts});out center tags 300;"}).encode()
    # Semua server ditanya bersamaan; jawaban sukses pertama dipakai. Batas total ~65 detik.
    errs = []

    def ask(url):
        d = http(url, body, timeout=60)  # server utama kadang butuh 20-40 detik
        if not isinstance(d.get("elements"), list):
            raise ValueError("format tidak dikenal")
        return d

    ex = ThreadPoolExecutor(max_workers=len(OVERPASS))
    futs = {ex.submit(ask, u): u for u in OVERPASS}
    try:
        for f in as_completed(futs, timeout=65):
            try:
                return f.result()
            except Exception as e:  # noqa: BLE001
                errs.append(f"{futs[f].split('/')[2]}: {str(e)[:60]}")
    except FuturesTimeout:
        errs.append("waktu habis")
    finally:
        ex.shutdown(wait=False, cancel_futures=True)
    sys.exit("Error: server data peta sedang sibuk, coba lagi sebentar. (" + "; ".join(errs) + ")")


def dist(a, b, c, d):
    r = math.radians
    x = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(x))


def fmt_dist(m):
    return f"{round(m / 10) * 10} m" if m < 1000 else f"{m / 1000:.1f} km".replace(".", ",")


# ---- jam buka (subset format OSM, sama dengan core.js di situs) ----
DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]


def _days(spec):
    out = set()
    for part in spec.split(","):
        a, _, b = part.strip().partition("-")
        if a not in DAYS or (b and b not in DAYS):
            return None
        i = DAYS.index(a)
        if not b:
            out.add(i)
            continue
        j = DAYS.index(b)
        while True:
            out.add(i)
            if i == j:
                break
            i = (i + 1) % 7
    return out


def is_open(spec, now):
    """True/False, atau None kalau tidak diketahui."""
    if not spec:
        return None
    s = spec.strip()
    if s == "24/7":
        return True
    day = (now.weekday() + 1) % 7  # Python: Senin=0 -> OSM: Minggu=0
    prev = (day + 6) % 7
    mins = now.hour * 60 + now.minute
    result, understood = False, False
    for rule in [r.strip() for r in s.split(";") if r.strip()]:
        m = re.match(r"^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$", rule)
        days = _days(m.group(1)) if m.group(1) else set(range(7))
        times = m.group(2).strip()
        if days is None:
            return None
        if re.fullmatch(r"(?i)off|closed", times):
            understood = True
            if day in days:
                result = False
            continue
        ranges = [x.strip() for x in times.split(",")]
        if not all(re.fullmatch(r"\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?", x) for x in ranges):
            return None
        understood = True
        open_here, applies = False, day in days
        for x in ranges:
            a, b = x.rstrip("+").split("-")
            st = int(a[:-3]) * 60 + int(a[-2:])
            en = int(b[:-3]) * 60 + int(b[-2:])
            if en <= st:
                en += 1440
            if day in days and st <= mins < en:
                open_here = True
            if prev in days and en > 1440 and mins < en - 1440:
                open_here = applies = True
        if applies:
            result = open_here
    return result if understood else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("area", nargs="?")
    ap.add_argument("--lat", type=float)
    ap.add_argument("--lon", type=float)
    ap.add_argument("--radius", type=int, default=2000)
    ap.add_argument("--makan", action="store_true", help="ikutkan tempat makan santai")
    ap.add_argument("--buka", action="store_true", help="hanya yang pasti buka sekarang")
    ap.add_argument("--wifi", action="store_true")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    if a.lat is not None and a.lon is not None:
        lat, lon, label = a.lat, a.lon, "lokasi yang dibagikan"
    elif a.area:
        lat, lon, label = geocode(a.area)
    else:
        sys.exit("Error: sebutkan area atau --lat/--lon.")
    radius = min(RADII, key=lambda x: abs(x - a.radius))  # samakan dengan radius situs agar cache terpakai
    cats = ["kafe"] + (["makan"] if a.makan else [])
    now = datetime.now(WIB)

    seen, rows = set(), []
    for el in overpass(lat, lon, radius, cats)["elements"]:
        t = el.get("tags", {})
        la, lo = el.get("lat", el.get("center", {}).get("lat")), el.get("lon", el.get("center", {}).get("lon"))
        if not t.get("name") or la is None:
            continue
        key = (t["name"].lower(), round(la, 4), round(lo, 4))
        if key in seen:
            continue
        seen.add(key)
        op = is_open(t.get("opening_hours"), now)
        wifi = t.get("internet_access") in ("wlan", "yes")
        if (a.buka and op is not True) or (a.wifi and not wifi):
            continue
        addr = ", ".join(x for x in [" ".join(filter(None, [t.get("addr:street"), t.get("addr:housenumber")])),
                                     t.get("addr:suburb"), t.get("addr:city")] if x)
        d = dist(lat, lon, la, lo)
        rows.append({"nama": t["name"], "jarak_m": round(d), "jarak": fmt_dist(d), "alamat": addr or None,
                     "jam": t.get("opening_hours"), "status": {True: "buka", False: "tutup"}.get(op, "tidak diketahui"),
                     "wifi": wifi, "outdoor": t.get("outdoor_seating") == "yes",
                     "arahkan": f"https://www.google.com/maps/dir/?api=1&destination={la},{lo}"})
    rows.sort(key=lambda r: r["jarak_m"])
    out = {"area": label, "radius": radius, "jumlah": len(rows), "waktu": now.strftime("%H:%M WIB"),
           "tempat": rows[:a.limit], "web": "https://ruangseduh.cloud"}
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return
    print(f"{out['jumlah']} tempat dalam {radius / 1000:g} km dari {label} ({out['waktu']}):")
    for i, r in enumerate(out["tempat"], 1):
        extra = " · ".join(x for x in [r["status"] if r["status"] != "tidak diketahui" else "", "WiFi" if r["wifi"] else ""] if x)
        print(f"{i}. {r['nama']} ({r['jarak']}){' - ' + extra if extra else ''}\n   {r['arahkan']}")


try:  # Kantor AI (opsional)
    sys.path.insert(0, r"D:\labs\kantor-ai")
    from kantor import tugas
except Exception:  # noqa: BLE001
    from contextlib import nullcontext as _nc

    def tugas(*a, **k):
        return _nc()


if __name__ == "__main__":
    code = 0
    where = next((x for x in sys.argv[1:] if not x.startswith("-")), "lokasi yang dibagikan")
    try:
        with tugas("pencari-kafe", "Cari kafe: " + where[:50], room="kafe"):
            main()
    except SystemExit as e:  # pesan "Error: ..." dari sys.exit
        if isinstance(e.code, str):
            print(e.code)
            code = 1
        else:
            code = e.code or 0
    sys.stdout.flush()
    os._exit(code)  # jangan menunggu thread server yang lambat
