import { createClient } from "@supabase/supabase-js";
import { Item, Store, Price, StoreComparison } from "@/types";

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Search for products by name or barcode
 */
export async function searchProducts(query: string): Promise<Item[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
      .limit(20);

    if (error) {
      console.error("Search error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Search exception:", error);
    return [];
  }
}

/**
 * Get all stores
 */
export async function getStores(): Promise<Store[]> {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("chain_name");

    if (error) {
      console.error("Get stores error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Get stores exception:", error);
    return [];
  }
}

/**
 * Get price comparison for a basket of items
 * @param itemIds - Array of item IDs to compare
 * @param city - Optional city filter (e.g., 'Petah Tikva')
 */
export async function getPriceComparison(itemIds: number[], city?: string): Promise<StoreComparison[]> {
  try {
    // Get all prices for the basket items
    const { data: prices, error: pricesError } = await supabase
      .from("prices")
      .select(`
        item_id,
        price,
        store_id,
        stores (
          id,
          chain_name,
          branch_name
        ),
        items (
          name
        )
      `)
      .in("item_id", itemIds);

    if (pricesError) {
      console.error("Price comparison error:", pricesError);
      return [];
    }

    // Get all stores (filtered by city if provided)
    let storesQuery = supabase
      .from("stores")
      .select("*");
    
    if (city) {
      storesQuery = storesQuery.eq("city", city);
    }
    
    const { data: stores, error: storesError } = await storesQuery;

    if (storesError) {
      console.error("Get stores error:", storesError);
      return [];
    }

    if (!stores || !prices) return [];

    // Get all items to find missing ones
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("*")
      .in("id", itemIds);

    if (itemsError) {
      console.error("Get items error:", itemsError);
      return [];
    }

    // Calculate totals per store
    const comparisons: StoreComparison[] = stores.map((store) => {
      const storePrices = prices.filter((p: any) => p.store_id === store.id);
      const totalPrice = storePrices.reduce((sum: number, p: any) => sum + parseFloat(p.price), 0);

      // Find missing items
      const foundItemIds = storePrices.map((p: any) => p.item_id);
      const missingItemIds = itemIds.filter((id) => !foundItemIds.includes(id));

      // Get missing item names
      const missingItems = (items || [])
        .filter((item: any) => missingItemIds.includes(item.id))
        .map((item: any) => item.name);

      return {
        store_id: store.id,
        chain_name: store.chain_name,
        branch_name: store.branch_name,
        total_price: totalPrice,
        item_count: itemIds.length,
        missing_items: missingItems,
        is_complete: missingItems.length === 0,
      };
    });

    // Mark cheapest store (only among complete ones)
    const completeStores = comparisons.filter((c) => c.is_complete);
    if (completeStores.length > 0) {
      const cheapest = completeStores.reduce((prev, current) =>
        current.total_price < prev.total_price ? current : prev
      );

      comparisons.forEach((c) => {
        c.is_cheapest = c.store_id === cheapest.store_id && c.is_complete;
      });
    }

    return comparisons;
  } catch (error) {
    console.error("Price comparison exception:", error);
    return [];
  }
}

/**
 * Get detailed prices for an item across all stores
 */
export async function getItemPrices(itemId: number): Promise<Price[]> {
  try {
    const { data, error } = await supabase
      .from("prices")
      .select("*")
      .eq("item_id", itemId);

    if (error) {
      console.error("Get item prices error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Get item prices exception:", error);
    return [];
  }
}

/**
 * Get item by ID
 */
export async function getItemById(itemId: number): Promise<Item | null> {
  try {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (error) {
      console.error("Get item by ID error:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Get item by ID exception:", error);
    return null;
  }
}
