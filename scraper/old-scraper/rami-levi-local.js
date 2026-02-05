/**
 * Rami Levy Price Scraper - Local Version
 * * Reads a local .gz file, decompresses it, and imports to Supabase.
 */

const fs = require('fs'); // מודול לקריאת קבצים
const zlib = require('zlib');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CHAIN_NAME = 'Rami Levy';

/**
 * Read and decompress local .gz file
 */
function readAndDecompressLocal(filePath) {
  console.log(`📖 Reading local file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  console.log(`✓ Read ${ (fileBuffer.length / 1024 / 1024).toFixed(2) } MB from disk`);
  
  console.log('📦 Decompressing...');
  const decompressed = zlib.gunzipSync(fileBuffer);
  console.log(`✓ Decompressed to ${ (decompressed.length / 1024 / 1024).toFixed(2) } MB`);
  
  return decompressed.toString('utf-8');
}

/**
 * XML to JSON Parsing
 */
async function parseXML(xmlString) {
  console.log('🔍 Parsing XML...');
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  return await parser.parseStringPromise(xmlString);
}

/**
 * DB Operations (getOrCreateStore, upsertItem, upsertPrice)
 * השארתי את הפונקציות האלו ללא שינוי מהקוד המקורי שלך
 */
async function getOrCreateStore(storeData) {
  if (storeData.store_id) {
    const { data: existingByStoreId } = await supabase
      .from('stores')
      .select('id')
      .eq('chain_name', storeData.chain_name)
      .eq('store_id', storeData.store_id)
      .single();
    
    if (existingByStoreId) return existingByStoreId.id;
  }
  
  const { data: newStore, error } = await supabase
    .from('stores')
    .insert(storeData)
    .select('id')
    .single();
  
  if (error) { console.error('Error creating store:', error.message); return null; }
  return newStore.id;
}

async function upsertItem(itemData) {
  const { data, error } = await supabase
    .from('items')
    .upsert(itemData, { onConflict: 'barcode' })
    .select('id')
    .single();
  
  if (error) return null;
  return data.id;
}

async function upsertPrice(priceData) {
  const { error } = await supabase
    .from('prices')
    .upsert(priceData, { onConflict: 'item_id,store_id' });
  return !error;
}

/**
 * Main Processing Logic
 */
async function processPriceFull(data, targetStoreId = null) {
  const root = data.Root || data;
  const storeId = root.StoreId;
  const storeName = root.StoreName || `${CHAIN_NAME} Store ${storeId}`;
  
  const dbStoreId = await getOrCreateStore({
    chain_name: CHAIN_NAME,
    branch_name: storeName,
    city: root.City || 'Unknown',
    address: root.Address || null,
    store_id: targetStoreId || storeId,
  });

  if (!dbStoreId) throw new Error('Failed to handle store in DB');

  let items = root.Items?.Item || [];
  if (!Array.isArray(items)) items = [items];

  console.log(`\n📦 Processing ${items.length} items...`);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if ((i + 1) % 500 === 0) console.log(`  Progress: ${i + 1}/${items.length}`);

    const itemId = await upsertItem({
      barcode: item.ItemCode,
      name: item.ItemName,
      unit_measure: item.UnitMeasure || 'piece',
    });

    if (itemId && item.ItemPrice) {
      await upsertPrice({
        item_id: itemId,
        store_id: dbStoreId,
        price: parseFloat(item.ItemPrice),
        last_updated: new Date().toISOString(),
      });
    }
  }
  console.log('✅ Done!');
}

/**
 * CLI Entry Point
 */
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scraper.js <path-to-gz-file> [store-id]');
  process.exit(1);
}

const filePath = args[0];
const storeId = args[1] || null;

(async () => {
  try {
    const xmlContent = readAndDecompressLocal(filePath);
    const jsonData = await parseXML(xmlContent);
    await processPriceFull(jsonData, storeId);
    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
