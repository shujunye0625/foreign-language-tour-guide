#!/usr/bin/env python3
"""Generate MP3 for scenic guide sentences (edge-tts)."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "scenic_guides" / "index.json"
VOICE = "en-US-JennyNeural"
RATE = "-5%"


async def generate_one(text: str, out_path: Path) -> None:
    import edge_tts

    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(out_path))


async def main() -> None:
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("pip install edge-tts", file=sys.stderr)
        sys.exit(1)

    if not INDEX.exists():
        print("Run build_scenic_guides.py first", file=sys.stderr)
        sys.exit(1)

    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    total = done = skipped = 0

    for spot in index["spots"]:
        if only and spot["id"] not in only and not any(spot["id"].startswith(x) for x in only):
            continue
        data = json.loads((ROOT / "data" / "scenic_guides" / spot["file"]).read_text(encoding="utf-8"))
        for item in data["sentences"]:
            total += 1
            out = ROOT / item["audio"]
            if out.exists() and out.stat().st_size > 1000:
                skipped += 1
                continue
            text = (item.get("en") or "").strip()
            if not text:
                continue
            await generate_one(text, out)
            done += 1
            print(f"[{done}+{skipped}/{total}] {item['id']}")

    print(f"Scenic audio: generated {done}, skipped {skipped}, total scanned {total}")


if __name__ == "__main__":
    asyncio.run(main())
