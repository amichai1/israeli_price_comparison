// scraper/core/BaseProcessor.js
class BaseProcessor {
  constructor(supabase, config) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * הפונקציה הראשית שכל מעבד חייב לממש
   * @param {string} filePath - נתיב לקובץ ה-XML המקומי
   * @param {Object} metadata - מידע נוסף (כמו storeId חיצוני, או docType)
   */
  async process(filePath, metadata) {
    throw new Error("Method 'process' must be implemented by child class");
  }

  /**
   * לוגיקה משותפת לשמירה ב-Batch
   */
  async saveBatch(items, tableName, conflictColumns) {
    const CHUNK_SIZE = 1000;
    
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      
      const { error } = await this.supabase
        .from(tableName)
        .upsert(chunk, { onConflict: conflictColumns });
      
      if (error) {
        console.error(`⚠️ Error saving batch to ${tableName}:`, error.message);
        throw error;
      }
    }
  }
}

module.exports = BaseProcessor;