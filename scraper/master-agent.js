const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios'); // ייבוא axios לצורך שליחת הודעות
const execPromise = util.promisify(exec);

// טעינת משתני סביבה (חשוב להרצה מקומית עם קובץ .env)
require('dotenv').config();

/**
 * פונקציה לשליחת עדכון לטלגרם
 */
async function sendTelegramNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('⚠️ Telegram credentials missing, skipping notification.');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log('📱 Telegram notification sent!');
  } catch (error) {
    console.error('❌ Failed to send Telegram:', error.response?.data || error.message);
  }
}

/**
 * פונקציה להרצת ה-Uploader ומחיקת הקובץ בסיום
 */
async function uploadAndCleanup(filePath, storeFullName, chainName) {
  const command = `node upload-market-local.js "${filePath}" "${storeFullName}" "${chainName}"`;
  try {
    console.log(`📡 Uploading data for: ${storeFullName}...`);
    const { stdout } = await execPromise(command);
    console.log(stdout);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted temporary file: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error during upload for ${chainName}: ${error.message}`);
  }
}

/**
 * סוכן שופרסל - מותאם לכפתור "לחץ להורדה"
 */
async function scrapeShufersal(context) {
  const page = await context.newPage();
  const downloadPath = path.join(__dirname, 'downloads');
  try {
    console.log('\n🛒 Starting Shufersal Scan...');
    await page.goto('https://prices.shufersal.co.il/', { waitUntil: 'networkidle' });

    console.log('🔍 Selecting Category: PricesFull...');
    await page.selectOption('select#ddlCategory', { label: 'PricesFull' });
    
    await page.waitForTimeout(1500); 
    console.log('🏢 Selecting Store Branch 269...');
    await page.selectOption('select#ddlStore', '269');

    console.log('⏳ Waiting for "לחץ להורדה" button...');
    const downloadButton = page.getByText('לחץ להורדה').first();
    await downloadButton.waitFor({ state: 'visible', timeout: 20000 });

    console.log('⬇️ Initiating download...');
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click({ force: true });
    const download = await downloadPromise;

    const finalPath = path.join(downloadPath, `shufersal-269.gz`);
    await download.saveAs(finalPath);
    console.log('✅ Shufersal download complete.');

    await uploadAndCleanup(finalPath, "יוניברס סגולה (269)", "שופרסל");
  } catch (err) {
    console.error('❌ Shufersal error:', err.message);
  } finally {
    await page.close();
  }
}

/**
 * סוכן רשתות Retail (רמי לוי, יוחננוף, אושר עד)
 */
async function scrapeRetailChain(context, config) {
  const page = await context.newPage();
  const downloadPath = path.join(__dirname, 'downloads');
  try {
    console.log(`\n📦 Starting ${config.chainName} (${config.username})...`);
    await page.goto('https://url.retail.publishedprices.co.il/login');
    
    await page.fill('input[name="username"]', config.username);
    await page.keyboard.press('Enter');
    await page.waitForSelector('table', { timeout: 20000 });

    console.log('🔎 Filtering table for "pricefull"...');
    await page.fill('input[type="search"]', 'pricefull');
    await page.waitForTimeout(1000);

    const links = await page.locator('table a').all();
    let targetLink = null;
    for (const link of links) {
      const text = await link.innerText();
      if (text.toLowerCase().includes('pricefull') && text.includes(`-${config.branchId}`)) {
        targetLink = link;
        break;
      }
    }

    if (!targetLink) throw new Error(`File not found for branch ${config.branchId}`);

    const downloadPromise = page.waitForEvent('download');
    await targetLink.click();
    const download = await downloadPromise;

    const finalPath = path.join(downloadPath, `${config.username}.gz`);
    await download.saveAs(finalPath);
    console.log(`✅ ${config.chainName} download complete.`);

    await uploadAndCleanup(finalPath, config.storeFullName, config.chainName);
    await page.goto('https://url.retail.publishedprices.co.il/logout').catch(() => {}); 
  } catch (err) {
    console.error(`❌ ${config.chainName} error:`, err.message);
  } finally {
    await page.close();
  }
}

/**
 * הפעלה מרכזית
 */
(async () => {
  const startTime = Date.now();
  console.log(`🕒 Agent started at: ${new Date(startTime).toLocaleTimeString()}`);

  if (!fs.existsSync('./downloads')) fs.mkdirSync('./downloads');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  const chains = [
    { username: 'RamiLevi', branchId: '724', storeFullName: 'רמי לוי הקניון הגדול (724)', chainName: 'רמי לוי' },
    { username: 'yohananof', branchId: '021', storeFullName: 'יוחננוף סגולה (021)', chainName: 'יוחננוף' },
    { username: 'osherad', branchId: '010', storeFullName: 'אושר עד סגולה (010)', chainName: 'אושר עד' }
  ];

  try {
    await scrapeShufersal(context);
    for (const config of chains) {
      await scrapeRetailChain(context, config);
    }
  } finally {
    await browser.close();
  }

  const diff = Date.now() - startTime;
  const minutes = Math.floor(diff / 60000);
  const seconds = ((diff % 60000) / 1000).toFixed(0);

  const summaryText = `*✅ עדכון מחירים הסתיים!* \n\n⏱️ זמן ריצה: ${minutes}m ${seconds}s \n🏢 רשתות שעודכנו: שופרסל, רמי לוי, יוחננוף, אושר עד.`;
  
  console.log(`\n--- 🏁 Summary ---`);
  console.log(summaryText);
  console.log(`------------------\n`);

  // שליחת ההודעה לטלגרם בסיום הריצה
  await sendTelegramNotification(summaryText);
})();