const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createGunzip } = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pLimit = require('p-limit');
const TelegramClient = require('../utils/TelegramClient'); // ✅ אינטגרציה לטלגרם

const streamPipeline = promisify(pipeline);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const DOC_TYPES = {
  STORES: 'Stores',
  PRICE_FULL: 'PriceFull',
  PRICE_UPDATE: 'PriceUpdate',
  PROMO_FULL: 'PromoFull',
  PROMO_UPDATE: 'PromoUpdate'
};

class BaseProvider {
  constructor(chainConfig, supabase) {
    // Validation
    if (!chainConfig) throw new Error('BaseProvider: chainConfig is required');
    if (!chainConfig.name) throw new Error('BaseProvider: chainConfig.name is required');
    if (!chainConfig.id) throw new Error('BaseProvider: chainConfig.id is required');
    if (!supabase) throw new Error('BaseProvider: supabase client is required');

    this.config = chainConfig;
    this.supabase = supabase;
    this.limit = pLimit(2);
    
    this.downloadDir = path.join(__dirname, '../downloads');
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  // --- Abstract Methods ---
  async fetchFileList(docType) { 
    throw new Error("Method 'fetchFileList' must be implemented by child class"); 
  }
  
  getProcessor(docType) { 
    throw new Error("Method 'getProcessor' must be implemented by child class"); 
  }

  clearCache() {
    // Default implementation: do nothing.
    // Child classes can override this to clean up specific resources (Maps, Sets, etc).
  }
  
  // --- Main Execution Flow ---
  async run(docType) {
    console.log(`🚀 מתחיל ריצה עבור ספק: ${this.config.name} [${docType}]`);
    
    // ✅ דיווח התחלה לטלגרם
    TelegramClient.sendStart(this.config.name, docType);

    const startTime = Date.now();

    try {
      const allFiles = await this.fetchFileList(docType);
      
      if (!allFiles || allFiles.length === 0) {
        console.log('⚠️ לא נמצאו קבצים להורדה.');
        return;
      }

      const tasksToProcess = await this.filterFiles(allFiles, docType);
      console.log(`🎯 מעבד ${tasksToProcess.length} קבצים רלוונטיים.`);

      if (tasksToProcess.length === 0) {
        console.log('⚠️ לא נותרו קבצים לאחר הסינון.');
        return;
      }

      const processor = this.getProcessor(docType);

      const promises = tasksToProcess.map(task => {
        return this.limit(() => this.processSingleTask(task, processor, docType));
      });

      // ✅ שימוש ב-allSettled כדי לא לעצור את הריצה בגלל קובץ בודד
      const results = await Promise.allSettled(promises);
      
      // סטטיסטיקות
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ הריצה הסתיימה עבור ${this.config.name} תוך ${duration} שניות`);
      console.log(`📊 סטטיסטיקה: ${succeeded} הצליחו, ${failed} נכשלו (מתוך ${tasksToProcess.length})`);
      
      // ✅ דיווח הצלחה וסטטיסטיקה לטלגרם
      TelegramClient.sendSuccess(this.config.name, docType, duration, succeeded, failed);

      // לוג שגיאות מפורט אם יש כישלונות
      if (failed > 0) {
        console.warn(`⚠️ פירוט קבצים שנכשלו:`);
        results
          .filter(r => r.status === 'rejected')
          .slice(0, 5) // מציג רק את ה-5 הראשונים בלוג
          .forEach((r, i) => console.warn(`  ${i + 1}. ${r.reason?.message || 'שגיאה לא ידועה'}`));
        
        if (failed > 5) {
          console.warn(`  ... ועוד ${failed - 5} קבצים`);
        }
      }

    } catch (err) {
      console.error(`❌ שגיאה קריטית בריצה:`, err.message);
      
      // ✅ דיווח שגיאה קריטית לטלגרם
      TelegramClient.sendError(this.config.name, err.message);
      
      throw err;
    }
  }

  async processSingleTask(task, processor, docType) {
    const { fileName, url, storeId } = task;
    const tempId = Math.random().toString(36).substring(7);
    const downloadPath = path.join(this.downloadDir, `${tempId}_${fileName}`);
    const extractPath = downloadPath.replace(/\.gz$|\.zip$/, '.xml');

    try {
      // א. הורדה
      console.log(`⬇️  מוריד קובץ: ${fileName}`);
      await this.downloadFile(url, downloadPath);

      // ב. חילוץ
      if (fileName.endsWith('.gz') || fileName.endsWith('.zip')) {
        await this.decompressFile(downloadPath, extractPath);
      } else {
        fs.copyFileSync(downloadPath, extractPath);
      }

      // ג. עיבוד
      console.log(`⚙️  מעבד את תוכן הקובץ: ${fileName}...`);
      await processor.process(extractPath, { 
        externalStoreId: storeId,
        fileName: fileName,
        docType: docType 
      });

      console.log(`✅ הושלם בהצלחה: ${fileName}`);

    } catch (error) {
      console.error(`❌ שגיאה בעיבוד ${fileName}:`, error.message);
      throw error; // זורקים למעלה כדי ש-allSettled יתפוס את זה כ-rejected
    } finally {
      // ד. ניקוי
      this.cleanupFiles(downloadPath, extractPath);
    }
  }

  // --- Helpers ---
  
  cleanupFiles(...paths) {
    for (const filePath of paths) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        if (e.code !== 'ENOENT') {
          console.warn(`⚠️ אזהרת ניקוי קבצים עבור ${path.basename(filePath)}:`, e.message);
        }
      }
    }
  }
  
  async filterFiles(allFiles, docType) {
    // Stores: לוקחים רק את הקובץ העדכני ביותר
    if (docType === DOC_TYPES.STORES) {
      if (allFiles.length === 0) return [];
      allFiles.sort((a, b) => b.date - a.date);
      return [allFiles[0]];
    }

    // Prices: סינון לפי סניפים פעילים מה-DB
    const activeIds = await this.getActiveStoreIdsFromDB();
    
    if (activeIds.length === 0) {
      console.warn('⚠️ לא נמצאו חנויות פעילות ב-DB לסינון.');
      return [];
    }
    
    const uniqueMap = new Map();
    
    for (const file of allFiles) {
      if (activeIds.includes(file.storeId)) {
        if (!uniqueMap.has(file.url)) {
          uniqueMap.set(file.url, file);
        }
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  async getActiveStoreIdsFromDB() {
    try {
      const { data, error } = await this.supabase
        .from('stores')
        .select('store_id, cities!inner(is_active)')
        .eq('chain_id', this.config.id)
        .eq('cities.is_active', true);
      
      if (error) {
        console.error('❌ שגיאה בשליפת חנויות פעילות:', error.message);
        return [];
      }
      
      return data ? [...new Set(data.map(s => s.store_id))] : [];
    } catch (err) {
      console.error('❌ חריגה בשליפת חנויות פעילות:', err.message);
      return [];
    }
  }

  async downloadFile(url, outputPath, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const writer = fs.createWriteStream(outputPath);
        const response = await axios({ 
          url, 
          method: 'GET', 
          responseType: 'stream', 
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        await streamPipeline(response.data, writer);
        return;
        
      } catch (e) {
        // ניקוי קובץ חלקי
        try { fs.unlinkSync(outputPath); } catch(cleanupErr) {}
        
        if (attempt === retries) {
          throw new Error(`נכשל בהורדה לאחר ${retries} ניסיונות: ${e.message}`);
        }
        
        console.log(`⚠️ ניסיון הורדה ${attempt} נכשל, מנסה שוב בעוד ${2 * attempt} שניות...`);
        await sleep(2000 * attempt);
      }
    }
  }

  // ✅ מנגנון הגנה מפני Decompression Bomb
  async decompressFile(input, output, maxSize = 500 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const source = fs.createReadStream(input);
      const destination = fs.createWriteStream(output);
      
      let totalSize = 0;
      let aborted = false;
      
      gunzip.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize && !aborted) {
          aborted = true;
          
          // עצירת חירום
          source.destroy();
          gunzip.destroy();
          destination.destroy();
          
          // ניקוי הקובץ החלקי
          try { fs.unlinkSync(output); } catch(e) {}
          
          reject(new Error(
            `Decompression bomb detected: ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds ${maxSize / 1024 / 1024}MB limit`
          ));
        }
      });
      
      streamPipeline(source, gunzip, destination)
        .then(() => {
          if (!aborted) {
            console.log(`📦 הקובץ חולץ בהצלחה: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
            resolve();
          }
        })
        .catch((err) => {
          if (!aborted) {
            reject(err);
          }
        });
    });
  }
}

module.exports = { BaseProvider, DOC_TYPES };