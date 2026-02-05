/**
 * Run database migration to add store_id and populate Petah Tikva stores
 */

const { createClient } = require('@supabase/supabase-js');

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

async function runMigration() {
  console.log('🔄 Running migration...\n');
  
  try {
    // Step 1: Clear existing data
    console.log('1. Clearing existing prices...');
    const { error: pricesError } = await supabase.from('prices').delete().neq('id', 0);
    if (pricesError) console.error('  Warning:', pricesError.message);
    else console.log('  ✓ Prices cleared');
    
    console.log('2. Clearing existing stores...');
    const { error: storesError } = await supabase.from('stores').delete().neq('id', 0);
    if (storesError) console.error('  Warning:', storesError.message);
    else console.log('  ✓ Stores cleared');
    
    // Step 2: Insert Petah Tikva stores
    console.log('\n3. Inserting Petah Tikva stores...');
    
    const petahTikvaStores = [
      { chain_name: 'Rami Levy', branch_name: 'Rami Levy Petah Tikva - Rothschild', city: 'Petah Tikva', address: 'Rothschild Blvd 45', store_id: '001' },
      { chain_name: 'Rami Levy', branch_name: 'Rami Levy Petah Tikva - Jabotinsky', city: 'Petah Tikva', address: 'Jabotinsky St 120', store_id: '002' },
      { chain_name: 'Osher Ad', branch_name: 'Osher Ad Petah Tikva - Center', city: 'Petah Tikva', address: 'Herzl St 88', store_id: '101' },
      { chain_name: 'Osher Ad', branch_name: 'Osher Ad Petah Tikva - North', city: 'Petah Tikva', address: 'Moshe Sneh St 15', store_id: '102' },
      { chain_name: 'Yohananof', branch_name: 'Yohananof Petah Tikva - Sirkin', city: 'Petah Tikva', address: 'Sirkin St 25', store_id: '201' },
      { chain_name: 'Yohananof', branch_name: 'Yohananof Petah Tikva - Segula', city: 'Petah Tikva', address: 'Segula Quarter', store_id: '202' },
      { chain_name: 'Shufersal', branch_name: 'Shufersal Deal Petah Tikva', city: 'Petah Tikva', address: 'Ahuza St 120', store_id: '301' },
      { chain_name: 'Shufersal', branch_name: 'Shufersal Sheli Petah Tikva', city: 'Petah Tikva', address: 'Ben Gurion St 55', store_id: '302' },
    ];
    
    for (const store of petahTikvaStores) {
      const { error } = await supabase.from('stores').insert(store);
      if (error) {
        console.error(`  ✗ Error inserting ${store.branch_name}:`, error.message);
      } else {
        console.log(`  ✓ ${store.branch_name}`);
      }
    }
    
    // Step 3: Insert stores from other cities
    console.log('\n4. Inserting stores from other cities...');
    
    const otherStores = [
      { chain_name: 'Rami Levy', branch_name: 'Rami Levy Jerusalem Center', city: 'Jerusalem', address: 'Jaffa St 123', store_id: '003' },
      { chain_name: 'Osher Ad', branch_name: 'Osher Ad Tel Aviv', city: 'Tel Aviv', address: 'Dizengoff St 200', store_id: '103' },
      { chain_name: 'Yohananof', branch_name: 'Yohananof Haifa', city: 'Haifa', address: 'Herzl St 45', store_id: '203' },
      { chain_name: 'Shufersal', branch_name: 'Shufersal Deal Ramat Gan', city: 'Ramat Gan', address: 'Bialik St 88', store_id: '303' },
    ];
    
    for (const store of otherStores) {
      const { error } = await supabase.from('stores').insert(store);
      if (error) {
        console.error(`  ✗ Error inserting ${store.branch_name}:`, error.message);
      } else {
        console.log(`  ✓ ${store.branch_name}`);
      }
    }
    
    // Step 4: Verify
    console.log('\n5. Verifying stores...');
    const { data: stores, error: verifyError } = await supabase
      .from('stores')
      .select('*')
      .order('city', { ascending: true })
      .order('chain_name', { ascending: true });
    
    if (verifyError) {
      console.error('  Error verifying:', verifyError.message);
    } else {
      console.log(`  ✓ Total stores: ${stores.length}`);
      console.log('\n  Stores by city:');
      const byCityMap = {};
      stores.forEach(s => {
        if (!byCityMap[s.city]) byCityMap[s.city] = [];
        byCityMap[s.city].push(s);
      });
      Object.keys(byCityMap).forEach(city => {
        console.log(`    ${city}: ${byCityMap[city].length} stores`);
      });
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Populate prices with: node populate-sample-data.js');
    console.log('2. Or run scraper for specific store: node rami-levy-scraper.js <URL> <STORE_ID>');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
