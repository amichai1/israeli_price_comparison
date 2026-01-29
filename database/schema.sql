-- Israeli Supermarket Price Comparison Database Schema
-- This schema is designed for Supabase (PostgreSQL)

-- Items table: Stores product information
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  unit_measure VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on barcode for fast lookups
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);

-- Create index on name for search functionality
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

-- Stores table: Stores supermarket chain and branch information
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  chain_name VARCHAR(100) NOT NULL,
  branch_name VARCHAR(255),
  city VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on chain_name for filtering
CREATE INDEX IF NOT EXISTS idx_stores_chain_name ON stores(chain_name);

-- Create index on city for location-based queries
CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);

-- Prices table: Stores price information for items at specific stores
CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, store_id)
);

-- Create index on item_id for fast price lookups
CREATE INDEX IF NOT EXISTS idx_prices_item_id ON prices(item_id);

-- Create index on store_id for store-based queries
CREATE INDEX IF NOT EXISTS idx_prices_store_id ON prices(store_id);

-- Create composite index for efficient price comparison queries
CREATE INDEX IF NOT EXISTS idx_prices_item_store ON prices(item_id, store_id);

-- Create index on last_updated for freshness checks
CREATE INDEX IF NOT EXISTS idx_prices_last_updated ON prices(last_updated);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for items table
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for stores table
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert sample stores for major Israeli chains
INSERT INTO stores (chain_name, branch_name, city) VALUES
  ('Rami Levy', 'Rami Levy Jerusalem Center', 'Jerusalem'),
  ('Osher Ad', 'Osher Ad Tel Aviv', 'Tel Aviv'),
  ('Yohananof', 'Yohananof Haifa', 'Haifa'),
  ('Shufersal', 'Shufersal Deal Ramat Gan', 'Ramat Gan')
ON CONFLICT DO NOTHING;

-- View for getting the cheapest price per item across all stores
CREATE OR REPLACE VIEW cheapest_prices AS
SELECT 
  i.id AS item_id,
  i.barcode,
  i.name,
  i.unit_measure,
  MIN(p.price) AS cheapest_price,
  s.chain_name AS cheapest_store,
  p.last_updated
FROM items i
JOIN prices p ON i.id = p.item_id
JOIN stores s ON p.store_id = s.id
GROUP BY i.id, i.barcode, i.name, i.unit_measure, s.chain_name, p.last_updated;

-- View for price comparison across all stores
CREATE OR REPLACE VIEW price_comparison AS
SELECT 
  i.id AS item_id,
  i.barcode,
  i.name,
  i.unit_measure,
  s.chain_name,
  s.branch_name,
  p.price,
  p.last_updated
FROM items i
JOIN prices p ON i.id = p.item_id
JOIN stores s ON p.store_id = s.id
ORDER BY i.name, s.chain_name;
