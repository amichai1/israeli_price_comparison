// scraper/processors/StoreProcessor.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const BaseProcessor = require('../core/BaseProcessor');

class StoreProcessor extends BaseProcessor {
  constructor(supabase, config) {
    super(supabase, config);
    this.citiesMap = new Map();
  }

  async process(filePath, metadata) {
    await this.loadCitiesMap();
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const xml = new XmlStream(stream);
      let buffer = [];

      // ✅ FIXED: הגדרת handleNode לפני השימוש בו
      const handleNode = async (node) => {
        const normalized = this.normalize(node);
        if (normalized) buffer.push(normalized);
        
        if (buffer.length >= 500) {
          xml.pause();
          try {
            await this.saveBatch(buffer, 'stores', 'chain_id, store_id');
            buffer = [];
          } catch (e) {
            console.error('❌ Error saving stores chunk:', e.message);
            xml.destroy(); // ✅ עוצר stream
            reject(e);
            return;
          }
          xml.resume();
        }
      };

      // עכשיו אפשר להשתמש בו
      xml.on('endElement: Store', handleNode);
      xml.on('endElement: Branch', handleNode);

      xml.on('end', async () => {
        if (buffer.length > 0) {
          try {
            await this.saveBatch(buffer, 'stores', 'chain_id, store_id');
          } catch (e) {
            console.error('❌ Error saving final stores chunk:', e.message);
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

  async loadCitiesMap() {
    if (this.citiesMap.size > 0) return;
    
    const { data, error } = await this.supabase
      .from('cities')
      .select('id, name');
    
    if (error) {
      console.error('❌ Error loading cities:', error.message);
      throw error;
    }
    
    if (data) {
      data.forEach(c => this.citiesMap.set(c.name.trim(), c.id));
    }
  }

  normalize(node) {
    const storeId = node.StoreId || node.BranchId || node.ID;
    const storeName = node.StoreName || node.BranchName || node.Name;
    let cityName = node.City || node.CityName || '';
    
    if (!storeId || !storeName) return null;

    // לוגיקת אינטרנט
    if (!cityName || cityName.trim() === '') {
      if (storeName.toLowerCase().includes('אינטרנט') || 
          storeName.toLowerCase().includes('אונליין')) {
        cityName = 'Internet';
      } else {
        return null; 
      }
    }

    const cityId = this.citiesMap.get(cityName.trim());
    if (!cityId) {
      // ✅ NEW: לוג למעקב אחר ערים חסרות
      console.warn(`⚠️ Unknown city: ${cityName.trim()} (store: ${storeId})`);
      return null;
    }

    return {
      chain_id: this.config.id,
      store_id: storeId.toString(),
      branch_name: storeName.trim(),
      address: node.Address || '',
      city_id: cityId,
      sub_chain_id: node.SubChainId || '0'
    };
  }
}

module.exports = StoreProcessor;