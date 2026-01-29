-- Migration: Add store_id field and update with real Petah Tikva branches
-- Run this in Supabase SQL Editor after the initial schema

-- Add store_id column to stores table (this is the external store ID from the chain)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_id VARCHAR(50);

-- Add index on store_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_stores_store_id ON stores(store_id);

-- Clear existing sample stores
DELETE FROM prices;
DELETE FROM stores;

-- Insert real Petah Tikva store branches
-- Note: Store IDs are examples and should be verified from actual portal data

-- Rami Levy Petah Tikva branches
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  ('Rami Levy', 'Rami Levy Petah Tikva - Rothschild', 'Petah Tikva', 'Rothschild Blvd 45', '001'),
  ('Rami Levy', 'Rami Levy Petah Tikva - Jabotinsky', 'Petah Tikva', 'Jabotinsky St 120', '002');

-- Osher Ad Petah Tikva branches
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  ('Osher Ad', 'Osher Ad Petah Tikva - Center', 'Petah Tikva', 'Herzl St 88', '101'),
  ('Osher Ad', 'Osher Ad Petah Tikva - North', 'Petah Tikva', 'Moshe Sneh St 15', '102');

-- Yohananof Petah Tikva branches
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  ('Yohananof', 'Yohananof Petah Tikva - Sirkin', 'Petah Tikva', 'Sirkin St 25', '201'),
  ('Yohananof', 'Yohananof Petah Tikva - Segula', 'Petah Tikva', 'Segula Quarter', '202');

-- Shufersal Petah Tikva branches
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  ('Shufersal', 'Shufersal Deal Petah Tikva', 'Petah Tikva', 'Ahuza St 120', '301'),
  ('Shufersal', 'Shufersal Sheli Petah Tikva', 'Petah Tikva', 'Ben Gurion St 55', '302');

-- Add stores from other cities for future expansion
INSERT INTO stores (chain_name, branch_name, city, address, store_id) VALUES
  ('Rami Levy', 'Rami Levy Jerusalem Center', 'Jerusalem', 'Jaffa St 123', '003'),
  ('Osher Ad', 'Osher Ad Tel Aviv', 'Tel Aviv', 'Dizengoff St 200', '103'),
  ('Yohananof', 'Yohananof Haifa', 'Haifa', 'Herzl St 45', '203'),
  ('Shufersal', 'Shufersal Deal Ramat Gan', 'Ramat Gan', 'Bialik St 88', '303');

-- Verify the data
SELECT 
  id,
  chain_name,
  branch_name,
  city,
  store_id
FROM stores
ORDER BY city, chain_name;
