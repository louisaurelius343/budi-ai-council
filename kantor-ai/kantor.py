"""Pencatat event untuk Kantor AI (tanpa dependensi, tidak pernah membuat skrip pemanggil gagal).

Pakai di skrip lain:
    import sys; sys.path.insert(0, r"D:\\labs\\kantor-ai")
    from kantor import event, tugas

    event("budi", "start", "Cari kafe di Dago", room="kafe")
    with tugas("dewan-A", "Mengkritik draf", room="dewan", detail="oc/deepseek"):
        ...   # otomatis 'done', atau 'error' + pesan bila ada exception

Status: start | progress | done | error | idle
Ruangan: lobi | dewan | perpustakaan | kafe | riset | sosmed | server
"""
import json, os, time
from contextlib import contextmanager
from datetime import datetime, timezone

EVENTS = os.environ.get("KANTOR_EVENTS", r"D:\labs\kantor-ai\events.jsonl")
ROOMS = {"lobi", "dewan", "perpustakaan", "kafe", "riset", "sosmed", "server"}
STATUSES = {"start", "progress", "done", "error", "idle"}


def event(agent, status, task="", room=None, detail=None, **extra):
    """Tambahkan satu baris event. Gagal diam-diam: monitoring tidak boleh merusak tugas utama."""
    try:
        rec = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "agent": str(agent)[:40],
            "status": status if status in STATUSES else "progress",
            "task": str(task)[:120],
        }
        if room in ROOMS:
            rec["room"] = room
        if detail:
            rec["detail"] = str(detail)[:300]
        for k, v in extra.items():
            if isinstance(v, (str, int, float, bool)):
                rec[k] = v if not isinstance(v, str) else v[:120]
        os.makedirs(os.path.dirname(EVENTS), exist_ok=True)
        with open(EVENTS, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001
        pass


@contextmanager
def tugas(agent, task, room=None, detail=None, done_room="lobi"):
    t0 = time.time()
    event(agent, "start", task, room=room, detail=detail)
    try:
        yield
    except SystemExit as e:
        if e.code not in (None, 0):
            event(agent, "error", task, room=room, detail=str(e.code))
        else:
            event(agent, "done", task, room=done_room, detail=f"{time.time() - t0:.1f} dtk")
        raise
    except BaseException as e:  # noqa: BLE001
        event(agent, "error", task, room=room, detail=f"{type(e).__name__}: {e}")
        raise
    else:
        event(agent, "done", task, room=done_room, detail=f"{time.time() - t0:.1f} dtk")
