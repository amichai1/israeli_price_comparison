/**
 * Israeli Supermarket Price Scraper - Multi-Chain Local Version
 * Usage: node upload-market-local.js <path-to-file> <branch-name> <chain-name>
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
  console.error('❌ Error: Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function parseXML(xmlString) {
  console.log('🔍 Parsing XML content...');
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  return await parser.parseStringPromise(xmlString);
}

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

// פונקציית עזר לחלוקה לצ'אנקים
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function processPriceData(data, branchNameFromArgs, chainName) {
  const root = data.Root || data.root || data;
  const storeIdFromXML = root.StoreId || root.StoreID || root.store_id;
  const finalBranchName = branchNameFromArgs || root.StoreName || `${chainName} ${storeIdFromXML}`;
  
  console.log(`\n🏢 Store: ${finalBranchName} | Chain: ${chainName}`);

  const dbStoreId = await getOrCreateStore({
    chain_name: chainName,
    branch_name: finalBranchName,
    city: root.City || root.city || 'Unknown',
    address: root.Address || root.address || null,
    store_id: storeIdFromXML,
  });

  if (!dbStoreId) throw new Error('Could not handle store in DB');

  const itemsContainer = root.Items || root.items;
  let items = itemsContainer?.Item || itemsContainer?.item || [];
  if (!Array.isArray(items)) items = [items];

  console.log(`📦 Processing ${items.length} items in chunks...`);

  const chunks = chunkArray(items, 1000); // חלוקה ל-1000 בכל פעם
  let count = 0;

  for (const chunk of chunks) {
    try {
      // שלב א: הכנת המוצרים ל-Upsert (לפי השדות המקוריים שלך)
      const itemsToUpsert = chunk.map(item => ({
        barcode: item.ItemCode || item.item_code,
        name: item.ItemName || item.item_name,
        unit_measure: item.UnitMeasure || item.UnitOfMeasure || 'piece'
      })).filter(i => i.barcode);

      // ביצוע Upsert קבוצתי למוצרים וקבלת ה-IDs שלהם
      const { data: upsertedItems, error: itemError } = await supabase
        .from('items')
        .upsert(itemsToUpsert, { onConflict: 'barcode' })
        .select('id, barcode');

      if (itemError) throw itemError;

      // יצירת מפה לקישור מהיר בין ברקוד ל-ID שנוצר ב-DB
      const barcodeToId = Object.fromEntries(upsertedItems.map(row => [row.barcode, row.id]));

      // שלב ב: הכנת המחירים ל-Upsert
      const pricesToUpsert = chunk.map(item => {
        const itemPrice = item.ItemPrice || item.UnitPrice || item.UnitOfMeasurePrice;
        const barcode = item.ItemCode || item.item_code;
        const itemId = barcodeToId[barcode];

        if (!itemId || !itemPrice || parseFloat(itemPrice) === 0) return null;

        return {
          item_id: itemId,
          store_id: dbStoreId,
          price: parseFloat(itemPrice),
          last_updated: new Date().toISOString()
        };
      }).filter(Boolean);

      if (pricesToUpsert.length > 0) {
        const { error: priceError } = await supabase
          .from('prices')
          .upsert(pricesToUpsert, { onConflict: 'item_id,store_id' });
        
        if (priceError) throw priceError;
      }

      count += chunk.length;
      process.stdout.write(`\r🚀 Progress: ${count}/${items.length} items...`);
    } catch (e) {
      console.error(`\n⚠️ Chunk error: ${e.message}`);
    }
  }
  
  return { count, finalBranchName };
}

// --- CLI Entry Point ---
const args = process.argv.slice(2);
const [filePath, branchName, chainName] = args;

(async () => {
  const startTime = Date.now();
  try {
    const xmlContent = readAndDecompressLocal(filePath);
    const jsonData = await parseXML(xmlContent);
    const result = await processPriceData(jsonData, branchName, chainName);

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(1);

    console.log(`\n\n--- 🏁 Upload Summary ---`);
    console.log(`🔗 Chain: ${chainName}`);
    console.log(`🏪 Store: ${result.finalBranchName}`);
    console.log(`📦 Items Processed: ${result.count}`);
    console.log(`⏱️  Duration: ${minutes}m ${seconds}s`);
    console.log(`-------------------------\n`);

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    process.exit(1);
  }
})();


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
 * פונקציית עזר לפיצול מערך לצ'אנקים
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function processPriceData(data, branchNameFromArgs, chainName) {
  const root = data.Root || data.root || data;
  const storeIdFromXML = root.StoreId || root.StoreID || root.store_id;
  const finalBranchName = branchNameFromArgs || root.StoreName || `${chainName} ${storeIdFromXML}`;

  const dbStoreId = await getOrCreateStore({
    chain_name: chainName,
    branch_name: finalBranchName,
    city: root.City || root.city || 'Israel',
    address: root.Address || root.address || null,
    store_id: storeIdFromXML,
  });

  if (!dbStoreId) throw new Error('Store ID not found/created');

  const itemsContainer = root.Items || root.items;
  let rawItems = itemsContainer?.Item || itemsContainer?.item || [];
  if (!Array.isArray(rawItems)) rawItems = [rawItems];

  console.log(`📦 Found ${rawItems.length} items. Preparing Batch Upsert...`);

  // 1. סינון והכנת הפריטים (מניעת כפילויות ברמת הקובץ)
  const itemsMap = new Map();
  rawItems.forEach(item => {
    const barcode = item.ItemCode || item.item_code;
    const price = parseFloat(item.ItemPrice || item.UnitPrice || 0);
    if (barcode && price > 0) {
      itemsMap.set(barcode, {
        barcode: barcode,
        name: item.ItemName || item.item_name,
        unit_measure: item.UnitMeasure || 'piece',
        price: price
      });
    }
  });

  const uniqueItems = Array.from(itemsMap.values());
  const itemChunks = chunkArray(uniqueItems, CHUNK_SIZE);

  let totalItemsProcessed = 0;

  // 2. ביצוע Upsert לפריטים וקבלת ה-IDs שלהם
  for (const chunk of itemChunks) {
    const { data: upsertedItems, error: itemError } = await supabase
      .from('items')
      .upsert(chunk.map(i => ({ barcode: i.barcode, name: i.name, unit_measure: i.unit_measure })), { onConflict: 'barcode' })
      .select('id, barcode');

    if (itemError) {
      console.error('❌ Error upserting items chunk:', itemError.message);
      continue;
    }

    // 3. יצירת מפה של Barcode -> ItemID כדי לקשר למחירים
    const idMap = new Map(upsertedItems.map(row => [row.barcode, row.id]));

    // 4. הכנת המחירים לצ'אנק הנוכחי
    const pricesToUpsert = chunk
      .filter(i => idMap.has(i.barcode))
      .map(i => ({
        item_id: idMap.get(i.barcode),
        store_id: dbStoreId,
        price: i.price,
        last_updated: new Date().toISOString()
      }));

    const { error: priceError } = await supabase
      .from('prices')
      .upsert(pricesToUpsert, { onConflict: 'item_id,store_id' });

    if (priceError) {
      console.error('❌ Error upserting prices chunk:', priceError.message);
    } else {
      totalItemsProcessed += chunk.length;
      process.stdout.write(`\r🚀 Progress: ${totalItemsProcessed}/${uniqueItems.length} items synchronized...`);
    }
  }

  return { count: totalItemsProcessed, finalBranchName };
}

// --- CLI Entry Point ---
const args = process.argv.slice(2);
const [filePath, branchName, chainName] = args;

(async () => {
  const startTime = Date.now();
  try {
    const xmlContent = readAndDecompressLocal(filePath);
    const jsonData = await parseXML(xmlContent);
    const result = await processPriceData(jsonData, branchName, chainName);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✅ Finished: ${chainName} | Items: ${result.count} | Time: ${duration}s\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    process.exit(1);
  }
})();

async function processPriceData(data, branchNameFromArgs, chainName) {
  const root = data.Root || data.root || data;
  const storeIdFromXML = root.StoreId || root.StoreID || root.store_id;
  
  // שם הסניף כפי שיופיע בבסיס הנתונים
  const finalBranchName = branchNameFromArgs || root.StoreName || `${chainName} ${storeIdFromXML}`;
  
  console.log(`\n🏢 Store: ${finalBranchName} | Chain: ${chainName}`);

  const dbStoreId = await getOrCreateStore({
    chain_name: chainName,
    branch_name: finalBranchName,
    city: root.City || root.city || 'Petah Tikva',
    address: root.Address || root.address || null,
    store_id: storeIdFromXML,
  });

  if (!dbStoreId) throw new Error('Could not handle store in DB');

  const itemsContainer = root.Items || root.items;
  let items = itemsContainer?.Item || itemsContainer?.item || [];
  if (!Array.isArray(items)) items = [items];

  console.log(`📦 Processing ${items.length} items...`);

  let count = 0;
  for (const item of items) {
    try {
      const itemPrice = item.ItemPrice || item.UnitPrice || item.UnitOfMeasurePrice;
      const barcode = item.ItemCode || item.item_code;
      
      if (!barcode || !itemPrice || parseFloat(itemPrice) === 0) continue;

      const { data: itemObj } = await supabase
        .from('items')
        .upsert({
          barcode: barcode,
          name: item.ItemName || item.item_name,
          unit_measure: item.UnitMeasure || item.UnitOfMeasure || 'piece'
        }, { onConflict: 'barcode' })
        .select('id')
        .single();

      if (itemObj) {
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
    } catch (e) { /* skip */ }
  }
  return { count, finalBranchName };
}

// --- CLI Entry Point ---
const args = process.argv.slice(2);
const [filePath, branchName, chainName] = args;

(async () => {
  // 1. תזמון התחלה
  const startTime = Date.now();

  try {
    const xmlContent = readAndDecompressLocal(filePath);
    const jsonData = await parseXML(xmlContent);
    const result = await processPriceData(jsonData, branchName, chainName);

    // 2. חישוב זמן סיום ופורמט
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(1);

    console.log(`\n\n--- 🏁 Upload Summary ---`);
    console.log(`🔗 Chain: ${chainName}`);
    console.log(`🏪 Store: ${result.finalBranchName}`);
    console.log(`📦 Items Processed: ${result.count}`);
    console.log(`⏱️  Duration: ${minutes}m ${seconds}s`);
    console.log(`-------------------------\n`);

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    process.exit(1);
  }
})();
