// scraper/processors/PriceProcessor.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const BaseProcessor = require('../core/BaseProcessor');

class PriceProcessor extends BaseProcessor {
  constructor(supabase, config) {
    super(supabase, config);
    this.itemIdCache = new Map();
    this.storeIdCache = new Map();
    this.cacheMaxSize = 10000;
  }

  async process(filePath, metadata) {
    const { externalStoreId } = metadata;
    
    if (!externalStoreId) {
      console.warn('⚠️ No store ID provided, skipping file');
      return;
    }

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const xml = new XmlStream(stream);
      let buffer = [];

      let nodeCount = 0;
      let normalizedCount = 0;

      xml.on('endElement: Item', async (item) => {
        nodeCount++;
        const normalized = this.normalize(item, externalStoreId);
        if (normalized) {
          normalizedCount++;
          buffer.push(normalized);
        }

        if (buffer.length >= 1000) {
          xml.pause();
          try {
            await this.saveBuffer(buffer);
            buffer = [];
          } catch (e) {
            console.error('❌ Error saving prices chunk:', e.message);
            stream.destroy();
            reject(e);
            return;
          }
          xml.resume();
        }
      });

      xml.on('end', async () => {
        console.log(`📊 ${nodeCount} items parsed, ${buffer.length} remaining in buffer`);
        if (buffer.length > 0) {
          try {
            await this.saveBuffer(buffer);
            console.log(`💾 Saved ${buffer.length} prices`);
          } catch (e) {
            console.error('❌ Error saving final prices chunk:', e.message);
            reject(e);
            return;
          }
        }
        resolve();
      });

      xml.on('error', (err) => {
        console.error('❌ XML parsing error:', err.message);
        reject(err);
      });
    });
  }

  normalize(xmlItem, extStoreId) {
    const barcode = xmlItem.ItemCode || xmlItem.Barcode || xmlItem.ItemOnly;
    const priceRaw = xmlItem.ItemPrice || xmlItem.UnitOfMeasurePrice;
    
    if (!barcode || !priceRaw) return null;
    
    const price = parseFloat(priceRaw);
    if (isNaN(price) || price < 0) return null;

    return {
      item_data: {
        barcode: String(barcode).trim(),
        name: (xmlItem.ItemName || xmlItem.Name || 'Unknown').trim().slice(0, 255),
        manufacturer_name: (xmlItem.ManufacturerName || '').trim(),
        unit_measure: xmlItem.UnitOfMeasure || ''
      },
      price_data: {
        barcode: String(barcode).trim(),
        price: price,
        external_store_id: extStoreId
      }
    };
  }

  async saveBuffer(buffer) {
    if (buffer.length === 0) return;
    
    const now = new Date();

    // 1. Items - Upsert (רק למי שאין ב-Cache)
    const itemsToUpsert = buffer
      .filter(b => !this.itemIdCache.has(b.item_data.barcode))
      .map(b => b.item_data);
    
    // De-duplicate
    const uniqueItems = Array.from(
      new Map(itemsToUpsert.map(i => [i.barcode, i])).values()
    );

    if (uniqueItems.length > 0) {
      const { data, error } = await this.supabase
        .from('items')
        .upsert(uniqueItems, { 
          onConflict: 'barcode',
          ignoreDuplicates: false 
        })
        .select('id, barcode');
      
      // ✅ IMPROVED: validation מלאה
      if (error) {
        console.error('❌ Error upserting items:', error.message);
        throw error;
      }

      if (!data || data.length === 0) {
        console.error('❌ Upsert returned no data');
        throw new Error('Failed to upsert items - no data returned');
      }

      data.forEach(i => this.checkAndAddCache(i.barcode, i.id));
    }

    // 2. Prices - Insert
    const internalStoreId = await this.getInternalStoreId(
      buffer[0].price_data.external_store_id
    );
    
    if (!internalStoreId) {
      console.warn(`⚠️ Store not found: ${buffer[0].price_data.external_store_id}`);
      return;
    }

    // De-duplicate: אם אותו ברקוד מופיע פעמיים באותו batch, שומרים את האחרון
    const priceMap = new Map();
    for (const b of buffer) {
      const itemId = this.itemIdCache.get(b.price_data.barcode);
      if (!itemId) continue;
      const key = `${internalStoreId}_${itemId}`;
      priceMap.set(key, {
        item_id: itemId,
        store_id: internalStoreId,
        price: b.price_data.price,
        last_updated: now
      });
    }
    const prices = Array.from(priceMap.values());

    if (prices.length > 0) {
      await this.saveBatch(prices, 'prices', 'store_id, item_id');
    }
  }

  checkAndAddCache(key, val) {
    if (this.itemIdCache.size >= this.cacheMaxSize) {
      const firstKey = this.itemIdCache.keys().next().value;
      this.itemIdCache.delete(firstKey);
    }
    this.itemIdCache.set(key, val);
  }

  async getInternalStoreId(extId) {
    // 1. בדיקת cache
    if (this.storeIdCache.has(extId)) {
      return this.storeIdCache.get(extId);
    }

    // 2. שליפה מ-DB
    const { data, error } = await this.supabase
      .from('stores')
      .select('id')
      .eq('store_id', extId)
      .eq('chain_id', this.config.id)
      .single();
    
    if (error) {
      console.error(`❌ Error fetching store ID for ${extId}:`, error.message);
      return null;
    }

    if (data) {
      // ניהול גודל cache
      if (this.storeIdCache.size >= 1000) {
        const firstKey = this.storeIdCache.keys().next().value;
        this.storeIdCache.delete(firstKey);
      }
      this.storeIdCache.set(extId, data.id);
      return data.id;
    }
    
    return null;
  }

  // ✅ NEW: פונקציה לניקוי cache
  clearCache() {
    this.itemIdCache.clear();
    this.storeIdCache.clear();
  }
}

module.exports = PriceProcessor;