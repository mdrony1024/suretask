const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');

// Firebase Admin SDK Init
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) { console.error('Firebase init error:', e); }

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const bot = new Telegraf(process.env.TELEGRAM_API_TOKEN);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userId, title, url, category, quantity, pointsPerTask } = req.body;

    if (!userId || !title || !url || !category || !quantity || !pointsPerTask) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    
    let chatId;
    try {
        const chatUrl = new URL(url);
        // t.me/username or t.me/c/12345/ or t.me/joinchat/xyz
        const pathParts = chatUrl.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
            chatId = `@${pathParts[0]}`; // পাবলিক 채널/গ্রুপের জন্য
        } else {
             throw new Error('Invalid URL format.');
        }
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid URL format. Please provide a valid public channel/group link.' });
    }

    // ===== নতুন পরিবর্তন এখানে শুরু হচ্ছে =====
    try {
        const botInfo = await bot.telegram.getMe();
        const chat = await bot.telegram.getChat(chatId); // চ্যাটের তথ্য আনা হচ্ছে
        const botMember = await bot.telegram.getChatMember(chat.id, botInfo.id);

        let hasPermission = false;
        
        // বটটি অ্যাডমিন বা ক্রিয়েটর কিনা তা চেক করা হচ্ছে
        if (['administrator', 'creator'].includes(botMember.status)) {
            hasPermission = true;
        }

        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                message: `Our bot (@${botInfo.username}) must be an administrator in the target channel/group.` 
            });
        }
    } catch (error) {
        console.error("Telegram API check failed:", error.message);
        if (error.response && error.response.description) {
            // "member list is inaccessible" এররটিকে একটি ব্যবহারকারী-বান্ধব বার্তায় পরিণত করা হচ্ছে
            if (error.response.description.includes('member list is inaccessible')) {
                return res.status(400).json({ success: false, message: `Could not verify membership. Please ensure your channel/group is public and our bot is an admin.` });
            }
             return res.status(400).json({ success: false, message: `Telegram Error: ${error.response.description}.` });
        }
        return res.status(500).json({ success: false, message: "Could not connect to Telegram. Please try again."});
    }
    // ===== নতুন পরিবর্তন এখানে শেষ হচ্ছে =====
    
    // ... আপনার বাকি কোড (ডুপ্লিকেট চেক, ট্রানজেকশন, ইত্যাদি) অপরিবর্তিত থাকবে ...
    
  } catch (error) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
  }
};
