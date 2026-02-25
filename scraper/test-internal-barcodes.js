// בדיקות: נורמליזציה, שדות חדשים, ולוגיקת התאמה
// מריצים: node test-internal-barcodes.js

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}: expected "${expected}", got "${actual}"`);
  }
}

// ============================================================
// 1. בדיקת normalizeUnitMeasure (שחזור הפונקציה מהקוד)
// ============================================================
const UNIT_MEASURE_MAP = {
  'ק"ג': 'kg', 'קילו': 'kg', 'קילוגרם': 'kg', 'KG': 'kg', 'Kg': 'kg', 'kg': 'kg',
  'גרם': 'g', 'גרמים': 'g', 'GR': 'g', 'gr': 'g', 'g': 'g',
  'ליטר': 'l', 'ל': 'l', 'LT': 'l', 'L': 'l', 'l': 'l',
  'מ"ל': 'ml', 'מיליליטר': 'ml', 'ML': 'ml', 'ml': 'ml',
  'יחידה': 'unit', 'יחידות': 'unit', 'יח': 'unit', 'UN': 'unit', 'EA': 'unit',
  'מטר': 'm', 'מ': 'm', 'M': 'm',
  'ס"מ': 'cm', 'CM': 'cm',
};

function normalizeUnitMeasure(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  return UNIT_MEASURE_MAP[trimmed] || trimmed.toLowerCase();
}

function normalizeName(name) {
  if (!name) return '';
  return name.trim().replace(/['"״׳`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

console.log('\n=== 1. normalizeUnitMeasure ===\n');

assertEqual(normalizeUnitMeasure('ק"ג'), 'kg', 'ק"ג → kg');
assertEqual(normalizeUnitMeasure('קילו'), 'kg', 'קילו → kg');
assertEqual(normalizeUnitMeasure('KG'), 'kg', 'KG → kg');
assertEqual(normalizeUnitMeasure('Kg'), 'kg', 'Kg → kg');
assertEqual(normalizeUnitMeasure('גרם'), 'g', 'גרם → g');
assertEqual(normalizeUnitMeasure('GR'), 'g', 'GR → g');
assertEqual(normalizeUnitMeasure('ליטר'), 'l', 'ליטר → l');
assertEqual(normalizeUnitMeasure('LT'), 'l', 'LT → l');
assertEqual(normalizeUnitMeasure('מ"ל'), 'ml', 'מ"ל → ml');
assertEqual(normalizeUnitMeasure('ML'), 'ml', 'ML → ml');
assertEqual(normalizeUnitMeasure('יחידה'), 'unit', 'יחידה → unit');
assertEqual(normalizeUnitMeasure('EA'), 'unit', 'EA → unit');
assertEqual(normalizeUnitMeasure('ס"מ'), 'cm', 'ס"מ → cm');
assertEqual(normalizeUnitMeasure(''), '', 'ריק → ריק');
assertEqual(normalizeUnitMeasure(null), '', 'null → ריק');
assertEqual(normalizeUnitMeasure(undefined), '', 'undefined → ריק');
assertEqual(normalizeUnitMeasure('  KG  '), 'kg', 'KG עם רווחים → kg');
assertEqual(normalizeUnitMeasure('Something'), 'something', 'ערך לא מוכר → lowercase');

// ============================================================
// 2. בדיקת normalizeName
// ============================================================
console.log('\n=== 2. normalizeName ===\n');

assertEqual(normalizeName('סלמון טרי'), 'סלמון טרי', 'שם רגיל');
assertEqual(normalizeName('  סלמון  טרי  '), 'סלמון טרי', 'רווחים מיותרים');
assertEqual(normalizeName('תפו"ע פינק ליידי'), 'תפוע פינק ליידי', 'הסרת גרשיים כפולים');
assertEqual(normalizeName("חלב 3% שומן"), 'חלב 3% שומן', 'אחוזים נשמרים');
assertEqual(normalizeName('מים מינרליים 1.5 ל׳'), 'מים מינרליים 1.5 ל', 'הסרת גרש עברי');
assertEqual(normalizeName('קוטג` 5%'), 'קוטג 5%', 'הסרת backtick');
assertEqual(normalizeName(''), '', 'ריק → ריק');
assertEqual(normalizeName(null), '', 'null → ריק');
assertEqual(normalizeName('SALMON Fresh'), 'salmon fresh', 'אנגלית → lowercase');

// בדיקת עקביות — אותו מוצר בווריאציות שונות
const variants = [
  'תפו"ע פינק ליידי אורגני',
  "תפו'ע פינק ליידי אורגני",
  'תפו״ע פינק ליידי אורגני',
  'תפוע פינק ליידי אורגני',
];
const normalized = variants.map(normalizeName);
assert(normalized.every(n => n === normalized[0]), 'כל הווריאציות של תפו"ע מתנרמלות לאותו ערך');

// ============================================================
// 3. בדיקת normalize() — שדות חדשים מ-XML
// ============================================================
console.log('\n=== 3. PriceProcessor.normalize() — שדות חדשים ===\n');

// סימולציה של normalize (אותו קוד מהפרוססור)
function normalize(xmlItem, extStoreId) {
  const barcode = xmlItem.ItemCode || xmlItem.Barcode || xmlItem.ItemOnly;
  const priceRaw = xmlItem.ItemPrice || xmlItem.UnitOfMeasurePrice;
  if (!barcode || !priceRaw) return null;
  const price = parseFloat(priceRaw);
  if (isNaN(price) || price < 0) return null;

  const name = (xmlItem.ItemName || xmlItem.Name || 'Unknown').trim().slice(0, 255);
  const itemType = parseInt(xmlItem.ItemType, 10);
  const itemTypeVal = (itemType === 0 || itemType === 1) ? itemType : 1;
  const quantity = xmlItem.Quantity ? parseFloat(xmlItem.Quantity) : null;
  const qtyInPackage = parseInt(xmlItem.QtyInPackage, 10);
  const unitOfMeasurePrice = xmlItem.UnitOfMeasurePrice ? parseFloat(xmlItem.UnitOfMeasurePrice) : null;

  return {
    item_data: {
      barcode: String(barcode).trim(),
      name,
      manufacturer_name: (xmlItem.ManufacturerName || '').trim(),
      unit_measure: normalizeUnitMeasure(xmlItem.UnitOfMeasure),
      item_type: itemTypeVal,
      is_weighted: xmlItem.bIsWeighted === '1' || xmlItem.bIsWeighted === 'true',
      quantity: isNaN(quantity) ? null : quantity,
      unit_qty: (xmlItem.UnitQty || '').trim(),
      qty_in_package: (!isNaN(qtyInPackage) && qtyInPackage > 0) ? qtyInPackage : 1,
      unit_of_measure_price: (unitOfMeasurePrice !== null && !isNaN(unitOfMeasurePrice)) ? unitOfMeasurePrice : null,
      normalized_name: normalizeName(name),
    },
    price_data: {
      barcode: String(barcode).trim(),
      price: price,
      external_store_id: extStoreId,
    }
  };
}

// 3a. מוצר תקני רגיל (item_type=1)
const standard = normalize({
  ItemCode: '7290000123456',
  ItemName: 'חלב תנובה 3%',
  ItemPrice: '6.90',
  ItemType: '1',
  bIsWeighted: '0',
  UnitOfMeasure: 'ליטר',
  Quantity: '1',
  QtyInPackage: '1',
  UnitOfMeasurePrice: '6.90',
  ManufacturerName: 'תנובה',
  UnitQty: 'ליטר',
}, '001-010');

assertEqual(standard.item_data.item_type, 1, 'מוצר תקני: item_type=1');
assertEqual(standard.item_data.is_weighted, false, 'מוצר תקני: is_weighted=false');
assertEqual(standard.item_data.unit_measure, 'l', 'מוצר תקני: unit_measure=l');
assertEqual(standard.item_data.quantity, 1, 'מוצר תקני: quantity=1');
assertEqual(standard.item_data.qty_in_package, 1, 'מוצר תקני: qty_in_package=1');
assertEqual(standard.item_data.unit_of_measure_price, 6.90, 'מוצר תקני: unit_of_measure_price=6.90');
assertEqual(standard.item_data.manufacturer_name, 'תנובה', 'מוצר תקני: manufacturer_name=תנובה');
assertEqual(standard.item_data.normalized_name, 'חלב תנובה 3%', 'מוצר תקני: normalized_name');
assertEqual(standard.price_data.price, 6.90, 'מוצר תקני: price=6.90');

// 3b. מוצר פנימי שקיל (item_type=0, bIsWeighted=1)
const internal = normalize({
  ItemCode: '100200300',
  ItemName: 'סלמון טרי',
  ItemPrice: '89.90',
  ItemType: '0',
  bIsWeighted: '1',
  UnitOfMeasure: 'ק"ג',
  Quantity: '1',
  QtyInPackage: '1',
  UnitOfMeasurePrice: '89.90',
  ManufacturerName: '',
}, '001-010');

assertEqual(internal.item_data.item_type, 0, 'מוצר פנימי: item_type=0');
assertEqual(internal.item_data.is_weighted, true, 'מוצר פנימי: is_weighted=true');
assertEqual(internal.item_data.unit_measure, 'kg', 'מוצר פנימי: unit_measure=kg (מ-ק"ג)');
assertEqual(internal.item_data.normalized_name, 'סלמון טרי', 'מוצר פנימי: normalized_name');

// 3c. מוצר ללא ItemType (ברירת מחדל 1)
const noType = normalize({
  ItemCode: '111222333',
  ItemName: 'מוצר כלשהו',
  ItemPrice: '10.00',
  UnitOfMeasure: 'gr',
}, '001-010');

assertEqual(noType.item_data.item_type, 1, 'ללא ItemType: ברירת מחדל 1');
assertEqual(noType.item_data.is_weighted, false, 'ללא bIsWeighted: ברירת מחדל false');
assertEqual(noType.item_data.qty_in_package, 1, 'ללא QtyInPackage: ברירת מחדל 1');
assertEqual(noType.item_data.quantity, null, 'ללא Quantity: null');
assertEqual(noType.item_data.unit_measure, 'g', 'gr → g');

// 3d. מוצר עם bIsWeighted='true' (לא '1')
const weightedTrue = normalize({
  ItemCode: '444555666',
  ItemName: 'עגבניות',
  ItemPrice: '5.90',
  ItemType: '0',
  bIsWeighted: 'true',
  UnitOfMeasure: 'KG',
}, '001-010');

assertEqual(weightedTrue.item_data.is_weighted, true, 'bIsWeighted=true (string): is_weighted=true');

// 3e. ערכים לא תקינים
assertEqual(normalize({ ItemCode: '', ItemPrice: '10' }, '001'), null, 'ברקוד ריק → null');
assertEqual(normalize({ ItemCode: '123', ItemPrice: '' }, '001'), null, 'מחיר ריק → null');
assertEqual(normalize({ ItemCode: '123', ItemPrice: '-5' }, '001'), null, 'מחיר שלילי → null');
assertEqual(normalize({ ItemCode: '123', ItemPrice: 'abc' }, '001'), null, 'מחיר לא מספרי → null');

// 3f. מוצר עם QtyInPackage > 1
const multiPack = normalize({
  ItemCode: '777888999',
  ItemName: 'מים מינרליים 6 יח',
  ItemPrice: '15.90',
  ItemType: '1',
  QtyInPackage: '6',
  Quantity: '1.5',
  UnitOfMeasure: 'ליטר',
}, '001-010');

assertEqual(multiPack.item_data.qty_in_package, 6, 'אריזת 6: qty_in_package=6');
assertEqual(multiPack.item_data.quantity, 1.5, 'כמות 1.5: quantity=1.5');

// 3g. QtyInPackage לא תקין
const badQty = normalize({
  ItemCode: '111',
  ItemName: 'test',
  ItemPrice: '1',
  QtyInPackage: '0',
}, '001');
assertEqual(badQty.item_data.qty_in_package, 1, 'QtyInPackage=0 → ברירת מחדל 1');

const negQty = normalize({
  ItemCode: '222',
  ItemName: 'test',
  ItemPrice: '1',
  QtyInPackage: '-3',
}, '001');
assertEqual(negQty.item_data.qty_in_package, 1, 'QtyInPackage שלילי → ברירת מחדל 1');

// ============================================================
// 4. בדיקת לוגיקת דדופליקציה (מ-supabase-service)
// ============================================================
console.log('\n=== 4. לוגיקת דדופליקציה ===\n');

// סימולציה: חנות שמחזירה מספר מקבילים לאותו פריט
const storePrices = [
  { item_id: 42, price: 89.90 },  // המקורי
  { item_id: 42, price: 95.00 },  // מקביל שמופה ל-42
  { item_id: 42, price: 79.90 },  // מקביל שמופה ל-42 — הזול!
  { item_id: 100, price: 15.00 }, // פריט אחר
];

const bestByItem = new Map();
for (const p of storePrices) {
  const existing = bestByItem.get(p.item_id);
  if (!existing || p.price < existing.price) {
    bestByItem.set(p.item_id, p);
  }
}
const deduped = Array.from(bestByItem.values());

assertEqual(deduped.length, 2, 'דדופליקציה: 2 פריטים ייחודיים (מתוך 4)');
assertEqual(bestByItem.get(42).price, 79.90, 'דדופליקציה: נבחר המחיר הזול (79.90)');
assertEqual(bestByItem.get(100).price, 15.00, 'דדופליקציה: פריט ללא כפילות נשאר');

// ============================================================
// 5. בדיקת reverseMap
// ============================================================
console.log('\n=== 5. reverseMap — מיפוי מקבילים חזרה למקור ===\n');

const reverseMap = new Map();
reverseMap.set(78, 42);   // פריט 78 (רשת ב) → מקורי 42
reverseMap.set(135, 42);  // פריט 135 (רשת ג) → מקורי 42

// סימולציה: מחירים חוזרים מ-3 רשתות
const rawPrices = [
  { item_id: 42, price: 89.90, store_id: 1 },   // רשת א — המקורי
  { item_id: 78, price: 85.00, store_id: 2 },   // רשת ב — מקביל
  { item_id: 135, price: 92.00, store_id: 3 },  // רשת ג — מקביל
];

const mappedPrices = rawPrices.map(p => ({
  ...p,
  item_id: reverseMap.get(p.item_id) ?? p.item_id
}));

assert(mappedPrices.every(p => p.item_id === 42), 'reverseMap: כל המקבילים ממופים ל-42');
assertEqual(mappedPrices.length, 3, 'reverseMap: 3 מחירים מ-3 רשתות');

// כל חנות מחזירה את ה-ID המקורי
assertEqual(mappedPrices[0].store_id, 1, 'רשת א: store_id=1');
assertEqual(mappedPrices[1].store_id, 2, 'רשת ב: store_id=2');
assertEqual(mappedPrices[2].store_id, 3, 'רשת ג: store_id=3');

// ============================================================
// 6. בדיקת תרחיש מלא — "סלמון טרי" ב-3 רשתות
// ============================================================
console.log('\n=== 6. תרחיש מלא: סלמון טרי ב-3 רשתות ===\n');

// סימולציה: 3 רשתות עם אותו מוצר, ברקודים שונים
const items = [
  { id: 42, name: 'סלמון טרי', barcode: '100001', item_type: 0, normalized_name: 'סלמון טרי' },
  { id: 78, name: 'סלמון טרי', barcode: '200002', item_type: 0, normalized_name: 'סלמון טרי' },
  { id: 135, name: 'סלמון טרי', barcode: '300003', item_type: 0, normalized_name: 'סלמון טרי' },
];

// שלב 1: resolveEquivalentItems — מקבל [42], מוצא גם 78 ו-135
const originalIds = [42];
const internalItems = items.filter(i => originalIds.includes(i.id) && i.item_type === 0);
const normalizedNames = [...new Set(internalItems.map(i => i.normalized_name))];
const equivalents = items.filter(i => i.item_type === 0 && normalizedNames.includes(i.normalized_name));

const expandedSet = new Set(originalIds);
const simReverseMap = new Map();
for (const eq of equivalents) {
  if (!originalIds.includes(eq.id)) {
    expandedSet.add(eq.id);
    simReverseMap.set(eq.id, 42);
  }
}

const expandedIds = Array.from(expandedSet);
assertEqual(expandedIds.length, 3, 'הרחבה: [42] → [42, 78, 135]');
assert(expandedIds.includes(42) && expandedIds.includes(78) && expandedIds.includes(135), 'כל ה-IDs קיימים');

// שלב 2: מחירים חוזרים ומקובצים לפי חנות
const storePricesMap = new Map();
const priceResults = [
  { item_id: 42, price: 89.90, store_id: 10, chain: 'רמי לוי' },
  { item_id: 78, price: 85.00, store_id: 20, chain: 'אושר עד' },
  { item_id: 135, price: 92.00, store_id: 30, chain: 'יוחננוף' },
];

for (const p of priceResults) {
  const originalId = simReverseMap.get(p.item_id) ?? p.item_id;
  if (!storePricesMap.has(p.store_id)) {
    storePricesMap.set(p.store_id, { chain: p.chain, prices: [] });
  }
  storePricesMap.get(p.store_id).prices.push({ item_id: originalId, price: p.price });
}

assertEqual(storePricesMap.size, 3, 'תוצאה: 3 חנויות בהשוואה');
assertEqual(storePricesMap.get(10).prices[0].item_id, 42, 'רמי לוי: ממופה ל-42');
assertEqual(storePricesMap.get(20).prices[0].item_id, 42, 'אושר עד: ממופה ל-42');
assertEqual(storePricesMap.get(30).prices[0].item_id, 42, 'יוחננוף: ממופה ל-42');

// מציאת הזול
const cheapest = priceResults.reduce((prev, curr) => curr.price < prev.price ? curr : prev);
assertEqual(cheapest.chain, 'אושר עד', 'הזול ביותר: אושר עד (85.00)');

// ============================================================
// 7. מקרי קצה
// ============================================================
console.log('\n=== 7. מקרי קצה ===\n');

// 7a. מוצר תקני (item_type=1) לא עובר הרחבה
const standardItem = { id: 500, item_type: 1, normalized_name: 'חלב תנובה 3%' };
const standardInternal = [standardItem].filter(i => i.item_type === 0);
assertEqual(standardInternal.length, 0, 'מוצר תקני (type=1): לא נכנס להתאמה');

// 7b. מוצר פנימי ללא normalized_name
const noName = { id: 600, item_type: 0, normalized_name: '' };
const noNameFiltered = [noName].filter(i => i.item_type === 0 && i.normalized_name && i.normalized_name.length > 0);
assertEqual(noNameFiltered.length, 0, 'פנימי ללא שם מנורמל: לא נכנס להתאמה');

// 7c. מוצר פנימי ללא מקבילים (רשת אחת בלבד)
const lonelyItem = { id: 700, item_type: 0, normalized_name: 'מוצר ייחודי לרשת' };
const lonelyEquivalents = [lonelyItem]; // רק הוא עצמו
const lonelyExpanded = new Set([700]);
for (const eq of lonelyEquivalents) {
  if (eq.id !== 700) lonelyExpanded.add(eq.id);
}
assertEqual(lonelyExpanded.size, 1, 'פנימי ללא מקבילים: הרשימה לא מורחבת');

// 7d. סל מעורב — פריט תקני + פריט פנימי
const mixedBasket = [
  { id: 42, item_type: 0, normalized_name: 'סלמון טרי' },
  { id: 500, item_type: 1, normalized_name: 'חלב תנובה 3%' },
];
const mixedInternal = mixedBasket.filter(i => i.item_type === 0 && i.normalized_name.length > 0);
assertEqual(mixedInternal.length, 1, 'סל מעורב: רק פריט פנימי אחד מורחב');
assertEqual(mixedInternal[0].id, 42, 'סל מעורב: הפנימי הוא 42');

// ============================================================
// סיכום
// ============================================================
console.log('\n========================================');
console.log(`  סה"כ: ${passed + failed} בדיקות`);
console.log(`  ✅ עברו: ${passed}`);
console.log(`  ❌ נכשלו: ${failed}`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
