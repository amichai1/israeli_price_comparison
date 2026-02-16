// scraper/providers/CerberusProvider.js
const { Client } = require('basic-ftp');
const fs = require('fs');
const pLimit = require('p-limit');
const { BaseProvider, DOC_TYPES } = require('../core/BaseProvider');
const StoreProcessor = require('../processors/StoreProcessor');
const PriceProcessor = require('../processors/PriceProcessor');
const PromoProcessor = require('../processors/PromoProcessor');

// FTP filter pattern per doc type (lowercase, partial match on filename)
const FILE_PATTERNS = {
  [DOC_TYPES.STORES]:       'store',
  [DOC_TYPES.PRICE_FULL]:   'pricefull',
  [DOC_TYPES.PRICE_UPDATE]: 'price',
  [DOC_TYPES.PROMO_FULL]:   'promofull',
  [DOC_TYPES.PROMO_UPDATE]: 'promo',
};

class CerberusProvider extends BaseProvider {
  constructor(config, supabase) {
    super(config, supabase);
    this.ftpHost = 'url.retail.publishedprices.co.il';
    this.ftpClient = null;
    this.limit = pLimit(1); // FTP is serial — one connection can't do parallel downloads
  }

  /**
   * פותח חיבור FTP+TLS לשרת Cerberus. מרוכז במקום אחד.
   */
  async _connectFtp() {
    const client = new Client();
    console.log(`🔌 FTP connecting to ${this.ftpHost} (user: ${this.config.username})`);
    await client.access({
      host: this.ftpHost,
      user: this.config.username || '',
      password: '',
      secure: true,
      secureOptions: { rejectUnauthorized: false }
    });
    console.log('✓ FTP connected');
    return client;
  }

  /**
   * Override: פותח חיבור FTP יחיד לפני כל הריצה, סוגר ב-finally.
   */
  async run(docType) {
    this.ftpClient = await this._connectFtp();
    try {
      await super.run(docType);
    } finally {
      this.ftpClient.close();
      this.ftpClient = null;
    }
  }

  getProcessor(docType) {
    if (docType === DOC_TYPES.STORES) {
      return new StoreProcessor(this.supabase, this.config);
    }
    if (docType === DOC_TYPES.PROMO_FULL || docType === DOC_TYPES.PROMO_UPDATE) {
      return new PromoProcessor(this.supabase, this.config);
    }
    return new PriceProcessor(this.supabase, this.config);
  }

  /**
   * שליפת רשימת קבצים מ-Cerberus דרך FTP
   * מסנן לפי סוג מסמך + תאריך היום.
   * משתמש בחיבור FTP המשותף (this.ftpClient).
   */
  async fetchFileList(docType) {
    const allFiles = await this.ftpClient.list();
    console.log(`📂 Total files on server: ${allFiles.length}`);

    const pattern = FILE_PATTERNS[docType];
    if (!pattern) {
      console.warn(`⚠️ Unknown doc type: ${docType}`);
      return [];
    }

    // תאריך היום בפורמט שמופיע בשמות הקבצים: YYYYMMDD
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const filtered = allFiles.filter(f => {
      const name = f.name.toLowerCase();

      if (!name.includes(pattern)) return false;

      // מניעת התנגשויות: "price" מתאים גם ל-"pricefull"
      if (pattern === 'price' && name.includes('pricefull')) return false;
      if (pattern === 'promo' && name.includes('promofull')) return false;

      // רק קבצים מהיום
      if (!f.name.includes(today)) return false;

      return true;
    });

    console.log(`🔍 Found ${filtered.length} ${docType} files from today (${today})`);

    return filtered.map(f => ({
      fileName: f.name,
      url: f.name, // משמש כמפתח ייחודי ב-filterFiles
      storeId: this.extractStoreId(f.name),
      date: f.modifiedAt || new Date()
    }));
  }

  /**
   * חילוץ מזהה חנות משם הקובץ.
   * תופס את מקטע הספרות שלפני התאריך (YYYYMMDD שמתחיל ב-20).
   * Format A: PriceFull{barcode}-{storeId}-{YYYYMMDDHHMI}.gz          (רמי לוי, יוחננוף)
   * Format B: PriceFull{barcode}-{sub}-{storeId}-{YYYYMMDD}-{HHMMSS}.gz  (אושר עד)
   */
  extractStoreId(fileName) {
    const match = fileName.match(/-(\d+)-20\d{6}/);
    return match ? match[1] : null;
  }

  /**
   * הורדת קובץ מ-Cerberus דרך FTP ישירות.
   * משתמש בחיבור FTP המשותף (this.ftpClient).
   * במקרה של כשל — reconnect ומנסה שוב.
   */
  async downloadFile(url, outputPath, retries = 3) {
    const fileName = url.split('/').pop();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.ftpClient.downloadTo(outputPath, fileName);
        return;
      } catch (e) {
        try { fs.unlinkSync(outputPath); } catch (_) {}

        if (attempt === retries) {
          throw new Error(`FTP download failed after ${retries} attempts: ${e.message}`);
        }

        const delay = 2000 * attempt;
        console.log(`⚠️ Attempt ${attempt} failed, reconnecting in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));

        // Reconnect — the previous connection may be broken
        try { this.ftpClient.close(); } catch (_) {}
        this.ftpClient = await this._connectFtp();
      }
    }
  }

  clearCache() {
    console.log(`🧹 Cache cleared for ${this.config.name}`);
  }
}

module.exports = CerberusProvider;
