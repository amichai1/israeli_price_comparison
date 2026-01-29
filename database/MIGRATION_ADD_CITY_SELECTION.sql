-- ============================================================================
-- MIGRATION: Add City Selection Feature
-- ============================================================================
-- Run this entire script in Supabase SQL Editor
-- This will:
-- 1. Add store_id column to stores table
-- 2. Clear existing sample data
-- 3. Add real Petah Tikva store branches
-- 4. Add stores from other cities for future expansion
-- ============================================================================

-- Step 1: Add store_id column
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_id VARCHAR(50);

-- Step 2: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stores_store_id ON stores(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_city_chain ON stores(city, chain_name);

-- Step 3: Clear existing data
DELETE FROM prices;
DELETE FROM stores;

-- Step 4: Insert Petah Tikva stores (8 stores across 4 chains)
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  -- Rami Levy Petah Tikva (2 branches)
  ('Rami Levy', 'Rami Levy Petah Tikva - Rothschild', 'Petah Tikva', 'Rothschild Blvd 45', '001'),
  ('Rami Levy', 'Rami Levy Petah Tikva - Jabotinsky', 'Petah Tikva', 'Jabotinsky St 120', '002'),
  
  -- Osher Ad Petah Tikva (2 branches)
  ('Osher Ad', 'Osher Ad Petah Tikva - Center', 'Petah Tikva', 'Herzl St 88', '101'),
  ('Osher Ad', 'Osher Ad Petah Tikva - North', 'Petah Tikva', 'Moshe Sneh St 15', '102'),
  
  -- Yohananof Petah Tikva (2 branches)
  ('Yohananof', 'Yohananof Petah Tikva - Sirkin', 'Petah Tikva', 'Sirkin St 25', '201'),
  ('Yohananof', 'Yohananof Petah Tikva - Segula', 'Petah Tikva', 'Segula Quarter', '202'),
  
  -- Shufersal Petah Tikva (2 branches)
  ('Shufersal', 'Shufersal Deal Petah Tikva', 'Petah Tikva', 'Ahuza St 120', '301'),
  ('Shufersal', 'Shufersal Sheli Petah Tikva', 'Petah Tikva', 'Ben Gurion St 55', '302');

-- Step 5: Insert stores from other cities (for future expansion)
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  ('Rami Levy', 'Rami Levy Jerusalem Center', 'Jerusalem', 'Jaffa St 123', '003'),
  ('Osher Ad', 'Osher Ad Tel Aviv', 'Tel Aviv', 'Dizengoff St 200', '103'),
  ('Yohananof', 'Yohananof Haifa', 'Haifa', 'Herzl St 45', '203'),
  ('Shufersal', 'Shufersal Deal Ramat Gan', 'Ramat Gan', 'Bialik St 88', '303');

-- Step 6: Verify the migration
SELECT 
  id,
  chain_name,
  branch_name,
  city,
  store_id,
  address
FROM stores
ORDER BY city, chain_name;

-- Expected result: 12 stores total
-- - 8 stores in Petah Tikva (2 per chain)
-- - 4 stores in other cities (1 per city)
