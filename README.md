# Price Compare IL - Israeli Supermarket Price Comparison App

A mobile application for comparing grocery prices across major Israeli supermarket chains (Rami Levy, Osher Ad, Yohananof, Shufersal) based on the Israeli Price Transparency Law open data.

## Features

### ✨ Core Features

- **Product Search**: Search for products by name or barcode with real-time results
- **Shopping Basket**: Add items to your basket and manage them easily
- **Price Comparison**: Compare total basket prices across all major Israeli chains
- **Missing Item Detection**: Clear warnings when items are not available at specific stores
- **Cheapest Store Highlight**: Automatically identifies and highlights the cheapest option
- **Detailed Breakdowns**: View item-by-item price breakdowns for each store

### 🎨 User Experience

- Clean, modern iOS-style interface following Apple Human Interface Guidelines
- Portrait-optimized for one-handed usage
- Haptic feedback for interactions
- Dark mode support
- Fast, responsive search with debouncing
- Persistent basket across app sessions

## Tech Stack

### Frontend
- **React Native** 0.81 with **Expo SDK 54**
- **TypeScript** 5.9 for type safety
- **NativeWind 4** (Tailwind CSS for React Native)
- **Expo Router 6** for navigation
- **AsyncStorage** for local data persistence

### Backend
- **Supabase** (PostgreSQL) for database
- **Node.js** scraper for XML data processing
- Israeli Price Transparency portals for data source

### Design
- Custom app icon and branding
- Israeli blue color scheme (#0066CC)
- Responsive layouts for all screen sizes

## Project Structure

```
israeli_price_comparison/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx             # Search screen
│   │   ├── basket.tsx            # Basket screen
│   │   └── comparison.tsx        # Price comparison screen
│   └── _layout.tsx               # Root layout
├── components/                   # Reusable UI components
│   ├── screen-container.tsx      # SafeArea wrapper
│   └── ui/
│       └── icon-symbol.tsx       # Icon mappings
├── lib/                          # Utilities and services
│   ├── supabase-service.ts       # API service (currently mock data)
│   ├── basket-storage.ts         # AsyncStorage helpers
│   └── utils.ts                  # Utility functions
├── types/                        # TypeScript type definitions
│   └── index.ts                  # Shared types
├── database/                     # Database setup
│   ├── schema.sql                # PostgreSQL schema
│   └── README.md                 # Database documentation
├── scraper/                      # Price data scraper
│   ├── rami-levy-scraper.js      # Rami Levy scraper
│   ├── package.json              # Scraper dependencies
│   └── README.md                 # Scraper documentation
├── assets/images/                # App icons and images
├── design.md                     # Design plan and guidelines
├── todo.md                       # Project task list
├── SUPABASE_SETUP.md            # Supabase setup guide
└── README.md                     # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Expo Go app on your phone (for testing)

### Installation & Setup

#### 1️⃣ Clone the repository
```bash
cd /path/to/your/projects
git clone <repo-url>
cd israeli_price_comparison
```

#### 2️⃣ Install dependencies
```bash
npm install
# or
pnpm install
```

#### 3️⃣ Setup environment variables

**⚠️ IMPORTANT: Keep your `.env` file SECRET!**

```bash
# Copy the template
cp .env.example .env

# Edit .env and add your credentials (see .env.example for template)
# DO NOT share or commit this file!
```

Add to `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://wpdaidwskbgiphgdarbp.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**Get these from:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select project `wpdaidwskbgiphgdarbp`
3. Go to **Settings → API**
4. Copy the **anon public** key (not the service role key!)

⚠️ **Security Notes:**
- `.env` is in `.gitignore` - it won't be committed
- If you accidentally commit credentials, [see SECURITY.md](./SECURITY.md) for remediation
- Use `cp .env.example .env` to get started, never add `.env` to Git


#### 4️⃣ Populate the database with sample data
```bash
cd scraper
npm install
node populate-sample-data.js
```

This adds:
- ✅ 20 sample Israeli grocery products
- ✅ 4 supermarket chains (Rami Levy, Osher Ad, Yohananof, Shufersal)
- ✅ Realistic prices across stores

#### 5️⃣ Start the development server
```bash
# From root directory
npm run dev
# or
pnpm dev
```

You'll see:
```
expo://YOUR_IP:8081
```

#### 6️⃣ Run the app

**Option A: iOS Simulator (Mac)**
```bash
Press 'i' in terminal
```

**Option B: Android Emulator**
```bash
Press 'a' in terminal
```

**Option C: Physical Device**
```bash
1. Install Expo Go from App Store / Google Play
2. Scan QR code from terminal
3. App opens in Expo Go
```

### Troubleshooting

**"supabaseKey is required"**
- ✅ Check `.env` file exists
- ✅ Verify `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set
- ✅ Restart dev server after updating `.env`

**"No products found"**
- ✅ Run `node populate-sample-data.js` in scraper folder
- ✅ Check you selected the correct city

**Can't type in search**
- ✅ This is a known RTL issue, workaround coming soon

## Database Setup

### Using Existing Database

The project is already connected to a Supabase project. You just need to:

1. Get the **Anon Key** from [Supabase Dashboard](https://app.supabase.com)
2. Add it to `.env` file
3. Run `populate-sample-data.js` to add sample data

### Creating Your Own Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Run SQL schema from `database/schema.sql`
4. Get your project URL and Anon Key
5. Update `.env` file

### Database Schema

```sql
-- Main tables
- items (id, barcode, name, unit_measure)
- stores (id, chain_name, branch_name, city, address)
- prices (id, item_id, store_id, price, last_updated)

-- Relationships
- prices.item_id → items.id
- prices.store_id → stores.id
```

See `database/schema.sql` for complete schema.

## Scraper Setup

The scraper downloads and parses XML files from Israeli Price Transparency portals and imports them into Supabase.

### Quick Start with Sample Data

```bash
cd scraper
npm install
node populate-sample-data.js
```

This populates the database with realistic sample data for testing.

### Using Real Data from Rami Levy

For real prices from Rami Levy portal:

1. Download XML file from [url.retail.publishedprices.co.il](https://url.retail.publishedprices.co.il)
   - Login: `RamiLevi` (no password)
   - Download a `PriceFull` file

2. Run scraper:
```bash
cd scraper
npm install
node rami-levy-scraper.js <path-to-xml-file-or-url>
```

See `scraper/README.md` for full documentation.

### Scraper Output

- ✅ Imports products into `items` table
- ✅ Updates store information in `stores` table
- ✅ Inserts/updates prices in `prices` table
- ✅ Automatically handles duplicates

## Development

### Project Conventions

- **TypeScript**: All code is type-safe
- **Tailwind CSS**: Use NativeWind classes for styling
- **Component Structure**: Functional components with hooks
- **State Management**: React hooks + AsyncStorage
- **Error Handling**: Try-catch blocks with console logging

### Adding New Features

1. Update `todo.md` with new tasks
2. Implement the feature
3. Test on iOS and Android
4. Mark tasks as complete in `todo.md`
5. Update documentation

### Styling Guidelines

- Use Tailwind classes via `className` prop
- Follow the color palette in `theme.config.js`
- Maintain consistent spacing (4px grid)
- Ensure minimum touch targets of 44x44px

## Mock Data

The app includes mock data for 10 sample products and 4 stores with realistic prices. This allows you to:

- Test the UI without setting up Supabase
- Demonstrate the app functionality
- Develop and iterate quickly

Mock data is defined in `lib/supabase-service.ts`.

## Deployment

### Building for Production

```bash
# Build for iOS
pnpm ios

# Build for Android
pnpm android
```

### Publishing with EAS

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project
eas build:configure

# Build for app stores
eas build --platform all
```

## Roadmap

### Completed ✅

- [x] Product search with real-time results
- [x] Shopping basket management
- [x] Price comparison across stores
- [x] Missing item detection and warnings
- [x] Cheapest store highlighting
- [x] Detailed price breakdowns
- [x] Database schema and documentation
- [x] Rami Levy scraper implementation
- [x] Mock data for testing

### Planned 🔄

- [ ] Connect to real Supabase database
- [ ] Implement scrapers for other chains (Osher Ad, Yohananof, Shufersal)
- [ ] Add barcode scanning functionality
- [ ] Store location filtering
- [ ] Price history and trends
- [ ] Favorites and shopping lists
- [ ] Push notifications for price drops
- [ ] Share comparison results

## Israeli Price Transparency Law

This app leverages data published under the Israeli Price Transparency Law, which requires major supermarket chains to publish their price data in XML format.

### Data Sources

- **Rami Levy, Osher Ad, Yohananof**: [url.retail.publishedprices.co.il](https://url.retail.publishedprices.co.il)
- **Shufersal**: [prices.shufersal.co.il](https://prices.shufersal.co.il)

### Data Update Frequency

- **Full Price Lists**: Daily
- **Incremental Updates**: Hourly
- **Store Information**: Weekly

## Contributing

Contributions are welcome! Areas for improvement:

- Additional scrapers for other chains
- UI/UX enhancements
- Performance optimizations
- Test coverage
- Documentation improvements

## License

This project is for educational and demonstration purposes. Price data is sourced from public Israeli Price Transparency portals.

## Support

For questions or issues:

1. Check the documentation in `database/README.md` and `scraper/README.md`
2. Review the `SUPABASE_SETUP.md` guide
3. Inspect the `design.md` for design decisions

## Acknowledgments

- Israeli Ministry of Economy for the Price Transparency initiative
- Supabase for the backend infrastructure
- Expo team for the excellent mobile development framework
- Israeli supermarket chains for publishing their data

---

**Built with ❤️ for the Israeli consumer**
