import sys, io
from pathlib import Path
from rembg import remove, new_session
from PIL import Image

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
pad = int(sys.argv[3]) if len(sys.argv) > 3 else 4

sess = new_session('u2net')
im = Image.open(src).convert('RGBA')
out = remove(im, session=sess, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=8)
bbox = out.getbbox()
if bbox:
    out = out.crop(bbox)
w, h = out.size
side = max(w, h) + pad * 2
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(out, ((side - w) // 2, (side - h) // 2), out)
canvas.save(dst)
print(f'{src.name} {im.size} -> {canvas.size} (content {w}x{h})')
