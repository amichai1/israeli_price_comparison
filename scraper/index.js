require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const CerberusProvider = require('./providers/CerberusProvider');
const { DOC_TYPES } = require('./core/BaseProvider');

// --- 1. Configuration Check ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

// Connect to Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// --- 2. Provider Registry (Factory Pattern) ---
// This allows easy extension for future providers (e.g., Shufersal, Victory)
const PROVIDERS = {
  cerberus: CerberusProvider,
  // 'shufersal': ShufersalProvider, // Future integration
};

function getProvider(chain) {
  const ProviderClass = PROVIDERS[chain.scraper_type];
  
  if (!ProviderClass) {
    console.warn(`⚠️ Unknown scraper type "${chain.scraper_type}" for chain ${chain.name}`);
    return null;
  }
  
  return new ProviderClass(chain, supabase);
}

// --- 3. Main Execution Loop ---
async function main() {
  console.log('🚀 Starting Main Scraper Loop...');
  const globalStart = Date.now();

  try {
    // A. Fetch chains from DB
    // Currently filtering only for 'cerberus' type
    const { data: chains, error } = await supabase
      .from('chains')
      .select('*')
      .eq('scraper_type', 'cerberus')
      .order('name');

    if (error) throw error;

    if (!chains || chains.length === 0) {
      console.log('⚠️ No chains found in DB.');
      return;
    }

    console.log(`📋 Found ${chains.length} chains to process.`);

    // B. Process chains (Serial Execution)
    for (const chain of chains) {
      console.log(`\n---------------------------------------------------------`);
      console.log(`🏢 Processing Chain: ${chain.name} (Code: ${chain.chain_code})`);
      console.log(`---------------------------------------------------------`);

      const provider = getProvider(chain);

      if (!provider) continue;

      try {
        // Step 1: Stores
        // Must run first to ensure FK integrity for prices
        console.log(`🏪 Step 1: Updating Stores...`);
        await provider.run(DOC_TYPES.STORES);

        // Step 2: Prices
        console.log(`💰 Step 2: Updating Prices...`);
        await provider.run(DOC_TYPES.PRICE_FULL);

        // Cleanup: Polymorphic call (BaseProvider guarantees this method exists)
        provider.clearCache();

      } catch (chainError) {
        console.error(`❌ Error processing chain ${chain.name}:`, chainError.message);
        // Continue to next chain, don't crash the whole process
      }
    }

  } catch (err) {
    console.error('❌ Critical System Error:', err.message);
    process.exit(1); // Exit with error code only on critical failure
  } finally {
    const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);
    console.log(`\n🏁 All tasks finished. Total time: ${totalTime}s`);
    // Node process will exit naturally when event loop is empty
  }
}

// Start
main();