-- מיגרציה: הוספת עמודות לזיהוי ברקודים פנימיים + נורמליזציית יחידות

-- עמודות חדשות לטבלת items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS item_type SMALLINT DEFAULT 1;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_weighted BOOLEAN DEFAULT false;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS quantity REAL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS unit_qty VARCHAR(20) DEFAULT '';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS qty_in_package SMALLINT DEFAULT 1;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS unit_of_measure_price REAL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS normalized_name TEXT DEFAULT '';

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_items_normalized_name ON items(normalized_name) WHERE item_type = 0;
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);

-- נורמליזציית יחידות מידה קיימות
UPDATE items SET unit_measure = 'kg' WHERE unit_measure IN ('ק"ג', 'קילו', 'קילוגרם', 'KG', 'Kg');
UPDATE items SET unit_measure = 'g' WHERE unit_measure IN ('גרם', 'גרמים', 'GR', 'gr');
UPDATE items SET unit_measure = 'l' WHERE unit_measure IN ('ליטר', 'ל', 'LT', 'L');
UPDATE items SET unit_measure = 'ml' WHERE unit_measure IN ('מ"ל', 'מיליליטר', 'ML');
UPDATE items SET unit_measure = 'unit' WHERE unit_measure IN ('יחידה', 'יחידות', 'יח', 'UN', 'EA');

-- עדכון view להכיל שדות חדשים
DROP VIEW IF EXISTS price_comparison;
CREATE VIEW price_comparison WITH (security_invoker = true) AS
SELECT
  i.id AS item_id,
  i.barcode,
  i.name,
  i.unit_measure,
  i.item_type,
  i.is_weighted,
  i.normalized_name,
  c.name as chain_name,
  s.branch_name,
  p.price,
  p.last_updated
FROM items i
JOIN prices p ON i.id = p.item_id
JOIN stores s ON p.store_id = s.id
JOIN chains c ON s.chain_id = c.id
ORDER BY i.name, c.name;
