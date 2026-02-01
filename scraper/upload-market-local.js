/**
 * Israeli Supermarket Price Scraper - Multi-Chain Local Version
 * Usage: node upload-market-local.js <path-to-file> <branch-name> <chain-name>
 */

require('dotenv').config();
const fs = require('fs');
const zlib = require('zlib');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// --- Supabase Configuration ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHUNK_SIZE = 1000;
const DEFAULT_CITY = 'Petah Tikva';

// --- Telegram Configuration ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =============== Helper Functions ===============

async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured, skipping notification');
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
    console.log('📱 Telegram notification sent');
  } catch (error) {
    console.error('Failed to send Telegram notification:', error.message);
  }
}

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
    .maybeSingle(); // שימוש ב-maybeSingle למניעת שגיאות
  
  if (existingStore) return existingStore.id;
  
  const { data: newStore, error } = await supabase
    .from('stores')
    .insert(storeData)
    .select('id')
    .single();
  
  if (error) return null;
  return newStore.id;
}

// פונקציית עזר לפיצול מערך לצ'אנקים
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
    city: root.City || root.city || DEFAULT_CITY,
    address: root.Address || root.address || null,
    store_id: storeIdFromXML,
  });

  if (!dbStoreId) throw new Error('Could not handle store in DB');

  const itemsContainer = root.Items || root.items;
  let items = itemsContainer?.Item || itemsContainer?.item || [];
  if (!Array.isArray(items)) items = [items];

  console.log(`📦 Processing ${items.length} items in batches...`);

  const chunks = chunkArray(items, 1000); // חלוקה ל-1000 בכל פעם
  let totalCount = 0;

  for (const chunk of chunks) {
    try {
      // 1. הכנת הפריטים לעדכון/הכנסה
      const itemsToUpsert = chunk.map(item => {
        const barcode = item.ItemCode || item.item_code;
        if (!barcode) return null;
        return {
          barcode: barcode,
          name: item.ItemName || item.item_name,
          unit_measure: item.UnitMeasure || item.UnitOfMeasure || 'piece'
        };
      }).filter(Boolean);

      // 2. ביצוע Upsert קבוצתי לפריטים וקבלת ה-IDs שלהם
      const { data: upsertedItems, error: itemError } = await supabase
        .from('items')
        .upsert(itemsToUpsert, { onConflict: 'barcode' })
        .select('id, barcode');

      if (itemError) throw itemError;

      // מפת עזר לקישור ברקוד ל-ID
      const idMap = new Map(upsertedItems.map(row => [row.barcode, row.id]));

      // 3. הכנת המחירים לעדכון קבוצתי
      const pricesToUpsert = chunk.map(item => {
        const itemPrice = item.ItemPrice || item.UnitPrice || item.UnitOfMeasurePrice;
        const barcode = item.ItemCode || item.item_code;
        const itemId = idMap.get(barcode);

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

      totalCount += chunk.length;
      process.stdout.write(`\r🚀 Progress: ${totalCount}/${items.length} items synchronized...`);
    } catch (e) {
      console.error(`\n⚠️ Batch error: ${e.message}`);
    }
  }
  
  return { count: totalCount, finalBranchName };
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

    // Send Telegram notification
    const message = `✅ Upload Complete\n🔗 Chain: ${chainName}\n🏪 Store: ${result.finalBranchName}\n📦 Items: ${result.count}\n⏱️ Time: ${minutes}m ${seconds}s`;
    await sendTelegramNotification(message);

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    
    // Send Telegram error notification
    const errorMessage = `❌ Upload Failed\n🔗 Chain: ${chainName}\n📍 File: ${filePath}\n⚠️ Error: ${err.message}`;
    await sendTelegramNotification(errorMessage);
    
    process.exit(1);
  }
})();
