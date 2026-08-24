#!/usr/bin/env python3
"""Generate en-US neural audio files for corpus sentences using edge-tts."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "data" / "corpus.json"
VOICE = "en-US-JennyNeural"
RATE = "-5%"


async def generate_one(text: str, out_path: Path) -> None:
    import edge_tts

    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(out_path))


async def main() -> None:
    if not CORPUS.exists():
        print(f"Missing {CORPUS}. Run extract_corpus.py first.", file=sys.stderr)
        sys.exit(1)

    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("edge-tts not installed. Run: pip install edge-tts", file=sys.stderr)
        sys.exit(1)

    data = json.loads(CORPUS.read_text(encoding="utf-8"))
    sentences = data.get("sentences", [])
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    done = 0
    for item in sentences:
        sid = item["id"]
        if only and sid not in only and not any(sid.startswith(x) for x in only):
            continue
        out = ROOT / item["audio"]
        if out.exists() and out.stat().st_size > 1000:
            done += 1
            continue
        text = item.get("en") or item.get("text") or ""
        if not text.strip():
            print(f"skip empty text: {sid}")
            continue
        await generate_one(text, out)
        done += 1
        print(f"[{done}/{len(sentences)}] {sid}")

    print(f"Audio ready: {done} files")


if __name__ == "__main__":
    asyncio.run(main())
