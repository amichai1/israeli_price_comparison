import { createClient } from "@supabase/supabase-js";
import { Item, Store, Price, StoreComparison, ItemPromotion } from "@/types";

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
      .eq("is_active", true)
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
 * שליפת מבצעים פעילים עבור רשימת פריטים
 * מחזירה Map עם מפתח "storeId_itemId" ומערך מבצעים
 */
async function getActivePromotionsForItems(
  itemIds: number[]
): Promise<Map<string, ItemPromotion[]>> {
  const result = new Map<string, ItemPromotion[]>();
  if (itemIds.length === 0) return result;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("promotion_items")
    .select(`
      item_id, min_qty, discount_rate, discounted_price, reward_type,
      promotions!inner (store_id, description, club_id, min_qty, start_date, end_date)
    `)
    .in("item_id", itemIds)
    .gte("promotions.end_date", now)
    .lte("promotions.start_date", now);

  if (error || !data) {
    console.error("Promotions fetch error:", error);
    return result;
  }

  for (const row of data as any[]) {
    const promo = row.promotions;
    const key = `${promo.store_id}_${row.item_id}`;
    const promoItem: ItemPromotion = {
      description: promo.description || "",
      club_id: promo.club_id || "0",
      min_qty: row.min_qty || promo.min_qty || 1,
      reward_type: row.reward_type || "1",
      discount_rate: row.discount_rate || 0,
      discounted_price: row.discounted_price || 0,
    };
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key)!.push(promoItem);
  }

  return result;
}

/**
 * חישוב מחיר אפקטיבי ליחידה לפי מבצע
 */
function calculateEffectivePrice(
  promo: ItemPromotion,
  quantity: number,
  regularPrice: number
): number {
  // מתנה — אין השפעה על מחיר
  if (promo.reward_type === "2") return regularPrice;

  // מבצע כמות (min_qty > 1)
  if (promo.min_qty > 1) {
    if (quantity < promo.min_qty) return regularPrice;

    const bundles = Math.floor(quantity / promo.min_qty);
    const remainder = quantity % promo.min_qty;

    let bundleUnitPrice = regularPrice;
    if (promo.discounted_price > 0) {
      // מחיר חבילה (למשל "2 ב-10₪")
      bundleUnitPrice = promo.discounted_price / promo.min_qty;
    } else if (promo.discount_rate > 0) {
      bundleUnitPrice = regularPrice - promo.discount_rate / promo.min_qty;
    }

    const total = bundles * promo.min_qty * bundleUnitPrice + remainder * regularPrice;
    return total / quantity;
  }

  // הנחה רגילה (min_qty ≤ 1)
  if (promo.discounted_price > 0) return promo.discounted_price;
  if (promo.discount_rate > 0) return Math.max(0, regularPrice - promo.discount_rate);

  return regularPrice;
}

/**
 * בחירת המבצע הטוב ביותר (מחיר נמוך ביותר)
 */
function selectBestPromotion(
  promos: ItemPromotion[],
  quantity: number,
  regularPrice: number
): { price: number; promotion?: ItemPromotion } {
  let bestPrice = regularPrice;
  let bestPromo: ItemPromotion | undefined;

  for (const promo of promos) {
    const effective = calculateEffectivePrice(promo, quantity, regularPrice);
    if (effective < bestPrice) {
      bestPrice = effective;
      bestPromo = promo;
    }
  }

  return { price: bestPrice, promotion: bestPromo };
}

/**
 * Get price comparison for a basket of items
 * @param itemIds - Array of item IDs to compare
 * @param cityId - Optional city ID filter
 * @param quantities - Optional map of itemId → quantity
 */
export async function getPriceComparison(
  itemIds: number[],
  cityId?: number,
  quantities?: Map<number, number>
): Promise<StoreComparison[]> {
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

    // שליפת מבצעים פעילים
    const promotionsMap = await getActivePromotionsForItems(itemIds);

    // בניית StoreComparison מכל store
    const comparisons: StoreComparison[] = Array.from(storeMap.values()).map((store) => {
      const foundItemIds = store.prices.map((p) => p.item_id);
      const missingItemIds = itemIds.filter((id) => !foundItemIds.includes(id));
      const missingItems = missingItemIds.map((id) => itemNameMap.get(id) || `Item ${id}`);

      const availableItems = store.prices.map((p) => {
        const qty = quantities?.get(p.item_id) ?? 1;
        const promoKey = `${store.store_id}_${p.item_id}`;
        const promos = promotionsMap.get(promoKey) || [];

        let finalPrice = p.price;
        let appliedPromo: ItemPromotion | undefined;

        if (promos.length > 0) {
          const best = selectBestPromotion(promos, qty, p.price);
          finalPrice = best.price;
          appliedPromo = best.promotion;
        }

        return {
          name: itemNameMap.get(p.item_id) || `Item ${p.item_id}`,
          item_id: p.item_id,
          price: finalPrice,
          quantity: qty,
          line_total: finalPrice * qty,
          promotion: appliedPromo,
        };
      });

      const totalPrice = availableItems.reduce((sum, item) => sum + item.line_total, 0);

      return {
        store_id: store.store_id,
        chain_name: store.chain_name,
        branch_name: store.branch_name,
        total_price: totalPrice,
        item_count: itemIds.length,
        available_items: availableItems,
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
