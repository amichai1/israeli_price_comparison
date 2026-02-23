import AsyncStorage from "@react-native-async-storage/async-storage";
import { BasketItem } from "@/types";

const BASKET_KEY = "@price_compare_basket";

/**
 * Get all items in the basket
 */
export async function getBasket(): Promise<BasketItem[]> {
  try {
    const data = await AsyncStorage.getItem(BASKET_KEY);
    if (data) {
      const items = JSON.parse(data) as BasketItem[];
      // backward compat: פריטים ישנים בלי quantity
      return items.map((item) => ({ ...item, quantity: item.quantity ?? 1 }));
    }
    return [];
  } catch (error) {
    console.error("Error loading basket:", error);
    return [];
  }
}

/**
 * Add an item to the basket
 */
export async function addToBasket(item: BasketItem): Promise<void> {
  try {
    const basket = await getBasket();

    // Check if item already exists
    const exists = basket.some((i) => i.id === item.id);
    if (exists) {
      console.log("Item already in basket");
      return;
    }

    basket.push({ ...item, quantity: item.quantity ?? 1 });
    await AsyncStorage.setItem(BASKET_KEY, JSON.stringify(basket));
  } catch (error) {
    console.error("Error adding to basket:", error);
    throw error;
  }
}

/**
 * Update quantity of a basket item
 */
export async function updateBasketQuantity(itemId: number, quantity: number): Promise<void> {
  try {
    const basket = await getBasket();
    const updated = basket.map((item) =>
      item.id === itemId ? { ...item, quantity } : item
    );
    await AsyncStorage.setItem(BASKET_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error updating basket quantity:", error);
    throw error;
  }
}

/**
 * Remove an item from the basket
 */
export async function removeFromBasket(itemId: number): Promise<void> {
  try {
    const basket = await getBasket();
    const filtered = basket.filter((i) => i.id !== itemId);
    await AsyncStorage.setItem(BASKET_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing from basket:", error);
    throw error;
  }
}

/**
 * Clear all items from the basket
 */
export async function clearBasket(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BASKET_KEY);
  } catch (error) {
    console.error("Error clearing basket:", error);
    throw error;
  }
}

/**
 * Get basket item count
 */
export async function getBasketCount(): Promise<number> {
  try {
    const basket = await getBasket();
    return basket.length;
  } catch (error) {
    console.error("Error getting basket count:", error);
    return 0;
  }
}

/**
 * Check if an item is in the basket
 */
export async function isInBasket(itemId: number): Promise<boolean> {
  try {
    const basket = await getBasket();
    return basket.some((i) => i.id === itemId);
  } catch (error) {
    console.error("Error checking basket:", error);
    return false;
  }
}
