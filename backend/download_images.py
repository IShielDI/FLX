"""
download_images.py  —  Run this once from your backend/ folder.
"""
import requests
from pathlib import Path

IMAGES_DIR = Path(__file__).parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://stockx.com/",
}

BASE = "https://images.stockx.com/360"

PRODUCTS = {
    "patta-air-max-1.jpg": "https://images.stockx.com/images/Nike-Air-Max-1-Patta-Monarch-Product.jpg",
    "yzy-slides.jpg":      "https://images.stockx.com/images/adidas-Yeezy-Slide-Black-Product.jpg",
    "bearbrick-kaws.jpg":  "https://images.stockx.com/images/Bearbrick-Kaws-Dissected-1000-Black.png",
    "ow-clip.jpg":         "https://images.stockx.com/images/OFF-WHITE-FOR-MONEY-Bill-Clip-Wallet-Black.jpg",
    "stussy-hoodie.jpg":   "https://images.stockx.com/images/Stussy-Basic-Hoodie-Black-Product_V2.jpg",
    "cr-aventus.jpg":      "https://www.creedfragrance.com/dw/image/v2/BCQH_PRD/on/demandware.static/-/Sites-creed-master-catalog/default/dwb54b1f6e/images/hi-res/AVE100ML_main.jpg",
}
def download(filename, url):
    dest = IMAGES_DIR / filename
    if dest.exists():
        print(f"  SKIP  {filename} already exists")
        return
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", ""):
            dest.write_bytes(r.content)
            print(f"  OK    {filename}")
        else:
            print(f"  FAIL  {filename}  HTTP {r.status_code}")
    except Exception as e:
        print(f"  ERR   {filename}  {e}")

print(f"\nDownloading to {IMAGES_DIR}\n")
for f, u in PRODUCTS.items():
    download(f, u)
print("\nDone.")