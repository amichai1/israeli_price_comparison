// scraper/providers/CerberusProvider.js
const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const zlib = require('zlib');
const { chromium } = require('playwright');
const { BaseProvider, DOC_TYPES } = require('../core/BaseProvider');
const StoreProcessor = require('../processors/StoreProcessor');
const PriceProcessor = require('../processors/PriceProcessor');

// ⚠️ TEMPORARY SSL WORKAROUND - Cerberus has certificate issues
const httpsAgent = new https.Agent({  
  rejectUnauthorized: false
});

class CerberusProvider extends BaseProvider {
  constructor(config, supabase) {
    super(config, supabase);
    this.browser = null;
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
   * הורדת רשימת קבצים - שימוש ב-Playwright להתחברות אוטומטית
   */
  async fetchFileList(docType, retries = 3) {
    let browser;
    let page;
    
    try {
      console.log(`🔌 Opening browser for ${this.config.name}...`);
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();
      
      // שלב 1: תנועה לעמוד ההתחברות
      console.log(`🌐 Navigating to login page...`);
      await page.goto('https://url.retail.publishedprices.co.il/login', { waitUntil: 'networkidle' });
      
      // שלב 2: מלא את השם משתמש
      console.log(`📝 Entering username: ${this.config.username}`);
      await page.fill('input[name="username"]', this.config.username);
      
      // שלב 3: לחץ Enter להתחברות
      console.log(`⌨️ Pressing Enter...`);
      await page.keyboard.press('Enter');
      
      // שלב 4: המתן לטבלת הקבצים להופיע
      console.log(`⏳ Waiting for files table...`);
      await page.waitForSelector('table', { timeout: 20000 });
      
      // שלב 5: חפש קבצים לפי סוג
      console.log(`🔍 Filtering for ${docType} files...`);
      const searchSelector = 'input[type="search"]';
      
      if (await page.isVisible(searchSelector)) {
        // אם יש search box, השתמש בו
        if (docType === DOC_TYPES.STORES) {
          await page.fill(searchSelector, 'store');
        } else {
          await page.fill(searchSelector, 'pricefull');
        }
        await page.waitForTimeout(1000); // המתן לסינון
      }
      
      // שלב 6: חילוץ נתוני הטבלה
      console.log(`📊 Extracting file list...`);
      const files = await page.evaluate((docType) => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        const files = [];
        
        rows.forEach((row) => {
          const link = row.querySelector('a');
          if (!link) return;
          
          const fileName = link.textContent.trim();
          const href = link.getAttribute('href');
          
          if (!fileName || !href) return;
          
          // בניית URL מלא
          const url = href.startsWith('http') 
            ? href 
            : href.startsWith('/') 
              ? window.location.origin + href 
              : window.location.origin + '/' + href;
          
          // סינון לפי סוג
          if (docType === 'Stores' && !fileName.toLowerCase().includes('store')) return;
          if (docType !== 'Stores' && !fileName.toLowerCase().includes('price')) return;
          
          files.push({
            fileName,
            url,
            storeId: fileName.match(/-(\d{3,4})-/)?.[1] || null,
            date: new Date()
          });
        });
        
        return files;
      }, docType);
      
      console.log(`🔎 Found ${files.length} files for [${docType}]`);
      return files;
      
    } catch (e) {
      console.error(`❌ Failed to fetch file list: ${e.message}`);
      return [];
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * הורדה וחילוץ קובץ .gz - בדיוק כמו הקוד הישן שעבד!
   */
  async downloadAndDecompress(url) {
    console.log(`📥 Downloading: ${url}`);
    
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        httpsAgent, // ✅ רק ה-SSL fix
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log(`✓ Downloaded ${(response.data.length / 1024 / 1024).toFixed(2)} MB`);
      console.log('📦 Decompressing...');
      
      const decompressed = zlib.gunzipSync(response.data);
      console.log(`✓ Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(2)} MB`);
      
      return decompressed.toString('utf-8');
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Download timeout - file may be too large or connection is slow');
      }
      throw error;
    }
  }

  /**
   * בדיקה האם קובץ הוא קובץ מחירים
   */
  isPriceFile(name) {
    const n = name.toLowerCase();
    return (n.includes('pricefull') || n.includes('price')) && !n.includes('update');
  }

  /**
   * חילוץ מזהה חנות מתוך שם הקובץ
   */
  extractStoreId(name) {
    const match = name.match(/-(\d{3,4})-/);
    return match ? match[1] : null;
  }

  /**
   * ניקוי cache (אין session אז אין מה לנקות)
   */
  clearCache() {
    console.log(`🧹 Cache cleared for ${this.config.name}`); 
  }
}

module.exports = CerberusProvider;