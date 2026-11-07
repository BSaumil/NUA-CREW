"""Render app/store icons from the approved traced NUA CREW vector assets.

Owner brand kit: NUA_Crew_Complete_Brand_Kit(1).zip, 8 Nov 2026.
The source vectors under packages/ui/assets are traced from the approved raster;
do not describe them as native designer vectors. Requires Pillow and CairoSVG.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "packages/ui/assets"
ASSETS = ROOT / "apps/mobile/assets"
IVORY = "#F6F0E5"


def render(svg: str, width: int) -> Image.Image:
    return Image.open(
        io.BytesIO(cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=width))
    ).convert("RGBA")


def center(image: Image.Image, size: int, background: str | None = None) -> Image.Image:
    base = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    base.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    return base


def output(image: Image.Image, path: Path, check: bool) -> bool:
    image = image.convert("RGBA")
    data = io.BytesIO()
    image.save(data, format="PNG", optimize=True)
    new = data.getvalue()
    if check:
        ok = path.exists() and path.read_bytes() == new
        print(f"{'OK' if ok else 'DIFFERENT'} {path.relative_to(ROOT)}")
        return ok
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(new)
    print(f"WRITE {path.relative_to(ROOT)} ({len(new)} bytes)")
    return True


def main(check: bool) -> None:
    symbol = (BRAND / "nua-crew-symbol.svg").read_text(encoding="utf-8")
    master = (BRAND / "nua-crew-logo.svg").read_text(encoding="utf-8")
    artwork = render(symbol, 730)

    # iOS/Android standard icon: ivory square, official burgundy glyph.
    app = center(artwork, 1024, IVORY)
    # Adaptive foreground: transparent with generous crop safety.
    adaptive = center(render(symbol, 660), 1024)
    # Splash: true approved master, including its own tagline, on transparent canvas.
    master_art = render(master, 840)
    splash = center(master_art, 1024)
    # Android notifications need an opaque-white silhouette on transparent ground.
    mono_svg = symbol.replace("#890A31", "#FFFFFF")
    notification = center(render(mono_svg, 350), 512)
    favicon = center(render(symbol, 178), 256)
    apple_touch = center(render(symbol, 140), 180, IVORY)

    images = [
        (ASSETS / "icon.png", app),
        (ASSETS / "adaptive-icon.png", adaptive),
        (ASSETS / "splash-icon.png", splash),
        (ASSETS / "notification-icon.png", notification),
        (ASSETS / "favicon.png", favicon),
        (ROOT / "apps/site/app/apple-icon.png", apple_touch),
        (ROOT / "apps/web/app/apple-icon.png", apple_touch),
        (ROOT / "apps/employer/app/apple-icon.png", apple_touch),
    ]
    valid = all(output(image, path, check) for path, image in images)
    if not valid:
        raise SystemExit("Brand output differs: regenerate and commit all approved icons.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
