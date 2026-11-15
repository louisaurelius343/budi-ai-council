"""Dewan AI: satu generator membuat draf, beberapa kritikus dari keluarga model berbeda
mengkritik secara paralel, lalu generator merevisi jadi versi final.

Semua model lewat 9router (http://127.0.0.1:20128/v1). Kalau 9router mati, generator
Holver/Groq jatuh ke API langsung. Kritikus yang gagal dilewati; minimal 1 harus berhasil.

Pakai:
  python council.py --file tugas.txt --out FOLDER
  python council.py --file tugas.txt --out FOLDER --critic 9r:oc/glm-5.3-flash-free,9r:gemini/gemini-3.5-flash-lite
"""
import argparse, json, os, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

# Kantor AI (pemantau visual). Opsional: kalau tidak ada, dewan tetap jalan.
try:
    sys.path.insert(0, r"D:\labs\kantor-ai")
    from kantor import event as kantor
except Exception:  # noqa: BLE001
    def kantor(*a, **k):
        pass

ENV = r"D:\budi\.openclaw\.env"
PROVIDERS = {
    "9r":     ("http://127.0.0.1:20128/v1", "NINEROUTER_API_KEY"),
    "holver": ("https://api.holver.id/v1", "HOLVER_API_KEY"),
    "groq":   ("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
}
GENERATOR = "9r:holver/gpt-6-luna"
CRITICS = [
    "9r:oc/deepseek-v4.1-flash-free",
    "9r:oc/glm-5.3-flash-free",
    "9r:gemini/gemini-3.5-flash-lite",
    "9r:groq/openai/gpt-oss-120b",
]
GAYA = " Gunakan tanda baca biasa (hindari em-dash dan kutip melengkung)."


def load_env():
    d = {}
    for line in open(ENV, encoding="utf-8-sig"):  # -sig: .env bisa ber-BOM
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    return d


ENVV = load_env()


class CallError(Exception):
    pass


def _post(spec, messages, temperature, timeout):
    provider, model = spec.split(":", 1)
    base, keyname = PROVIDERS[provider]
    key = ENVV.get(keyname)
    if not key:
        raise CallError(keyname + " tidak ada di .env")
    body = json.dumps({"model": model, "messages": messages, "temperature": temperature,
                       "max_tokens": 4000, "stream": False}).encode()
    req = urllib.request.Request(base + "/chat/completions", data=body, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "council/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = json.load(r)["choices"][0]["message"].get("content") or ""
    except urllib.error.HTTPError as e:
        raise CallError("HTTP " + str(e.code) + ": " + e.read().decode(errors="replace")[:200])
    except Exception as e:  # noqa: BLE001  (koneksi ditolak, timeout, JSON rusak)
        raise CallError(type(e).__name__ + ": " + str(e)[:200])
    if not txt.strip():
        raise CallError("jawaban kosong")
    return txt


def call(spec, messages, temperature=0.6, timeout=150):
    """Panggil model; kalau lewat 9router gagal dan modelnya Holver/Groq, coba API langsung."""
    try:
        return _post(spec, messages, temperature, timeout), spec
    except CallError as e:
        provider, model = spec.split(":", 1)
        if provider == "9r" and model.split("/", 1)[0] in ("holver", "groq"):
            direct = model.replace("/", ":", 1)
            print("   ! " + spec + " gagal (" + str(e)[:80] + "), coba langsung " + direct)
            return _post(direct, messages, temperature, timeout), direct
        raise CallError(spec + " -> " + str(e))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--generator", default=GENERATOR)
    ap.add_argument("--critic", default=",".join(CRITICS), help="satu atau beberapa, pisahkan koma")
    a = ap.parse_args()
    critics = [c.strip() for c in a.critic.split(",") if c.strip()]
    task = open(a.file, encoding="utf-8-sig").read().strip()
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()

    judul = task.replace("\n", " ")[:60]
    kantor("budi", "start", "Dewan: " + judul, room="dewan")
    try:
        print("[1/3] Generator (" + a.generator + ") membuat draf...")
        kantor("dewan-ketua", "start", "Menulis draf", room="dewan", detail=a.generator)
        draft, gen = call(a.generator, [
            {"role": "system", "content": "Kamu ahli. Kerjakan tugas sebaik mungkin dalam bahasa Indonesia." + GAYA},
            {"role": "user", "content": task}])
        kantor("dewan-ketua", "progress", "Menunggu kritik", room="dewan")
    except CallError as e:
        kantor("dewan-ketua", "error", "Menulis draf", room="dewan", detail=str(e))
        kantor("budi", "error", "Dewan gagal", room="dewan", detail="generator gagal")
        sys.exit("Error generator: " + str(e))

    print("[2/3] " + str(len(critics)) + " kritikus bekerja paralel...")
    crit_msgs = [
        {"role": "system", "content": "Kamu reviewer independen yang kritis dan teliti. Temukan kelemahan, "
         "kesalahan fakta, bagian kurang jelas, dan hal yang terlewat. Jangan memuji. Beri daftar perbaikan "
         "konkret dalam bahasa Indonesia, maksimal 10 poin." + GAYA},
        {"role": "user", "content": "TUGAS:\n" + task + "\n\nDRAF:\n" + draft}]

    def review(item):
        idx, spec = item
        who = "dewan-" + chr(65 + idx)
        model = spec.split(":", 1)[-1]
        kantor(who, "start", "Mengkritik draf", room="dewan", detail=model)
        s = time.time()
        try:
            txt, used = call(spec, crit_msgs, 0.4, timeout=120)
            kantor(who, "done", "Mengkritik draf", detail=f"{model}, {time.time() - s:.1f} dtk")
            return {"model": used, "ok": True, "kritik": txt, "detik": round(time.time() - s, 1)}
        except CallError as e:
            kantor(who, "error", "Mengkritik draf", room="dewan", detail=f"{model}: {str(e)[:150]} (dilewati)")
            return {"model": spec, "ok": False, "error": str(e)[:300], "detik": round(time.time() - s, 1)}

    with ThreadPoolExecutor(max_workers=len(critics)) as ex:
        reviews = list(ex.map(review, enumerate(critics)))
    for r in reviews:
        print("   " + ("OK   " if r["ok"] else "GAGAL") + " " + r["model"] + " (" + str(r["detik"]) + " dtk)"
              + ("" if r["ok"] else " - " + r["error"][:100]))
    good = [r for r in reviews if r["ok"]]
    if not good:
        kantor("dewan-ketua", "error", "Menunggu kritik", room="dewan", detail="semua kritikus gagal")
        kantor("budi", "error", "Dewan gagal", room="dewan", detail="semua kritikus gagal (9router mati?)")
        sys.exit("Error: semua kritikus gagal. " + "; ".join(r["error"][:80] for r in reviews))
    kantor("dewan-ketua", "progress", f"Merevisi dari {len(good)} kritik", room="dewan")

    print("[3/3] Generator merevisi berdasarkan " + str(len(good)) + " kritik...")
    kritik_txt = "\n\n".join("KRITIK " + chr(65 + i) + " (" + r["model"] + "):\n" + r["kritik"]
                             for i, r in enumerate(good))
    try:
        final, _ = call(gen, [
            {"role": "system", "content": "Kamu penulis yang merevisi berdasarkan beberapa reviewer independen "
             "dari keluarga model berbeda. Terapkan masukan yang valid, abaikan yang keliru atau bertentangan "
             "dengan fakta. Keluarkan versi FINAL utuh dalam bahasa Indonesia." + GAYA},
            {"role": "user", "content": "TUGAS:\n" + task + "\n\nDRAF:\n" + draft + "\n\n" + kritik_txt
             + "\n\nTulis versi FINAL."}], 0.5)
    except CallError as e:
        kantor("dewan-ketua", "error", "Merevisi", room="dewan", detail=str(e))
        kantor("budi", "error", "Dewan gagal", room="dewan", detail="reviser gagal")
        sys.exit("Error reviser: " + str(e))
    kantor("dewan-ketua", "done", "Versi final", detail=f"{time.time() - t0:.0f} dtk")
    kantor("budi", "done", "Dewan selesai: " + judul, detail=f"{len(good)} kritik dipakai")
    for i in range(len(critics)):
        kantor("dewan-" + chr(65 + i), "idle", "Kembali ke lobi")

    labels = {chr(65 + i): r for i, r in enumerate(good)}
    out = {"task": task, "draf": draft, "final": final,
           # kompatibel dengan skill lama: kritik_A / kritik_B
           "kritik_A": good[0]["kritik"], "kritik_B": good[1]["kritik"] if len(good) > 1 else "",
           "kritik": {k: {"model": r["model"], "isi": r["kritik"]} for k, r in labels.items()},
           "gagal": [{"model": r["model"], "error": r["error"]} for r in reviews if not r["ok"]],
           "dewan": {"generator": gen, **{"kritikus_" + k: r["model"] for k, r in labels.items()}},
           "detik": round(time.time() - t0, 1), "waktu": time.strftime("%Y-%m-%d %H:%M")}
    json.dump(out, open(os.path.join(a.out, "council.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(os.path.join(a.out, "final.md"), "w", encoding="utf-8").write(final)
    print("\nSelesai dalam " + str(out["detik"]) + " detik.\n===== FINAL =====\n" + final)


if __name__ == "__main__":
    main()
