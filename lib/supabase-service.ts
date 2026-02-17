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
 * Get all cities from the database
 */
export async function getCities(): Promise<{ id: number; name: string }[]> {
  try {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Get cities error:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Get cities exception:", error);
    return [];
  }
}

/**
 * Get all stores with chain and city names
 */
export async function getStores(): Promise<Store[]> {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*, chains(name), cities(name)")
      .order("branch_name");

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
 * @param cityId - Optional city ID filter
 */
export async function getPriceComparison(itemIds: number[], cityId?: number): Promise<StoreComparison[]> {
  try {
    // שאילתת prices עם join לחנויות, רשתות וערים
    let query = supabase
      .from("prices")
      .select(`
        item_id,
        price,
        store_id,
        stores!inner (
          id,
          branch_name,
          chain_id,
          city_id,
          chains (name),
          cities (name)
        ),
        items (name)
      `)
      .in("item_id", itemIds);

    if (cityId) {
      query = query.eq("stores.city_id", cityId);
    }

    const { data: prices, error: pricesError } = await query;

    if (pricesError) {
      console.error("Price comparison error:", pricesError);
      return [];
    }

    if (!prices || prices.length === 0) return [];

    // קיבוץ prices לפי store
    const storeMap = new Map<number, {
      store_id: number;
      chain_name: string;
      branch_name: string | null;
      prices: { item_id: number; price: number }[];
    }>();

    for (const p of prices as any[]) {
      const sid = p.store_id;
      if (!storeMap.has(sid)) {
        storeMap.set(sid, {
          store_id: p.stores.id,
          chain_name: p.stores.chains?.name || '',
          branch_name: p.stores.branch_name,
          prices: [],
        });
      }
      storeMap.get(sid)!.prices.push({ item_id: p.item_id, price: parseFloat(p.price) });
    }

    // שמות הפריטים למציאת חסרים
    const itemNameMap = new Map<number, string>();
    for (const p of prices as any[]) {
      if (p.items?.name && !itemNameMap.has(p.item_id)) {
        itemNameMap.set(p.item_id, p.items.name);
      }
    }
    // אם יש פריטים שלא נמצאו ב-prices, נביא אותם בנפרד
    const missingNameIds = itemIds.filter((id) => !itemNameMap.has(id));
    if (missingNameIds.length > 0) {
      const { data: missingItems } = await supabase
        .from("items")
        .select("id, name")
        .in("id", missingNameIds);
      for (const item of missingItems || []) {
        itemNameMap.set(item.id, item.name);
      }
    }

    // בניית StoreComparison מכל store
    const comparisons: StoreComparison[] = Array.from(storeMap.values()).map((store) => {
      const totalPrice = store.prices.reduce((sum, p) => sum + p.price, 0);
      const foundItemIds = store.prices.map((p) => p.item_id);
      const missingItemIds = itemIds.filter((id) => !foundItemIds.includes(id));
      const missingItems = missingItemIds.map((id) => itemNameMap.get(id) || `Item ${id}`);

      return {
        store_id: store.store_id,
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
