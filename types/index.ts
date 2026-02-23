// Shared TypeScript types for the Israeli Price Comparison app

export interface Item {
  id: number;
  barcode: string;
  name: string;
  unit_measure: string | null;
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
  // Extends Item with any basket-specific properties
}

export interface StoreComparisonItem {
  name: string;
  price: number;
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
