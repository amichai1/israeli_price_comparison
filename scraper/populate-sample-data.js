/**
 * Sample Data Populator
 * 
 * This script populates the Supabase database with sample Israeli grocery products
 * and realistic prices across the four major supermarket chains.
 * 
 * Run this to test the app with real data before implementing the full XML scraper.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables!');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  console.error('\n📝 Please set these in your .env file:');
  console.error('   SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Sample products with realistic Israeli barcodes
const sampleProducts = [
  { barcode: '7290000000001', name: 'Milk 3% 1L', unit_measure: 'liter' },
  { barcode: '7290000000002', name: 'White Bread 500g', unit_measure: 'piece' },
  { barcode: '7290000000003', name: 'Eggs 12 pack', unit_measure: 'pack' },
  { barcode: '7290000000004', name: 'Cottage Cheese 250g', unit_measure: 'piece' },
  { barcode: '7290000000005', name: 'Tomatoes 1kg', unit_measure: 'kg' },
  { barcode: '7290000000006', name: 'Cucumbers 1kg', unit_measure: 'kg' },
  { barcode: '7290000000007', name: 'Olive Oil 1L', unit_measure: 'liter' },
  { barcode: '7290000000008', name: 'Chicken Breast 1kg', unit_measure: 'kg' },
  { barcode: '7290000000009', name: 'Rice 1kg', unit_measure: 'kg' },
  { barcode: '7290000000010', name: 'Orange Juice 1L', unit_measure: 'liter' },
  { barcode: '7290000000011', name: 'Yogurt 500g', unit_measure: 'piece' },
  { barcode: '7290000000012', name: 'Pasta 500g', unit_measure: 'piece' },
  { barcode: '7290000000013', name: 'Tuna Can 160g', unit_measure: 'piece' },
  { barcode: '7290000000014', name: 'Hummus 400g', unit_measure: 'piece' },
  { barcode: '7290000000015', name: 'Pita Bread 6 pack', unit_measure: 'pack' },
  { barcode: '7290000000016', name: 'Chocolate Bar 100g', unit_measure: 'piece' },
  { barcode: '7290000000017', name: 'Coffee 200g', unit_measure: 'piece' },
  { barcode: '7290000000018', name: 'Tea Bags 25 pack', unit_measure: 'pack' },
  { barcode: '7290000000019', name: 'Butter 200g', unit_measure: 'piece' },
  { barcode: '7290000000020', name: 'Sugar 1kg', unit_measure: 'kg' },
];

// Price ranges for each product (min, max in ILS)
const priceRanges = {
  '7290000000001': [5.50, 6.90],  // Milk
  '7290000000002': [4.20, 5.50],  // Bread
  '7290000000003': [12.00, 14.50], // Eggs
  '7290000000004': [6.50, 8.00],  // Cottage Cheese
  '7290000000005': [7.90, 10.50], // Tomatoes
  '7290000000006': [5.50, 8.00],  // Cucumbers
  '7290000000007': [22.00, 28.00], // Olive Oil
  '7290000000008': [35.00, 45.00], // Chicken
  '7290000000009': [8.00, 12.00],  // Rice
  '7290000000010': [9.00, 12.00],  // Orange Juice
  '7290000000011': [7.50, 9.50],   // Yogurt
  '7290000000012': [5.00, 7.50],   // Pasta
  '7290000000013': [6.50, 9.00],   // Tuna
  '7290000000014': [8.00, 11.00],  // Hummus
  '7290000000015': [6.00, 8.50],   // Pita
  '7290000000016': [4.50, 6.50],   // Chocolate
  '7290000000017': [18.00, 25.00], // Coffee
  '7290000000018': [8.00, 12.00],  // Tea
  '7290000000019': [9.00, 12.00],  // Butter
  '7290000000020': [5.00, 7.50],   // Sugar
};

/**
 * Generate random price within range
 */
function randomPrice(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

/**
 * Insert sample items
 */
async function insertItems() {
  console.log('Inserting sample items...');
  
  for (const product of sampleProducts) {
    const { data, error } = await supabase
      .from('items')
      .upsert(product, { onConflict: 'barcode' });
    
    if (error) {
      console.error(`Error inserting ${product.name}:`, error.message);
    } else {
      console.log(`✓ Inserted: ${product.name}`);
    }
  }
}

/**
 * Get store IDs
 */
async function getStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('id');
  
  if (error) {
    console.error('Error fetching stores:', error.message);
    return [];
  }
  
  return data || [];
}

/**
 * Insert prices for all items at all stores
 */
async function insertPrices() {
  console.log('\nInserting prices...');
  
  // Get all items
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('*');
  
  if (itemsError) {
    console.error('Error fetching items:', itemsError.message);
    return;
  }
  
  // Get all stores
  const stores = await getStores();
  
  if (!stores || stores.length === 0) {
    console.error('No stores found. Please run the database schema first.');
    return;
  }
  
  console.log(`Found ${items.length} items and ${stores.length} stores`);
  
  // Insert prices for each item at each store
  for (const item of items) {
    const [minPrice, maxPrice] = priceRanges[item.barcode] || [5.00, 15.00];
    
    for (const store of stores) {
      // Randomly skip some items at some stores (to test missing item handling)
      const skipChance = Math.random();
      if (skipChance < 0.15) { // 15% chance to skip
        console.log(`  ⊗ Skipping ${item.name} at ${store.chain_name}`);
        continue;
      }
      
      const price = randomPrice(minPrice, maxPrice);
      
      const { error } = await supabase
        .from('prices')
        .upsert({
          item_id: item.id,
          store_id: store.id,
          price: parseFloat(price),
          last_updated: new Date().toISOString(),
        }, { onConflict: 'item_id,store_id' });
      
      if (error) {
        console.error(`  ✗ Error inserting price for ${item.name} at ${store.chain_name}:`, error.message);
      } else {
        console.log(`  ✓ ${item.name} at ${store.chain_name}: ₪${price}`);
      }
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting sample data population...\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);
  
  try {
    await insertItems();
    await insertPrices();
    
    console.log('\n✅ Sample data population completed!');
    console.log('\nYou can now:');
    console.log('1. Open the mobile app');
    console.log('2. Search for products (e.g., "milk", "bread", "eggs")');
    console.log('3. Add items to your basket');
    console.log('4. Compare prices across stores');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { main };
