-- ============================================================================
-- UPDATE: Real Store IDs for Petah Tikva
-- ============================================================================
-- Run this in Supabase SQL Editor to update with actual store IDs
-- ============================================================================

-- Update Shufersal Petah Tikva stores
UPDATE stores 
SET store_id = '269', 
    branch_name = 'Shufersal Petah Tikva - Segula',
    address = 'Segula Quarter'
WHERE chain_name = 'Shufersal' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Segula%';

-- Remove the other Shufersal Petah Tikva store (we only have one real ID)
DELETE FROM stores 
WHERE chain_name = 'Shufersal' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Deal%';

-- Update Osher Ad Petah Tikva
UPDATE stores 
SET store_id = '1290',
    branch_name = 'Osher Ad Petah Tikva'
WHERE chain_name = 'Osher Ad' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Center%';

-- Remove the other Osher Ad Petah Tikva store
DELETE FROM stores 
WHERE chain_name = 'Osher Ad' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%North%';

-- Update Yohananof Petah Tikva
UPDATE stores 
SET store_id = '1776',
    branch_name = 'Yohananof Petah Tikva'
WHERE chain_name = 'Yohananof' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Sirkin%';

-- Remove the other Yohananof Petah Tikva store
DELETE FROM stores 
WHERE chain_name = 'Yohananof' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Segula%';

-- Update Rami Levy Petah Tikva
UPDATE stores 
SET store_id = '71',
    branch_name = 'Rami Levy Petah Tikva'
WHERE chain_name = 'Rami Levy' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Rothschild%';

-- Remove the other Rami Levy Petah Tikva store
DELETE FROM stores 
WHERE chain_name = 'Rami Levy' 
  AND city = 'Petah Tikva' 
  AND branch_name LIKE '%Jabotinsky%';

-- Verify the updates
SELECT 
  id,
  chain_name,
  branch_name,
  city,
  store_id,
  address
FROM stores
WHERE city = 'Petah Tikva'
ORDER BY chain_name;

-- Expected result: 4 stores in Petah Tikva
-- - Rami Levy: store_id = 71
-- - Osher Ad: store_id = 1290
-- - Yohananof: store_id = 1776
-- - Shufersal: store_id = 269
