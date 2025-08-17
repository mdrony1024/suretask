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
        chatId = `@${chatUrl.pathname.split('/')[1]}`;
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid URL format.' });
    }

    // ===== নতুন পরিবর্তন এখানে শুরু হচ্ছে =====
    try {
        const botInfo = await bot.telegram.getMe();
        const botMember = await bot.telegram.getChatMember(chatId, botInfo.id);

        let requiredPermissionText = "";
        let hasPermission = false;

        if (botMember.status === 'administrator' || botMember.status === 'creator') {
            if (category === 'channel' || category === 'tg_views') {
                requiredPermissionText = "'Post Messages' and 'Invite Users' permissions";
                if (botMember.can_post_messages && botMember.can_invite_users) {
                    hasPermission = true;
                }
            } else if (category === 'group') {
                requiredPermissionText = "'Invite Users' permission";
                if (botMember.can_invite_users) {
                    hasPermission = true;
                }
            } else {
                // bot_start বা yt_views এর জন্য কোনো পারমিশন চেক করার প্রয়োজন নেই
                hasPermission = true;
            }
        }
        
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                message: `Our bot (@${botInfo.username}) needs to be an admin with ${requiredPermissionText} in your channel/group to proceed.` 
            });
        }
    } catch (error) {
        if (error.response && error.response.description) {
             return res.status(400).json({ success: false, message: `Telegram Error: ${error.response.description}. Make sure the URL is correct and public.` });
        }
        throw error;
    }
    // ===== নতুন পরিবর্তন এখানে শেষ হচ্ছে =====
    
    const existingPromoQuery = await firestore.collection('promotions')
        .where('creatorId', '==', String(userId))
        .where('url', '==', url)
        .where('status', '==', 'active')
        .limit(1).get();

    if (!existingPromoQuery.empty) {
        return res.status(400).json({ success: false, message: "You already have an active promotion with this URL." });
    }
    
    // ... আপনার বাকি কোড (Transaction, ইত্যাদি) অপরিবর্তিত থাকবে ...
    
  } catch (error) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
  }
};
