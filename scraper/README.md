# Israeli Price Comparison - Scraper

Downloads and processes XML price data from Israeli supermarket chains via FTP, and upserts it into a Supabase (PostgreSQL) database.

## Architecture

### Core Components

- **BaseProvider** - Orchestrates the scraping flow: `fetchFileList` -> `filterFiles` -> `processSingleTask`. Handles downloading, decompression (gzip), and cleanup of temporary files.
- **CerberusProvider** - FTP-based provider for chains on the Cerberus platform. Establishes a single FTP connection per run, lists files by document type, and extracts store IDs from filenames.
- **BaseProcessor** - Shared database save logic with batched upserts.
- **StoreProcessor** - Parses store XML files, maps city names to the `cities` table, and upserts store records.
- **PriceProcessor** - Parses price XML files using streaming (xml-stream), upserts items, and inserts/updates prices. Includes an in-memory cache for item and store ID lookups.
- **PromoProcessor** - Parses promotion XML files, upserts promotions and promotion_items. Handles deduplication of barcodes within a single promotion.

### Flow

1. The CLI (`index.js`) loads chain configurations and instantiates a `CerberusProvider` for each chain.
2. The provider connects to the FTP server and fetches the file list for the requested document type.
3. Files are filtered against active stores in the database (for price types) or deduplicated to the latest file (for stores).
4. Each file is downloaded, decompressed if needed, and passed to the appropriate processor.
5. The processor parses the XML and upserts data into Supabase in batches.

## Supported Chains

All chains currently use the Cerberus platform (FTP-based):

- Rami Levy
- Osher Ad
- Yochananof

## Document Types

| Type | Status | Description |
|------|--------|-------------|
| Stores | Supported | Store locations and metadata |
| PriceFull | Supported | Full price list for a store |
| PriceUpdate | Supported | Incremental price changes |
| PromoFull | Supported | Full promotions list |
| PromoUpdate | Supported | Incremental promotion changes |

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

Optional (for Telegram notifications):

```env
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
```

## Directory Structure

```
scraper/
├── core/
│   ├── BaseProvider.js      # Abstract provider with download/decompress logic
│   └── BaseProcessor.js     # Shared DB save logic (batched upserts)
├── providers/
│   └── CerberusProvider.js  # FTP-based provider for Cerberus chains
├── processors/
│   ├── StoreProcessor.js    # Store XML parser
│   ├── PriceProcessor.js    # Price XML parser with streaming
│   └── PromoProcessor.js    # Promotion XML parser
├── utils/
│   └── TelegramClient.js    # Telegram notification client
├── index.js                 # CLI entry point
├── package.json
└── README.md
```
