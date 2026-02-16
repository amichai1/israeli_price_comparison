// scraper/processors/StoreProcessor.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const BaseProcessor = require('../core/BaseProcessor');

class StoreProcessor extends BaseProcessor {
  constructor(supabase, config) {
    super(supabase, config);
    this.cbsCodeMap = new Map();   // קוד למ"ס (string) → city_id
    this.cityNameMap = new Map();  // שם עיר (string) → city_id
    this.sortedCityNames = [];     // שמות ערים ממוינים לפי אורך יורד (longest match first)
  }

  async process(filePath, metadata) {
    // המרת UTF-16LE ל-UTF-8 אם נדרש (קבצי Stores מ-Cerberus מגיעים ב-UTF-16LE)
    this._convertToUtf8IfNeeded(filePath);

    await this.loadCitiesMap();

    let matched = { cbsCode: 0, internet: 0, fallbackName: 0 };
    let skipped = 0;

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const xml = new XmlStream(stream);
      let buffer = [];
      let totalNodes = 0;

      const handleNode = async (node) => {
        totalNodes++;
        const normalized = this.normalize(node, matched);
        if (normalized) {
          buffer.push(normalized);
        } else {
          skipped++;
        }

        if (buffer.length >= 500) {
          xml.pause();
          try {
            await this.saveBatch(buffer, 'stores', 'chain_id, store_id');
            console.log(`💾 Saved batch of ${buffer.length} stores`);
            buffer = [];
          } catch (e) {
            console.error('❌ Error saving stores chunk:', e.message);
            xml.destroy();
            reject(e);
            return;
          }
          xml.resume();
        }
      };

      xml.on('endElement: Store', handleNode);
      xml.on('endElement: Branch', handleNode);

      xml.on('end', async () => {
        if (buffer.length > 0) {
          try {
            await this.saveBatch(buffer, 'stores', 'chain_id, store_id');
            console.log(`💾 Saved final batch of ${buffer.length} stores`);
          } catch (e) {
            console.error('❌ Error saving final stores chunk:', e.message);
            reject(e);
            return;
          }
        }

        console.log(`📊 Stores summary: ${totalNodes} parsed, ${totalNodes - skipped} matched, ${skipped} skipped`);
        console.log(`   ├─ CBS code: ${matched.cbsCode}, Internet: ${matched.internet}, Fallback name: ${matched.fallbackName}`);
        resolve();
      });

      xml.on('error', (err) => {
        console.error('❌ XML parsing error:', err.message);
        reject(err);
      });
    });
  }

  async loadCitiesMap() {
    if (this.cbsCodeMap.size > 0 || this.cityNameMap.size > 0) return;

    const { data, error } = await this.supabase
      .from('cities')
      .select('id, name, cbs_code');

    if (error) {
      console.error('❌ Error loading cities:', error.message);
      throw error;
    }

    if (data) {
      data.forEach(c => {
        this.cityNameMap.set(c.name.trim(), c.id);
        if (c.cbs_code) {
          this.cbsCodeMap.set(c.cbs_code.trim(), c.id);
        }
      });

      // מיון שמות ערים לפי אורך יורד (כדי ש"מודיעין-מכבים-רעות" ימצא לפני "מודיעין")
      this.sortedCityNames = [...this.cityNameMap.keys()]
        .sort((a, b) => b.length - a.length);

      console.log(`📍 Loaded ${this.cbsCodeMap.size} CBS codes and ${this.cityNameMap.size} city names`);
    }
  }

  normalize(node, matched) {
    const storeId = node.StoreID || node.StoreId || node.BranchId || node.ID;
    const storeName = node.StoreName || node.BranchName || node.Name;
    const rawCity = (node.City || node.CityName || '').toString().trim();
    const storeType = (node.StoreType || '').toString().trim();

    if (!storeId || !storeName) return null;

    // שלב 1: זיהוי חנויות אינטרנט לפי StoreType
    if (storeType === '2') {
      const internetId = this.cityNameMap.get('Internet');
      if (internetId) {
        matched.internet++;
        return this._buildStoreRow(storeId, storeName, node, internetId, rawCity);
      }
    }

    // שלב 2: חיפוש לפי קוד למ"ס (רמי לוי, אושר עד — City מכיל קוד מספרי)
    if (rawCity && rawCity !== '0') {
      const cityId = this.cbsCodeMap.get(rawCity);
      if (cityId) {
        matched.cbsCode++;
        return this._buildStoreRow(storeId, storeName, node, cityId, rawCity);
      }
    }

    // שלב 3: Fallback — חיפוש שם עיר מוכר בתוך שם הסניף (יוחננוף City=0)
    const cityId = this._extractCityFromText(storeName);
    if (cityId) {
      matched.fallbackName++;
      return this._buildStoreRow(storeId, storeName, node, cityId, rawCity);
    }

    // לא הצלחנו לזהות עיר
    console.warn(`⚠️ Unknown city: "${rawCity}" for store ${storeId} "${storeName}"`);
    return null;
  }

  /**
   * אם הקובץ מקודד UTF-16LE (BOM: FF FE) — ממיר אותו ל-UTF-8 in-place
   */
  _convertToUtf8IfNeeded(filePath) {
    const buf = Buffer.alloc(2);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);

    if (buf[0] === 0xFF && buf[1] === 0xFE) {
      console.log('🔄 Converting UTF-16LE → UTF-8');
      const raw = fs.readFileSync(filePath);
      const utf8 = new TextDecoder('utf-16le').decode(raw);
      fs.writeFileSync(filePath, utf8, 'utf8');
    }
  }

  /**
   * בניית אובייקט store row (DRY)
   */
  _buildStoreRow(storeId, storeName, node, cityId, rawCity) {
    return {
      chain_id: this.config.id,
      store_id: storeId.toString(),
      branch_name: storeName.trim(),
      address: node.Address || '',
      city_id: cityId,
      sub_chain_id: node.SubChainId || '0',
      raw_city_name: rawCity || null,
    };
  }

  /**
   * חיפוש שם עיר מוכר בתוך מחרוזת (longest match first)
   * @returns {number|null} city_id או null
   */
  _extractCityFromText(text) {
    if (!text) return null;
    for (const cityName of this.sortedCityNames) {
      if (cityName === 'Internet') continue; // לא לחפש "Internet" בתוך שמות סניפים
      if (text.includes(cityName)) {
        return this.cityNameMap.get(cityName);
      }
    }
    return null;
  }
}

module.exports = StoreProcessor;
