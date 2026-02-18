# Scraper

Downloads and processes XML price data from Israeli supermarket chains, and upserts it into Supabase (PostgreSQL).

## Architecture

### Provider Layer

Providers handle file discovery and download per chain platform:

- **BaseProvider** — Abstract orchestrator: `fetchFileList` → `filterFiles` → `processSingleTask`. Handles HTTP download, gzip decompression, and temp file cleanup with retry logic.
- **CerberusProvider** — FTP-based provider for chains on the Cerberus platform. Single FTP connection per run.
- **ShufersalProvider** — HTML scraping from `prices.shufersal.co.il`. Handles cookie management, pagination, and regex-based HTML table parsing. Downloads from Azure Blob Storage URLs.

### Processor Layer

Processors parse XML and upsert data into Supabase:

- **BaseProcessor** — Shared save logic with batched upserts.
- **StoreProcessor** — Parses store XML, maps cities via multi-step resolution (CBS codes → name normalization → aliases → fallback extraction). Extensible via `_resolveFields()` and `storeElements` hooks.
  - **ShufersalStoreProcessor** — Subclass for SAP XML format (uppercase elements: `STORE`, `STOREID`, `STORENAME`).
- **PriceProcessor** — Streaming XML parser with in-memory cache for item/store ID lookups.
- **PromoProcessor** — Parses promotions and promotion_items with barcode deduplication.

### City Matching Engine

The `StoreProcessor` uses a 4-step city resolution strategy:

1. **CBS code** — Direct lookup by government statistical code (Cerberus chains)
2. **City name** — Exact match, then normalized match (hyphens, spelling variants like קרית→קריית)
3. **Alias mapping** — `CITY_ALIASES` dict for abbreviations, neighborhoods, and alternate names
4. **Fallback** — Extract known city names from the store name text, then check `STORE_OVERRIDES` for manual mappings

Result: **592/592 stores matched (100%)** across all 4 chains.

### Flow

1. `index.js` loads chain configs from Supabase and instantiates the appropriate provider per `scraper_type`.
2. The provider fetches the file list (FTP directory listing or HTML table parsing).
3. Files are filtered against active stores (for prices) or deduplicated to latest (for stores).
4. Each file is downloaded, decompressed, and passed to the matching processor.
5. The processor streams the XML and upserts data in batches.

## Supported Chains

| Chain | Provider | Stores |
|-------|----------|--------|
| Shufersal | ShufersalProvider | 422 |
| Rami Levy | CerberusProvider | 98 |
| Yochananof | CerberusProvider | 50 |
| Osher Ad | CerberusProvider | 22 |

## Usage

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

## Environment Variables

Create a `.env` file in the `scraper/` directory:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Optional (Telegram notifications):

```env
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
```

## Directory Structure

```
scraper/
├── core/
│   ├── BaseProvider.js         # Abstract provider (download, decompress, orchestrate)
│   └── BaseProcessor.js        # Shared DB save logic (batched upserts)
├── providers/
│   ├── CerberusProvider.js     # FTP-based provider
│   └── ShufersalProvider.js    # HTML scraping provider + ShufersalStoreProcessor
├── processors/
│   ├── StoreProcessor.js       # Store XML parser + city matching engine
│   ├── PriceProcessor.js       # Price XML streaming parser
│   └── PromoProcessor.js       # Promotion XML parser
├── utils/
│   └── TelegramClient.js       # Telegram notification client
├── index.js                    # CLI entry point
├── package.json
└── README.md
```
