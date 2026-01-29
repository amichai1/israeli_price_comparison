# City Selection Feature

The app now includes a city selection feature that allows users to filter stores and price comparisons by city. Petah Tikva is set as the default city.

## Features

### 1. City Picker UI
- Located on the Search screen, below the header
- Dropdown-style picker with all available cities
- Shows currently selected city
- Smooth dropdown animation with haptic feedback

### 2. City-Based Filtering
- Price comparison shows only stores from the selected city
- Automatically filters results when comparing basket prices
- City name displayed in comparison screen header

### 3. Persistent Selection
- Selected city is saved to AsyncStorage
- Persists across app restarts
- Defaults to "Petah Tikva" on first launch

## Database Structure

### Updated Stores Table
```sql
stores (
  id SERIAL PRIMARY KEY,
  chain_name VARCHAR(100),
  branch_name VARCHAR(255),
  city VARCHAR(100),
  address TEXT,
  store_id VARCHAR(50),  -- NEW: External store ID from chain
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Petah Tikva Stores
Real store IDs have been configured for Petah Tikva:

| Chain | Store ID | Branch Name |
|-------|----------|-------------|
| Rami Levy | 71 | Rami Levy Petah Tikva |
| Osher Ad | 1290 | Osher Ad Petah Tikva |
| Yohananof | 1776 | Yohananof Petah Tikva |
| Shufersal | 269 | Shufersal Petah Tikva |

## Scraper Updates

The scraper now accepts an optional store ID parameter to match specific stores:

```bash
# Basic usage (creates new store or matches by name)
node rami-levy-scraper.js <xml-url>

# With store ID (matches existing store by ID)
node rami-levy-scraper.js <xml-url> 71
```

### Example Usage

```bash
# Scrape Rami Levy Petah Tikva (store ID: 71)
node rami-levy-scraper.js https://url.retail.publishedprices.co.il/file/d/PriceFull7290027600007-001-202601250000.gz 71

# Scrape Osher Ad Petah Tikva (store ID: 1290)
node osher-ad-scraper.js https://url.retail.publishedprices.co.il/file/d/PriceFull... 1290
```

### Store Matching Logic

The scraper uses a three-tier matching strategy:

1. **By store_id**: If provided, tries to match existing store by chain_name + store_id
2. **By branch_name**: Falls back to matching by chain_name + branch_name
3. **Create new**: If no match found, creates a new store entry

This ensures that scraped data updates the correct store in the database.

## API Changes

### getPriceComparison()

Updated signature:
```typescript
getPriceComparison(itemIds: number[], city?: string): Promise<StoreComparison[]>
```

**Parameters:**
- `itemIds`: Array of item IDs to compare
- `city`: Optional city filter (e.g., "Petah Tikva")

**Behavior:**
- Without city: Returns all stores
- With city: Returns only stores in that city

## User Flow

1. **App Launch**
   - City context loads "Petah Tikva" from storage (or sets as default)
   - Search screen displays city picker with "Petah Tikva" selected

2. **Changing City**
   - User taps city picker
   - Dropdown shows available cities
   - User selects a city
   - Selection is saved to AsyncStorage
   - All subsequent price comparisons use the new city

3. **Price Comparison**
   - User adds items to basket
   - Navigates to comparison screen
   - Only stores from selected city are shown
   - City name displayed in header

## Available Cities

- Petah Tikva (default, 4 stores)
- Jerusalem (1 store)
- Tel Aviv (1 store)
- Haifa (1 store)
- Ramat Gan (1 store)

## Testing

All city selection features have been tested:

✅ Petah Tikva stores exist in database  
✅ Correct store IDs configured  
✅ Price comparison filters by city  
✅ Returns all stores when no filter  
✅ Correctly identifies cheapest store  
✅ Handles missing items properly  

Run tests:
```bash
pnpm test city-selection.test.ts
```

## Migration Instructions

If you've already run the initial schema, apply these updates:

### Option 1: Run SQL Migration (Recommended)

Copy and paste `database/UPDATE_REAL_STORE_IDS.sql` into Supabase SQL Editor.

### Option 2: Run Node.js Script

```bash
cd scraper
node update-store-ids.js
```

This will:
- Add store_id column if missing
- Update Petah Tikva stores with real IDs (71, 1290, 1776, 269)
- Remove duplicate stores

## Future Enhancements

### Potential Improvements

1. **Location-Based Selection**
   - Use device GPS to auto-select nearest city
   - Show distance to each store

2. **Multi-City Comparison**
   - Allow comparing prices across cities
   - Show price differences between regions

3. **Store-Level Selection**
   - Let users select specific stores within a city
   - Create custom store lists

4. **City Management**
   - Add/remove cities dynamically
   - Sync city list from server

## Troubleshooting

### City picker not showing
- Check that CityProvider is wrapped around the app in `app/_layout.tsx`
- Verify AsyncStorage permissions

### Price comparison shows all stores
- Ensure `selectedCity` is passed to `getPriceComparison()`
- Check that stores have correct `city` values in database

### Scraper not matching stores
- Verify store_id parameter is passed correctly
- Check that store_id matches database value
- Review scraper console output for matching logs

## Code References

### Key Files

- `lib/city-context.tsx` - City selection state management
- `app/(tabs)/index.tsx` - City picker UI
- `app/(tabs)/comparison.tsx` - Filtered comparison
- `lib/supabase-service.ts` - City filtering logic
- `scraper/rami-levy-scraper.js` - Store ID matching
- `database/UPDATE_REAL_STORE_IDS.sql` - Migration script

### Context Usage

```typescript
import { useCity } from '@/lib/city-context';

function MyComponent() {
  const { selectedCity, setSelectedCity, availableCities } = useCity();
  
  // Use selectedCity for filtering
  const results = await getPriceComparison(itemIds, selectedCity);
  
  // Change city
  setSelectedCity('Tel Aviv');
}
```

---

**Version:** 1.0  
**Last Updated:** January 25, 2026  
**Status:** ✅ Fully Implemented and Tested
