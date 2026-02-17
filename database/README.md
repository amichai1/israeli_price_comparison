# Database Setup Guide

This document explains the Supabase (PostgreSQL) database structure for the Israeli Supermarket Price Comparison app.

## Overview

The database stores product information, store details, price data, and promotions from Israeli supermarket chains. All tables are defined in `schema.sql` — it is the single source of truth for the DB schema.

## Tables

### 1. cities

Manages scan regions. Each city has an optional CBS code (`cbs_code`) used to match city names from Cerberus XML files.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (identity) | Primary key |
| `name` | TEXT | City name (unique) |
| `cbs_code` | TEXT | CBS code (nullable — NULL for virtual cities like "Internet") |
| `is_active` | BOOLEAN | Whether to scan this city |
| `created_at` | TIMESTAMPTZ | Record creation time |

### 2. chains

Scraper configuration per chain — credentials, platform type, and portal URL.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (identity) | Primary key |
| `name` | TEXT | Chain name (e.g. Rami Levy) |
| `chain_code` | TEXT | Official chain code (unique) |
| `scraper_type` | TEXT | Platform type: cerberus, shufersal, etc. |
| `username` | TEXT | Portal username (nullable) |
| `base_url` | TEXT | Portal URL |
| `created_at` | TIMESTAMPTZ | Record creation time |

### 3. stores

Branch information, linked to a chain and city via foreign keys.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `chain_id` | BIGINT (FK) | References `chains.id` |
| `city_id` | BIGINT (FK) | References `cities.id` |
| `branch_name` | VARCHAR | Branch name |
| `address` | TEXT | Full address |
| `sub_chain_id` | TEXT | Sub-chain code |
| `store_id` | TEXT | Store identifier from source file |
| `raw_city_name` | TEXT | Original city name from source |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Constraints:** `UNIQUE(chain_id, store_id)`
**Indexes:** `idx_stores_lookup` on `(chain_id, city_id)`

### 4. items

Product catalog with unique barcodes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `barcode` | VARCHAR(50) | Unique product barcode |
| `name` | VARCHAR(255) | Product name |
| `unit_measure` | VARCHAR(50) | Unit of measurement |
| `manufacturer_name` | TEXT | Manufacturer name |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

### 5. prices

Price per item per store. Updated by the scraper.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `item_id` | INTEGER (FK) | References `items.id` |
| `store_id` | INTEGER (FK) | References `stores.id` |
| `price` | DECIMAL(10,2) | Price in NIS |
| `last_updated` | TIMESTAMP | When this price was last seen |

**Constraints:** `UNIQUE(item_id, store_id)`

### 6. promotions

Promotions per store. The same `promotion_id` can appear across multiple stores.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (identity) | Primary key |
| `store_id` | BIGINT (FK) | References `stores.id` |
| `promotion_id` | TEXT | Promotion ID from XML |
| `description` | TEXT | Promotion description |
| `start_date` | TIMESTAMPTZ | Start date |
| `end_date` | TIMESTAMPTZ | End date |
| `club_id` | TEXT | "0" = everyone, other = club members |
| `min_qty` | INTEGER | Minimum quantity |
| `allow_multiple` | BOOLEAN | Allow multiple discounts |
| `last_updated` | TIMESTAMPTZ | Last update time |

**Constraints:** `UNIQUE(store_id, promotion_id)`

### 7. promotion_items

Links promotions to items with discount details.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (identity) | Primary key |
| `promotion_id` | BIGINT (FK) | References `promotions.id` |
| `item_id` | BIGINT (FK) | References `items.id` |
| `group_id` | TEXT | Group ID from XML |
| `reward_type` | TEXT | "1" = discount, "2" = gift |
| `min_qty` | REAL | Minimum quantity to purchase |
| `discount_rate` | REAL | Discount amount in NIS |
| `discounted_price` | REAL | Price after discount |
| `is_weighted` | BOOLEAN | Weighted item flag |

**Constraints:** `UNIQUE(promotion_id, item_id, group_id)`

## Views

### price_comparison

All prices for all items across all stores — used for comparison tables.

```sql
SELECT * FROM price_comparison WHERE barcode = '7290000000000';
```

### cheapest_prices

Cheapest price per item across all stores.

```sql
SELECT * FROM cheapest_prices WHERE barcode = '7290000000000';
```

### active_promotions

Currently active promotions with item, store, and chain details.

```sql
SELECT * FROM active_promotions WHERE barcode = '7290000000000';
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

### 2. Run Schema

1. Open the Supabase SQL Editor
2. Copy the contents of `schema.sql`
3. Execute the SQL script
4. Verify tables are created in the Table Editor

### 3. Configure Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Note:** The service role key is only needed for the scraper (server-side). The mobile app uses the anon key.

## API Usage Examples

### Search Products

```typescript
const { data } = await supabase
  .from('items')
  .select('*')
  .ilike('name', `%${searchQuery}%`)
  .limit(20);
```

### Get Price Comparison

```typescript
const { data } = await supabase
  .from('prices')
  .select(`
    item_id,
    price,
    store_id,
    stores (
      branch_name,
      chain_id,
      chains ( name )
    ),
    items (
      name,
      barcode
    )
  `)
  .in('item_id', itemIds);
```

### Get Active Promotions for an Item

```typescript
const { data } = await supabase
  .from('active_promotions')
  .select('*')
  .eq('barcode', '7290000000000');
```

## Maintenance

Prices and promotions are updated by the scraper service. The `last_updated` timestamp tracks freshness.
