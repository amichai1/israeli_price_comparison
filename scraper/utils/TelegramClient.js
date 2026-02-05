const axios = require('axios');

class TelegramClient {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.isEnabled = !!(this.token && this.chatId);
    
    if (!this.isEnabled) {
      console.warn('⚠️ Telegram notifications are disabled (missing .env vars)');
    }
  }

  /**
   * שליחת הודעה לטלגרם (Fire and Forget)
   */
  async send(message) {
    if (!this.isEnabled) return;

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    
    // שליחה ללא המתנה (כדי לא לעכב את הסקראפר)
    axios.post(url, {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    }).catch(err => {
      console.error('❌ Telegram send error:', err.message);
    });
  }

  sendStart(chainName, docType) {
    const msg = `🚀 <b>מתחיל סריקה</b>\n\n🏢 רשת: ${chainName}\n📂 סוג: ${docType}\n🕒 שעה: ${new Date().toLocaleString('he-IL')}`;
    this.send(msg);
  }

  sendSuccess(chainName, docType, duration, succeeded, failed) {
    const msg = `✅ <b>הסתיים בהצלחה</b>\n\n🏢 רשת: ${chainName}\n📂 סוג: ${docType}\n⏱ זמן: ${duration} שניות\n\n📊 <b>סטטיסטיקה:</b>\n🟢 הצלחות: ${succeeded}\n🔴 כישלונות: ${failed}`;
    this.send(msg);
  }

  sendError(chainName, error) {
    const msg = `❌ <b>שגיאה קריטית</b>\n\n🏢 רשת: ${chainName}\n⚠️ שגיאה: ${error}`;
    this.send(msg);
  }
}

module.exports = new TelegramClient();