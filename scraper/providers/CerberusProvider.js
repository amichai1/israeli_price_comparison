// scraper/providers/CerberusProvider.js
const { chromium } = require('playwright');
const { BaseProvider, DOC_TYPES } = require('../core/BaseProvider');
const StoreProcessor = require('../processors/StoreProcessor');
const PriceProcessor = require('../processors/PriceProcessor');

class CerberusProvider extends BaseProvider {
  constructor(config, supabase) {
    super(config, supabase);
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * מימוש הפקטורי
   */
  getProcessor(docType) {
    if (docType === DOC_TYPES.STORES) {
      return new StoreProcessor(this.supabase, this.config);
    }
    return new PriceProcessor(this.supabase, this.config);
  }

  /**
   * התחברות ל-Cerberus portal - משותף לכל הפעולות
   */
  async ensureBrowserConnected() {
    if (this.page) return; // כבר מחובר

    console.log(`🔌 Opening browser for ${this.config.name}...`);
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true // ⚠️ SSL WORKAROUND for Cerberus
    });
    this.page = await this.context.newPage();

    // התחברות
    console.log(`🌐 Navigating to login page...`);
    await this.page.goto('https://url.retail.publishedprices.co.il/login', { waitUntil: 'networkidle' });

    console.log(`📝 Entering username: ${this.config.username}`);
    await this.page.fill('input[name="username"]', this.config.username);

    console.log(`⌨️ Pressing Enter...`);
    await this.page.keyboard.press('Enter');

    console.log(`⏳ Waiting for files table...`);
    await this.page.waitForSelector('table', { timeout: 60000 });
  }

  /**
   * הורדת רשימת קבצים - שימוש ב-Playwright להתחברות אוטומטית
   * מוריד את כל הקבצים מאותו יום לפי הסוג שצוין
   */
  async fetchFileList(docType, retries = 3) {
    try {
      // התחבר (או השתמש ב-browser קיים)
      await this.ensureBrowserConnected();

      // חפש קבצים לפי סוג (אם יש search box)
      console.log(`🔍 Filtering for ${docType} files...`);
      const searchSelector = 'input[type="search"]';

      if (await this.page.isVisible(searchSelector)) {
        // אם יש search box, השתמש בו
        let searchTerm = '';
        if (docType === DOC_TYPES.STORES) {
          searchTerm = 'store';
        } else if (docType === DOC_TYPES.PRICE_FULL) {
          searchTerm = 'price'; // יחפש גם Price וגם PriceFull
        } else if (docType === DOC_TYPES.PROMO_FULL) {
          searchTerm = 'promo';
        }

        if (searchTerm) {
          await this.page.fill(searchSelector, searchTerm);
          await this.page.waitForTimeout(1500); // המתן לסינון
        }
      }

      // חילוץ שמות קבצים מהטבלה
      console.log(`📊 Extracting file list from table...`);

      // תאריך היום בפורמט YYYYMMDD
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      console.log(`📅 Looking for files from today: ${today}`);

      const links = await this.page.locator('table a.f').all(); // רק קישורי קבצים (class="f")
      const files = [];

      for (const link of links) {
        const fileName = await link.getAttribute('title'); // השתמש ב-title במקום innerText

        if (!fileName) continue;

        // סינון לפי סוג קובץ
        let matchesType = false;
        if (docType === DOC_TYPES.STORES && fileName.toLowerCase().startsWith('store')) {
          matchesType = true;
        } else if (docType === DOC_TYPES.PRICE_FULL && fileName.toLowerCase().startsWith('price')) {
          matchesType = true;
        } else if (docType === DOC_TYPES.PROMO_FULL && fileName.toLowerCase().startsWith('promo')) {
          matchesType = true;
        }

        if (!matchesType) continue;

        // סינון לפי תאריך - רק קבצים מהיום
        if (!fileName.includes(today)) {
          continue;
        }

        // חילוץ store ID מתוך שם הקובץ
        // פורמט Price: Price7290058140886-001-070-20260205-070019.gz
        //                                   ^^^ store ID (5 parts total)
        // פורמט Stores: Stores7290058140886-000-20260205-050500.xml
        //                                   ^^^ "000" = all stores (4 parts total)
        const parts = fileName.split('-');
        let storeId = null;

        if (parts.length === 5) {
          // Price/Promo files - יש store ID ספציפי
          storeId = parts[2];
        } else if (parts.length === 4) {
          // Store files - "000" = כל הסניפים (אין store ID ספציפי)
          storeId = parts[1]; // "000"
        }

        files.push({
          fileName,
          url: null, // לא צריך URL - נוריד דרך Playwright
          storeId,
          date: new Date()
        });
      }

      console.log(`🔎 Found ${files.length} files from today for [${docType}]`);

      if (files.length > 0) {
        console.log(`📋 Sample files:`);
        files.slice(0, 3).forEach(f => console.log(`   - ${f.fileName} (Store: ${f.storeId})`));
        if (files.length > 3) {
          console.log(`   ... and ${files.length - 3} more`);
        }
      }

      return files;

    } catch (e) {
      console.error(`❌ Failed to fetch file list: ${e.message}`);
      return [];
    }
  }

  /**
   * הורדת קובץ דרך Playwright context (עם cookies)
   * משתמש ב-browser הפתוח עם session תקף
   */
  async downloadFileViaPlaywright(fileName) {
    const fs = require('fs');
    const path = require('path');

    try {
      console.log(`📥 Downloading: ${fileName}`);

      // ודא שהדפדפן מחובר
      await this.ensureBrowserConnected();

      // חיפוש הקישור הספציפי לפי attribute title
      const links = await this.page.locator('table a.f').all();
      let targetHref = null;

      for (const link of links) {
        const title = await link.getAttribute('title');

        if (title === fileName) {
          const href = await link.getAttribute('href');
          targetHref = href;
          console.log(`✓ Found link: ${href}`);
          break;
        }
      }

      if (!targetHref) {
        // Debug: הדפס את כל הקישורים שמצאנו
        console.log('⚠️ Available files in table:');
        for (const link of links.slice(0, 10)) {
          const title = await link.getAttribute('title');
          console.log(`  - ${title}`);
        }
        if (links.length > 10) {
          console.log(`  ... and ${links.length - 10} more files`);
        }
        throw new Error(`File not found in table: ${fileName}`);
      }

      // בניית URL מלא
      const baseUrl = 'https://url.retail.publishedprices.co.il';
      const fullUrl = targetHref.startsWith('http') ? targetHref : baseUrl + targetHref;

      console.log(`🌐 Downloading from: ${fullUrl}`);

      // הורדה דרך context (שומר את ה-cookies)
      const response = await this.context.request.get(fullUrl);

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // שמירת הקובץ
      const downloadPath = path.join(this.downloadDir, `${Date.now()}_${fileName}`);
      const buffer = await response.body();
      fs.writeFileSync(downloadPath, buffer);

      const sizeKB = (buffer.length / 1024).toFixed(2);
      console.log(`✅ Downloaded: ${fileName} (${sizeKB} KB)`);

      return downloadPath;

    } catch (error) {
      console.error(`❌ Failed to download ${fileName}:`, error.message);
      throw error;
    }
  }

  /**
   * ניקוי cache וסגירת דפדפן
   */
  async clearCache() {
    console.log(`🧹 Cleaning up browser for ${this.config.name}`);
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (e) {
      console.warn(`⚠️ Error closing browser: ${e.message}`);
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

module.exports = CerberusProvider;