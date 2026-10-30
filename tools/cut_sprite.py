"""单帧抠图：洋红底走色键、复杂底走 rembg；输出指定高度 PNG（脚底对齐由调用方处理）"""
import sys, numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session

MAGENTA = np.array([255, 0, 255], dtype=np.float32)
_sess = None

def cut(path):
    global _sess
    im0 = Image.open(path).convert('RGB')
    a = np.array(im0).astype(np.float32)
    c = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3),
                        a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    magenta_bg = np.median(np.sqrt(((c - MAGENTA) ** 2).sum(-1))) < 60
    if magenta_bg:
        d = np.sqrt(((a - MAGENTA) ** 2).sum(-1))
        alpha = np.clip((d - 70) / 60, 0, 1)
        rgb = a
        how = 'key'
    else:
        if _sess is None:
            _sess = new_session('u2net')
        ra = np.array(remove(im0, session=_sess)).astype(np.float32)
        rgb, alpha = ra[..., :3], ra[..., 3] / 255.0
        how = 'rembg'
    al = alpha[..., None]
    fixed = np.clip((rgb - (1 - al) * MAGENTA) / np.maximum(al, 0.15), 0, 255)
    w = np.clip((0.95 - al) / 0.95, 0, 1) ** 1.2
    out = np.clip(rgb * (1 - w) + fixed * w, 0, 255)
    im = Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), 'RGBA')
    r_, g_, b_, a_ = im.split()
    a_ = a_.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.5))
    im = Image.merge('RGBA', (r_, g_, b_, a_))
    bb = im.getbbox()
    return (im.crop(bb) if bb else im), how

src, dst, H = sys.argv[1], sys.argv[2], int(sys.argv[3])
fr, how = cut(src)
w, h = fr.size
s = H / h
out = fr.resize((max(1, round(w * s)), H), Image.LANCZOS)
out.save(dst, optimize=True)
import os
print(f'{how} {fr.size} -> {out.size} {os.path.getsize(dst)//1024}KB -> {dst}')
