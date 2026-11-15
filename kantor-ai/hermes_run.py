"""Jalankan Hermes untuk Budi sambil melapor ke Kantor AI.

Perintah Hermes-nya sama persis dengan skill minta-hermes; hanya ditambah laporan start/done/error.
  python hermes_run.py --folder "D:\\budi\\.openclaw\\workspace\\hermes\\20261115-120000"
  python hermes_run.py --folder "..." --video        # budget 600 dtk, 60 turn
Keluaran: daftar file hasil (selain tugas.txt & log.txt). Exit 1 kalau tidak ada hasil.
"""
import argparse, os, re, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kantor import event  # noqa: E402

HERMES = os.environ.get("HERMES_EXE") or os.path.expandvars(r"%LOCALAPPDATA%\hermes\bin\hermes.exe")


def ringkas_tugas(folder: Path) -> str:
    try:
        t = (folder / "tugas.txt").read_text(encoding="utf-8", errors="ignore")
        # Blok permintaan yang asli adalah yang TERAKHIR (yang pertama ada di kalimat petunjuk).
        blocks = re.findall(r"<permintaan>\s*(.*?)\s*</permintaan>", t, re.S)
        text = blocks[-1] if blocks else t
        return " ".join(text.split())[:70] or "tugas Hermes"
    except OSError:
        return "tugas Hermes"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", required=True)
    ap.add_argument("--video", action="store_true")
    a = ap.parse_args()
    folder = Path(a.folder)
    if not (folder / "tugas.txt").exists():
        print("Error: tugas.txt tidak ada di " + str(folder))
        return 1
    budget, turns, timeout = ("600", "60", 660) if a.video else ("300", "30", 360)
    tugas = ringkas_tugas(folder)
    event("budi", "progress", "Menyerahkan ke Hermes", room="riset")
    event("hermes", "start", tugas, room="riset", detail=f"budget {budget} dtk")
    env = dict(os.environ, HERMES_HOME=r"D:\hermes\data")
    t0 = time.time()
    log = folder / "log.txt"
    try:
        with open(log, "w", encoding="utf-8", errors="replace") as f:
            rc = subprocess.run([HERMES, "chat", "--query-file", str(folder / "tugas.txt"), "-Q", "--source", "tool",
                                 "--run-budget", budget, "--max-turns", turns],
                                stdout=f, stderr=subprocess.STDOUT, env=env, timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        rc = "timeout"
    except OSError as e:
        rc = f"tidak bisa dijalankan: {e}"
    dur = f"{time.time() - t0:.0f} dtk"
    hasil = [p for p in folder.iterdir() if p.is_file() and p.name not in ("tugas.txt", "log.txt")]
    if hasil:
        event("hermes", "done", tugas, detail=f"{len(hasil)} file, {dur}")
        # Pengiriman ke WA dilakukan Budi sesudah skrip ini; tandai tugas Budi selesai di sini
        # supaya tidak "menggantung" selamanya di dashboard.
        event("budi", "done", "Hasil Hermes siap dikirim ke WA", detail=", ".join(p.name for p in hasil)[:120])
        for p in hasil:
            print(f"{p.name}\t{p.stat().st_size}")
        return 0
    tail = ""
    try:
        tail = " | ".join(l.strip() for l in log.read_text(encoding="utf-8", errors="ignore").splitlines()[-3:] if l.strip())
    except OSError:
        pass
    event("hermes", "error", tugas, room="riset", detail=f"tanpa file hasil (exit {rc}, {dur}). {tail}"[:300])
    event("budi", "error", "Hermes gagal", room="riset", detail="lihat log.txt")
    print(f"Error: Hermes tidak menghasilkan file (exit {rc}). 15 baris terakhir log:")
    try:
        print("\n".join(log.read_text(encoding="utf-8", errors="ignore").splitlines()[-15:]))
    except OSError:
        pass
    return 1


if __name__ == "__main__":
    sys.exit(main())
