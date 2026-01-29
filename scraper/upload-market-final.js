/**
 * Universal Israeli Supermarket Scraper
 * Supports: Shufersal, Rami Levy, Osher Ad, Yohananof, and more.
 * Usage: node scraper.js <file-path> <store-id> <chain-name>
 */

require('dotenv').config();

const fs = require('fs');
const zlib = require('zlib');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

// --- Supabase Configuration ---
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

/**
 * קריאת קובץ וזיהוי אוטומטי של GZIP או XML
 */
function readAndDecompressLocal(filePath) {
  console.log(`\n📖 Reading file: ${filePath}`);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const fileBuffer = fs.readFileSync(filePath);
  if (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b) {
    console.log('📦 Decompressing GZIP...');
    return zlib.gunzipSync(fileBuffer).toString('utf-8');
  }
  return fileBuffer.toString('utf-8');
}

/**
 * פירסור XML ל-JSON
 */
async function parseXML(xmlString) {
  console.log('🔍 Parsing XML content...');
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  return await parser.parseStringPromise(xmlString);
}

/**
 * ניהול סניפים ב-DB
 */
async function getOrCreateStore(storeData) {
  const { data: existingStore } = await supabase
    .from('stores')
    .select('id')
    .eq('chain_name', storeData.chain_name)
    .eq('store_id', storeData.store_id)
    .single();
  
  if (existingStore) return existingStore.id;
  
  const { data: newStore, error } = await supabase
    .from('stores')
    .insert(storeData)
    .select('id')
    .single();
  
  if (error) return null;
  return newStore.id;
}

/**
 * עיבוד נתונים אוניברסלי
 */
async function processPriceData(data, targetStoreId, chainName) {
  // פתרון לבעיית שופרסל: תמיכה ב-Root או ב-root
  const root = data.Root || data.root || data;
  
  const storeId = root.StoreId || targetStoreId;
  const storeName = root.StoreName || `${chainName} סניף ${storeId}`;
  
  console.log(`\n🏢 Store: ${storeName} | Chain: ${chainName}`);

  const dbStoreId = await getOrCreateStore({
    chain_name: chainName,
    branch_name: storeName,
    city: root.City || 'Unknown',
    address: root.Address || null,
    store_id: storeId,
  });

  if (!dbStoreId) throw new Error('DB Store Error');

  // גישה בטוחה למוצרים (תומך במבנה של שופרסל וגם של רמי לוי)
  let items = root.Items?.Item || [];
  if (!Array.isArray(items)) items = [items];

  console.log(`📦 Processing ${items.length} items...`);

  let count = 0;
  for (const item of items) {
    try {
      // תמיכה בכל שמות תגיות המחיר האפשריות
      const price = item.ItemPrice || item.UnitPrice || item.UnitOfMeasurePrice;
      const barcode = item.ItemCode;
      
      if (!barcode || !price || parseFloat(price) === 0) continue;

      const { data: itemObj } = await supabase
        .from('items')
        .upsert({
          barcode: barcode,
          name: item.ItemName,
          unit_measure: item.UnitMeasure || item.UnitOfMeasure || 'piece'
        }, { onConflict: 'barcode' })
        .select('id')
        .single();

      if (itemObj) {
        await supabase.from('prices').upsert({
          item_id: itemObj.id,
          store_id: dbStoreId,
          price: parseFloat(price),
          last_updated: new Date().toISOString()
        }, { onConflict: 'item_id,store_id' });
        
        count++;
        if (count % 500 === 0) process.stdout.write(`\r🚀 Progress: ${count}/${items.length}...`);
      }
    } catch (e) {}
  }
  console.log(`\n✅ Finished! ${count} items updated for ${chainName}.`);
}

// --- CLI ---
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node scraper.js <path> <id> <name>');
  process.exit(1);
}

const [filePath, storeId, chainName] = args;

(async () => {
  try {
    const xml = readAndDecompressLocal(filePath);
    const json = await parseXML(xml);
    await processPriceData(json, storeId, chainName);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();