/**
 * Database Migration Script - Version 2.0
 * Migrates database to support 8 chains with modular scraper architecture
 *
 * WARNING: This will clear all existing data!
 */

require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables!');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  console.error('\n📝 Please set these in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('🚀 Starting Database Migration to V2...\n');
  console.log('⚠️  WARNING: This will clear all existing data!');
  console.log('⚠️  Make sure you have a backup if needed.\n');

  try {
    // Step 1: Check if chains table already exists
    console.log('1. Checking existing tables...');
    const { data: existingChains, error: checkError } = await supabase
      .from('chains')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('   ✓ chains table already exists');
      console.log('   ℹ️  Skipping schema creation (tables already exist)');
      console.log('   ℹ️  If you need to recreate tables, run the SQL in Supabase dashboard\n');
    } else if (checkError.code === '42P01') {
      // Table doesn't exist - need to create it
      console.log('   ⚠️  chains table does not exist');
      console.log('   ℹ️  You need to run the SQL schema manually in Supabase dashboard');
      console.log('   ℹ️  File: database/schema.sql\n');
      console.log('📋 Instructions:');
      console.log('   1. Go to https://app.supabase.com');
      console.log('   2. Select your project');
      console.log('   3. Go to SQL Editor');
      console.log('   4. Copy and paste the contents of database/schema.sql');
      console.log('   5. Click "Run" to execute');
      console.log('   6. Run this migration script again\n');
      process.exit(1);
    } else {
      throw checkError;
    }

    // Step 2: Verify schema
    console.log('2. Verifying schema...');

    const { data: chains } = await supabase.from('chains').select('*');
    const { data: cities } = await supabase.from('cities').select('*');

    console.log(`   ✓ Found ${chains?.length || 0} chains in database`);
    console.log(`   ✓ Found ${cities?.length || 0} cities in database`);

    if (chains && chains.length > 0) {
      console.log('\n   Configured chains:');
      chains.forEach(c => {
        console.log(`     - ${c.name} (${c.scraper_type})`);
      });
    }

    if (cities && cities.length > 0) {
      console.log('\n   Configured cities:');
      cities.forEach(c => {
        console.log(`     - ${c.name} ${c.is_active ? '✓' : '✗'}`);
      });
    }

    // Step 3: Check stores table structure
    console.log('\n3. Checking stores table structure...');
    const { data: sampleStore } = await supabase
      .from('stores')
      .select('*')
      .limit(1)
      .single();

    if (sampleStore) {
      const hasNewColumns = 'chain_id' in sampleStore && 'city_id' in sampleStore;
      if (hasNewColumns) {
        console.log('   ✓ stores table has new structure (chain_id, city_id)');
      } else {
        console.log('   ⚠️  stores table missing new columns');
        console.log('   ℹ️  Run database/schema.sql in Supabase dashboard');
      }
    } else {
      console.log('   ✓ stores table is empty (ready for new data)');
    }

    console.log('\n✅ Migration validation completed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test the new scraper: cd scraper && node index.js');
    console.log('   2. Or test with a specific chain in Supabase dashboard');
    console.log('   3. Monitor logs for any issues\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Full error:', error);
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
