/**
 * Rami Levy Price Scraper
 * 
 * Downloads and parses XML price files from the Israeli Price Transparency portal
 * and imports the data into Supabase.
 * 
 * Usage:
 *   node rami-levy-scraper.js <xml-file-url> [store-id]
 * 
 * Example:
 *   node rami-levy-scraper.js https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202601250000.gz 71
 */

const axios = require('axios');
const zlib = require('zlib');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const PORTAL_URL = 'https://url.retail.publishedprices.co.il';
const USERNAME = 'RamiLevi';
const CHAIN_NAME = 'Rami Levy';

// Supabase configuration
// Set these as environment variables before running:
// export SUPABASE_URL=https://your-project.supabase.co
// export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables!');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  console.error('\n📝 Please set these in your .env file:');
  console.error('   SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Download and decompress .gz file
 */
async function downloadAndDecompress(url) {
  console.log(`📥 Downloading: ${url}`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 seconds
    });
    
    console.log(`✓ Downloaded ${(response.data.length / 1024 / 1024).toFixed(2)} MB`);
    console.log('📦 Decompressing...');
    
    const decompressed = zlib.gunzipSync(response.data);
    console.log(`✓ Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(2)} MB`);
    
    return decompressed.toString('utf-8');
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Download timeout - file may be too large or connection is slow');
    }
    throw error;
  }
}

/**
 * Parse XML to JSON
 */
async function parseXML(xmlString) {
  console.log('🔍 Parsing XML...');
  
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
  });
  
  const result = await parser.parseStringPromise(xmlString);
  console.log('✓ XML parsed successfully');
  
  return result;
}

/**
 * Get or create store
 * If store_id is provided, try to match existing store first
 */
async function getOrCreateStore(storeData) {
  // If store_id is provided, try to find existing store by store_id
  if (storeData.store_id) {
    const { data: existingByStoreId } = await supabase
      .from('stores')
      .select('id')
      .eq('chain_name', storeData.chain_name)
      .eq('store_id', storeData.store_id)
      .single();
    
    if (existingByStoreId) {
      console.log(`✓ Found existing store by store_id: ${storeData.store_id}`);
      return existingByStoreId.id;
    }
  }
  
  // Try to find by chain_name and branch_name
  const { data: existingStore } = await supabase
    .from('stores')
    .select('id')
    .eq('chain_name', storeData.chain_name)
    .eq('branch_name', storeData.branch_name)
    .single();
  
  if (existingStore) {
    console.log(`✓ Found existing store: ${storeData.branch_name}`);
    return existingStore.id;
  }
  
  // Create new store
  const { data: newStore, error } = await supabase
    .from('stores')
    .insert(storeData)
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating store:', error.message);
    return null;
  }
  
  console.log(`✓ Created store: ${storeData.branch_name}`);
  return newStore.id;
}

/**
 * Insert or update item
 */
async function upsertItem(itemData) {
  const { data, error } = await supabase
    .from('items')
    .upsert(itemData, { onConflict: 'barcode' })
    .select('id')
    .single();
  
  if (error) {
    console.error(`Error upserting item ${itemData.barcode}:`, error.message);
    return null;
  }
  
  return data.id;
}

/**
 * Insert or update price
 */
async function upsertPrice(priceData) {
  const { error } = await supabase
    .from('prices')
    .upsert(priceData, { onConflict: 'item_id,store_id' });
  
  if (error) {
    console.error(`Error upserting price:`, error.message);
    return false;
  }
  
  return true;
}

/**
 * Process PriceFull XML file
 * @param {object} data - Parsed XML data
 * @param {string} targetStoreId - Optional store ID to match (e.g., '71' for Petah Tikva)
 */
async function processPriceFull(data, targetStoreId = null) {
  console.log('\n📊 Processing PriceFull data...');
  
  const root = data.Root || data;
  
  // Extract store information
  const chainId = root.ChainId;
  const subChainId = root.SubChainId;
  const storeId = root.StoreId;
  const storeName = root.StoreName || `${CHAIN_NAME} Store ${storeId}`;
  
  console.log(`\nStore Information:`);
  console.log(`  Chain ID: ${chainId}`);
  console.log(`  Sub-chain ID: ${subChainId}`);
  console.log(`  Store ID: ${storeId}`);
  console.log(`  Store Name: ${storeName}`);
  
  // Get or create store
  const dbStoreId = await getOrCreateStore({
    chain_name: CHAIN_NAME,
    branch_name: storeName,
    city: root.City || 'Unknown',
    address: root.Address || null,
    store_id: targetStoreId || storeId,
  });
  
  if (!dbStoreId) {
    throw new Error('Failed to create or get store');
  }
  
  // Process items
  let items = root.Items?.Item || [];
  if (!Array.isArray(items)) {
    items = [items];
  }
  
  console.log(`\n📦 Found ${items.length} items to process`);
  
  let processedItems = 0;
  let processedPrices = 0;
  let errors = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Progress indicator every 100 items
    if ((i + 1) % 100 === 0) {
      console.log(`  Progress: ${i + 1}/${items.length} items processed...`);
    }
    
    try {
      // Extract item data
      const barcode = item.ItemCode;
      const name = item.ItemName;
      const unitMeasure = item.UnitMeasure || item.UnitOfMeasure || 'piece';
      const price = parseFloat(item.ItemPrice || item.UnitOfMeasurePrice || 0);
      
      if (!barcode || !name) {
        errors++;
        continue;
      }
      
      // Upsert item
      const itemId = await upsertItem({
        barcode: barcode,
        name: name,
        unit_measure: unitMeasure,
      });
      
      if (!itemId) {
        errors++;
        continue;
      }
      
      processedItems++;
      
      // Upsert price
      if (price > 0) {
        const success = await upsertPrice({
          item_id: itemId,
          store_id: dbStoreId,
          price: price,
          last_updated: new Date().toISOString(),
        });
        
        if (success) {
          processedPrices++;
        } else {
          errors++;
        }
      }
    } catch (error) {
      console.error(`Error processing item ${i + 1}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Processing complete!`);
  console.log(`  Items processed: ${processedItems}`);
  console.log(`  Prices updated: ${processedPrices}`);
  console.log(`  Errors: ${errors}`);
  
  return {
    itemsProcessed: processedItems,
    pricesUpdated: processedPrices,
    errors: errors,
  };
}

/**
 * Main scraper function
 * @param {string} fileUrl - URL of the XML file to scrape
 * @param {string} targetStoreId - Optional store ID to match in database (e.g., '71')
 */
async function scrapeRamiLevy(fileUrl, targetStoreId = null) {
  console.log('\n🚀 Starting Rami Levy Price Scraper\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);
  
  try {
    // Download and decompress
    const xmlContent = await downloadAndDecompress(fileUrl);
    
    // Parse XML
    const data = await parseXML(xmlContent);
    
    // Process data
    const result = await processPriceFull(data, targetStoreId);
    
    console.log('\n🎉 Scraping completed successfully!');
    console.log('\nYou can now:');
    console.log('1. Open the mobile app');
    console.log('2. Search for products');
    console.log('3. Compare prices across stores');
    
    return result;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n📖 Rami Levy Price Scraper\n');
    console.log('Usage:');
    console.log('  node rami-levy-scraper.js <xml-file-url> [store-id]\n');
    console.log('Examples:');
    console.log('  node rami-levy-scraper.js https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202601250000.gz');
    console.log('  node rami-levy-scraper.js https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202601250000.gz 71\n');
    console.log('Store IDs for Petah Tikva:');
    console.log('  Rami Levy: 71');
    console.log('  Osher Ad: 1290');
    console.log('  Yohananof: 1776');
    console.log('  Shufersal: 269\n');
    console.log('How to get the URL:');
    console.log('  1. Go to: https://url.retail.publishedprices.co.il/login');
    console.log('  2. Enter username: RamiLevi (no password)');
    console.log('  3. Find a PriceFull file (look for recent dates)');
    console.log('  4. Right-click the file and copy the link\n');
    process.exit(1);
  }
  
  const fileUrl = args[0];
  const storeId = args[1] || null;
  
  if (storeId) {
    console.log(`\nTarget store ID: ${storeId}`);
  }
  
  scrapeRamiLevy(fileUrl, storeId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { scrapeRamiLevy };
