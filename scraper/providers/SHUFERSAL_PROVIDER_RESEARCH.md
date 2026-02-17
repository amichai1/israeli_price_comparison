# Shufersal Provider - Research Summary

## 1. Overview

Shufersal (שופרסל) is Israel's largest supermarket chain (20% market share, chain code `7290027600007`).
Unlike other chains that use the Cerberus FTP server (`url.retail.publishedprices.co.il`),
Shufersal hosts its **own price transparency website** at `https://prices.shufersal.co.il/`.

This document summarizes the research needed to build a `ShufersalProvider` for our scraper system.

---

## 2. Download Method

### 2.1 NOT FTP - HTTP Web Scraping Required

Shufersal does **not** use FTP. Files are available through a paginated HTML web interface:

- **Base URL:** `https://prices.shufersal.co.il/`
- **File listing endpoint:** `https://prices.shufersal.co.il/FileObject/UpdateCategory?catID={type}&storeId={store}&page={page}`

### 2.2 URL Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `catID`   | `0` = All, `1` = Prices, `2` = PriceFull, `3` = Promos, `4` = PromoFull, `5` = Stores | File type filter |
| `storeId` | Store number (optional) | Filter by specific store |
| `page`    | Page number | Pagination parameter |

### 2.3 Anti-Bot Protection

The site returns **403 Forbidden** for bare HTTP requests (confirmed by our test).
Key observations:

1. **Cookie/Session Required:** The site requires visiting the main page first to establish a session cookie before accessing file lists or downloads.
2. **Geo-blocking:** The site may block access from non-Israeli IPs.
3. **No Cloudflare WAF detected** - the protection appears to be simpler cookie-based session validation.

### 2.4 Recommended Approach

Based on the [OpenIsraeliSupermarkets](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers) Python scraper (which successfully scrapes Shufersal), the approach is:

1. **Use `axios` with cookie jar** (or `tough-cookie` library) to maintain sessions
2. First request to `https://prices.shufersal.co.il/` to establish cookies
3. Then request file listing pages with those cookies
4. Parse HTML to extract download links
5. Download the `.gz` files directly

**Alternative if cookie approach fails:** Use Playwright (already in `package.json`) as a fallback for the initial session establishment. The [il-supermarket-scraper](https://pypi.org/project/il-supermarket-scraper/) project uses a `session_with_cookies_by_chain` pattern that first visits the base URL, stores cookies, then reuses them for subsequent requests.

---

## 3. Website HTML Structure

### 3.1 File Listing Page

The HTML page at `/FileObject/UpdateCategory` contains a table with file listings:

```html
<div id="gridContainer">
  <table>
    <tbody>
      <tr>
        <td><a href="/FileObject/UpdateCategory?...&download=true">PriceFull7290027600007-001-202602160000.gz</a></td>
        <td><!-- date --></td>
        <td><!-- file size, e.g. "1.5 MB" --></td>
      </tr>
      ...
    </tbody>
    <tfoot>
      <tr>
        <td>
          <!-- pagination links -->
          <a href="?page=1">1</a>
          <a href="?page=2">2</a>
          ...
          <a href="?page=N">N</a>
        </td>
      </tr>
    </tfoot>
  </table>
</div>
```

### 3.2 Key HTML Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Table rows | `#gridContainer table tbody tr` | Each file entry |
| Download link | `tr td:first-child a` | File name + download href |
| File size | `tr td:nth-child(3)` | File size (e.g., "1.5 MB") |
| Total pages | `#gridContainer table tfoot tr td a:last-child` | Last page number for pagination |

### 3.3 Pagination

Total pages can be extracted using:
- XPath: `//\*[@id="gridContainer"]/table/tfoot/tr/td/a[6]/@href`
- Pattern: `[?&]page=([0-9]+)` on the last pagination link

---

## 4. File Format & Structure

### 4.1 File Types (Same as Cerberus)

| Type | File Prefix | catID | Description |
|------|-------------|-------|-------------|
| Stores | `Stores` | 5 | Store directory (daily) |
| PriceFull | `PriceFull` | 2 | Full price list per store (daily) |
| Prices | `Prices` | 1 | Incremental price updates (hourly) |
| PromoFull | `PromoFull` | 4 | Full promotion list (daily) |
| Promos | `Promos` | 3 | Incremental promo updates (hourly) |

### 4.2 File Name Convention

Same pattern as Cerberus:
```
{Type}{ChainCode}-{StoreId}-{Timestamp}.gz
Example: PriceFull7290027600007-001-202602160000.gz
```

### 4.3 Compression

Files are **gzip compressed** (`.gz`), same as Cerberus.
Our existing `BaseProvider.decompressFile()` can be reused directly.

### 4.4 Encoding

The XML files may use either **UTF-8** or **Windows-1255** encoding. Different chains use different encodings.
Shufersal typically uses **UTF-8**, but the parser should handle both.

---

## 5. XML Schema

### 5.1 Price File Elements (PriceFull / Prices)

The XML structure follows the Israeli government's price transparency regulation.
Elements inside each `<Item>` node:

| Element | Description | Used in our PriceProcessor |
|---------|-------------|---------------------------|
| `ChainId` | Chain identifier | - |
| `SubchainId` | Sub-chain identifier | - |
| `StoreId` | Store number | - |
| `ItemCode` | Product barcode (EAN) | Yes: `xmlItem.ItemCode` |
| `ItemName` | Product name (Hebrew) | Yes: `xmlItem.ItemName` |
| `ItemPrice` | Price in NIS | Yes: `xmlItem.ItemPrice` |
| `ItemType` | Product type code | - |
| `ManufacturerName` | Manufacturer name | Yes: `xmlItem.ManufacturerName` |
| `ManufacturerCountry` | Country of origin | - |
| `ManufacturerItemDescription` | Product description | - |
| `UnitQty` | Unit quantity | - |
| `Quantity` | Quantity value | - |
| `UnitOfMeasure` | Unit type (kg, liter, etc.) | Yes: `xmlItem.UnitOfMeasure` |
| `bIsWeighted` / `blsWeighted` | Is weighted item | - |
| `QtyInPackage` | Items per package | - |
| `UnitOfMeasurePrice` | Price per unit | - |
| `AllowDiscount` | Discount allowed flag | - |
| `ItemStatus` | Item status | - |
| `PriceUpdateDate` | Last price update timestamp | - |

### 5.2 Store File Elements (Stores)

Elements inside each `<Store>` or `<Branch>` node:

| Element | Description | Used in our StoreProcessor |
|---------|-------------|---------------------------|
| `ChainId` | Chain identifier | - |
| `SubchainId` | Sub-chain code | Yes: `node.SubChainId` |
| `StoreId` | Store number | Yes: `node.StoreId` |
| `ChainName` | Chain name | - |
| `SubchainName` | Sub-chain name | - |
| `StoreName` | Branch name | Yes: `node.StoreName` |
| `BikoretNo` | Audit number | - |
| `StoreType` | Store type code | - |
| `Address` | Street address | Yes: `node.Address` |
| `City` | City name | Yes: `node.City` |
| `ZipCode` | Zip code | - |
| `LastUpdateTime` / `LastUpdateDate` | Last update timestamp | - |

### 5.3 Promo File Elements (PromoFull / Promos)

Elements inside each `<Promotion>` or `<Sale>` node:

| Element | Description |
|---------|-------------|
| `PromotionId` | Promotion identifier |
| `PromotionDescription` | Promotion description |
| `PromotionStartDate` / `PromotionStartHour` | Start time |
| `PromotionEndDate` / `PromotionEndHour` | End time |
| `RewardType` | Reward type |
| `DiscountRate` | Discount percentage |
| `DiscountType` | Type of discount |
| `MinPurchaseAmnt` | Minimum purchase amount |
| `MinQty` / `MaxQty` | Min/max quantities |
| `DiscountedPrice` | Discounted price |
| `ItemCode` | Product barcode (in promo) |
| `Remarks` | Additional notes |

---

## 6. Reusable Components from Cerberus Provider

### 6.1 Can Reuse Directly (No Changes Needed)

| Component | File | Reason |
|-----------|------|--------|
| `BaseProvider` | `core/BaseProvider.js` | Base class with `run()`, `filterFiles()`, `decompressFile()`, `cleanupFiles()` |
| `PriceProcessor` | `processors/PriceProcessor.js` | Same XML elements (`ItemCode`, `ItemName`, `ItemPrice`, etc.) |
| `StoreProcessor` | `processors/StoreProcessor.js` | Same XML elements (`StoreId`, `StoreName`, `City`, etc.) |
| `BaseProcessor` | `core/BaseProcessor.js` | `saveBatch()` and `process()` infrastructure |
| `TelegramClient` | `utils/TelegramClient.js` | Notification system |
| DOC_TYPES | `core/BaseProvider.js` | Same document type definitions |

### 6.2 Need New Implementation (ShufersalProvider-specific)

| Method | Reason |
|--------|--------|
| `fetchFileList(docType)` | HTTP with pagination instead of FTP |
| `downloadFile(url, outputPath)` | HTTP download with session cookies instead of FTP |
| `extractStoreId(fileName)` | Same regex pattern should work, but verify |
| Session management | Cookie-based sessions for anti-bot protection |

### 6.3 Shared Pattern: `extractStoreId`

The file naming convention is the **same** as Cerberus:
```
PriceFull7290027600007-001-202602160000.gz
```
The existing regex `/-(\d+)-\d{12}/` should work identically.

---

## 7. Implementation Plan

### 7.1 New Files Needed

1. **`scraper/providers/ShufersalProvider.js`** - Main provider class

### 7.2 Files to Modify

1. **`scraper/index.js`** - Add `shufersal` to PROVIDERS registry
2. **Database** - Add Shufersal chain entry with `scraper_type: 'shufersal'`

### 7.3 New Dependencies (Possibly)

| Package | Purpose | Alternative |
|---------|---------|-------------|
| `tough-cookie` + `axios-cookiejar-support` | Cookie jar for axios | Use Playwright for session init |
| `cheerio` | HTML parsing (lightweight) | Use regex on simple HTML |

### 7.4 ShufersalProvider Architecture

```javascript
class ShufersalProvider extends BaseProvider {
  constructor(config, supabase) {
    super(config, supabase);
    this.baseUrl = 'https://prices.shufersal.co.il';
    this.cookieJar = null; // initialized on first request
  }

  // 1. Establish session (visit main page, get cookies)
  async initSession() { ... }

  // 2. Fetch file list from paginated HTML pages
  async fetchFileList(docType) {
    await this.initSession();
    // Map docType to catID
    // For each page: GET /FileObject/UpdateCategory?catID=X&page=N
    // Parse HTML table rows
    // Extract file name, download URL, store ID
  }

  // 3. Download file using session cookies
  async downloadFile(url, outputPath, retries = 3) {
    // Use axios with cookie jar
    // GET the download URL with session cookies
  }

  // 4. Same as Cerberus
  extractStoreId(fileName) {
    const match = fileName.match(/-(\d+)-\d{12}/);
    return match ? match[1] : null;
  }

  // 5. Same processors as Cerberus
  getProcessor(docType) {
    if (docType === DOC_TYPES.STORES) return new StoreProcessor(...);
    return new PriceProcessor(...);
  }
}
```

### 7.5 catID Mapping

```javascript
const CAT_ID_MAP = {
  [DOC_TYPES.STORES]:       '5',
  [DOC_TYPES.PRICE_FULL]:   '2',
  [DOC_TYPES.PRICE_UPDATE]: '1',
  [DOC_TYPES.PROMO_FULL]:   '4',
  [DOC_TYPES.PROMO_UPDATE]: '3',
};
```

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| 403 from simple HTTP | High | Cookie jar session management; fallback to Playwright |
| Geo-blocking (non-IL IPs) | Medium | Run from Israeli server/VPS |
| HTML structure changes | Medium | Use robust selectors; add monitoring |
| Rate limiting | Low | Respect delays between requests; use p-limit(2) |
| Encoding issues (Windows-1255) | Low | Our XML parser handles UTF-8; add fallback if needed |
| Pagination edge cases | Low | Handle zero-page responses gracefully |

---

## 9. Sources

- [Shufersal Price Transparency Site](https://prices.shufersal.co.il/)
- [OpenIsraeliSupermarkets - Scrapers](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers)
- [OpenIsraeliSupermarkets - Parsers](https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-parsers)
- [fluhus/prices - Go Parser](https://github.com/fluhus/prices)
- [Gov.il - Price Transparency Regulation](https://www.gov.il/he/departments/legalInfo/cpfta_prices_regulations)
- [ganoti/prices - Hebrew University Aggregator](https://github.com/ganoti/prices)
- [AKorets/israeli-supermarket-data](https://github.com/AKorets/israeli-supermarket-data)
- [il-supermarket-scraper on PyPI](https://pypi.org/project/il-supermarket-scraper/)
