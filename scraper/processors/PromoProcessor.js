// scraper/processors/PromoProcessor.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const BaseProcessor = require('../core/BaseProcessor');
const { DOC_TYPES } = require('../core/BaseProvider');

class PromoProcessor extends BaseProcessor {
  constructor(supabase, config) {
    super(supabase, config);
    this.itemIdCache = new Map();
    this.storeIdCache = new Map();
    this.cacheMaxSize = 10000;
  }

  async process(filePath, metadata) {
    const { externalStoreId, docType } = metadata;

    if (!externalStoreId) {
      console.warn('⚠️ No store ID provided, skipping promo file');
      return;
    }

    const internalStoreId = await this.getInternalStoreId(externalStoreId);
    if (!internalStoreId) {
      console.warn(`⚠️ Store not found: ${externalStoreId}`);
      return;
    }

    // PromoFull: מחיקת כל המבצעים הקיימים של הסניף לפני הכנסה מחדש
    if (docType === DOC_TYPES.PROMO_FULL) {
      await this.deleteExistingPromotions(internalStoreId);
    }

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const xml = new XmlStream(stream);
      // xml-stream: בלי collect, כשיש כמה ילדים עם אותו שם רק האחרון נשמר
      xml.collect('Item');           // Format B: PromotionItems → Item[]
      xml.collect('Group');          // Format A: Groups → Group[]
      xml.collect('PromotionItem');  // Format A: Group → PromotionItems → PromotionItem[]
      let buffer = [];
      let promoCount = 0;

      xml.on('endElement: Promotion', async (promo) => {
        promoCount++;
        if (promoCount === 1) {
          console.log('[PROMO DEBUG] First Promotion keys:', Object.keys(promo));
          console.log('[PROMO DEBUG] First Promotion:', JSON.stringify(promo).slice(0, 800));
        }
        const normalized = this.normalizePromotion(promo, internalStoreId);
        if (normalized) {
          buffer.push(normalized);
        }

        if (buffer.length >= 100) {
          xml.pause();
          try {
            await this.savePromotionBatch(buffer);
            buffer = [];
          } catch (e) {
            console.error('❌ Error saving promos chunk:', e.message);
            stream.destroy();
            reject(e);
            return;
          }
          xml.resume();
        }
      });

      xml.on('end', async () => {
        if (buffer.length > 0) {
          try {
            await this.savePromotionBatch(buffer);
          } catch (e) {
            console.error('❌ Error saving final promos chunk:', e.message);
            reject(e);
            return;
          }
        }
        console.log(`📊 ${promoCount} promotions parsed for store ${externalStoreId}`);
        resolve();
      });

      xml.on('error', (err) => {
        console.error('❌ XML parsing error:', err.message);
        reject(err);
      });
    });
  }

  normalizePromotion(promo, internalStoreId) {
    // Format A: PromotionID (רמי לוי, אושר עד)
    // Format B: PromotionId (יוחננוף)
    const promotionId = promo.PromotionID || promo.PromotionId;
    if (!promotionId) return null;

    // ClubID: Format A = string, Format B = Clubs.ClubId
    const clubId = promo.ClubID || promo.Clubs?.ClubId || '0';

    const promoData = {
      store_id: internalStoreId,
      promotion_id: String(promotionId).trim(),
      description: (promo.PromotionDescription || '').trim(),
      start_date: promo.PromotionStartDateTime || promo.PromotionStartDate || null,
      end_date: promo.PromotionEndDateTime || promo.PromotionEndDate || null,
      club_id: String(clubId).trim(),
      min_qty: parseInt(promo.MinNoOfItemOffered || promo.MinNoOfItemOfered) || 1,
      allow_multiple: promo.AllowMultipleDiscounts === '1',
      last_updated: new Date()
    };

    const items = this.extractPromotionItems(promo);

    return { promoData, items };
  }

  extractPromotionItems(promo) {
    // Format A (רמי לוי, אושר עד): Groups → Group → PromotionItems → PromotionItem
    //   MinQty, DiscountRate, DiscountedPrice, RewardType — per item
    // Format B (יוחננוף): PromotionItems → Item (no Groups wrapper)
    //   MinQty, DiscountedPrice, RewardType — at promotion level

    const items = [];
    const groups = this._ensureArray(promo.Groups?.Group);

    if (groups.length > 0) {
      // Format A: nested Groups → Group → PromotionItems → PromotionItem
      for (const group of groups) {
        const groupId = group.GroupID || '1';
        const promoItems = this._ensureArray(group.PromotionItems?.PromotionItem);

        for (const pi of promoItems) {
          const barcode = pi.ItemCode;
          if (!barcode) continue;

          items.push({
            barcode: String(barcode).trim(),
            group_id: String(groupId).trim(),
            reward_type: String(pi.RewardType || '1').trim(),
            min_qty: parseFloat(pi.MinQty) || 0,
            discount_rate: parseFloat(pi.DiscountRate) || 0,
            discounted_price: parseFloat(pi.DiscountedPrice) || 0,
            is_weighted: pi.bIsWeighted === '1'
          });
        }
      }
    } else {
      // Format B: flat PromotionItems → Item, values at promotion level
      const promoItems = this._ensureArray(promo.PromotionItems?.Item);
      const promoMinQty = parseFloat(promo.MinQty) || 0;
      const promoDiscountRate = parseFloat(promo.DiscountRate) || 0;
      const promoDiscountedPrice = parseFloat(promo.DiscountedPrice) || 0;
      const promoRewardType = String(promo.RewardType || '1').trim();

      for (const pi of promoItems) {
        const barcode = pi.ItemCode;
        if (!barcode) continue;

        items.push({
          barcode: String(barcode).trim(),
          group_id: '1',
          reward_type: promoRewardType,
          min_qty: promoMinQty,
          discount_rate: promoDiscountRate,
          discounted_price: promoDiscountedPrice,
          is_weighted: promo.IsWeightedPromo === '1'
        });
      }
    }

    return items;
  }

  _ensureArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  async savePromotionBatch(buffer) {
    if (buffer.length === 0) return;

    console.log(`[PROMO] savePromotionBatch: ${buffer.length} promotions in batch`);

    // שלב 1: SELECT ברקודים מ-items (לא מוסיפים חדשים — אין שם מוצר)
    const allBarcodes = new Set();
    for (const { items } of buffer) {
      for (const item of items) {
        allBarcodes.add(item.barcode);
      }
    }

    console.log(`[PROMO] Step 1: ${allBarcodes.size} unique barcodes to resolve`);

    const barcodesToLookup = [...allBarcodes].filter(b => !this.itemIdCache.has(b));
    console.log(`[PROMO] Step 1: ${barcodesToLookup.length} barcodes not in cache`);

    if (barcodesToLookup.length > 0) {
      // רק SELECT — לא מוסיפים ברקודים חדשים (אין לנו שם מוצר, וה-DB דורש name NOT NULL)
      // ברקודים שלא קיימים ב-items ידולגו ב-promotion_items
      let fetched = 0;
      for (let i = 0; i < barcodesToLookup.length; i += 500) {
        const chunk = barcodesToLookup.slice(i, i + 500);
        const { data, error: fetchError } = await this.supabase
          .from('items')
          .select('id, barcode')
          .in('barcode', chunk);

        if (fetchError) {
          console.error(`[PROMO] Step 1 fetch error:`, fetchError.message);
          throw fetchError;
        }
        if (data) {
          fetched += data.length;
          data.forEach(item => this.checkAndAddCache(item.barcode, item.id));
        }
      }
      console.log(`[PROMO] Step 1: fetched ${fetched} item IDs from DB, cache size: ${this.itemIdCache.size}`);
    }

    // שלב 2: Upsert מבצעים
    const promoRows = buffer.map(b => b.promoData);
    console.log(`[PROMO] Step 2: upserting ${promoRows.length} promotions`);
    console.log(`[PROMO] Step 2: sample row:`, JSON.stringify(promoRows[0]).slice(0, 300));

    const { data: savedPromos, error: promoError } = await this.supabase
      .from('promotions')
      .upsert(promoRows, { onConflict: 'store_id, promotion_id' })
      .select('id, promotion_id, store_id');

    if (promoError) {
      console.error(`[PROMO] Step 2 error:`, promoError.message);
      throw promoError;
    }

    console.log(`[PROMO] Step 2: savedPromos returned ${savedPromos ? savedPromos.length : 'null'} rows`);

    // map של store_id+promotion_id → internal id
    const promoIdMap = new Map();
    if (savedPromos) {
      for (const sp of savedPromos) {
        promoIdMap.set(`${sp.store_id}_${sp.promotion_id}`, sp.id);
      }
    }

    // שלב 3: Upsert פריטי מבצע (עם דדופליקציה לפי conflict key)
    const promoItemMap = new Map();
    let skippedNoPromo = 0;
    let skippedNoItem = 0;
    for (const { promoData, items } of buffer) {
      const internalPromoId = promoIdMap.get(`${promoData.store_id}_${promoData.promotion_id}`);
      if (!internalPromoId) { skippedNoPromo += items.length; continue; }

      for (const item of items) {
        const itemId = this.itemIdCache.get(item.barcode);
        if (!itemId) { skippedNoItem++; continue; }

        const key = `${internalPromoId}_${itemId}_${item.group_id}`;
        if (!promoItemMap.has(key)) {
          promoItemMap.set(key, {
            promotion_id: internalPromoId,
            item_id: itemId,
            group_id: item.group_id,
            reward_type: item.reward_type,
            min_qty: item.min_qty,
            discount_rate: item.discount_rate,
            discounted_price: item.discounted_price,
            is_weighted: item.is_weighted
          });
        }
      }
    }
    const promoItemRows = [...promoItemMap.values()];

    console.log(`[PROMO] Step 3: ${promoItemRows.length} promotion_items to save, skipped: ${skippedNoPromo} (no promo ID), ${skippedNoItem} (no item ID)`);

    if (promoItemRows.length > 0) {
      await this.saveBatch(promoItemRows, 'promotion_items', 'promotion_id, item_id, group_id');
      console.log(`[PROMO] Step 3: saved successfully`);
    }
  }

  async deleteExistingPromotions(internalStoreId) {
    const { error } = await this.supabase
      .from('promotions')
      .delete()
      .eq('store_id', internalStoreId);

    if (error) {
      console.error('❌ Error deleting existing promotions:', error.message);
      throw error;
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
    if (this.storeIdCache.has(extId)) {
      return this.storeIdCache.get(extId);
    }

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
      if (this.storeIdCache.size >= 1000) {
        const firstKey = this.storeIdCache.keys().next().value;
        this.storeIdCache.delete(firstKey);
      }
      this.storeIdCache.set(extId, data.id);
      return data.id;
    }

    return null;
  }

  clearCache() {
    this.itemIdCache.clear();
    this.storeIdCache.clear();
  }
}

module.exports = PromoProcessor;
