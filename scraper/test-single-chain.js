/**
 * Test Single Chain Script
 * Tests the new scraper with just one chain (Rami Levy by default)
 *
 * Usage:
 *   node test-single-chain.js                  # Test Rami Levy
 *   node test-single-chain.js "אושר עד"        # Test specific chain
 */

require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const CerberusProvider = require('./providers/CerberusProvider');
const { DOC_TYPES } = require('./core/BaseProvider');

// Configuration Check
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

// Connect to Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Get chain name from command line or default to Rami Levy
const targetChainName = process.argv[2] || 'רמי לוי';

async function testSingleChain() {
  console.log('🧪 Testing Single Chain Scraper\n');
  console.log(`🎯 Target Chain: ${targetChainName}\n`);

  const globalStart = Date.now();

  try {
    // Fetch the specific chain from DB
    const { data: chains, error } = await supabase
      .from('chains')
      .select('*')
      .eq('name', targetChainName)
      .limit(1);

    if (error) throw error;

    if (!chains || chains.length === 0) {
      console.error(`❌ Chain "${targetChainName}" not found in database.`);
      console.log('\n📋 Available chains:');

      const { data: allChains } = await supabase
        .from('chains')
        .select('name')
        .order('name');

      if (allChains) {
        allChains.forEach(c => console.log(`   - ${c.name}`));
      }

      process.exit(1);
    }

    const chain = chains[0];

    console.log(`✓ Found chain: ${chain.name}`);
    console.log(`  - Type: ${chain.scraper_type}`);
    console.log(`  - Username: ${chain.username || 'N/A'}`);
    console.log(`  - URL: ${chain.base_url}\n`);

    // Create provider
    const provider = new CerberusProvider(chain, supabase);

    // Test: Step 1 - Stores
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏪 STEP 1: Updating Stores');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await provider.run(DOC_TYPES.STORES);

    // Verify stores were created
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, branch_name, store_id, city_id')
      .eq('chain_id', chain.id);

    if (!storesError && stores) {
      console.log(`\n✅ ${stores.length} stores added to database:`);
      stores.slice(0, 5).forEach(s => {
        console.log(`   - ${s.branch_name} (ID: ${s.store_id})`);
      });
      if (stores.length > 5) {
        console.log(`   ... and ${stores.length - 5} more`);
      }
    }

    // Test: Step 2 - Prices (only if stores were created)
    if (stores && stores.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💰 STEP 2: Updating Prices');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      await provider.run(DOC_TYPES.PRICE_FULL);

      // Verify prices were created
      const { data: priceCount } = await supabase
        .from('prices')
        .select('id', { count: 'exact', head: true })
        .in('store_id', stores.map(s => s.id));

      if (priceCount !== null) {
        console.log(`\n✅ Prices updated in database`);
      }
    } else {
      console.log('\n⚠️  Skipping prices - no stores were created');
    }

    // Cleanup
    provider.clearCache();

    const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Test completed successfully!`);
    console.log(`⏱️  Total time: ${totalTime}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Next Steps:');
    console.log('   1. Verify data in Supabase dashboard');
    console.log('   2. If everything looks good, run: node index.js (for all chains)');
    console.log('   3. Or test another chain: node test-single-chain.js "שופרסל"\n');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error('\n📋 Error details:', err);
    process.exit(1);
  }
}

// Start
testSingleChain();
