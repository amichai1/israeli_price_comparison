// Shared TypeScript types for the Israeli Price Comparison app

export interface Item {
  id: number;
  barcode: string;
  name: string;
  unit_measure: string | null;
  manufacturer_name?: string;
  item_type?: number;                    // 0=ברקוד פנימי, 1=ברקוד תקני (EAN)
  is_weighted?: boolean;
  quantity?: number | null;
  unit_qty?: string;
  qty_in_package?: number;
  unit_of_measure_price?: number | null;
  normalized_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Store {
  id: number;
  chain_id: number;
  city_id: number;
  branch_name: string | null;
  address?: string | null;
  store_id?: string;
  sub_chain_id?: string;
  chains?: { name: string };
  cities?: { name: string };
}

export interface Price {
  id: number;
  item_id: number;
  store_id: number;
  price: number;
  last_updated: string;
}

export interface BasketItem extends Item {
  quantity: number;
}

export interface ItemPromotion {
  description: string;
  club_id: string;          // '0' = כולם, אחר = מועדון
  min_qty: number;
  reward_type: string;      // '1' = הנחה, '2' = מתנה
  discount_rate: number;
  discounted_price: number;
}

export interface StoreComparisonItem {
  name: string;
  item_id: number;
  price: number;            // מחיר סופי (אחרי מבצע אם רלוונטי)
  quantity: number;
  line_total: number;       // price × quantity
  promotion?: ItemPromotion; // המבצע שהוחל (אם יש)
}

export interface StoreComparison {
  store_id: number;
  chain_name: string;
  branch_name: string | null;
  total_price: number;
  item_count: number;
  available_items: StoreComparisonItem[];
  missing_items: string[];
  is_complete: boolean;
  is_cheapest?: boolean;
}

export interface PriceDetail {
  item_id: number;
  item_name: string;
  barcode: string;
  price: number | null;
  available: boolean;
}

export interface ComparisonResult {
  stores: StoreComparison[];
  cheapest_store_id: number | null;
  last_updated: string;
}
