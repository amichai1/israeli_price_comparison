# Israeli Supermarket Price Comparison App - Design Plan

## Overview
A mobile app for comparing grocery prices across major Israeli supermarket chains (Osher Ad, Yohananof, Shufersal, Rami Levy) based on real-time price transparency data.

## Design Philosophy
- **Mobile-first**: Optimized for portrait orientation (9:16) and one-handed usage
- **iOS HIG Compliance**: Follows Apple Human Interface Guidelines for native iOS feel
- **Efficiency**: Quick product search and instant price comparison
- **Transparency**: Clear indication of missing items and partial prices

## Screen List

### 1. Search Screen (Home)
**Primary Content:**
- Search bar at top for product search by name or barcode
- Product search results list with:
  - Product name
  - Barcode
  - Unit measure
  - "Add to Basket" button
- Current basket summary badge (item count)

**Functionality:**
- Real-time search as user types
- Tap product to add to basket
- Visual feedback when item added
- Empty state when no results

### 2. Basket Screen
**Primary Content:**
- List of selected products with:
  - Product name and barcode
  - Unit measure
  - Remove button
- "Compare Prices" button at bottom
- Empty state when basket is empty

**Functionality:**
- Swipe to delete items
- Clear all basket button
- Navigate to comparison screen

### 3. Price Comparison Screen
**Primary Content:**
- Comparison table showing:
  - Store name and logo
  - Total basket price (in ₪)
  - Status indicator (complete/partial)
- Cheapest store highlighted in green
- Warning badges for missing items
- Detailed breakdown expandable per store

**Functionality:**
- Tap store row to see item-by-item breakdown
- Missing item warnings with specific product names
- Refresh button to update prices
- Share comparison results

## Key User Flows

### Flow 1: Search and Add Products
1. User opens app → Search Screen
2. User types product name in search bar
3. Results appear in real-time
4. User taps "Add to Basket" on desired products
5. Badge updates showing basket count
6. User switches to Basket tab

### Flow 2: Compare Prices
1. User is on Basket Screen with items
2. User taps "Compare Prices" button
3. App navigates to Comparison Screen
4. Comparison table loads with store totals
5. Cheapest store highlighted in green
6. User taps store row to see breakdown
7. Modal shows item-by-item prices

### Flow 3: Handle Missing Items
1. User on Comparison Screen
2. Store with missing items shows warning badge
3. User taps store row
4. Breakdown shows "Not available" for missing items
5. Partial total clearly indicated

## Color Choices

### Brand Colors
- **Primary**: `#0066CC` (Israeli blue - trust and reliability)
- **Success**: `#22C55E` (Green - cheapest price highlight)
- **Warning**: `#F59E0B` (Amber - partial data warning)
- **Error**: `#EF4444` (Red - missing items)

### UI Colors
- **Background**: `#FFFFFF` (light) / `#151718` (dark)
- **Surface**: `#F5F5F5` (light) / `#1E2022` (dark)
- **Foreground**: `#11181C` (light) / `#ECEDEE` (dark)
- **Muted**: `#687076` (light) / `#9BA1A6` (dark)
- **Border**: `#E5E7EB` (light) / `#334155` (dark)

## Typography
- **Headers**: Bold, 24-28px
- **Body**: Regular, 16px
- **Captions**: Regular, 14px
- **Prices**: Bold, 18-20px (₪ symbol)

## Layout Patterns

### Search Results
- Full-width cards with subtle shadows
- Left-aligned text, right-aligned action button
- 16px horizontal padding, 12px vertical padding
- 8px gap between cards

### Comparison Table
- Full-width rows with alternating backgrounds
- Store logo/icon on left (40x40px)
- Store name and price in center
- Status badge on right
- Tap target: entire row (minimum 48px height)

### Bottom Actions
- Fixed bottom bar with primary action button
- Safe area insets respected
- Full-width button with 16px horizontal margin
- 48px height for easy thumb reach

## Interaction Patterns

### Feedback
- **Add to Basket**: Scale animation (0.97) + success haptic
- **Remove Item**: Swipe gesture + confirmation haptic
- **Price Load**: Skeleton loading states
- **Empty States**: Friendly illustrations with clear CTAs

### Navigation
- **Tab Bar**: 2 tabs (Search, Basket)
- **Modal**: Comparison screen as full-screen modal
- **Back**: Standard iOS back gesture and button

## Data Handling

### Local Storage
- Basket items stored in AsyncStorage
- Persist across app sessions
- Clear basket option available

### Real-time Updates
- Prices fetched from Supabase on comparison
- Last updated timestamp shown
- Manual refresh available

### Missing Data
- Clear visual indicators (warning icon)
- Explanatory text: "Item X not found in Store Y"
- Partial total calculation and display

## Accessibility
- Minimum touch targets: 44x44px
- High contrast ratios for text
- Clear labels for screen readers
- Haptic feedback for actions

## Performance
- Debounced search (300ms)
- Pagination for large result sets
- Cached product data
- Optimistic UI updates for basket

## Notes
- No user authentication required (local app)
- No cloud sync (all data local except price queries)
- Focus on speed and simplicity
- Israeli market specific (₪ currency, Hebrew support optional)
