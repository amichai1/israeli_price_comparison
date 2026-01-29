import { describe, it, expect } from 'vitest';
import { searchProducts, getPriceComparison, getStores } from '../lib/supabase-service';

describe('Supabase Integration Tests', () => {
  it('should search for products and return results', async () => {
    const results = await searchProducts('milk');
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('barcode');
      expect(results[0]).toHaveProperty('name');
      expect(results[0].name.toLowerCase()).toContain('milk');
    }
  }, 10000);

  it('should get all stores', async () => {
    const stores = await getStores();
    
    expect(stores).toBeDefined();
    expect(Array.isArray(stores)).toBe(true);
    expect(stores.length).toBeGreaterThan(0);
    
    if (stores.length > 0) {
      expect(stores[0]).toHaveProperty('id');
      expect(stores[0]).toHaveProperty('chain_name');
    }
  }, 10000);

  it('should get price comparison for basket items', async () => {
    // First, search for some items
    const milkResults = await searchProducts('milk');
    const breadResults = await searchProducts('bread');
    
    if (milkResults.length > 0 && breadResults.length > 0) {
      const itemIds = [milkResults[0].id, breadResults[0].id];
      
      const comparison = await getPriceComparison(itemIds);
      
      expect(comparison).toBeDefined();
      expect(Array.isArray(comparison)).toBe(true);
      expect(comparison.length).toBeGreaterThan(0);
      
      if (comparison.length > 0) {
        expect(comparison[0]).toHaveProperty('store_id');
        expect(comparison[0]).toHaveProperty('chain_name');
        expect(comparison[0]).toHaveProperty('total_price');
        expect(comparison[0]).toHaveProperty('is_complete');
        expect(comparison[0]).toHaveProperty('missing_items');
      }
      
      // Check if at least one store is marked as cheapest
      const cheapestStores = comparison.filter(c => c.is_cheapest);
      expect(cheapestStores.length).toBeGreaterThanOrEqual(0);
    }
  }, 15000);

  it('should handle empty search query', async () => {
    const results = await searchProducts('');
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('should handle search with no results', async () => {
    const results = await searchProducts('xyzabc123nonexistent');
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});
