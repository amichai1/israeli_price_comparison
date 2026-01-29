import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getPriceComparison } from '../lib/supabase-service';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials in environment variables. ' +
    'Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe('City Selection and Filtering', () => {
  let petahTikvaStores: any[] = [];
  let allStores: any[] = [];
  let sampleItemIds: number[] = [];

  beforeAll(async () => {
    // Get all stores
    const { data: stores } = await supabase
      .from('stores')
      .select('*');
    allStores = stores || [];

    // Get Petah Tikva stores
    const { data: ptStores } = await supabase
      .from('stores')
      .select('*')
      .eq('city', 'Petah Tikva');
    petahTikvaStores = ptStores || [];

    // Get some sample items
    const { data: items } = await supabase
      .from('items')
      .select('id')
      .limit(5);
    sampleItemIds = (items || []).map((item: any) => item.id);
  });

  it('should have Petah Tikva stores in database', () => {
    expect(petahTikvaStores.length).toBeGreaterThan(0);
    expect(petahTikvaStores.length).toBe(4); // Rami Levy, Osher Ad, Yohananof, Shufersal
  });

  it('should have correct store IDs for Petah Tikva', () => {
    const ramiLevy = petahTikvaStores.find(s => s.chain_name === 'Rami Levy');
    const osherAd = petahTikvaStores.find(s => s.chain_name === 'Osher Ad');
    const yohananof = petahTikvaStores.find(s => s.chain_name === 'Yohananof');
    const shufersal = petahTikvaStores.find(s => s.chain_name === 'Shufersal');

    expect(ramiLevy?.store_id).toBe('71');
    expect(osherAd?.store_id).toBe('1290');
    expect(yohananof?.store_id).toBe('1776');
    expect(shufersal?.store_id).toBe('269');
  });

  it('should filter price comparison by city', async () => {
    if (sampleItemIds.length === 0) {
      console.log('No sample items found, skipping test');
      return;
    }

    // Get comparison for Petah Tikva
    const petahTikvaComparison = await getPriceComparison(sampleItemIds, 'Petah Tikva');

    // All stores in comparison should be from Petah Tikva
    petahTikvaComparison.forEach(comparison => {
      const store = petahTikvaStores.find(s => s.id === comparison.store_id);
      expect(store).toBeDefined();
      expect(store?.city).toBe('Petah Tikva');
    });

    // Should only have 4 stores (Petah Tikva stores)
    expect(petahTikvaComparison.length).toBeLessThanOrEqual(4);
  });

  it('should return all stores when no city filter is provided', async () => {
    if (sampleItemIds.length === 0) {
      console.log('No sample items found, skipping test');
      return;
    }

    // Get comparison without city filter
    const allComparison = await getPriceComparison(sampleItemIds);

    // Should have more stores than just Petah Tikva
    expect(allComparison.length).toBeGreaterThanOrEqual(petahTikvaStores.length);
  });

  it('should correctly identify cheapest store in Petah Tikva', async () => {
    if (sampleItemIds.length === 0) {
      console.log('No sample items found, skipping test');
      return;
    }

    const comparison = await getPriceComparison(sampleItemIds, 'Petah Tikva');

    // Find complete stores (all items available)
    const completeStores = comparison.filter(c => c.is_complete);

    if (completeStores.length > 0) {
      // Should have exactly one cheapest store
      const cheapestStores = comparison.filter(c => c.is_cheapest);
      expect(cheapestStores.length).toBe(1);

      // Cheapest store should be complete
      expect(cheapestStores[0].is_complete).toBe(true);

      // Cheapest store should have lowest price among complete stores
      const cheapestPrice = cheapestStores[0].total_price;
      completeStores.forEach(store => {
        expect(cheapestPrice).toBeLessThanOrEqual(store.total_price);
      });
    }
  });

  it('should handle missing items correctly', async () => {
    if (sampleItemIds.length === 0) {
      console.log('No sample items found, skipping test');
      return;
    }

    const comparison = await getPriceComparison(sampleItemIds, 'Petah Tikva');

    comparison.forEach(store => {
      if (!store.is_complete) {
        // Incomplete stores should have missing items
        expect(store.missing_items.length).toBeGreaterThan(0);
        
        // Should not be marked as cheapest
        expect(store.is_cheapest).toBeFalsy();
      }
    });
  });
});
