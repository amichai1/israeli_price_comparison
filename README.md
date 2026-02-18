# Price Compare IL

> Real-time grocery price comparison across Israel's largest supermarket chains, powered by open government data.

A full-stack mobile application that scrapes, processes, and compares prices from 592 supermarket branches across 4 major Israeli chains. Built with React Native (Expo), Supabase (PostgreSQL), and a custom Node.js data pipeline — all orchestrated via GitHub Actions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native + Expo (TypeScript) |
| Database | Supabase (PostgreSQL) with RLS |
| Scraper | Node.js, XML streaming, HTML parsing |
| CI/CD | GitHub Actions (scheduled cron jobs) |
| Notifications | Telegram Bot API |

## Key Features

- **Product Search** — by name or barcode scan
- **Price Comparison** — across all chains with cheapest store highlighting
- **Shopping Basket** — persistent basket with per-store price breakdowns
- **Promotions** — active deals and club discounts
- **Missing Item Detection** — identifies which stores don't carry a product

## Data Pipeline

The scraper downloads XML price files published under the [Israeli Price Transparency Law](https://www.gov.il/he/pages/cpfta), which mandates that major supermarket chains publish their pricing data publicly.

### Supported Chains

| Chain | Platform | Stores | Method |
|-------|----------|--------|--------|
| Shufersal | Custom portal | 422 | HTML scraping + Azure Blob download |
| Rami Levy | Cerberus | 98 | FTP |
| Yochananof | Cerberus | 50 | FTP |
| Osher Ad | Cerberus | 22 | FTP |

**Total: 592 stores, 100% city-matched** using a multi-step resolution engine (CBS codes, name normalization, alias mapping, and fallback extraction).

### Document Types

| Type | Description |
|------|-------------|
| `stores` | Branch locations and metadata |
| `pricefull` | Complete price list per store |
| `price` | Incremental price updates |
| `promofull` | Full promotions list |
| `promo` | Incremental promotion updates |

### Scraper Architecture

```
BaseProvider (abstract)
├── CerberusProvider    → FTP-based chains (Rami Levy, Osher Ad, Yochananof)
└── ShufersalProvider   → HTML scraping from prices.shufersal.co.il

BaseProcessor (abstract)
├── StoreProcessor      → City matching with normalization + aliases
│   └── ShufersalStoreProcessor  → SAP XML format (uppercase elements)
├── PriceProcessor      → Streaming XML parser with in-memory caching
└── PromoProcessor      → Promotion and promotion_items deduplication
```

Follows the **Dependency Inversion Principle** — base classes depend on abstractions (`_resolveFields()`, `storeElements`), not on chain-specific implementations.

## CI/CD Pipeline (GitHub Actions)

Automated data pipeline using a single workflow file with conditional job routing:

| Schedule | Job | Command | Description |
|----------|-----|---------|-------------|
| Daily 05:00 IST | `daily-full` | `pricefull promofull` | Full price and promotion sync |
| Daily 11:00 IST | `daily-incremental` | `price promo` | Incremental updates |
| Monthly (1st) | `monthly-stores` | `stores` | Store data synchronization |
| On-demand | `workflow_dispatch` | Configurable | Manual runs with custom doc types |

- **Security** — All credentials stored in GitHub Secrets (Supabase, Telegram)
- **Performance** — NPM dependency caching for faster builds
- **Monitoring** — Telegram notifications on completion/failure

## Database Schema

7 tables with full RLS (Row Level Security) and read-only public access:

```
cities ──┐
chains ──┤
         ├── stores ── prices ── items
         │              └── promotions ── promotion_items
         └──────────────────────┘
```

3 views: `price_comparison`, `cheapest_prices`, `active_promotions`

See [`database/README.md`](database/README.md) for full schema documentation.

## Project Structure

```
israeli_price_comparison/
├── app/                        # Expo Router screens (React Native)
├── components/                 # Reusable UI components
├── lib/                        # Utilities and services
├── types/                      # TypeScript type definitions
├── server/                     # tRPC backend
├── database/
│   └── schema.sql              # PostgreSQL schema — single source of truth
├── scraper/
│   ├── core/                   # BaseProvider, BaseProcessor
│   ├── providers/              # CerberusProvider, ShufersalProvider
│   ├── processors/             # StoreProcessor, PriceProcessor, PromoProcessor
│   ├── utils/                  # TelegramClient
│   └── index.js                # CLI entry point
└── .github/workflows/          # GitHub Actions pipeline
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Supabase project

### Installation

```bash
git clone https://github.com/amichai1/israeli_price_comparison.git
cd israeli_price_comparison
npm install
```

### Environment Variables

**App** (root `.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**Scraper** (`scraper/.env`):
```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
TELEGRAM_BOT_TOKEN=<optional>
TELEGRAM_CHAT_ID=<optional>
```

### Running the App

```bash
npm run dev
```

### Running the Scraper

```bash
cd scraper && npm install
node index.js                      # default: PriceFull
node index.js stores               # update store data
node index.js pricefull promofull  # full price + promotions
node index.js price promo          # incremental updates
```

## License

This project is for educational and demonstration purposes. Price data is sourced from public Israeli Price Transparency portals as mandated by law.
