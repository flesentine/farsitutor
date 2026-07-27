#!/usr/bin/env python3
"""Regenerate Farsi Daily App Store and PWA visual assets.

Requires Pillow and an installed Arabic/Persian-capable font. No font files are
stored in this repository.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib
import json
import os

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app-store-assets"
WEB = ROOT / "assets" / "icons"

COLORS = {
    "primary_light": "#7466E8",
    "primary": "#5141CE",
    "primary_dark": "#4638BD",
    "background": "#F7F7FC",
    "accent": "#61C7A8",
}

FONT_CANDIDATES = [
    os.environ.get("FARSI_DAILY_ARABIC_FONT"),
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Geeza Pro Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Black.ttf",
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf",
]

def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))

def font_path() -> str:
    for candidate in FONT_CANDIDATES:
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("Install an Arabic-capable font or set FARSI_DAILY_ARABIC_FONT.")

def gradient(size: int) -> Image.Image:
    start, end = rgb(COLORS["primary_light"]), rgb(COLORS["primary_dark"])
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            amount = min(1, max(0, (x * .56 + y * .44) / (size - 1)))
            pixels[x, y] = tuple(round(start[i] + (end[i] - start[i]) * amount) for i in range(3))
    glow = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(glow)
    draw.ellipse((-size * .4, -size * .42, size * .8, size * .78), fill=(255, 255, 255, 40))
    draw.ellipse((size * .45, size * .55, size * 1.25, size * 1.28), fill=(*rgb(COLORS["accent"]), 38))
    return Image.alpha_composite(image.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(size * .1)))

def centered_text(image: Image.Image, text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, ...], center: tuple[float, float], dy: float = 0) -> None:
    draw = ImageDraw.Draw(image)
    box = draw.textbbox((0, 0), text, font=font)
    width, height = box[2] - box[0], box[3] - box[1]
    draw.text((center[0] - width / 2 - box[0], center[1] - height / 2 - box[1] + dy), text, font=font, fill=fill)

def icon(size: int) -> Image.Image:
    image = gradient(size)
    card = (int(size * .19), int(size * .19), int(size * .81), int(size * .81))
    shadow = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle((card[0], card[1] + size * .025, card[2], card[3] + size * .025), radius=int(size * .17), fill=(27, 20, 80, 88))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * .042)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(card, radius=int(size * .17), fill=(255, 255, 255, 244), outline=(255, 255, 255, 175), width=max(1, size // 180))
    centered_text(image, "ف", ImageFont.truetype(font_path(), int(size * .39)), (*rgb(COLORS["primary"]), 255), (size * .5, size * .49), -size * .02)
    draw.arc((int(size * .32), int(size * .63), int(size * .68), int(size * .82)), 200, 340, fill=(*rgb(COLORS["accent"]), 255), width=max(4, int(size * .018)))
    return image.convert("RGB")

def launch_mark(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    pad = int(size * .08)
    card = (pad, pad, size - pad, size - pad)
    shadow = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle((card[0], card[1] + size * .035, card[2], card[3] + size * .035), radius=int(size * .22), fill=(39, 31, 89, 70))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * .05)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(card, radius=int(size * .22), fill=(*rgb(COLORS["primary"]), 255))
    centered_text(image, "ف", ImageFont.truetype(font_path(), int(size * .57)), (255, 255, 255, 255), (size * .5, size * .47), -size * .03)
    return image

def main() -> None:
    appicon = OUT / "Assets.xcassets" / "AppIcon.appiconset"
    launch = OUT / "Assets.xcassets" / "LaunchMark.imageset"
    appicon.mkdir(parents=True, exist_ok=True)
    launch.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)

    source = icon(1024)
    source.save(appicon / "AppIcon-1024.png", optimize=True)

    for size, filename in [(192, "farsi-daily-192.png"), (512, "farsi-daily-512.png"), (180, "apple-touch-icon-180.png")]:
        icon(size).save(WEB / filename, optimize=True)

    maskable = gradient(512)
    maskable.alpha_composite(icon(410).convert("RGBA"), (51, 51))
    maskable.convert("RGB").save(WEB / "farsi-daily-maskable-512.png", optimize=True)

    for size, filename in [(160, "LaunchMark.png"), (320, "LaunchMark@2x.png"), (480, "LaunchMark@3x.png")]:
        launch_mark(size).save(launch / filename, optimize=True)

    assets = []
    for path in sorted([*OUT.rglob("*.png"), *WEB.glob("*.png")]):
        image = Image.open(path)
        assets.append({
            "path": str(path.relative_to(ROOT)),
            "width": image.width,
            "height": image.height,
            "mode": image.mode,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        })
    manifest = {"brand": COLORS, "assets": assets}
    (OUT / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
