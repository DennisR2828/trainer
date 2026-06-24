#!/usr/bin/env python3
"""Generate app-icon PNGs (no third-party deps) matching icon.svg.
Outputs: icon-192.png, icon-512.png (rounded, transparent corners),
icon-maskable-512.png, apple-touch-icon-180.png (full-bleed, opaque)."""
import struct, zlib

# dumbbell rects in a 512 space: (x0, y0, x1, y1, radius)
RECTS = [
    (176, 240, 336, 272, 10),
    (150, 206, 182, 306, 12), (330, 206, 362, 306, 12),
    (122, 188, 154, 324, 14), (358, 188, 390, 324, 14),
    (104, 224, 126, 288, 8),  (386, 224, 408, 288, 8),
]
FG = (74, 222, 128)          # accent green
BG_TOP, BG_BOT = (19, 27, 36), (11, 15, 20)
SS = 3                        # supersample factor for anti-aliasing


def in_rrect(px, py, x0, y0, x1, y1, r):
    qx = (x0 + r - px) if px < x0 + r else (px - (x1 - r) if px > x1 - r else 0)
    qy = (y0 + r - py) if py < y0 + r else (py - (y1 - r) if py > y1 - r else 0)
    return qx * qx + qy * qy <= r * r


def sample(px, py, rounded, full_bg, glyph_k):
    # background coverage
    if rounded and not in_rrect(px, py, 0, 0, 512, 512, 112):
        return (0, 0, 0, 0)
    bg = tuple(round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * (py / 512)) for i in range(3))
    for (x0, y0, x1, y1, r) in RECTS:
        if glyph_k != 1.0:
            x0, x1 = 256 + (x0 - 256) * glyph_k, 256 + (x1 - 256) * glyph_k
            y0, y1 = 256 + (y0 - 256) * glyph_k, 256 + (y1 - 256) * glyph_k
            r *= glyph_k
        if in_rrect(px, py, x0, y0, x1, y1, r):
            return (FG[0], FG[1], FG[2], 255)
    return (bg[0], bg[1], bg[2], 255)


def render(size, rounded, full_bg, glyph_k=1.0):
    scale = 512 / (size * SS)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter type 0
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    px = (x * SS + sx + 0.5) * scale
                    py = (y * SS + sy + 0.5) * scale
                    pr, pg, pb, pa = sample(px, py, rounded, full_bg, glyph_k)
                    r += pr * pa; g += pg * pa; b += pb * pa; a += pa
            n = SS * SS
            if a == 0:
                raw += bytes((0, 0, 0, 0))
            else:
                raw += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
    return bytes(raw)


def write_png(path, size, raw):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, size)


here = __file__.rsplit('/', 1)[0]
write_png(f'{here}/icon-192.png', 192, render(192, rounded=True, full_bg=False))
write_png(f'{here}/icon-512.png', 512, render(512, rounded=True, full_bg=False))
write_png(f'{here}/icon-maskable-512.png', 512, render(512, rounded=False, full_bg=True, glyph_k=0.78))
write_png(f'{here}/apple-touch-icon-180.png', 180, render(180, rounded=False, full_bg=True))
print('done')
