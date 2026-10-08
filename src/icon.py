# アイコン（ピルケース）を描き直す。使い方: python3 src/icon.py
from PIL import Image, ImageDraw
S, INK = 1024, (46, 36, 64)

def draw(scale=1.0):
    im = Image.new("RGB", (S, S), (255, 243, 220)); d = ImageDraw.Draw(im)
    cx = cy = S / 2
    R = lambda x0, y0, x1, y1: [cx + (x0-cx)*scale, cy + (y0-cy)*scale,
                                cx + (x1-cx)*scale, cy + (y1-cy)*scale]
    bw = int(22 * scale)
    d.rounded_rectangle(R(178, 348, 898, 728), radius=int(88*scale), fill=INK)
    d.rounded_rectangle(R(152, 318, 872, 698), radius=int(88*scale), fill=(255,255,255), outline=INK, width=bw)
    w = (720 - 72 - 56) / 3
    for i, c in enumerate([(255,197,61), (79,209,165), (157,139,255)]):
        x0 = 152 + 36 + i * (w + 28); x1 = x0 + w
        d.rounded_rectangle(R(x0, 370, x1, 678), radius=int(48*scale), fill=INK)
        d.rounded_rectangle(R(x0, 354, x1, 662), radius=int(48*scale), fill=c, outline=INK, width=int(16*scale))
    return im

for name, size, sc in [("icon-512.png", 512, 1.0), ("icon-192.png", 192, 1.0),
                       ("apple-touch-icon.png", 180, 1.0), ("icon-maskable-512.png", 512, 0.76)]:
    draw(sc).resize((size, size), Image.LANCZOS).save(name)
print("アイコンを書き出しました")
