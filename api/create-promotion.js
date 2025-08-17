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
        const username = chatUrl.pathname.split('/')[1];
        if (!username) throw new Error();
        chatId = `@${username}`;
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid URL format.' });
    }

    // ===== টেলিগ্রাম ভেরিফিকেশন সেকশনটি সরল করা হয়েছে =====
    try {
        const botInfo = await bot.telegram.getMe();
        // সরাসরি chatId (@username) ব্যবহার করে getChatMember কল করা হচ্ছে
        const botMember = await bot.telegram.getChatMember(chatId, botInfo.id);

        if (!['administrator', 'creator'].includes(botMember.status)) {
            return res.status(403).json({ success: false, message: `Our bot (@${botInfo.username}) must be an administrator.` });
        }
    } catch (error) {
        console.error("Telegram API check failed:", error.message);
        if (error.response && error.response.description) {
            return res.status(400).json({ success: false, message: `Telegram Error: ${error.response.description}.` });
        }
        return res.status(500).json({ success: false, message: "Could not connect to Telegram."});
    }
    
    // ... আপনার বাকি কোড (ডুপ্লিকেট চেক, ট্রানজেকশন, ইত্যাদি) অপরিবর্তিত থাকবে ...
    const existingPromoQuery = await firestore.collection('promotions')
        .where('creatorId', '==', String(userId))
        .where('url', '==', url)
        .where('status', '==', 'active')
        .limit(1).get();

    if (!existingPromoQuery.empty) {
        return res.status(400).json({ success: false, message: "You already have an active promotion with this URL." });
    }
    
    const totalCost = quantity * pointsPerTask;
    const userRef = firestore.collection('users').doc(String(userId));
    
    await firestore.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('User not found.');
      
      const currentUserPoints = userDoc.data().points || 0;
      if (currentUserPoints < totalCost) throw new Error("You don't have enough points.");

      transaction.update(userRef, { points: currentUserPoints - totalCost });
      const promotionRef = firestore.collection('promotions').doc();
      transaction.set(promotionRef, {
        title, url, category, pointsPerTask, quantity,
        completedCount: 0,
        creatorId: String(userId),
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    
    return res.status(200).json({ success: true, message: 'Promotion created successfully!' });
    
  } catch (error) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
  }
};
