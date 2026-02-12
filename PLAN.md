# תוכנית תיקון CerberusProvider - ניתוח מעמיק

## סיכום מצב נוכחי

הריפקטורינג (קומיט `3c14971`) יצר ארכיטקטורה גנרית טובה (BaseProvider/BaseProcessor),
אבל שבר את החיבור ל-Cerberus. הקומיט הישן (`f358eed` ולפניו) עבד.

---

## באגים שזוהו (5 בעיות קריטיות)

### באג 1: `downloadAndDecompress()` הוא קוד מת (CRITICAL)

**הבעיה:** ב-`CerberusProvider.js:126-153` יש מתודה `downloadAndDecompress()` שמכילה את
ה-SSL fix (`httpsAgent`) ומורידה קבצים בצורה שעובדת. **אבל היא אף פעם לא נקראת.**

הזרימה בפועל:
```
BaseProvider.run()
  → BaseProvider.processSingleTask()     (שורה 122)
    → BaseProvider.downloadFile()         (שורה 131) ← זו הפונקציה שנקראת!
    → BaseProvider.decompressFile()       (שורה 135)
```

`BaseProvider.downloadFile()` (שורה 222) משתמש ב-axios רגיל **ללא httpsAgent**,
כלומר ההורדה תיכשל בגלל בעיית SSL של Cerberus.

**הפתרון:** לאפשר ל-CerberusProvider לעקוף את `downloadFile()` של BaseProvider,
או ליצור מנגנון ב-BaseProvider שמאפשר העברת httpsAgent כקונפיגורציה.

---

### באג 2: `config.dbId` לא קיים (CRITICAL)

**הבעיה:** ב-3 מקומות הקוד משתמש ב-`this.config.dbId`:
- `StoreProcessor.js:106` → `chain_id: this.config.dbId`
- `PriceProcessor.js:180` → `.eq('chain_id', this.config.dbId)`
- `BaseProvider.js:207` → `.eq('chain_id', this.config.dbId)`

**אבל** טבלת `chains` ב-DB מחזירה `id`, לא `dbId`.
ב-`index.js:45` מביאים `select('*')` מ-chains, אז ה-config יכיל `id` אבל לא `dbId`.

**הפתרון:** להחליף `config.dbId` ל-`config.id` בכל 3 המקומות,
או לעשות mapping ב-`index.js` לפני שמעבירים את ה-chain ל-provider.

---

### באג 3: חוסר SSL bypass ב-BaseProvider.downloadFile() (CRITICAL)

**הבעיה:** `BaseProvider.downloadFile()` (שורה 222-251) משתמש ב-axios ללא `httpsAgent`:
```javascript
const response = await axios({
  url, method: 'GET', responseType: 'stream', timeout: 30000,
  headers: { 'User-Agent': '...' }
  // ← אין httpsAgent!
});
```

שרת Cerberus (`url.retail.publishedprices.co.il`) ידוע כבעייתי מבחינת SSL certificates.

**עדות:** ב-`CerberusProvider.js:11-14` יש הערה מפורשת:
```javascript
// ⚠️ TEMPORARY SSL WORKAROUND - Cerberus has certificate issues
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
```

ובקוד הישן ב-`master-agent.js:212`:
```javascript
const context = await browser.newContext({ ignoreHTTPSErrors: true });
```

**הפתרון:** ל-BaseProvider צריך מנגנון שמאפשר לכל provider להגדיר axios options
(כמו httpsAgent). או ש-CerberusProvider יעקוף את downloadFile.

---

### באג 4: רגקס חילוץ StoreId צר מדי (MEDIUM)

**הבעיה:** ב-`CerberusProvider.js:103`:
```javascript
storeId: fileName.match(/-(\d{3,4})-/)?.[1] || null
```

הרגקס `-(\d{3,4})-` תופס רק 3-4 ספרות. אבל ב-seed data רואים store IDs כמו:
- `010` (3 ספרות) ✓
- `724` (3 ספרות) ✓
- `021` (3 ספרות) ✓
- `1290` (4 ספרות) ✓
- `269` (3 ספרות) ✓

אבל ישנם גם store IDs של 1-2 ספרות או 5+ ספרות שלא ייתפסו.

**הפתרון:** להרחיב ל-`/-(\d{1,5})-/` או לחלץ את ה-store ID בצורה יותר מדויקת
על בסיס מבנה שם הקובץ.

---

### באג 5: סינון קבצי PriceFull לא מדויק (LOW)

**הבעיה:** ב-`CerberusProvider.js:98`:
```javascript
if (docType !== 'Stores' && !fileName.toLowerCase().includes('price')) return;
```

זה תופס גם `Price` (עדכון) וגם `PriceFull` (מלא).
אבל בשלב 5 של `fetchFileList` (שורה 69), ה-search box מסנן ל-`'pricefull'`,
מה שאמור לפתור את הבעיה ברמת ה-UI.

עם זאת, אם ה-search box לא עובד מסיבה כלשהי (lazy loading, JS delay),
קבצי `Price` (דלתא) עלולים להיכנס ברשימה.

**הפתרון:** להחמיר את הבדיקה: `fileName.toLowerCase().includes('pricefull')`.

---

## ניתוח ההבדלים בין הקוד הישן לחדש

| היבט | ישן (עובד) | חדש (שבור) |
|------|-----------|------------|
| **הורדת קבצים** | Playwright click + waitForEvent('download') + saveAs | URL extraction → axios GET (ללא cookies/SSL) |
| **SSL** | `ignoreHTTPSErrors: true` ב-browser context | `httpsAgent` קיים אך לא מחובר (dead code) |
| **סקופ** | חנות אחת ספציפית per chain (hardcoded branchId) | כל החנויות הפעילות (דינמי מ-DB) |
| **XML Parsing** | `xml2js` (DOM מלא) + MainWrapper | `xml-stream` (streaming) |
| **DB Schema** | `chain_name` (string) | `chain_id` (FK) + `city_id` (FK) |
| **Config** | Hardcoded objects | שליפה מ-DB (`chains` table) |

---

## תוכנית תיקון (סדר עדיפות)

### שלב 1: תיקון config.dbId → config.id
**קבצים:** `StoreProcessor.js`, `PriceProcessor.js`, `BaseProvider.js`
**שינוי:** החלפת `this.config.dbId` ב-`this.config.id` בכל מקום

### שלב 2: חיבור SSL bypass ל-download flow
**אופציה A (מומלצת): Override downloadFile ב-CerberusProvider**
- CerberusProvider יעקוף את `downloadFile()` של BaseProvider
- יוסיף `httpsAgent` ל-axios request
- שומר על BaseProvider נקי לsproviders אחרים (שופרסל וכו')

**אופציה B: הוספת getAxiosConfig() ל-BaseProvider**
- מתודה שchild classes יכולים לעקוף
- BaseProvider.downloadFile() ישתמש בה

### שלב 3: הסרת קוד מת ב-CerberusProvider
- מחיקת `downloadAndDecompress()` (שורות 126-153)
- מחיקת `isPriceFile()` (שורות 158-161)
- מחיקת `extractStoreId()` (שורות 166-169)

### שלב 4: הרחבת regex של Store ID
- שינוי `/-(\d{3,4})-/` ל-`/-(\d+)-/`

### שלב 5: החמרת סינון PriceFull
- שינוי `includes('price')` ל-`includes('pricefull')` עבור DOC_TYPES.PRICE_FULL

---

## ארכיטקטורה מוצעת לאחר התיקון

```
CerberusProvider extends BaseProvider
├── getProcessor(docType)          # Factory - כבר עובד
├── fetchFileList(docType)         # Playwright login + extract - כבר עובד (בערך)
├── downloadFile(url, outputPath)  # NEW OVERRIDE: axios + httpsAgent
├── clearCache()                   # כבר עובד
└── (ללא קוד מת)

BaseProvider
├── run(docType)                   # Orchestration - עובד
├── processSingleTask()            # Download → Decompress → Process - עובד
├── downloadFile()                 # Default (ללא SSL bypass) - לproviders אחרים
├── decompressFile()               # GZ decompression - עובד
├── filterFiles()                  # סינון חנויות פעילות - עובד (אחרי fix של config.id)
└── getActiveStoreIdsFromDB()      # שליפה מ-DB - עובד (אחרי fix של config.id)
```

---

## נושאים נוספים שכדאי לטפל בהם (לא קריטי לתיקון)

### 1. פונקציית עזר לעדכון חנויות (חודשי)
לפי דרישת המשתמש - פונקציה שתרוץ פעם בחודש ותעדכן חנויות:
```javascript
// scraper/tasks/updateStores.js
async function updateAllStores() {
  // עבור כל chain ב-DB
  //   → provider.run(DOC_TYPES.STORES)
}
```

### 2. פונקציה ראשית יומית
לפי דרישת המשתמש - תרוץ כל בוקר:
```javascript
// scraper/tasks/dailyPrices.js
async function updateDailyPrices(cities) {
  // עבור כל chain ב-DB
  //   → provider.run(DOC_TYPES.PRICE_FULL)
  // מסנן רק חנויות בערים הנתונות + אינטרנט
}
```

### 3. תמיכה ב-5 סוגי קבצים
כרגע רק STORES ו-PRICE_FULL מטופלים. צריך:
- PromoProcessor (לקבצי PromoFull + Promo)
- PriceUpdateProcessor (לקבצי Price incremental)

### 4. ביצועים / שיפור חוויית שימוש
- Browser reuse: פתיחת browser אחד ושימוש ב-context לכל chain (כמו בקוד הישן)
- FTP alternative: אפשר להשתמש ב-FTP במקום Playwright (כמו ב-Python scraper)

---

## מידע על מערכת Cerberus

### כתובות
- **Retail:** `https://url.retail.publishedprices.co.il`
- **Login:** `/login` (POST username only, no password)
- **File listing:** `/file/d/{username}/`
- **File download:** `/file/d/{filename}` (public, ללא auth!)

### נקודה חשובה
ה-URL ישיר להורדת קובץ (`/file/d/{filename}`) **עובד בלי cookies/auth** -
כפי שמוכיח `rami-levy-scraper.js:51` שמוריד עם axios רגיל בלי שום session.

המשמעות: ברגע שמחלצים את ה-URLs מהטבלה (עם Playwright),
ההורדה עצמה עובדת עם axios רגיל. **הבעיה היחידה היא SSL.**

### שמות משתמשים
| רשת | Username |
|-----|----------|
| רמי לוי | RamiLevi |
| אושר עד | OsherAd / osherad |
| ויקטורי | Victory |
| חצי חינם | HaziHinam |
| יוחננוף | Yochananof / yohananof |
| מחסני השוק | Shook |
| יינות ביתן | YeinotBitan |
