-- מיגרציה: הוספת ערים חסרות + הסרת עמודת city ישנה
-- להרצה ב-Supabase SQL Editor

-- הסרת עמודת city הישנה (הוחלפה ב-city_id FK + raw_city_name)
ALTER TABLE public.stores DROP COLUMN IF EXISTS city;

INSERT INTO public.cities (name, cbs_code, is_active) VALUES
    ('אופקים',               '31',   false),
    ('פרדסיה',               '171',  false),
    ('קדימה צורן',           '195',  false),
    ('נתיבות',               '246',  false),
    ('גבעת שמואל',           '681',  false),
    ('באר יעקב',             '1034', false),
    ('מבשרת ציון',           '1015', false),
    ('שדרות',                '1031', false),
    ('כרמיאל',               '1139', false),
    ('מודיעין עילית',        '1165', false),
    ('יבנה',                 '2660', false),
    ('אריאל',                '3570', false),
    ('מעלה אדומים',          '3616', false),
    ('גבעתיים',              '6300', false),
    ('פרדס חנה-כרכור',       '7800', false),
    ('זכרון יעקב',           '9300', false),
    ('קריית ים',             '9600', false)
ON CONFLICT (name) DO UPDATE SET cbs_code = EXCLUDED.cbs_code;
