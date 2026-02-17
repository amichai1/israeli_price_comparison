require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const CerberusProvider = require('./providers/CerberusProvider');
const ShufersalProvider = require('./providers/ShufersalProvider');
const { DOC_TYPES } = require('./core/BaseProvider');

// --- 1. Configuration ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// --- 2. Provider Registry ---
const PROVIDERS = {
  cerberus: CerberusProvider,
  shufersal: ShufersalProvider,
};

function getProvider(chain) {
  const ProviderClass = PROVIDERS[chain.scraper_type];

  if (!ProviderClass) {
    console.warn(`⚠️ Unknown scraper type "${chain.scraper_type}" for chain ${chain.name}`);
    return null;
  }

  return new ProviderClass(chain, supabase);
}

// --- 3. CLI Argument Parsing ---
// Usage:
//   node index.js                  → default: pricefull (daily task)
//   node index.js stores           → update stores only (monthly task)
//   node index.js pricefull        → update full prices
//   node index.js price            → update incremental prices
//   node index.js promofull        → update full promotions
//   node index.js promo            → update incremental promotions
//   node index.js stores pricefull → multiple types in sequence

const DOC_TYPE_MAP = {
  stores:    DOC_TYPES.STORES,
  pricefull: DOC_TYPES.PRICE_FULL,
  price:     DOC_TYPES.PRICE_UPDATE,
  promofull: DOC_TYPES.PROMO_FULL,
  promo:     DOC_TYPES.PROMO_UPDATE,
};

function parseDocTypes() {
  const args = process.argv.slice(2).map(a => a.toLowerCase());

  if (args.length === 0) {
    return [DOC_TYPES.PRICE_FULL]; // default: daily price update
  }

  const types = [];
  for (const arg of args) {
    const mapped = DOC_TYPE_MAP[arg];
    if (!mapped) {
      console.error(`❌ Unknown doc type: "${arg}"`);
      console.error(`   Valid types: ${Object.keys(DOC_TYPE_MAP).join(', ')}`);
      process.exit(1);
    }
    types.push(mapped);
  }
  return types;
}

// --- 4. Main Execution ---
async function main() {
  const docTypes = parseDocTypes();

  console.log('🚀 Starting Scraper...');
  console.log(`📂 Doc types: ${docTypes.join(', ')}`);
  const globalStart = Date.now();

  try {
    const { data: chains, error } = await supabase
      .from('chains')
      .select('*')
      .in('scraper_type', ['cerberus', 'shufersal'])
      .order('name');

    if (error) throw error;

    if (!chains || chains.length === 0) {
      console.log('⚠️ No chains found in DB.');
      return;
    }

    console.log(`📋 Found ${chains.length} chains to process.`);

    for (const chain of chains) {
      console.log(`\n---------------------------------------------------------`);
      console.log(`🏢 Processing: ${chain.name} (${chain.chain_code})`);
      console.log(`---------------------------------------------------------`);

      const provider = getProvider(chain);
      if (!provider) continue;

      try {
        for (const docType of docTypes) {
          console.log(`\n📂 Running: ${docType}...`);
          await provider.run(docType);
        }
        provider.clearCache();
      } catch (chainError) {
        console.error(`❌ Error processing ${chain.name}:`, chainError.message);
      }
    }

  } catch (err) {
    console.error('❌ Critical Error:', err.message);
    process.exit(1);
  } finally {
    const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);
    console.log(`\n🏁 Done. Total time: ${totalTime}s`);
  }
}

main();
