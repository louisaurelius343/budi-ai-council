import sys, json, os, urllib.request, urllib.error, argparse, time

ENV = r"D:\budi\.openclaw\.env"
PROVIDERS = {
    "holver": ("https://api.holver.id/v1", "HOLVER_API_KEY"),
    "groq":   ("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
}

def load_env():
    d = {}
    for line in open(ENV, encoding="utf-8"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    return d

ENVV = load_env()

def call(spec, messages, temperature=0.6):
    provider, model = spec.split(":", 1)
    base, keyname = PROVIDERS[provider]
    key = ENVV.get(keyname)
    if not key:
        raise SystemExit(keyname + " tidak ada di .env")
    body = json.dumps({"model": model, "messages": messages, "temperature": temperature, "max_tokens": 4000}).encode()
    req = urllib.request.Request(base + "/chat/completions", data=body,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "council/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        raise SystemExit("Error " + spec + " -> HTTP " + str(e.code) + ": " + e.read().decode(errors="replace")[:300])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--generator", default="holver:gpt-6-luna")
    ap.add_argument("--critic", default="groq:qwen/qwen3.8-27b")
    a = ap.parse_args()
    task = open(a.file, encoding="utf-8").read().strip()
    os.makedirs(a.out, exist_ok=True)
    GAYA = " Gunakan tanda baca biasa (hindari em-dash dan kutip melengkung)."

    print("[1/4] Generator (" + a.generator + ") membuat draf...")
    draft = call(a.generator, [
        {"role": "system", "content": "Kamu ahli. Kerjakan tugas sebaik mungkin dalam bahasa Indonesia." + GAYA},
        {"role": "user", "content": task}])

    print("[2/4] Kritikus A (" + a.generator + ")...")
    crit_a = call(a.generator, [
        {"role": "system", "content": "Kamu reviewer kritis dan teliti. Temukan kelemahan, kesalahan fakta, bagian kurang jelas. Jangan memuji. Beri daftar perbaikan konkret." + GAYA},
        {"role": "user", "content": "TUGAS:\n" + task + "\n\nDRAF:\n" + draft}], 0.4)

    print("[3/4] Kritikus B (" + a.critic + ")...")
    crit_b = call(a.critic, [
        {"role": "system", "content": "Kamu reviewer independen dari tim lain. Baca tugas dan draf, beri kritik tajam dan perbaikan konkret dalam bahasa Indonesia. Fokus pada hal yang mungkin terlewat. Jangan memuji." + GAYA},
        {"role": "user", "content": "TUGAS:\n" + task + "\n\nDRAF:\n" + draft}], 0.5)

    print("[4/4] Reviser menyatukan dua kritik...")
    final = call(a.generator, [
        {"role": "system", "content": "Kamu penulis yang merevisi berdasarkan DUA reviewer independen. Terapkan masukan valid dari keduanya, abaikan yang keliru. Keluarkan versi FINAL utuh dalam bahasa Indonesia." + GAYA},
        {"role": "user", "content": "TUGAS:\n" + task + "\n\nDRAF:\n" + draft + "\n\nKRITIK A:\n" + crit_a + "\n\nKRITIK B:\n" + crit_b + "\n\nTulis versi FINAL."}], 0.5)

    json.dump({"task": task, "draf": draft, "kritik_A": crit_a, "kritik_B": crit_b, "final": final,
               "dewan": {"generator": a.generator, "kritikus_A": a.generator, "kritikus_B": a.critic},
               "waktu": time.strftime("%Y-%m-%d %H:%M")},
              open(os.path.join(a.out, "council.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(os.path.join(a.out, "final.md"), "w", encoding="utf-8").write(final)
    print("\n===== FINAL =====\n" + final)

if __name__ == "__main__":
    main()
