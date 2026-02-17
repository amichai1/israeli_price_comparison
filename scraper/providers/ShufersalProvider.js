// scraper/providers/ShufersalProvider.js
const axios = require('axios');
const { BaseProvider, DOC_TYPES } = require('../core/BaseProvider');
const StoreProcessor = require('../processors/StoreProcessor');
const PriceProcessor = require('../processors/PriceProcessor');
const PromoProcessor = require('../processors/PromoProcessor');

// מיפוי סוג מסמך → catID באתר שופרסל
const CAT_IDS = {
  [DOC_TYPES.STORES]:       5,
  [DOC_TYPES.PRICE_FULL]:   2,
  [DOC_TYPES.PRICE_UPDATE]: 1,
  [DOC_TYPES.PROMO_FULL]:   4,
  [DOC_TYPES.PROMO_UPDATE]: 3,
};

const BASE_URL = 'https://prices.shufersal.co.il';

/**
 * StoreProcessor מותאם לפורמט SAP XML של שופרסל (אלמנטים באותיות גדולות)
 */
class ShufersalStoreProcessor extends StoreProcessor {
  get storeElements() {
    return ['STORE'];
  }

  _resolveFields(node) {
    return {
      storeId: node.STOREID,
      storeName: node.STORENAME,
      city: (node.CITY || '').toString().trim(),
      storeType: (node.STORETYPE || '').toString().trim(),
      address: node.ADDRESS || '',
      subChainId: node.SUBCHAINID || '0',
    };
  }
}

class ShufersalProvider extends BaseProvider {
  constructor(config, supabase) {
    super(config, supabase);
    this.cookies = '';
  }

  getProcessor(docType) {
    if (docType === DOC_TYPES.STORES) {
      return new ShufersalStoreProcessor(this.supabase, this.config);
    }
    if (docType === DOC_TYPES.PROMO_FULL || docType === DOC_TYPES.PROMO_UPDATE) {
      return new PromoProcessor(this.supabase, this.config);
    }
    return new PriceProcessor(this.supabase, this.config);
  }

  /**
   * חילוץ מזהה חנות משם הקובץ.
   * אותו פורמט כמו Cerberus: PriceFull7290027600007-{storeId}-202602170300.gz
   */
  extractStoreId(fileName) {
    const match = fileName.match(/-(\d+)-20\d{6}/);
    return match ? match[1] : null;
  }

  /**
   * שליפת רשימת קבצים מאתר שופרסל
   * 1. GET ל-main page לקבלת cookies
   * 2. קריאה לדפי הרשימה עם pagination
   * 3. פרסינג HTML — חילוץ download URLs ושמות קבצים
   */
  async fetchFileList(docType) {
    const catID = CAT_IDS[docType];
    if (!catID) {
      console.warn(`⚠️ Unknown doc type: ${docType}`);
      return [];
    }

    // שלב 1: קבלת cookies מהדף הראשי
    await this._fetchCookies();

    // שלב 2: קריאה לדף ראשון וחילוץ מספר דפים
    const firstPageHtml = await this._fetchPage(catID, 1);
    const totalPages = this._extractTotalPages(firstPageHtml);
    console.log(`📄 Found ${totalPages} pages for ${docType}`);

    // שלב 3: פרסינג כל הדפים
    let allFiles = this._parseFilesFromHtml(firstPageHtml);

    for (let page = 2; page <= totalPages; page++) {
      const html = await this._fetchPage(catID, page);
      const files = this._parseFilesFromHtml(html);
      allFiles = allFiles.concat(files);
    }

    console.log(`🔍 Found ${allFiles.length} ${docType} files total`);
    return allFiles;
  }

  /**
   * GET לדף הראשי לקבלת cookies (Azure ARRAffinity)
   */
  async _fetchCookies() {
    try {
      const response = await axios.get(BASE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000,
      });

      const setCookies = response.headers['set-cookie'];
      if (setCookies) {
        this.cookies = setCookies.map(c => c.split(';')[0]).join('; ');
        console.log('🍪 Cookies received');
      }
    } catch (e) {
      console.warn(`⚠️ Failed to fetch cookies: ${e.message}, continuing without cookies`);
    }
  }

  /**
   * שליפת דף רשימת קבצים
   */
  async _fetchPage(catID, page) {
    const url = `${BASE_URL}/FileObject/UpdateCategory?catID=${catID}&storeId=0&page=${page}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': this.cookies,
      },
      timeout: 30000,
    });
    return response.data;
  }

  /**
   * חילוץ מספר הדף האחרון מה-pagination (>> link)
   * <a href="...page=22">&gt;&gt;</a>
   */
  _extractTotalPages(html) {
    // חיפוש הלינק של >> (הדף האחרון)
    const match = html.match(/page=(\d+)">\s*&gt;&gt;/);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * פרסינג שורות טבלה מה-HTML
   * כל <tr> מכיל: download URL (עמודה 1), timestamp (עמודה 2), filename (עמודה 7)
   */
  _parseFilesFromHtml(html) {
    const files = [];
    // חילוץ כל שורות הטבלה (<tr> עם class של webgrid)
    const rowRegex = /<tr\s+class="webgrid-(?:row-style|alternating-row)">([\s\S]*?)<\/tr>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];

      // חילוץ download URL
      const urlMatch = rowHtml.match(/href="(https:\/\/pricesprodpublic\.blob\.core\.windows\.net[^"]+)"/);
      if (!urlMatch) continue;

      // ה-URL מגיע עם &amp; — צריך להחליף
      const downloadUrl = urlMatch[1].replace(/&amp;/g, '&');

      // חילוץ שם הקובץ מה-URL path (אחרי / האחרון, לפני ?)
      const urlPath = downloadUrl.split('?')[0];
      const fileName = urlPath.split('/').pop();

      // חילוץ storeId
      const storeId = this.extractStoreId(fileName);

      // חילוץ תאריך מהעמודה השנייה (2/17/2026 3:00:00 AM)
      const dateMatch = rowHtml.match(/<td>(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)<\/td>/);
      const date = dateMatch ? new Date(dateMatch[1]) : new Date();

      files.push({
        fileName,
        url: downloadUrl,
        storeId,
        date,
      });
    }

    return files;
  }

  // downloadFile() — לא דורסים! ה-BaseProvider כבר מממש HTTP download עם axios.
  // ה-Azure Blob URLs לא דורשים cookies.

  clearCache() {
    this.cookies = '';
    console.log(`🧹 Cache cleared for ${this.config.name}`);
  }
}

module.exports = ShufersalProvider;
