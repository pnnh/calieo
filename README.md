# Calieo — Free Online Tool Portal

The main portal site for [calieo.xyz](https://calieo.xyz). Provides a multilingual homepage, per-tool detail pages, and a privacy policy — all statically generated and deployed to Cloudflare Workers via OpenNext.

## Features

- **4 languages** — `en`, `es`, `fr`, `zh`; URL-based routing via `/[lang]/`
- **Auto language detection** — root `/` redirects to the best-match language from `Accept-Language`
- **32 SSG pages** — homepage × 4 languages + tool detail × 6 tools × 4 languages + privacy × 4 languages
- **Cookie consent banner** — EU-compliant; sets `cookie-consent` with `Domain=.calieo.xyz` so all subdomains share the same preference without re-asking
- **Privacy policy** — 4-language SSG pages at `/{lang}/privacy`

## Tech Stack

- Next.js 16 (App Router, React 19, TypeScript)
- Tailwind CSS v4
- OpenNext + Cloudflare Workers (deployment)

## Development

```bash
pnpm dev          # starts on http://localhost:7500
pnpm build        # Next.js static build (67 pages)
pnpm adapter      # build + OpenNext Cloudflare adapter
pnpm preview      # preview Cloudflare Worker locally
```

### Environment variables (account sign-in)

Required for the "Sign in with Calieo" OIDC flow (`/api/auth/calieo/*`):

- `CALIEO_OIDC_ISSUER` — Calieo OIDC issuer base URL (default `https://portal.calieo.xyz`)
- `CALIEO_OIDC_CLIENT_ID` — registered OAuth2 client ID
- `CALIEO_OIDC_CLIENT_SECRET` — client secret (set via `wrangler secret put` in production)
- `CALIEO_OIDC_REDIRECT_URI` — callback URL registered with Calieo, e.g. `http://localhost:7300/api/auth/calieo/callback`
- `SESSION_TTL_DAYS` — session cookie lifetime in days (default `7`)

## Deployment

Deployed to Cloudflare Workers via `wrangler` + OpenNext adapter:

```bash
pnpm opennextjs-cloudflare build     # outputs to .open-next/
wrangler deploy   # or `wrangler publish`
```

`wrangler.jsonc` targets compatibility date `2026-05-09` with `nodejs_compat`.
