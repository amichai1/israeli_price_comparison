# Israeli Price Transparency Scraper

This directory contains Node.js scripts for scraping price data from Israeli supermarket chains via the Israeli Price Transparency Law portals.

## Overview

The Israeli Price Transparency Law requires major supermarket chains to publish their price data in XML format. This scraper downloads, parses, and imports that data into the Supabase database.

## Supported Chains

| Chain | Portal | Username | Status |
|-------|--------|----------|--------|
| Rami Levy | [url.retail.publishedprices.co.il](https://url.retail.publishedprices.co.il/login) | RamiLevi | ✅ Implemented |
| Osher Ad | [url.retail.publishedprices.co.il](https://url.retail.publishedprices.co.il/login) | osherad | 🔄 Planned |
| Yohananof | [url.retail.publishedprices.co.il](https://url.retail.publishedprices.co.il/login) | yohananof | 🔄 Planned |
| Shufersal | [prices.shufersal.co.il](https://prices.shufersal.co.il) | (separate portal) | 🔄 Planned |

## Prerequisites

### 1. Install Dependencies

```bash
npm install axios xml2js @supabase/supabase-js
```

### 2. Set Environment Variables

Create a `.env` file in the scraper directory:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** Use the **service role key**, not the anon key, as the scraper needs write access.

### 3. Database Setup

Ensure the database schema is already created (see `../database/schema.sql`).

## File Types

The portals publish several types of XML files:

| File Type | Description | Update Frequency |
|-----------|-------------|------------------|
| `PriceFull` | Complete price list for all items | Daily |
| `Price` | Incremental price updates | Hourly |
| `PromoFull` | Complete promotional prices | Daily |
| `Promo` | Incremental promo updates | Hourly |
| `Stores` | Store/branch information | Weekly |

## XML Structure

### PriceFull Example

```xml
<Root>
  <ChainId>7290027600007</ChainId>
  <SubChainId>001</SubChainId>
  <StoreId>123</StoreId>
  <BikoretNo>1-2345678-9</BikoretNo>
  <Items>
    <Item>
      <ItemCode>7290000000001</ItemCode>
      <ItemName>Milk 3% 1L</ItemName>
      <ManufacturerName>Tnuva</ManufacturerName>
      <UnitQty>1</UnitQty>
      <UnitMeasure>liter</UnitMeasure>
      <ItemPrice>5.90</ItemPrice>
      <UnitOfMeasurePrice>5.90</UnitOfMeasurePrice>
      <AllowDiscount>1</AllowDiscount>
      <ItemStatus>0</ItemStatus>
    </Item>
    <!-- More items... -->
  </Items>
</Root>
```

### Stores Example

```xml
<Root>
  <ChainId>7290027600007</ChainId>
  <SubChains>
    <SubChain>
      <SubChainId>001</SubChainId>
      <SubChainName>Rami Levy</SubChainName>
      <Stores>
        <Store>
          <StoreId>123</StoreId>
          <BikoretNo>1-2345678-9</BikoretNo>
          <StoreType>1</StoreType>
          <ChainName>Rami Levy</ChainName>
          <SubChainName>Rami Levy</SubChainName>
          <StoreName>Jerusalem Center</StoreName>
          <Address>123 Main St</Address>
          <City>Jerusalem</City>
          <ZipCode>9100001</ZipCode>
        </Store>
        <!-- More stores... -->
      </Stores>
    </SubChain>
  </SubChains>
</Root>
```

## Usage

### Basic Usage

```bash
node rami-levy-scraper.js
```

### Programmatic Usage

```javascript
const { scrapeRamiLevy } = require('./rami-levy-scraper');

// Scrape a specific file
const fileUrl = 'https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202401010000.gz';
await scrapeRamiLevy(fileUrl);
```

### Automated Scraping

Set up a cron job or scheduled task to run the scraper periodically:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/scraper && node rami-levy-scraper.js >> scraper.log 2>&1
```

## How It Works

### 1. Download

The scraper downloads `.gz` compressed XML files from the portal using axios.

### 2. Decompress

Files are decompressed using Node.js `zlib` module.

### 3. Parse

XML is parsed to JSON using `xml2js` library.

### 4. Extract

Item, store, and price data is extracted from the parsed JSON.

### 5. Upsert

Data is inserted or updated in the Supabase database:

- **Items**: Upserted by barcode (unique key)
- **Stores**: Inserted if not exists (by chain + branch name)
- **Prices**: Upserted by item_id + store_id (composite unique key)

## Portal Access

### Accessing the Portal

1. Go to [url.retail.publishedprices.co.il/login](https://url.retail.publishedprices.co.il/login)
2. Enter username (e.g., `RamiLevi`)
3. No password required for public access
4. Browse available files by date and type

### File Naming Convention

Files follow this pattern:

```
{FileType}{ChainId}-{SubChainId}-{Timestamp}.gz
```

Example:
```
PriceFull7290027600007-001-202401010000.gz
```

Where:
- `PriceFull` = File type
- `7290027600007` = Chain ID (Rami Levy)
- `001` = Sub-chain ID
- `202401010000` = Timestamp (YYYYMMDDHHMMSS)

## Error Handling

The scraper includes error handling for:

- Network failures (timeout, connection errors)
- Decompression errors
- XML parsing errors
- Database connection issues
- Missing or malformed data

Errors are logged to console and can be redirected to a log file.

## Performance Considerations

### Batch Processing

For large files (10,000+ items), consider:

- Processing items in batches
- Using database transactions
- Implementing parallel processing

### Rate Limiting

Respect the portal's rate limits:

- Don't scrape too frequently
- Use incremental updates (`Price` files) instead of full dumps
- Cache results locally

### Database Optimization

- Ensure indexes are created (see `schema.sql`)
- Use `UPSERT` operations to avoid duplicates
- Clean up old price data periodically

## Troubleshooting

### Connection Timeout

Increase the axios timeout:

```javascript
const response = await axios.get(url, {
  responseType: 'arraybuffer',
  timeout: 60000, // 60 seconds
});
```

### XML Parsing Errors

The XML structure may vary between chains and file types. Inspect the actual XML structure and adjust the extraction logic accordingly.

### Database Errors

Check:
- Supabase service role key is correct
- Database schema is up to date
- Row Level Security policies allow service role access

## Extending the Scraper

### Adding New Chains

1. Copy `rami-levy-scraper.js` to `{chain-name}-scraper.js`
2. Update the configuration:
   - `USERNAME`
   - `CHAIN_NAME`
   - `PORTAL_URL` (if different)
3. Adjust XML parsing logic for the chain's specific format
4. Test with sample files

### Adding Supabase Edge Functions

For serverless deployment, convert the scraper to a Supabase Edge Function:

```typescript
// supabase/functions/scrape-prices/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Scraper logic here
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

## Next Steps

1. Test the scraper with real XML files from the portal
2. Implement scrapers for other chains (Osher Ad, Yohananof, Shufersal)
3. Set up automated scheduling (cron job or cloud function)
4. Monitor scraper performance and error rates
5. Implement data validation and quality checks

## Resources

- [Israeli Price Transparency Law](https://www.gov.il/en/departments/policies/2014_des5398)
- [Retail Prices Portal](https://url.retail.publishedprices.co.il)
- [Supabase Documentation](https://supabase.com/docs)
- [xml2js Documentation](https://github.com/Leonidas-from-XIV/node-xml2js)
