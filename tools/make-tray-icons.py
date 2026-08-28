#!/usr/bin/env python3
"""Generate the tray icons. Standard library only, no image dependency.

macOS wants a template image around 16 points, with breathing room: the menu
bar looks wrong the moment a glyph fills its whole height. Linux panels use a
larger bitmap, so it gets its own file.
"""
import zlib, struct, math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'renderer')

def asterisk(size, radius_ratio, stroke):
    px = [[[255, 255, 255, 0] for _ in range(size)] for _ in range(size)]

    def blend(x, y, a):
        if 0 <= x < size and 0 <= y < size:
            px[y][x][3] = min(255, int(px[y][x][3] + a * 255))

    def line(x0, y0, x1, y1, w):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 6) + 1
        for i in range(steps + 1):
            t = i / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            r = w / 2
            span = int(r + 2)
            for dy in range(-span, span + 1):
                for dx in range(-span, span + 1):
                    d = math.hypot(dx, dy)
                    if d <= r + 0.5:
                        blend(int(cx) + dx, int(cy) + dy, min(1.0, r + 0.5 - d) * 0.3)

    c = size / 2
    R = size * radius_ratio
    for k in range(8):
        a = math.pi * k / 4
        line(c - R * math.cos(a), c - R * math.sin(a),
             c + R * math.cos(a), c + R * math.sin(a), stroke)
    return px

def write_png(path, px):
    size = len(px)
    raw = b''.join(b'\x00' + bytes(v for p in row for v in p) for row in px)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)
    print(f'{os.path.basename(path)}: {size}x{size}, {len(png)} bytes')

# macOS: 16 pt logical, with the @2x companion Electron picks up on its own.
write_png(os.path.join(OUT, 'tray.png'), asterisk(16, 0.30, 1.1))
write_png(os.path.join(OUT, 'tray@2x.png'), asterisk(32, 0.30, 2.2))
# Linux panels render a larger bitmap.
write_png(os.path.join(OUT, 'tray-linux.png'), asterisk(44, 0.34, 2.6))
