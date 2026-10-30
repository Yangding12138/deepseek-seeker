"""抠图 + 帧归一：洋红底走色键，复杂底走 rembg；统一去色边 + 裁边 + 归一化高度"""
import sys, numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
from rembg import remove, new_session

OUT_H = 216
MAGENTA = np.array([255, 0, 255], dtype=np.float32)
_sess = None

def _rembg_sess():
    global _sess
    if _sess is None:
        _sess = new_session('u2net')
    return _sess

def defringe(out, alpha):
    """按已知洋红背景做 unpremultiply，去掉边缘粉色污染；只作用于半透明区"""
    al = alpha[..., None]
    fixed = np.clip((out - (1.0 - al) * MAGENTA) / np.maximum(al, 0.15), 0, 255)
    w = np.clip((0.95 - al) / 0.95, 0, 1) ** 1.2
    return np.clip(out * (1 - w) + fixed * w, 0, 255)

def cut(path):
    im0 = Image.open(path).convert('RGB')
    a = np.array(im0).astype(np.float32)
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3),
                              a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    magenta_bg = np.median(np.sqrt(((corners - MAGENTA) ** 2).sum(-1))) < 60

    if magenta_bg:
        d = np.sqrt(((a - MAGENTA) ** 2).sum(-1))
        alpha = np.clip((d - 70) / 60, 0, 1)
        out = defringe(a, alpha)
    else:
        r = remove(im0, session=_rembg_sess())
        ra = np.array(r).astype(np.float32)
        out, alpha = ra[..., :3], ra[..., 3] / 255.0
        out = defringe(out, alpha)

    im = Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), 'RGBA')
    r_, g_, b_, al = im.split()
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.5))
    im = Image.merge('RGBA', (r_, g_, b_, al))
    bb = im.getbbox()
    return (im.crop(bb) if bb else im), ('key' if magenta_bg else 'rembg')

frames = {}
for src, name in [(sys.argv[1], 'idle'), (sys.argv[2], 'run'), (sys.argv[3], 'jump')]:
    frames[name] = cut(src)

for name, (fr, how) in frames.items():
    target = OUT_H * (0.95 if name == 'jump' else 1.0)
    w, h = fr.size
    s = target / h
    out = fr.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    dst = Path(f'art/sprites/hero-{name}.png')
    out.save(dst, optimize=True)
    print(f'{name:5s} [{how:5s}] src {fr.size} -> {out.size}  {dst.stat().st_size // 1024}KB')
