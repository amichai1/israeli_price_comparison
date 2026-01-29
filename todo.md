# Project TODO

## Branding
- [x] Generate custom app logo for Israeli price comparison
- [x] Update app.config.ts with app name and logo URL

## Database & Backend
- [x] Create Supabase database schema (items, stores, prices tables)
- [x] Set up database migrations
- [x] Document backend setup in database/README.md

## Frontend - Search Screen
- [x] Create product search screen with search bar
- [x] Implement real-time search functionality
- [x] Display search results in scrollable list
- [x] Add "Add to Basket" functionality
- [x] Show basket item count badge
- [x] Handle empty states

## Frontend - Basket Screen
- [x] Create basket screen with item list
- [x] Implement delete button for basket items
- [x] Add "Clear All" functionality
- [x] Create "Compare Prices" button
- [x] Handle empty basket state

## Frontend - Price Comparison Screen
- [x] Create comparison screen with store table
- [x] Display store names and total prices
- [x] Highlight cheapest store in green
- [x] Show warning badges for missing items
- [x] Implement expandable store details
- [x] Add item-by-item breakdown modal
- [ ] Show last updated timestamp

## Data Integration
- [x] Set up Supabase client configuration (with mock data for demo)
- [x] Create API service for product search
- [x] Create API service for price comparison
- [x] Implement local basket storage with AsyncStorage
- [x] Add loading states and error handling

## Scraper Development
- [x] Create Node.js scraper for Rami Levy XML data
- [x] Implement XML parsing logic
- [x] Add database update functionality
- [ ] Create scraper for Osher Ad
- [ ] Create scraper for Yohananof
- [ ] Create scraper for Shufersal
- [x] Document scraper usage and deployment

## Testing & Polish
- [x] Test search functionality
- [x] Test basket management
- [x] Test price comparison accuracy
- [x] Test missing item handling
- [x] Verify responsive layout
- [x] Add haptic feedback
- [x] Optimize performance

## Supabase Integration
- [x] Configure app with real Supabase credentials
- [x] Replace mock data with real Supabase queries
- [x] Install @supabase/supabase-js package
- [x] Update scraper with Supabase credentials
- [x] Test search functionality with real data
- [x] Test price comparison with real data

## Scraper Improvements
- [x] Update scraper to accept command-line URL argument
- [x] Add progress reporting and better error messages
- [x] Create step-by-step usage guide for running scraper
- [ ] Test scraper with real XML file from portal

## City Selection Feature
- [x] Update database with real Petah Tikva store branches
- [x] Add city picker UI to search screen
- [x] Set Petah Tikva as default city
- [x] Implement city-based store filtering
- [x] Update price comparison to show only selected city stores
- [x] Update scraper to accept store ID parameter
- [x] Add store_id field to database schema
- [x] Test city selection and filtering

## RTL (Right-to-Left) Support
- [x] Create RTL detection utility function
- [x] Update search screen with RTL text alignment
- [x] Update search input field with RTL support
- [x] Update basket screen with RTL text alignment
- [x] Update comparison screen with RTL text alignment
- [x] Test RTL with Hebrew product names
