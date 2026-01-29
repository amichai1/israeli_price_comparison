# Database Setup Guide

This document explains how to set up the Supabase database for the Israeli Supermarket Price Comparison app.

## Overview

The application uses **Supabase** (PostgreSQL) as the backend database to store product information, store details, and price data from Israeli supermarket chains.

## Database Schema

The database consists of three main tables:

### 1. Items Table

Stores product information with unique barcodes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `barcode` | VARCHAR(50) | Unique product barcode (EAN-13, etc.) |
| `name` | VARCHAR(255) | Product name |
| `unit_measure` | VARCHAR(50) | Unit of measurement (kg, liter, piece, etc.) |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_items_barcode` on `barcode` for fast lookups
- `idx_items_name` on `name` for search functionality

### 2. Stores Table

Stores supermarket chain and branch information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `chain_name` | VARCHAR(100) | Supermarket chain name (Rami Levy, Osher Ad, etc.) |
| `branch_name` | VARCHAR(255) | Specific branch name |
| `city` | VARCHAR(100) | City location |
| `address` | TEXT | Full address (optional) |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_stores_chain_name` on `chain_name` for filtering
- `idx_stores_city` on `city` for location-based queries

### 3. Prices Table

Stores price information for items at specific stores.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `item_id` | INTEGER | Foreign key to `items.id` |
| `store_id` | INTEGER | Foreign key to `stores.id` |
| `price` | DECIMAL(10, 2) | Price in Israeli Shekels (₪) |
| `last_updated` | TIMESTAMP | When this price was last updated |

**Constraints:**
- `UNIQUE(item_id, store_id)` - One price per item per store
- Foreign key cascades on delete

**Indexes:**
- `idx_prices_item_id` on `item_id` for fast price lookups
- `idx_prices_store_id` on `store_id` for store-based queries
- `idx_prices_item_store` composite index for efficient price comparison
- `idx_prices_last_updated` for freshness checks

## Views

### cheapest_prices

Returns the cheapest price for each item across all stores.

```sql
SELECT * FROM cheapest_prices WHERE barcode = '7290000000000';
```

### price_comparison

Returns all prices for all items across all stores, useful for comparison tables.

```sql
SELECT * FROM price_comparison WHERE item_id = 123;
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

### 2. Run Schema Migration

1. Open the Supabase SQL Editor
2. Copy the contents of `schema.sql`
3. Execute the SQL script
4. Verify tables are created in the Table Editor

### 3. Configure Environment Variables

Add these to your app's environment configuration:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Note:** The service role key is only needed for the scraper (server-side). The mobile app uses the anon key.

### 4. Enable Row Level Security (Optional)

For production deployments, enable RLS policies:

```sql
-- Enable RLS on all tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read on items" ON items FOR SELECT USING (true);
CREATE POLICY "Allow public read on stores" ON stores FOR SELECT USING (true);
CREATE POLICY "Allow public read on prices" ON prices FOR SELECT USING (true);

-- Restrict write access to service role only
CREATE POLICY "Service role only for items" ON items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only for stores" ON stores FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only for prices" ON prices FOR ALL USING (auth.role() = 'service_role');
```

## Sample Data

The schema includes sample stores for the four major Israeli chains:

- **Rami Levy** - Jerusalem Center
- **Osher Ad** - Tel Aviv
- **Yohananof** - Haifa
- **Shufersal** - Deal Ramat Gan

## API Usage Examples

### Search Products

```typescript
const { data, error } = await supabase
  .from('items')
  .select('*')
  .ilike('name', `%${searchQuery}%`)
  .limit(20);
```

### Get Price Comparison for Basket

```typescript
const itemIds = [1, 2, 3, 4, 5]; // Basket item IDs

const { data, error } = await supabase
  .from('prices')
  .select(`
    item_id,
    price,
    store_id,
    stores (
      chain_name,
      branch_name
    ),
    items (
      name,
      barcode
    )
  `)
  .in('item_id', itemIds);
```

### Get Cheapest Store for Basket

```typescript
// Group prices by store and calculate totals
const { data, error } = await supabase
  .rpc('calculate_basket_totals', {
    item_ids: [1, 2, 3, 4, 5]
  });
```

**Note:** You'll need to create a custom PostgreSQL function for basket total calculations.

## Maintenance

### Update Prices

Prices are updated by the scraper service. The `last_updated` timestamp tracks freshness.

### Clean Old Data

Optionally, set up a cron job to remove stale prices:

```sql
DELETE FROM prices WHERE last_updated < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Connection Issues

- Verify your Supabase URL and API keys
- Check if your IP is allowed (Supabase dashboard → Settings → Database)
- Ensure SSL mode is enabled for connections

### Slow Queries

- Check if indexes are created properly
- Use `EXPLAIN ANALYZE` to identify bottlenecks
- Consider adding composite indexes for common query patterns

### Data Inconsistencies

- Verify foreign key constraints are working
- Check for orphaned records
- Run data validation queries regularly

## Next Steps

1. Set up the scraper to populate product and price data
2. Configure Supabase client in the mobile app
3. Implement API service functions for search and comparison
4. Test with real data from Israeli supermarket chains
