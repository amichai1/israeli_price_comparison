# Supabase Setup Guide

This guide explains how to connect the mobile app to your Supabase database.

## Prerequisites

1. A Supabase account at [supabase.com](https://supabase.com)
2. A Supabase project created
3. Database schema already set up (see `database/schema.sql`)

## Step 1: Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)

## Step 2: Configure Environment Variables

The app currently uses mock data for development. To connect to real Supabase:

### Option A: Using Environment Variables (Recommended)

1. Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

2. The app will automatically use these values when available.

### Option B: Direct Configuration

Edit `lib/supabase-service.ts` and replace the configuration:

```typescript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key-here";
```

## Step 3: Install Supabase Client

The Supabase JavaScript client is not yet installed. To add it:

```bash
npm install @supabase/supabase-js
```

Or with pnpm:

```bash
pnpm add @supabase/supabase-js
```

## Step 4: Update API Service

Once Supabase is configured, update `lib/supabase-service.ts` to use real Supabase queries instead of mock data.

### Example: Real Search Implementation

Replace the mock `searchProducts` function with:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function searchProducts(query: string): Promise<Item[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return data || [];
}
```

### Example: Real Price Comparison

Replace the mock `getPriceComparison` function with:

```typescript
export async function getPriceComparison(itemIds: number[]): Promise<StoreComparison[]> {
  // Get all prices for the basket items
  const { data: prices, error } = await supabase
    .from('prices')
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
    .in('item_id', itemIds);

  if (error) {
    console.error('Price comparison error:', error);
    return [];
  }

  // Get all stores
  const { data: stores } = await supabase
    .from('stores')
    .select('*');

  if (!stores || !prices) return [];

  // Calculate totals per store
  const comparisons: StoreComparison[] = stores.map((store) => {
    const storePrices = prices.filter((p) => p.store_id === store.id);
    const totalPrice = storePrices.reduce((sum, p) => sum + p.price, 0);
    
    // Find missing items
    const foundItemIds = storePrices.map((p) => p.item_id);
    const missingItemIds = itemIds.filter((id) => !foundItemIds.includes(id));
    
    // Get missing item names
    const missingItems = prices
      .filter((p) => missingItemIds.includes(p.item_id))
      .map((p) => p.items.name)
      .filter((name, index, self) => self.indexOf(name) === index);

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

  // Mark cheapest store
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
}
```

## Step 5: Test the Connection

1. Ensure your Supabase database has data (run the scraper or insert test data)
2. Restart the Expo dev server
3. Test the search functionality
4. Add items to basket and test price comparison

## Troubleshooting

### "No results found"

- Check if your database has data in the `items` table
- Verify the Supabase URL and API key are correct
- Check browser/app console for error messages

### "Connection failed"

- Ensure your Supabase project is active
- Check if your IP is allowed (Supabase dashboard → Settings → Database)
- Verify the API key has the correct permissions

### "Missing items in comparison"

- Check if the `prices` table has data for all stores
- Run the scraper to populate price data
- Verify foreign key relationships are correct

## Row Level Security (RLS)

For production, enable RLS policies as described in `database/README.md`:

1. Enable RLS on all tables
2. Allow public read access
3. Restrict write access to service role only

This ensures:
- Mobile app can read data (search, comparison)
- Only the scraper can write data (via service role key)
- User data is protected

## Next Steps

1. Run the scraper to populate the database with real data
2. Update `lib/supabase-service.ts` to use real Supabase queries
3. Test all app features with live data
4. Enable RLS policies for production
5. Monitor query performance and optimize as needed

## Current Status

**The app currently uses mock data for demonstration purposes.** This allows you to test the UI and functionality without setting up Supabase first. Once you're ready to use real data, follow the steps above to connect to your Supabase database.
