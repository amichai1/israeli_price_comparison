# How to Run the Rami Levy Scraper

This guide will walk you through running the scraper on your computer to populate your Supabase database with real Israeli grocery prices.

## Prerequisites

✅ Node.js installed (version 14 or higher)  
✅ Internet connection  
✅ Supabase project with schema already set up

## Step 1: Download the Scraper

Download the entire `scraper` folder from your project, which includes:
- `rami-levy-scraper.js` - The main scraper script
- `package.json` - Dependencies list
- `populate-sample-data.js` - Sample data generator (optional)

## Step 2: Install Dependencies

Open a terminal/command prompt in the `scraper` folder and run:

```bash
npm install
```

This installs:
- `@supabase/supabase-js` - Database client
- `axios` - HTTP client for downloading files
- `xml2js` - XML parser

You should see output like:
```
added 40 packages, and audited 41 packages in 2s
found 0 vulnerabilities
```

## Step 3: Access the Israeli Price Transparency Portal

### 3.1 Open the Portal
Go to: **https://url.retail.publishedprices.co.il/login**

### 3.2 Login
- **Username:** `RamiLevi`
- **Password:** (leave empty, just click login)

### 3.3 Browse Files
You'll see a list of XML files organized by:
- **Date** (most recent at the top)
- **File Type** (PriceFull, Price, PromoFull, Promo, Stores)

## Step 4: Find the Right File

### File Types Explained

| File Type | Description | When to Use |
|-----------|-------------|-------------|
| **PriceFull** | Complete price list for all items | **Use this for initial population** |
| **Price** | Incremental price updates | Use for daily updates after initial load |
| **PromoFull** | Complete promotional prices | Optional |
| **Promo** | Incremental promo updates | Optional |
| **Stores** | Store/branch information | Optional |

### File Naming Convention

Files are named like this:
```
PriceFull7290027600007-001-202601250000.gz
```

Where:
- `PriceFull` = File type
- `7290027600007` = Chain ID (Rami Levy)
- `001` = Sub-chain ID
- `202601250000` = Timestamp (January 25, 2026, 00:00)
- `.gz` = Compressed file

### 3.4 Get the File URL

**Option A: Copy Link**
1. Find a recent **PriceFull** file
2. Right-click on the file name
3. Select "Copy Link Address" or "Copy Link"

**Option B: Construct URL**
The URL format is:
```
https://url.retail.publishedprices.co.il/file/d/[FILENAME]
```

Example:
```
https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202601250000.gz
```

## Step 5: Run the Scraper

### Basic Usage

In the `scraper` folder, run:

```bash
node rami-levy-scraper.js <URL>
```

### Example

```bash
node rami-levy-scraper.js https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202601250000.gz
```

### What You'll See

The scraper will show progress like this:

```
🚀 Starting Rami Levy Price Scraper

Supabase URL: https://wpdaidwskbgiphgdarbp.supabase.co

📥 Downloading: https://url.retail.publishedprices.co.il/file/d/PriceFull...
✓ Downloaded 2.45 MB
📦 Decompressing...
✓ Decompressed to 15.32 MB
🔍 Parsing XML...
✓ XML parsed successfully

📊 Processing PriceFull data...

Store Information:
  Chain ID: 7290027600007
  Sub-chain ID: 001
  Store ID: 123
  Store Name: Rami Levy Jerusalem Center

✓ Created store: Rami Levy Jerusalem Center

📦 Found 3542 items to process
  Progress: 100/3542 items processed...
  Progress: 200/3542 items processed...
  Progress: 300/3542 items processed...
  ...
  Progress: 3500/3542 items processed...

✅ Processing complete!
  Items processed: 3542
  Prices updated: 3542
  Errors: 0

🎉 Scraping completed successfully!

You can now:
1. Open the mobile app
2. Search for products
3. Compare prices across stores
```

## Step 6: Verify the Data

### Check in Supabase

1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Go to **Table Editor**
4. Check the tables:
   - **items** - Should have thousands of products
   - **stores** - Should have the new Rami Levy store
   - **prices** - Should have prices for all items

### Test in the App

1. Open your mobile app
2. Search for common products:
   - "milk"
   - "bread"
   - "eggs"
   - "chicken"
3. Add items to basket
4. Compare prices

## Troubleshooting

### Error: "Cannot find module"

**Problem:** Dependencies not installed

**Solution:**
```bash
npm install
```

### Error: "Download timeout"

**Problem:** File is too large or internet is slow

**Solution:**
- Try a smaller file first
- Check your internet connection
- The scraper has a 60-second timeout

### Error: "ECONNREFUSED" or "Network error"

**Problem:** Cannot reach the portal

**Solution:**
- Check if the portal URL is correct
- Verify you can access the portal in your browser
- Check your firewall settings

### Error: "Supabase error: Invalid API key"

**Problem:** Supabase credentials are wrong

**Solution:**
- Check that the credentials in the script match your Supabase project
- Make sure you're using the **service role key**, not the anon key

### No Items Processed

**Problem:** XML structure doesn't match expected format

**Solution:**
- The XML structure may vary between chains
- Open the XML file and check the structure
- You may need to adjust the parsing logic

### "Items processed: 0"

**Problem:** Items exist but no prices

**Solution:**
- Check if the XML file has price data
- Some files may only have item information without prices
- Try a different file

## Tips for Success

### 1. Start Small
For your first run, try a smaller file or use the sample data populator:
```bash
node populate-sample-data.js
```

### 2. Run Regularly
- Run the scraper weekly to keep prices up to date
- Use **PriceFull** files for complete updates
- Use **Price** files for incremental updates

### 3. Multiple Stores
The same Rami Levy chain may have multiple stores in the portal. Each store will be created separately in your database.

### 4. Other Chains
To scrape other chains (Osher Ad, Yohananof, Shufersal):
1. Copy `rami-levy-scraper.js` to a new file
2. Update the `USERNAME` and `CHAIN_NAME` constants
3. Use the appropriate portal URL

### 5. Automation
Set up a cron job or scheduled task to run the scraper automatically:

**Linux/Mac (crontab):**
```bash
# Run every day at 2 AM
0 2 * * * cd /path/to/scraper && node rami-levy-scraper.js <URL> >> scraper.log 2>&1
```

**Windows (Task Scheduler):**
Create a batch file and schedule it in Task Scheduler.

## Expected Results

### Small Store
- **Items:** 500-1,500
- **Time:** 1-3 minutes
- **Database size:** ~5 MB

### Medium Store
- **Items:** 1,500-5,000
- **Time:** 3-10 minutes
- **Database size:** ~20 MB

### Large Store
- **Items:** 5,000-15,000
- **Time:** 10-30 minutes
- **Database size:** ~50 MB

## Next Steps

After successfully running the scraper:

1. **Test the app** with real data
2. **Run scrapers for other chains** (Osher Ad, Yohananof, Shufersal)
3. **Set up automated updates** with cron jobs
4. **Monitor database size** and optimize if needed

## Need Help?

- Check the main `README.md` for project documentation
- Review `scraper/README.md` for technical details
- Check Supabase logs for database errors
- Ensure your database schema is up to date

---

**Happy scraping! 🛒**
