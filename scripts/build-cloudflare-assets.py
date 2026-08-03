from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

ROOT_STATIC_FILES = (
    "index.html",
    "paid-checkout.js",
    "favicon.png",
    "logo.png",
    "zeni-favicon-new.png",
    "robots.txt",
    "sitemap.xml",
    "site.webmanifest",
    "_headers",
    "_redirects",
)

STATIC_DIRECTORIES = (
    "premium",
    "privacy",
    "terms",
    "welcome",
)

REQUIRED_OUTPUTS = (
    "index.html",
    "paid-checkout.js",
    "welcome/index.html",
    "welcome/welcome.js",
    "premium/index.html",
    "privacy/index.html",
    "terms/index.html",
    "_headers",
)


def copy_if_present(relative_path: str) -> None:
    source = ROOT / relative_path
    if not source.exists():
        return

    destination = DIST / relative_path
    if source.is_dir():
        shutil.copytree(source, destination)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    for relative_path in ROOT_STATIC_FILES:
        copy_if_present(relative_path)

    for relative_path in STATIC_DIRECTORIES:
        copy_if_present(relative_path)

    missing = [relative_path for relative_path in REQUIRED_OUTPUTS if not (DIST / relative_path).is_file()]
    if missing:
        raise SystemExit(f"Cloudflare asset build is missing required outputs: {', '.join(missing)}")

    forbidden = (
        "api/checkout.js",
        "api/welcome.js",
        "worker/index.js",
        "vercel.json",
        "wrangler.jsonc",
        "package.json",
    )
    leaked = [relative_path for relative_path in forbidden if (DIST / relative_path).exists()]
    if leaked:
        raise SystemExit(f"Cloudflare asset build exposed non-public source files: {', '.join(leaked)}")

    print(f"Built Cloudflare static assets in {DIST}")


if __name__ == "__main__":
    main()
