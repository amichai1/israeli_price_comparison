# Israeli Price Comparison - Claude Code Context

## Project Overview
Full-stack mobile app for comparing grocery prices across major Israeli supermarket chains, leveraging the Israeli Price Transparency Law open data.

## Tech Stack
- **Frontend**: React Native + Expo SDK 54 + TypeScript + NativeWind (Tailwind)
- **Backend**: Supabase (PostgreSQL)
- **Scraper**: Node.js + Playwright + xml2js
- **Notifications**: Telegram Bot

## Project Structure
```
israeli_price_comparison/
├── app/                    # Expo Router screens (React Native)
├── scraper/               # Price scraping automation
│   ├── core/              # Base classes (BaseProvider, BaseProcessor)
│   ├── providers/         # Chain-specific scrapers (CerberusProvider)
│   ├── processors/        # Data processors (PriceProcessor, StoreProcessor)
│   ├── utils/             # Utilities (TelegramClient)
│   └── old-scraper/       # Legacy single-chain scrapers
├── database/              # PostgreSQL schema and migrations
├── server/                # API server (if applicable)
└── lib/                   # Shared utilities and services
```

## Database Schema
### Core Tables:
- **chains**: Supermarket chains with scraper config (name, chain_code, scraper_type, username, base_url)
- **cities**: Geographic areas for store filtering
- **stores**: Store branches (linked to chain_id, city_id)
- **items**: Products (barcode, name, unit_measure)
- **prices**: Price data (item_id, store_id, price, last_updated)

### Supported Chains (8 total):
1. רמי לוי (Rami Levy) - Cerberus
2. אושר עד (Osher Ad) - Cerberus
3. ויקטורי (Victory) - Cerberus
4. חצי חינם (Hazi Hinam) - Cerberus
5. יוחננוף (Yochananof) - Cerberus
6. מחסני השוק (Shook) - Cerberus
7. קרפור / יינות ביתן (Carrefour/Yeinot Bitan) - Cerberus
8. שופרסל (Shufersal) - Shufersal (separate portal)

## Scraper Architecture
### Two Provider Types:
1. **CerberusProvider**: For chains using url.retail.publishedprices.co.il (most chains)
   - Uses Playwright for automated login
   - Fetches XML files via web scraping
   - Supports multiple document types (STORES, PRICE_FULL)

2. **ShufersalProvider** (planned): For prices.shufersal.co.il

### Workflow:
1. `index.js` queries `chains` table from Supabase
2. For each chain, instantiates appropriate Provider
3. Provider downloads XML files (stores, prices)
4. Processor parses XML and upserts to Supabase
5. TelegramClient sends completion notification

## Current State
### Working:
- ✅ Frontend app with search, basket, price comparison
- ✅ Supabase integration with 8 chains configured
- ✅ Legacy scrapers for 4 chains (in old-scraper/)
- ✅ **NEW: Modular scraper architecture (CerberusProvider)** - WORKING!
- ✅ GitHub Actions for automated scraping

### Recently Fixed (Feb 2026):
- ✅ Browser persistence issue (was closing before download)
- ✅ SSL certificate workaround (ignoreHTTPSErrors)
- ✅ Download method (using Playwright context.request instead of axios)
- ✅ Store ID extraction from filenames
- ✅ File filtering by date (only today's files)

### In Progress:
- 🔄 StoreProcessor XML parsing (debugging structure)
- 🔄 PriceProcessor validation
- 🔄 Full workflow (Stores → PriceFull)

## Known Issues & Solutions

### ✅ SOLVED: Browser/Download Issues
**Problem**: Scraper couldn't download files, timeout errors
**Root Cause**:
- Browser was closing before download completed
- Tried to download with axios without session/cookies
- SSL certificate errors

**Solution** (Implemented):
1. ✅ Keep browser open across all operations (`ensureBrowserConnected()`)
2. ✅ Use Playwright `context.request.get()` with session cookies
3. ✅ Add `ignoreHTTPSErrors: true` to browser context
4. ✅ Download files one by one with same session

### 🔄 IN PROGRESS: StoreProcessor Not Adding Stores
**Problem**: Downloads work but "0 stores added to database"
**Root Cause**: Investigating XML structure mismatch
**Current Status**:
- Fixed `chain_id: this.config.id` (was dbId)
- Added detailed logging
- XML shows 0 stores found → need to check XML element names

**Next Steps**:
1. Inspect actual XML structure from Cerberus
2. Update XmlStream element selectors
3. Test with real data

## Environment Variables
Required in `scraper/.env`:
```
SUPABASE_URL=https://wpdaidwskbgiphgdarbp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
```

## Common Tasks

### Run Scraper (Old Version)
```bash
cd scraper
node old-scraper/master-agent.js  # Runs 4 chains (known working)
```

### Run Scraper (New Version - RECOMMENDED)
```bash
cd scraper

# Test single chain first
node test-single-chain.js                # Tests רמי לוי
node test-single-chain.js "אושר עד"     # Tests specific chain

# Run all 8 chains
node index.js  # Runs all chains from DB
```

### Debug Tools
```bash
cd scraper

# Check database migration status
node migrate-to-v2.js

# Inspect XML structure
node debug-xml.js
```

### Populate Sample Data
```bash
cd scraper
node populate-sample-data.js
```

### Run Database Migration
```bash
cd scraper
node run-migration.js
```

### Test Telegram Notifications
```bash
cd scraper
node old-scraper/test-telegram.js
```

### Run Frontend
```bash
npm run dev
# Then press 'i' for iOS or 'a' for Android
```

## Development Guidelines

### Adding a New Chain:
1. Add chain to `database/schema.sql` seed data
2. If using Cerberus portal, no code changes needed (uses CerberusProvider)
3. If custom portal, create new Provider class extending BaseProvider
4. Test with single store first

### Debugging Scraper:
1. Check logs for specific error messages
2. Verify Supabase credentials in .env
3. Test network connectivity to portals
4. Check if portal structure changed (inspect with browser DevTools)
5. Validate XML file integrity (gzip, proper closing tags)

### Code Style:
- TypeScript for frontend
- JSDoc comments for scraper
- Hebrew comments in scraper (for domain clarity)
- Follow existing patterns (BaseProvider/Processor)

## Git Workflow
- **main**: Production-ready code
- **this-is-working-manually-and-in-github-action**: Current working branch (4 chains)
- Commit 3c14971 has the 8-chain architecture (needs fixing)

## Next Steps (Priority Order)
1. ✅ ~~Fix commit 3c14971 - get 8-chain scraper working~~ (DONE)
2. ✅ ~~Run DB migration safely~~ (DONE)
3. 🔄 Fix StoreProcessor XML parsing (IN PROGRESS)
4. 🔄 Validate PriceProcessor works
5. 🔄 Test full workflow: Stores → PriceFull
6. Update GitHub Actions to use new scraper (index.js)
7. Add PromoFull support (optional)
8. Add last_updated timestamp to comparison screen
9. Implement barcode scanning in app
10. Add price history tracking

## Recent Session Summary (Feb 5, 2026)

### What Was Broken:
- Scraper architecture looked good but couldn't download files
- Browser was closing before download (session lost)
- axios attempted download without cookies (403/401 errors)
- SSL certificate errors blocking connections

### What We Fixed:
1. **Browser Persistence**: Created `ensureBrowserConnected()` method
   - Keeps browser/context/page as class properties
   - Reuses same session for all operations
   - Only closes in `clearCache()` at the end

2. **Download Method**: Changed from axios to Playwright context API
   - `const response = await this.context.request.get(fullUrl)`
   - Automatically includes session cookies
   - Works with SSL errors (ignored in context)

3. **Store ID Extraction**: Fixed filename parsing
   - 5-segment files (Price): `parts[2]` = store ID
   - 4-segment files (Stores): `parts[1]` = "000"

4. **File Filtering**: Only download today's files
   - Extract date from filename (YYYYMMDD format)
   - Compare with `new Date().toISOString().slice(0,10).replace(/-/g,'')`

### Current Status:
- ✅ Connection works
- ✅ File download works
- ✅ File decompression works
- ⚠️ XML parsing needs investigation (0 stores found)

## Notes for Claude Code
- ✅ DB migration completed - chains and cities tables exist
- ✅ SSL issues handled with `ignoreHTTPSErrors: true` in context
- ✅ Browser persistence is critical - keep it open across downloads
- ✅ Use `context.request.get()` for downloads (preserves session)
- ✅ Playwright timeouts: 60s for table load, 120s for downloads
- ⚠️ StoreProcessor needs XML structure investigation
- Always test with `test-single-chain.js` before running all chains
- Telegram notifications are critical for monitoring
- GitHub Actions runs on schedule (check .github/workflows/)

## Architecture Decisions

### Why Playwright Context Request?
- Initial attempt: Click link → wait for download event (failed - timeout)
- Second attempt: Extract URL → download with axios (failed - no cookies)
- **Final solution**: Extract URL → download with `context.request.get()`
  - ✅ Preserves session cookies
  - ✅ Works with redirects
  - ✅ No timeout issues
  - ✅ Simpler code

### File Naming Convention
Cerberus files follow this pattern:
- **Price files**: `Price{chainCode}-{subChain}-{storeID}-{date}-{time}.gz`
  - Example: `Price7290058140886-001-070-20260205-070019.gz`
  - 5 segments when split by '-'
  - storeID is parts[2]

- **Store files**: `Stores{chainCode}-{000}-{date}-{time}.xml`
  - Example: `Stores7290058140886-000-20260205-050500.xml`
  - 4 segments when split by '-'
  - "000" means all stores (parts[1])

## Pain Points (for automation)
- Manual testing of scrapers after each change
- No easy way to test single chain without modifying code
- Migration coordination between DB and code
- Debugging failed scraper runs (need better logging)
- Knowing when price data was last updated

## Success Metrics
- All 8 chains scraping successfully
- Price data updated daily
- App shows accurate comparison results
- Zero manual intervention needed for daily updates
