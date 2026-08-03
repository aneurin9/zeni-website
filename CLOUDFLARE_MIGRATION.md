# Zeni website Cloudflare migration

Canonical migration ledger: GitHub issue #72.

## Target architecture

- Cloudflare Workers with Static Assets.
- Static website output: `dist/`.
- Worker entrypoint: `worker/index.js`.
- Dynamic routes retained at the same browser paths:
  - `POST /api/checkout`
  - `GET /api/welcome`
- Existing Vercel functions remain in `api/` as an unchanged rollback path during migration and stabilization.

## Repository commands

```text
npm install
npm run check:cloudflare
npm run build:cloudflare
npx wrangler deploy --dry-run
```

The Cloudflare build applies the same guarded website transformations used by Vercel and then copies only public website assets into `dist/`. Server code, scripts, repository configuration and secrets are excluded from the static upload.

## Cloudflare Workers Builds settings

Use these settings only after Stage A is reviewed:

- Repository: `aneurin9/zeni-website`
- Production branch: keep production deployment disabled or pointed away from `main` until cutover is explicitly approved.
- Enable builds for non-production branches for preview verification.
- Build command: `npm run build:cloudflare`
- Deploy command: default `npx wrangler deploy`
- Preview deploy command: default `npx wrangler versions upload`

## Runtime variables and secrets

Do not place values in GitHub, source files, build logs or issue comments.

The Worker requires these runtime bindings before checkout can work:

- `ZENI_BACKEND_CHECKOUT_URL`
- `ZENI_CHECKOUT_BRIDGE_SECRET`

Both may be stored as encrypted Cloudflare secrets. The backend URL must use HTTPS and end at either `/api/public/checkout` or `/api/public/configured-checkout`; the Worker normalizes it to `/api/public/configured-checkout`. The same base is used for `/api/public/welcome`.

Do not rotate the shared secret or change the live backend URL during Stage A. Establish preview-safe values only after the Railway backend endpoint and its origin contract are reviewed.

## Verification gates

Before any custom domain or DNS change:

1. Static landing, Premium, Privacy, Terms and Welcome pages render correctly on a Cloudflare preview URL.
2. Static security headers are present.
3. Cross-origin requests to `/api/checkout` and `/api/welcome` fail closed.
4. Invalid methods, content types, bodies and checkout-session IDs return the expected errors.
5. No secret or backend URL appears in public assets.
6. Core and Premium checkout handoff is verified against an approved backend endpoint.
7. Stripe redirects only to `https://checkout.stripe.com`.
8. Post-payment welcome personalization succeeds without exposing the checkout session in browser history.

## Cutover boundary

Do not attach `zeni.aneurinadvisory.com`, change DNS, merge the migration PR, rotate the bridge secret, remove Vercel variables, or retire the Vercel project without explicit owner authorization recorded in issue #72. Keep Vercel available as rollback through the agreed stabilization period.
