#!/usr/bin/env python3
"""Create simple PWA icons without external deps."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    # Minimal valid PNG via struct (1x1 scaled conceptually — write SVG fallback as PNG placeholder)
    # Create tiny valid PNGs using pure Python zlib
    import struct
    import zlib

    def write_png(path: Path, size: int, rgb=(15, 23, 42)):
        def chunk(tag: bytes, data: bytes) -> bytes:
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        raw = b""
        r, g, b = rgb
        for y in range(size):
            raw += b"\x00"
            for x in range(size):
                # teal accent circle-ish
                cx, cy = size / 2, size / 2
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d < size * 0.35:
                    raw += bytes([14, 165, 233])
                else:
                    raw += bytes([r, g, b])
        ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
        data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
        path.write_bytes(data)

    out = Path(__file__).resolve().parents[1] / "app" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    write_png(out / "icon-192.png", 192)
    write_png(out / "icon-512.png", 512)
    print("Wrote icons (pure PNG)")
else:
    out = Path(__file__).resolve().parents[1] / "app" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        img = Image.new("RGB", (size, size), (15, 23, 42))
        draw = ImageDraw.Draw(img)
        margin = size // 8
        draw.ellipse([margin, margin, size - margin, size - margin], fill=(14, 165, 233))
        img.save(out / f"icon-{size}.png")
    print("Wrote icons (Pillow)")
