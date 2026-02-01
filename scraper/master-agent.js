const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process'); // שינינו ל-spawn לצורך לוגים חיים
const axios = require('axios');
require('dotenv').config();
const zlib = require('zlib');

/**
 * פונקציה לשליחת עדכון לטלגרם
 */
async function sendTelegramNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) 
  {
    console.log("We have a problem with Bot token or Telegram id");
    console.log(`Checking Token: ${token ? 'OK' : 'MISSING'}`);
    console.log(`Checking Chat ID: ${chatId ? 'OK' : 'MISSING'}`);
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await axios.post(url, { chat_id: chatId, text: message, parse_mode: 'Markdown' });
  } catch (error) {
    console.error('❌ Failed to send Telegram:', error.message);
  }
}

/**
 * פונקציה להרצת ה-Uploader עם פלט חי (Real-time logs)
 */
async function uploadAndCleanup(filePath, storeFullName, chainName) {
  return new Promise((resolve) => {
    console.log(`\n📡 Starting Upload for: ${storeFullName}...`);

    // הפעלה באמצעות spawn כדי להזרים את הנתונים בשידור חי
    const child = spawn('node', ['upload-market-local.js', filePath, storeFullName, chainName]);

    // הזרמת ה-stdout (הלוגים הרגילים, כולל ה-Progress)
    child.stdout.on('data', (data) => {
      process.stdout.write(data.toString()); // כותב ישירות לטרמינל ללא שורה חדשה מיותרת
    });

    // הזרמת שגיאות אם יש
    child.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted temporary file: ${path.basename(filePath)}`);
        }
      } else {
        console.error(`\n❌ Uploader failed (code ${code}) for ${chainName}`);
      }
      resolve();
    });
  });
}

async function scrapeShufersal(context) {
  const downloadPath = path.join(__dirname, 'downloads');
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const page = await context.newPage();
    
    // הגדרות "חמקן"
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://prices.shufersal.co.il/'
    });

    try {
      console.log(`\n🛒 Starting Shufersal Scan (Attempt ${attempt}/${MAX_RETRIES})...`);
      
      // Timeout נדיב להורדות איטיות
      page.setDefaultTimeout(180000); 

      // הסתרת בוט
      await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

      await page.goto('https://prices.shufersal.co.il/', { waitUntil: 'networkidle' });
      
      await page.selectOption('select#ddlCategory', { label: 'PricesFull' });
      await page.waitForTimeout(3000); 
      
      await page.selectOption('select#ddlStore', '269');
      
      // המתנה שהרשת תירגע
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000); 

      const downloadButton = page.getByText('לחץ להורדה').first();
      await downloadButton.waitFor({ state: 'visible' });

      console.log('⏳ Clicking download...');
      
      const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
      
      await downloadButton.hover();
      await page.mouse.down();
      await page.mouse.up();
      
      const download = await downloadPromise;
      const finalPath = path.join(downloadPath, `shufersal-269.gz`);
      await download.saveAs(finalPath);

      // --- 🛑 בדיקת תקינות הקובץ (במקום גודל) 🛑 ---
      console.log('🔍 Validating XML integrity...');
      
      try {
          const fileBuffer = fs.readFileSync(finalPath);
          // ניסיון לפתוח את ה-GZIP. אם הקובץ קטוע, זה יזרוק שגיאה מיידית!
          const content = zlib.gunzipSync(fileBuffer).toString('utf-8').trim();
          
          // בדיקה שהתוכן מסתיים בסגירת תגית (סימן שה-XML שלם)
          if (!content.endsWith('>')) {
              throw new Error("XML File is incomplete (does not end with '>')");
          }

          // בדיקה שקיימת תגית סוגרת של Root (לא חובה אבל מומלץ)
          if (!content.includes('</Root>') && !content.includes('</root>')) {
             throw new Error("XML missing closing Root tag");
          }

          console.log(`✅ File is valid! Length: ${content.length} chars.`);

      } catch (validationError) {
          throw new Error(`Corrupted file downloaded: ${validationError.message}`);
      }
      // -----------------------------------------------

      await page.close();
      await uploadAndCleanup(finalPath, "יוניברס סגולה (269)", "שופרסל");
      return; // יציאה מהלולאה בהצלחה

    } catch (err) {
      console.error(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      
      // סגירת הדף וניקוי
      try { await page.close(); } catch(e) {}
      const tempPath = path.join(downloadPath, `shufersal-269.gz`);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      // אם נכשלנו, נחכה זמן משמעותי כדי לא להיחסם
      if (attempt < MAX_RETRIES) {
          const waitTime = 20000 + (Math.random() * 10000); // 20-30 שניות
          console.log(`⏳ Waiting ${Math.round(waitTime/1000)}s before retry to avoid blocking...`);
          await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
}
/**
 * סוכן רשתות Retail
 */
async function scrapeRetailChain(context, config) {
  const page = await context.newPage();
  const downloadPath = path.join(__dirname, 'downloads');
  try {
    console.log(`\n📦 Starting ${config.chainName}...`);
    await page.goto('https://url.retail.publishedprices.co.il/login');
    await page.fill('input[name="username"]', config.username);
    await page.keyboard.press('Enter');
    await page.waitForSelector('table', { timeout: 20000 });
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

    if (!targetLink) throw new Error(`File not found for ${config.branchId}`);

    const downloadPromise = page.waitForEvent('download');
    await targetLink.click();
    const download = await downloadPromise;

    const finalPath = path.join(downloadPath, `${config.username}.gz`);
    await download.saveAs(finalPath);
    console.log(`✅ ${config.chainName} download complete.`);

    await uploadAndCleanup(finalPath, config.storeFullName, config.chainName);
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

  const summaryText = `*✅ עדכון מחירים הסתיים!*\n⏱️ זמן: ${minutes}m ${seconds}s \n🏢 רשתות שעודכנו: שופרסל, רמי לוי, יוחננוף, אושר עד.`;
  console.log(`\n--- 🏁 Summary ---\n${summaryText}`);

  await sendTelegramNotification(summaryText);
})();
