const axios = require('axios');
require('dotenv').config();

(async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  console.log(`Checking Token: ${token ? 'OK' : 'MISSING'}`);
  console.log(`Checking Chat ID: ${chatId ? 'OK' : 'MISSING'}`);
  
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: "בדיקת חיבור מהמחשב!"
    });
    console.log("✅ ההודעה נשלחה בהצלחה!");
  } catch (e) {
    console.error("❌ שגיאה בשליחה:", e.response?.data || e.message);
  }
})();
