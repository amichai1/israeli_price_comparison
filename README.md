# Price Compare IL - Israeli Supermarket Price Comparison App

A mobile application for comparing grocery prices across major Israeli supermarket chains, powered by open data published under the Israeli Price Transparency Law.

## Overview

- **Frontend**: React Native + Expo (TypeScript)
- **Backend**: Supabase (PostgreSQL) — cities, chains, stores, items, prices, promotions
- **Scraper**: Node.js service that downloads and processes XML price data from supermarket chains via FTP

## Features

- Product search by name or barcode
- Shopping basket management with persistent storage
- Price comparison across chains with cheapest store highlighting
- Missing item detection per store
- Item-by-item price breakdowns

## Supported Chains

| Chain | Scraper Type | Stores |
|-------|-------------|--------|
| Rami Levy | Cerberus (FTP) | 98 |
| Osher Ad | Cerberus (FTP) | 22 |
| Yochananof | Cerberus (FTP) | 50 |
| Shufersal | Custom (HTML scraping) | 422 |

### Supported Document Types

| Type | Status |
|------|--------|
| Stores | Supported |
| PriceFull | Supported |
| PriceUpdate | Supported |
| PromoFull | Supported |
| PromoUpdate | Supported |

## Project Structure

```
israeli_price_comparison/
├── app/                    # Expo Router screens
├── components/             # Reusable UI components
├── lib/                    # Utilities and services
├── types/                  # TypeScript type definitions
├── database/
│   └── schema.sql          # PostgreSQL schema (cities, chains, stores, items, prices, promotions)
├── scraper/
│   ├── core/               # BaseProvider, BaseProcessor
│   ├── providers/          # CerberusProvider, ShufersalProvider
│   ├── processors/         # StoreProcessor, PriceProcessor, PromoProcessor
│   ├── utils/              # TelegramClient
│   └── index.js            # CLI entry point
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- A Supabase project with the schema from `database/schema.sql`

### Installation

```bash
git clone <repo-url>
cd israeli_price_comparison
npm install
```

### Environment Setup

Create a `.env` file in the project root with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

For the scraper, create a `.env` file in the `scraper/` directory:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Running the App

```bash
npm run dev
```

### Running the Scraper

```bash
cd scraper
npm install
node index.js              # default: PriceFull
node index.js stores       # update store data
node index.js pricefull    # full price update
node index.js price        # incremental price update
node index.js promofull    # full promotions update
node index.js promo        # incremental promotions update
node index.js pricefull promofull  # multiple types in sequence
```

See `scraper/README.md` for detailed scraper documentation.

## Automated Data Pipeline (GitHub Actions)

The scraper runs automatically via GitHub Actions with a single YAML workflow file orchestrating multiple scheduled jobs:

| Schedule | Job | Command | Description |
|----------|-----|---------|-------------|
| Daily 05:00 IST | `daily-full` | `pricefull promofull` | Full price and promotion sync |
| Daily 11:00 IST | `daily-incremental` | `price promo` | Incremental updates only |
| Monthly (1st) | `monthly-stores` | `stores` | Store data synchronization |
| Manual | `workflow_dispatch` | Configurable | On-demand runs with custom doc types |

- **Security**: All credentials (Supabase, Telegram) stored in GitHub Secrets — no hardcoded keys in the codebase
- **Performance**: NPM dependency caching for optimized build times
- **Architecture**: Conditional job execution (`if: github.event.schedule == ...`) routes each cron trigger to the correct job within a single workflow

## Israeli Price Transparency Law

This app leverages data published under the Israeli Price Transparency Law, which requires major supermarket chains to publish their price data in XML format. Cerberus-based chains (Rami Levy, Osher Ad, Yochananof) publish via FTP at `url.retail.publishedprices.co.il`, while Shufersal publishes on their own portal at `prices.shufersal.co.il`.

### Data Update Frequency

- **Full Price Lists**: Daily
- **Incremental Updates**: Hourly
- **Store Information**: Weekly

## License

This project is for educational and demonstration purposes. Price data is sourced from public Israeli Price Transparency portals.
