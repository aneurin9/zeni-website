from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    path = ROOT / relative_path
    if not path.is_file():
        raise SystemExit(f"Required Cloudflare migration file is missing: {relative_path}")
    return path.read_text(encoding="utf-8")


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise SystemExit(f"Cloudflare portability contract missing: {label}")


def forbid(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise SystemExit(f"Cloudflare portability contract contains forbidden value: {label}")


def main() -> None:
    worker = read("worker/index.js")
    wrangler = json.loads(read("wrangler.jsonc"))
    package = json.loads(read("package.json"))
    headers = read("_headers")
    checkout_browser = read("paid-checkout.js")
    welcome_browser = read("welcome/welcome.js")
    build_script = read("scripts/build-cloudflare-assets.py")

    for needle, label in (
        ("pathname === '/api/checkout'", "checkout Worker route"),
        ("pathname === '/api/welcome'", "welcome Worker route"),
        ("env.ASSETS.fetch(request)", "static assets fallback"),
        ("ZENI_BACKEND_CHECKOUT_URL", "backend URL binding"),
        ("ZENI_CHECKOUT_BRIDGE_SECRET", "checkout bridge secret binding"),
        ("CF-Connecting-IP", "Cloudflare-trusted client IP"),
        ("crypto.subtle", "Workers Web Crypto signing"),
        ("X-Zeni-Checkout-Timestamp", "checkout timestamp signature header"),
        ("X-Zeni-Client-IP-Hash", "checkout IP hash header"),
        ("X-Zeni-Checkout-Signature", "checkout signature header"),
        ("X-Zeni-Welcome-Timestamp", "welcome timestamp signature header"),
        ("X-Zeni-Welcome-Signature", "welcome signature header"),
        ("website_bridge_origin_rejected", "origin rejection code"),
        ("WORKERS_PREVIEW_HOST_PATTERN", "preview host allowlist"),
    ):
        require(worker, needle, label)

    for needle, label in (
        ("VERCEL_ENV", "Vercel runtime environment"),
        ("VERCEL_URL", "Vercel deployment URL"),
        ("x-vercel-forwarded-for", "Vercel forwarded IP header"),
        ("x-vercel-protection-bypass", "Vercel protection bypass"),
        ("X-Forwarded-For", "untrusted forwarded IP header"),
        ("node:crypto", "Node crypto dependency"),
    ):
        forbid(worker, needle, label)

    if wrangler.get("name") != "zeni-website":
        raise SystemExit("Wrangler Worker name must remain zeni-website")
    if wrangler.get("main") != "worker/index.js":
        raise SystemExit("Wrangler main must point to worker/index.js")
    assets = wrangler.get("assets") or {}
    if assets.get("directory") != "./dist":
        raise SystemExit("Wrangler assets.directory must be ./dist")
    if assets.get("binding") != "ASSETS":
        raise SystemExit("Wrangler assets binding must be ASSETS")
    if assets.get("run_worker_first") != ["/api/*"]:
        raise SystemExit("Only /api/* may run through the Worker before static assets")
    if not wrangler.get("preview_urls"):
        raise SystemExit("Cloudflare preview URLs must remain enabled")

    scripts = package.get("scripts") or {}
    require(scripts.get("build:cloudflare", ""), "scripts/build-cloudflare-assets.py", "Cloudflare asset build")
    require(scripts.get("check:cloudflare", ""), "scripts/validate-cloudflare-portability.py", "Cloudflare portability validation")
    if (package.get("devDependencies") or {}).get("wrangler") != "4.114.0":
        raise SystemExit("Wrangler must remain pinned to the reviewed version")

    require(headers, "X-Content-Type-Options: nosniff", "static nosniff header")
    require(headers, "X-Frame-Options: DENY", "static frame protection")
    require(headers, "/welcome/*", "welcome cache rule")
    require(headers, "Cache-Control: no-store", "welcome no-store rule")

    require(checkout_browser, "fetch('/api/checkout'", "same-origin browser checkout route")
    require(welcome_browser, "fetch('/api/welcome?checkout_session_id='", "same-origin browser welcome route")
    for public_source in (checkout_browser, welcome_browser, read("index.html")):
        forbid(public_source, "ZENI_CHECKOUT_BRIDGE_SECRET", "secret in public website source")
        forbid(public_source, "ZENI_BACKEND_CHECKOUT_URL", "backend URL in public website source")

    require(build_script, '"api/checkout.js"', "Vercel checkout exclusion")
    require(build_script, '"worker/index.js"', "Worker source exclusion")
    require(build_script, '"wrangler.jsonc"', "Wrangler config exclusion")

    print("Cloudflare portability contracts passed")


if __name__ == "__main__":
    main()
