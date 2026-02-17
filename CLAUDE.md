# CLAUDE.md — Project Guidelines

## Project Overview

Israeli Supermarket Price Comparison — a mobile app (React Native + Expo) that compares grocery prices across Israeli supermarket chains. Data is scraped from FTP portals under the Israeli Price Transparency Law and stored in Supabase (PostgreSQL).

## Project Structure

```
israeli_price_comparison/
├── app/                    # Expo Router screens (React Native)
├── components/             # Reusable UI components
├── lib/                    # Utilities and services
├── types/                  # TypeScript type definitions
├── hooks/                  # React hooks (use-auth.ts etc.)
├── server/                 # tRPC backend (routers.ts, db.ts)
│   └── _core/              # ⛔ Framework internals — DO NOT MODIFY
├── shared/                 # Shared types and constants
│   └── _core/              # ⛔ Framework internals — DO NOT MODIFY
├── drizzle/                # Drizzle ORM schema (MySQL/TiDB for auth)
├── database/
│   └── schema.sql          # PostgreSQL schema — single source of truth
├── scraper/                # Node.js scraper (standalone)
│   ├── core/               # BaseProvider, BaseProcessor
│   ├── providers/          # CerberusProvider
│   ├── processors/         # StoreProcessor, PriceProcessor, PromoProcessor
│   ├── utils/              # TelegramClient
│   └── index.js            # CLI entry point
└── .github/workflows/      # GitHub Actions
```

## Rules

1. **DO NOT modify `_core/` directories** — `server/_core/`, `shared/_core/`, `lib/_core/` are framework-level (Manus template). Do not edit.
2. **Scraper is stable** — the `scraper/` directory works well. Avoid changes unless specifically requested.
3. **`schema.sql` is the source of truth** for the database. All tables, views, indexes, and seed data live there. No separate migration files.
4. **Hebrew comments** are used throughout the scraper and database files. Continue using Hebrew for comments in these areas.

## Database (Supabase / PostgreSQL)

Tables: `cities`, `chains`, `stores`, `items`, `prices`, `promotions`, `promotion_items`
Views: `price_comparison`, `cheapest_prices`, `active_promotions`

The mobile app connects to Supabase directly. The scraper uses `SUPABASE_SERVICE_ROLE_KEY` for write access.

## Scraper CLI

```bash
cd scraper && npm install
node index.js                      # default: PriceFull
node index.js stores               # update store data
node index.js pricefull            # full price update
node index.js promofull            # full promotions update
node index.js pricefull promofull  # multiple types in sequence
```

Currently supported chains (Cerberus FTP): Rami Levy, Osher Ad, Yochananof.

## Key Files

- `database/schema.sql` — full DB schema with seed data
- `scraper/index.js` — scraper entry point, CLI argument parsing
- `scraper/core/BaseProvider.js` — abstract provider (download, decompress, orchestrate)
- `scraper/core/BaseProcessor.js` — shared DB save logic (batched upserts)
- `scraper/providers/CerberusProvider.js` — FTP-based provider
- `server/routers.ts` — tRPC API routes
- `server/db.ts` — database query helpers
- `app/` — Expo Router screens

## Environment Variables

App (root `.env`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Scraper (`scraper/.env`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)
