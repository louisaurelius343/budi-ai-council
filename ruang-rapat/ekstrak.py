"""Ekstrak teks dari satu file untuk Ruang Rapat. Keluaran: teks UTF-8 di stdout.
  python ekstrak.py <path> <nama-asli>
Didukung: PDF (pypdf), DOCX, dan file teks (md, txt, csv, json, kode, dll). Lainnya -> exit 2.
"""
import re, sys, zipfile
from pathlib import Path

TEKS = {".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl", ".yaml", ".yml", ".xml", ".html", ".htm",
        ".py", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".css", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".php",
        ".rb", ".sh", ".ps1", ".bat", ".sql", ".ini", ".toml", ".env.example", ".log", ".tex", ".rst"}


def main():
    path, nama = Path(sys.argv[1]), sys.argv[2].lower()
    ext = Path(nama).suffix
    sys.stdout.reconfigure(encoding="utf-8")
    if ext == ".pdf":
        from pypdf import PdfReader
        r = PdfReader(str(path))
        print("\n\n".join(f"[halaman {i + 1}]\n{(p.extract_text() or '').strip()}" for i, p in enumerate(r.pages)))
    elif ext == ".docx":
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
        xml = re.sub(r"</w:p>", "\n", xml)
        print(re.sub(r"<[^>]+>", "", xml))
    elif ext in TEKS or nama.endswith(".env.example"):
        print(path.read_text(encoding="utf-8-sig", errors="replace"))
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()
