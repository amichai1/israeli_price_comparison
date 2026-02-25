import { createClient } from "@supabase/supabase-js";
import { Item, Store, Price, StoreComparison, ItemPromotion } from "@/types";

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * מציאת פריטים מקבילים לברקודים פנימיים (item_type=0)
 * פריטים תקניים (item_type=1) מוחזרים כמו שהם.
 * פריטים פנימיים מותאמים לפי normalized_name — מוצא את אותו מוצר ברשתות אחרות.
 */
async function resolveEquivalentItems(
  itemIds: number[]
): Promise<{ expandedIds: number[]; reverseMap: Map<number, number> }> {
  const reverseMap = new Map<number, number>(); // equivalent_id → original_id
  const expandedSet = new Set(itemIds);

  if (itemIds.length === 0) return { expandedIds: [], reverseMap };

  // שליפת item_type + normalized_name לכל הפריטים
  const { data: items, error } = await supabase
    .from("items")
    .select("id, item_type, normalized_name")
    .in("id", itemIds);

  if (error || !items) return { expandedIds: itemIds, reverseMap };

  // איתור פריטים פנימיים עם שם מנורמל
  const internalItems = items.filter(
    (i) => i.item_type === 0 && i.normalized_name && i.normalized_name.length > 0
  );

  if (internalItems.length === 0) return { expandedIds: itemIds, reverseMap };

  // חיפוש מקבילים לפי normalized_name
  const normalizedNames = [...new Set(internalItems.map((i) => i.normalized_name!))];
  const { data: equivalents, error: eqError } = await supabase
    .from("items")
    .select("id, normalized_name")
    .eq("item_type", 0)
    .in("normalized_name", normalizedNames);

  if (eqError || !equivalents) return { expandedIds: itemIds, reverseMap };

  // בניית מיפוי normalized_name → original_id
  const nameToOriginal = new Map<string, number>();
  for (const item of internalItems) {
    nameToOriginal.set(item.normalized_name!, item.id);
  }

  // הרחבת הרשימה + מיפוי הפוך
  for (const eq of equivalents) {
    const originalId = nameToOriginal.get(eq.normalized_name!);
    if (originalId === undefined) continue;
    if (eq.id === originalId) continue; // לא צריך למפות את עצמו
    expandedSet.add(eq.id);
    reverseMap.set(eq.id, originalId);
  }

  return { expandedIds: Array.from(expandedSet), reverseMap };
}

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
 * reverseMap — מיפוי פריט מקביל → פריט מקורי (לברקודים פנימיים)
 */
async function getActivePromotionsForItems(
  itemIds: number[],
  reverseMap?: Map<number, number>
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
    // מיפוי חזרה ל-ID המקורי אם יש reverseMap
    const originalId = reverseMap?.get(row.item_id) ?? row.item_id;
    const key = `${promo.store_id}_${originalId}`;
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
    // התאמת ברקודים פנימיים — הרחבת רשימת הפריטים לכלול מקבילים מרשתות אחרות
    const { expandedIds, reverseMap } = await resolveEquivalentItems(itemIds);

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
      .in("item_id", expandedIds);

    if (cityId) {
      query = query.eq("stores.city_id", cityId);
    }

    const { data: prices, error: pricesError } = await query;

    if (pricesError) {
      console.error("Price comparison error:", pricesError);
      return [];
    }

    if (!prices || prices.length === 0) return [];

    // קיבוץ prices לפי store — מיפוי מקבילים חזרה ל-original_id
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
      // מיפוי חזרה: אם זה פריט מקביל, מחזירים אותו ל-ID המקורי
      const originalId = reverseMap.get(p.item_id) ?? p.item_id;
      storeMap.get(sid)!.prices.push({ item_id: originalId, price: parseFloat(p.price) });
    }

    // דדופליקציה: אם חנות מחזירה מספר מקבילים לאותו פריט — שומרים את הזול
    for (const store of storeMap.values()) {
      const bestByItem = new Map<number, { item_id: number; price: number }>();
      for (const p of store.prices) {
        const existing = bestByItem.get(p.item_id);
        if (!existing || p.price < existing.price) {
          bestByItem.set(p.item_id, p);
        }
      }
      store.prices = Array.from(bestByItem.values());
    }

    // שמות הפריטים למציאת חסרים
    const itemNameMap = new Map<number, string>();
    for (const p of prices as any[]) {
      const originalId = reverseMap.get(p.item_id) ?? p.item_id;
      if (p.items?.name && !itemNameMap.has(originalId)) {
        itemNameMap.set(originalId, p.items.name);
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

    // שליפת מבצעים פעילים (כולל מקבילים)
    const promotionsMap = await getActivePromotionsForItems(expandedIds, reverseMap);

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
