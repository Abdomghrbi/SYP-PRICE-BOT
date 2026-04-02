const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
require('dotenv').config(); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
  console.error('❌ خطأ: متغيرات البيئة غير موجودة!');
  process.exit(1);
}

const telegramAPI = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
let lastUpdateId = 0;
async function sendToTelegram(message, chatId = CHAT_ID) {
  try {
    await axios.post(`${telegramAPI}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('✅ تم إرسال الرسالة إلى Telegram');
  } catch (error) {
    console.error('❌ خطأ في الإرسال:', error.message);
  }
}
async function fetchAndSend(chatId = CHAT_ID) {
  try {
    console.log('🔄 جارٍ جلب السعر...');
    
    const { data } = await axios.get('https://sp-today.com', {
  timeout: 30000, // 30 ثانية بدل 10
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});
    const $ = cheerio.load(data);
    
    const prices = [];
    $('span.text-3xl span.inline-block').each((i, el) => {
      prices.push($(el).text().replace(/,/g, ''));
    });
    
    const buyPrice = prices[0];
    const sellPrice = prices[1];
    
    console.log(`سعر الشراء: ${buyPrice}`);
    console.log(`سعر البيع: ${sellPrice}`);
    
    const message = `
💱 <b>سعر الليرة السورية</b>
🟢 سعر الشراء: <code>${buyPrice}</code>
🔴 سعر البيع: <code>${sellPrice}</code>
⏰ الوقت: ${new Date().toLocaleString('ar-SY')}
`;
    
    await sendToTelegram(message, chatId);
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    await sendToTelegram(`❌ حدث خطأ: ${error.message}`, chatId);
  }
}
// استماع للرسائل الواردة
async function listenForMessages() {
  try {
    const response = await axios.get(`${telegramAPI}/getUpdates?offset=${lastUpdateId}`);
    const updates = response.data.result;
    
    for (const update of updates) {
      lastUpdateId = update.update_id + 1;
      
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        console.log(`📬 رسالة جديدة: ${text} من ${chatId}`);
        
        if (text === '/start' || text === '/price') {
          console.log(`🚀 تم طلب السعر من ${chatId}`);
          await fetchAndSend(chatId);  // هلأ بيستنى صح
        }
      }
    }
  } catch (error) {
    // تجاهل خطأ 409
    if (error.response?.status === 409) {
      console.log('⚠️ Conflict (409), skipping...');
      return;
    }
    console.error('❌ خطأ في الاستماع:', error.message);
  }
}
// شغّل مرة واحدة في البداية
fetchAndSend();

setInterval(listenForMessages, 2000);
// ثم شغّل كل ساعة تلقائياً
cron.schedule('0 * * * *', () => {
  console.log('⏰ تحديث دوري...');
  fetchAndSend();
});
console.log('✅ البوت يعمل...');

