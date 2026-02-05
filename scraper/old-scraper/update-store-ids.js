/**
 * Update Petah Tikva stores with real store IDs
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

async function updateStoreIds() {
  console.log('🔄 Updating Petah Tikva stores with real IDs...\n');
  
  try {
    // Get all Petah Tikva stores
    const { data: stores, error: fetchError } = await supabase
      .from('stores')
      .select('*')
      .eq('city', 'Petah Tikva');
    
    if (fetchError) {
      throw new Error(`Failed to fetch stores: ${fetchError.message}`);
    }
    
    console.log(`Found ${stores.length} stores in Petah Tikva\n`);
    
    // Define the real store IDs
    const realStoreIds = {
      'Rami Levy': '71',
      'Osher Ad': '1290',
      'Yohananof': '1776',
      'Shufersal': '269'
    };
    
    // Update each chain
    for (const [chainName, storeId] of Object.entries(realStoreIds)) {
      // Find the first store for this chain in Petah Tikva
      const storeToKeep = stores.find(s => s.chain_name === chainName);
      
      if (!storeToKeep) {
        console.log(`⚠️  No ${chainName} store found in Petah Tikva`);
        continue;
      }
      
      // Update the store with real ID
      const { error: updateError } = await supabase
        .from('stores')
        .update({
          store_id: storeId,
          branch_name: `${chainName} Petah Tikva`
        })
        .eq('id', storeToKeep.id);
      
      if (updateError) {
        console.error(`✗ Error updating ${chainName}:`, updateError.message);
      } else {
        console.log(`✓ Updated ${chainName} - store_id: ${storeId}`);
      }
      
      // Delete other stores from the same chain in Petah Tikva
      const storesToDelete = stores.filter(s => 
        s.chain_name === chainName && s.id !== storeToKeep.id
      );
      
      for (const store of storesToDelete) {
        const { error: deleteError } = await supabase
          .from('stores')
          .delete()
          .eq('id', store.id);
        
        if (deleteError) {
          console.error(`  ✗ Error deleting duplicate ${chainName}:`, deleteError.message);
        } else {
          console.log(`  ✓ Removed duplicate: ${store.branch_name}`);
        }
      }
    }
    
    // Verify the updates
    console.log('\n📊 Verifying updates...');
    const { data: updatedStores, error: verifyError } = await supabase
      .from('stores')
      .select('*')
      .eq('city', 'Petah Tikva')
      .order('chain_name');
    
    if (verifyError) {
      console.error('Error verifying:', verifyError.message);
    } else {
      console.log(`\n✅ Petah Tikva now has ${updatedStores.length} stores:\n`);
      updatedStores.forEach(store => {
        console.log(`  ${store.chain_name.padEnd(15)} | Store ID: ${store.store_id.padEnd(6)} | ${store.branch_name}`);
      });
    }
    
    console.log('\n✅ Update completed successfully!');
    console.log('\nYou can now run the scraper with these store IDs:');
    console.log('  node rami-levy-scraper.js <URL> 71');
    console.log('  node osher-ad-scraper.js <URL> 1290');
    console.log('  node yohananof-scraper.js <URL> 1776');
    console.log('  node shufersal-scraper.js <URL> 269');
    
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  updateStoreIds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { updateStoreIds };
