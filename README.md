# Calieo — Free Online Tool Portal

The main portal site for [calieo.xyz](https://calieo.xyz). Provides a multilingual homepage, per-tool detail pages, and a privacy policy — all statically generated and deployed to Cloudflare Workers via OpenNext.

## Features

- **8 languages** — `en`, `es`, `fr`, `de-DE`, `pt-PT`, `ja`, `zh`, `zh-TW`; URL-based routing via `/[lang]/`
- **Auto language detection** — root `/` redirects to the best-match language from `Accept-Language`
- **67 SSG pages** — homepage × 8 languages + tool detail × 6 tools × 8 languages + privacy × 8 languages
- **Cookie consent banner** — EU-compliant; sets `cookie-consent` with `Domain=.calieo.xyz` so all subdomains share the same preference without re-asking
- **Privacy policy** — 8-language SSG pages at `/{lang}/privacy`

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

## Deployment

Deployed to Cloudflare Workers via `wrangler` + OpenNext adapter:

```bash
pnpm adapter      # outputs to .open-next/
wrangler deploy   # or `wrangler publish`
```

`wrangler.jsonc` targets compatibility date `2026-05-09` with `nodejs_compat`.
