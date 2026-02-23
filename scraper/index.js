require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const CerberusProvider = require('./providers/CerberusProvider');
const ShufersalProvider = require('./providers/ShufersalProvider');
const { DOC_TYPES } = require('./core/BaseProvider');
const TelegramClient = require('./utils/TelegramClient');

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
    return [DOC_TYPES.PRICE_FULL];
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

  // איסוף סטטיסטיקות לסיכום טלגרם
  const summary = []; // { chain, docType, succeeded, failed, duration }
  const errors = [];

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
          const result = await provider.run(docType);
          summary.push({
            chain: chain.name,
            docType,
            succeeded: result?.succeeded || 0,
            failed: result?.failed || 0,
            duration: result?.duration || '0',
          });
        }
        provider.clearCache();
      } catch (chainError) {
        console.error(`❌ Error processing ${chain.name}:`, chainError.message);
        errors.push({ chain: chain.name, error: chainError.message });
      }
    }

  } catch (err) {
    console.error('❌ Critical Error:', err.message);
    process.exit(1);
  } finally {
    const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);
    console.log(`\n🏁 Done. Total time: ${totalTime}s`);

    // שליחת סיכום לטלגרם
    sendTelegramSummary(docTypes, summary, errors, totalTime);
  }
}

function sendTelegramSummary(docTypes, summary, errors, totalTime) {
  const totalSucceeded = summary.reduce((s, r) => s + r.succeeded, 0);
  const totalFailed = summary.reduce((s, r) => s + r.failed, 0);

  const typesLabel = docTypes.join(', ');
  const mins = (parseFloat(totalTime) / 60).toFixed(1);

  let msg = `📊 <b>סיכום סריקה</b>\n`;
  msg += `📂 ${typesLabel}\n`;
  msg += `⏱ ${mins} דקות\n\n`;

  // שורה לכל רשת
  for (const r of summary) {
    const icon = r.failed > 0 ? '⚠️' : '✅';
    msg += `${icon} <b>${r.chain}</b> [${r.docType}]: ${r.succeeded} קבצים`;
    if (r.failed > 0) msg += `, ${r.failed} נכשלו`;
    msg += `\n`;
  }

  // סיכום כולל
  msg += `\n📈 סה"כ: ${totalSucceeded} הצליחו`;
  if (totalFailed > 0) msg += `, ${totalFailed} נכשלו`;

  // שגיאות קריטיות
  if (errors.length > 0) {
    msg += `\n\n❌ <b>שגיאות:</b>\n`;
    for (const e of errors) {
      msg += `• ${e.chain}: ${e.error}\n`;
    }
  }

  TelegramClient.send(msg);
}

main();
