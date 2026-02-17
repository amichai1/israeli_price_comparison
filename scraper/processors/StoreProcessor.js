// scraper/processors/StoreProcessor.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const BaseProcessor = require('../core/BaseProcessor');

// כינויים וקיצורים → שם עיר כפי שמופיע ב-DB
const CITY_ALIASES = {
  // קיצורים נפוצים
  'ת"א': 'תל אביב - יפו',
  'ראשל"צ': 'ראשון לציון',
  'ראשלצ': 'ראשון לציון',
  'תל אביב': 'תל אביב - יפו',
  // וריאציות כתיב
  'תל אביב-יפו': 'תל אביב - יפו',
  'תל אביב יפו': 'תל אביב - יפו',
  'רמת אביב א': 'תל אביב - יפו',
  'רמת אביב': 'תל אביב - יפו',
  'קרית גת': 'קריית גת',
  // שכונות/ישובים ← עיר-אם
  'גבעת אולגה': 'חדרה',
  'כרכור': 'פרדס חנה-כרכור',
  'קריית חיים': 'חיפה',
  'קרית חיים': 'חיפה',
  'רעות': 'מודיעין-מכבים-רעות',
  'מודיעין': 'מודיעין-מכבים-רעות',
  'שילת': 'מודיעין עילית',
  'קרית ספר': 'מודיעין עילית',
  'טבעון': 'קריית טבעון',
  'עקרון': 'קריית עקרון',
  'בילו': 'קריית עקרון',
  'יד אליהו': 'תל אביב - יפו',
  'מישור אדומים': 'מעלה אדומים',
  'אשדות יעקב': 'אשדות יעקב (איחוד)',
  // שמות חלופיים
  'יהוד': 'יהוד-מונוסון',
  'יוקנעם': 'יוקנעם עילית',
  'מעלות': 'מעלות-תרשיחא',
  'אלנקווה': 'אלקנה',
  // שמות מתחמים/קניונים
  'חוצות המפרץ': 'חיפה',
  'איירפורט סיטי': 'קריית שדה התעופה',
  'קניון הבאר': 'ראשון לציון',
  'שער בנימין': 'גבע בנימין',
  'גוש עציון': 'אלון שבות',
};

// כינויים ממוינים לפי אורך יורד (longest match first)
const SORTED_ALIAS_KEYS = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length);

// מיפוי ידני לסניפים ללא שדה עיר ושם לא מזוהה
const STORE_OVERRIDES = {
  'יוחננוף מפוח': 'רחובות',
  'יוחננוף ישן': 'רחובות',
  'אחד העם': 'רחובות',
  'אקספרס תל חי': 'כפר סבא',
  'BE אוסישקין': 'רמת השרון',
  'אקספרס הירדן': 'רמת גן',
};

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

    let matched = { cbsCode: 0, cityName: 0, internet: 0, fallbackName: 0 };
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

      for (const el of this.storeElements) {
        xml.on(`endElement: ${el}`, handleNode);
      }

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
        console.log(`   ├─ CBS code: ${matched.cbsCode}, City name: ${matched.cityName}, Internet: ${matched.internet}, Fallback name: ${matched.fallbackName}`);
        resolve();
      });

      xml.on('error', (err) => {
        console.error('❌ XML parsing error:', err.message);
        reject(err);
      });
    });
  }

  /**
   * שמות אלמנטים ב-XML — ניתן לדריסה ב-subclass (למשל ['STORE'] עבור SAP XML)
   */
  get storeElements() {
    return ['Store', 'Branch'];
  }

  /**
   * חילוץ שדות מאלמנט XML — ניתן לדריסה ב-subclass עבור פורמטים שונים
   * @returns {{ storeId, storeName, city, storeType, address, subChainId }}
   */
  _resolveFields(node) {
    return {
      storeId: node.StoreID || node.StoreId || node.BranchId || node.ID,
      storeName: node.StoreName || node.BranchName || node.Name,
      city: (node.City || node.CityName || '').toString().trim(),
      storeType: (node.StoreType || '').toString().trim(),
      address: node.Address || '',
      subChainId: node.SubChainId || '0',
    };
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
    const fields = this._resolveFields(node);
    const { storeId, storeName, city: rawCity, storeType, address, subChainId } = fields;

    if (!storeId || !storeName) return null;

    const buildRow = (cityId) => ({
      chain_id: this.config.id,
      store_id: storeId.toString(),
      branch_name: storeName.trim(),
      address,
      city_id: cityId,
      sub_chain_id: subChainId,
      raw_city_name: rawCity || null,
    });

    // שלב 1: זיהוי חנויות אינטרנט לפי StoreType
    if (storeType === '2') {
      const internetId = this.cityNameMap.get('Internet');
      if (internetId) {
        matched.internet++;
        return buildRow(internetId);
      }
    }

    if (rawCity && rawCity !== '0') {
      // שלב 2: חיפוש לפי קוד למ"ס (רמי לוי, אושר עד — City מכיל קוד מספרי)
      const cbsId = this.cbsCodeMap.get(rawCity);
      if (cbsId) {
        matched.cbsCode++;
        return buildRow(cbsId);
      }

      // שלב 2.5: חיפוש לפי שם עיר (שופרסל — CITY מכיל שם עיר בעברית)
      const cityNameId = this._matchCityByName(rawCity);
      if (cityNameId) {
        matched.cityName++;
        return buildRow(cityNameId);
      }
    }

    // שלב 3: Fallback — חיפוש שם עיר מוכר בתוך שם הסניף (יוחננוף City=0)
    const cityId = this._extractCityFromText(storeName);
    if (cityId) {
      matched.fallbackName++;
      return buildRow(cityId);
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
   * התאמת שם עיר עם נורמליזציה — מקפים, קיצורים, שגיאות כתיב
   * @returns {number|null} city_id או null
   */
  _matchCityByName(rawCity) {
    // 1. exact match
    let id = this.cityNameMap.get(rawCity);
    if (id) return id;

    // 2. נורמליזציה (מקפים, כתיב, קיצורים)
    const normalized = this._normalizeCityName(rawCity);
    if (normalized !== rawCity) {
      id = this.cityNameMap.get(normalized);
      if (id) return id;
    }

    // 3. prefix match: "תל אביב" → "תל אביב - יפו"
    id = this._findCityStartingWith(rawCity);
    if (id) return id;

    // 4. prefix match על השם המנורמל
    if (normalized !== rawCity) {
      id = this._findCityStartingWith(normalized);
      if (id) return id;
    }

    return null;
  }

  /**
   * נורמליזציה של שם עיר — מקפים, שגיאות כתיב, קיצורים
   */
  _normalizeCityName(name) {
    if (!name) return name;

    // קיצורים וכינויים (lookup ישיר)
    if (CITY_ALIASES[name]) return CITY_ALIASES[name];

    // מקפים → רווחים (באר-שבע → באר שבע)
    let normalized = name.replace(/-/g, ' ');

    // "קרית" → "קריית" (שגיאת כתיב נפוצה)
    normalized = normalized.replace(/^קרית /, 'קריית ');

    // "פתח תקוה" / "פתחתקוה" → "פתח תקווה"
    normalized = normalized.replace(/^פתח ?תקוה$/, 'פתח תקווה');

    return normalized;
  }

  /**
   * חיפוש עיר שמתחילה עם הטקסט הנתון (למשל "תל אביב" → "תל אביב - יפו")
   * @returns {number|null} city_id או null
   */
  _findCityStartingWith(text) {
    if (!text) return null;
    for (const cityName of this.sortedCityNames) {
      if (cityName === 'Internet') continue;
      if (cityName.startsWith(text) && cityName !== text) {
        return this.cityNameMap.get(cityName);
      }
    }
    return null;
  }

  _extractCityFromText(text) {
    if (!text) return null;
    // שלב 1: חיפוש ישיר של שם עיר בתוך הטקסט
    for (const cityName of this.sortedCityNames) {
      if (cityName === 'Internet') continue;
      if (text.includes(cityName)) {
        return this.cityNameMap.get(cityName);
      }
    }
    // שלב 2: נורמליזציה (למשל "קרית שמונה" → "קריית שמונה")
    const normalized = this._normalizeCityName(text);
    if (normalized !== text) {
      for (const cityName of this.sortedCityNames) {
        if (cityName === 'Internet') continue;
        if (normalized.includes(cityName)) {
          return this.cityNameMap.get(cityName);
        }
      }
    }
    // שלב 3: חיפוש כינויים בתוך הטקסט (ממוין לפי אורך יורד)
    for (const alias of SORTED_ALIAS_KEYS) {
      if (text.includes(alias)) {
        const id = this.cityNameMap.get(CITY_ALIASES[alias]);
        if (id) return id;
      }
    }
    // שלב 4: מיפוי ידני לפי שם סניף מדויק
    const override = STORE_OVERRIDES[text.trim()];
    if (override) {
      return this.cityNameMap.get(override);
    }
    return null;
  }
}

module.exports = StoreProcessor;
