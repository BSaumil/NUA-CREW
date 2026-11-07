#!/usr/bin/env python3
"""Install exact owner-approved NUA CREW artwork from supplied brand-kit ZIP."""
from pathlib import Path
import sys
import zipfile

if len(sys.argv) != 2:
    raise SystemExit("Usage: python3 scripts/install_brand_kit.py /path/to/NUA_Crew_Complete_Brand_Kit.zip")
root = Path.cwd()
if not (root / "packages/ui/src/brand.tsx").is_file():
    raise SystemExit("Run from the NUA-CREW repository root.")
with zipfile.ZipFile(sys.argv[1]) as archive:
    def install(source: str, destination: str) -> None:
        target = root / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.read(source))
        print(f"Installed {destination}")

    for app in ("site", "web", "employer"):
        prefix = f"apps/{app}/public/brand"
        install("logos/NUA_CREW_logo_vector_traced.svg", f"{prefix}/nua-crew-logo.svg")
        install("logos/NUA_CREW_symbol_vector_traced.svg", f"{prefix}/nua-crew-symbol.svg")
        install("logos/NUA_CREW_primary_transparent.png", f"{prefix}/nua-crew-primary.png")
        install("logos/NUA_CREW_white.png", f"{prefix}/nua-crew-white.png")
        install("social/NUA_CREW_open_graph.png", f"{prefix}/nua-crew-open-graph.png")
        install("icons/NUA_CREW_favicon.ico", f"apps/{app}/app/favicon.ico")
    install("icons/NUA_CREW_app_icon_ivory_1024.png", "apps/mobile/assets/icon.png")
    install("icons/NUA_CREW_app_icon_ivory_1024.png", "apps/mobile/assets/splash-icon.png")
    install("icons/NUA_CREW_app_icon_ivory_1024.png", "apps/mobile/assets/adaptive-icon.png")
    install("icons/NUA_CREW_icon_32.png", "apps/mobile/assets/favicon.png")
    install("icons/NUA_CREW_icon_192.png", "apps/mobile/assets/notification-icon.png")
    install("guidelines/BRAND_GUIDE.md", "docs/brand/NUA_CREW_OFFICIAL_BRAND_GUIDE.md")
print("Review Android adaptive alpha, notification monochrome and dark-mode legibility before native release.")
