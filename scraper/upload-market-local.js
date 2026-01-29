/**
 * Israeli Supermarket Price Scraper - Multi-Chain Local Version
 * Usage: node scraper.js <path-to-file> <store-id> <chain-name>
 * Example: node scraper.js ./price_file.gz 26 "Rami Levy"
 */

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
 * קריאת הקובץ מהדיסק וזיהוי אוטומטי של דחיסה
 */
function readAndDecompressLocal(filePath) {
  console.log(`\n📖 Reading file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  
  // בדיקת Magic Number של GZIP (0x1f 0x8b)
  if (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b) {
    console.log('📦 Decompressing GZIP content...');
    return zlib.gunzipSync(fileBuffer).toString('utf-8');
  }
  
  console.log('📄 Plain XML file detected.');
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
 * יצירה או שליפה של סניף (משתמש ב-chain_name למניעת כפילויות)
 */
async function getOrCreateStore(storeData) {
  const { data: existingStore } = await supabase
    .from('stores')
    .select('id')
    .eq('chain_name', storeData.chain_name)
    .eq('store_id', storeData.store_id)
    .single();
  
  if (existingStore) {
    console.log(`✓ Using existing store: ${storeData.branch_name} (ID: ${existingStore.id})`);
    return existingStore.id;
  }
  
  const { data: newStore, error } = await supabase
    .from('stores')
    .insert(storeData)
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating store:', error.message);
    return null;
  }
  
  console.log(`✨ Created new store: ${storeData.branch_name}`);
  return newStore.id;
}

/**
 * עיבוד נתוני המחירים והמוצרים
 */
async function processPriceData(data, targetStoreId, chainName) {
  const root = data.Root || data;
  const storeId = root.StoreId;
  const storeName = root.StoreName || `${chainName} ${storeId}`;
  
  console.log(`\n🏢 Store: ${storeName} | Chain: ${chainName}`);

  const dbStoreId = await getOrCreateStore({
    chain_name: chainName,
    branch_name: storeName,
    city: root.City || 'Unknown',
    address: root.Address || null,
    store_id: targetStoreId || storeId,
  });

  if (!dbStoreId) throw new Error('Could not handle store in DB');

  let items = root.Items?.Item || [];
  if (!Array.isArray(items)) items = [items];

  console.log(`📦 Processing ${items.length} items...`);

  let count = 0;
  for (const item of items) {
    try {
      // חילוץ מחיר גמיש - תומך ב-3 תגיות שונות של רשתות שונות
      const itemPrice = item.ItemPrice || item.UnitPrice || item.UnitOfMeasurePrice;
      const barcode = item.ItemCode;
      
      if (!barcode || !itemPrice || parseFloat(itemPrice) === 0) continue;

      // 1. הוספה/עדכון מוצר בטבלת items
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
        // 2. הוספה/עדכון מחיר בטבלת prices
        await supabase
          .from('prices')
          .upsert({
            item_id: itemObj.id,
            store_id: dbStoreId,
            price: parseFloat(itemPrice),
            last_updated: new Date().toISOString()
          }, { onConflict: 'item_id,store_id' });
        
        count++;
        if (count % 500 === 0) process.stdout.write(`\r🚀 Progress: ${count}/${items.length} items...`);
      }
    } catch (e) {
      // דילוג על פריטים בעייתיים
    }
  }
  console.log(`\n✅ Finished! Processed ${count} items for ${chainName}.`);
}

// --- CLI Entry Point ---
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('\n❌ Missing arguments!');
  console.log('Usage: node scraper.js <file-path> <store-id> <chain-name>');
  console.log('Example: node scraper.js ./file.gz 12 "Osher Ad"\n');
  process.exit(1);
}

const [filePath, storeId, chainName] = args;

(async () => {
  try {
    const xmlContent = readAndDecompressLocal(filePath);
    const jsonData = await parseXML(xmlContent);
    await processPriceData(jsonData, storeId, chainName);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    process.exit(1);
  }
})();