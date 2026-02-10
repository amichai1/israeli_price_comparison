/**
 * Debug script - download and inspect XML structure
 */

require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const CerberusProvider = require('./providers/CerberusProvider');
const { DOC_TYPES } = require('./core/BaseProvider');
const fs = require('fs');
const zlib = require('zlib');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function debug() {
  console.log('🔍 Debug: Inspecting Stores XML structure\n');

  // Get chain
  const { data: chains } = await supabase.from('chains').select('*').eq('name', 'רמי לוי').limit(1);
  const chain = chains[0];

  const provider = new CerberusProvider(chain, supabase);

  // Download file
  await provider.ensureBrowserConnected();
  const files = await provider.fetchFileList(DOC_TYPES.STORES);

  if (files.length === 0) {
    console.log('❌ No files found');
    return;
  }

  const file = files[0];
  console.log(`📥 Downloading: ${file.fileName}\n`);

  const downloadPath = await provider.downloadFileViaPlaywright(file.fileName);

  // Decompress
  console.log(`📦 Decompressing...\n`);
  const xmlPath = downloadPath.replace('.gz', '');
  const fileBuffer = fs.readFileSync(downloadPath);
  const xmlContent = zlib.gunzipSync(fileBuffer);
  fs.writeFileSync(xmlPath, xmlContent);

  console.log(`✅ XML saved to: ${xmlPath}\n`);
  console.log(`📄 First 100 lines:\n`);
  console.log('─'.repeat(80));

  const lines = xmlContent.toString('utf-8').split('\n');
  lines.slice(0, 100).forEach((line, i) => {
    console.log(`${i + 1}\t${line}`);
  });

  await provider.clearCache();
}

debug().catch(console.error);
