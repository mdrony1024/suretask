const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');

// Firebase Admin SDK ইনিশিয়ালাইজেশন
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('Firebase Admin SDK Initialization Error:', error);
}

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const bot = new Telegraf(process.env.TELEGRAM_API_TOKEN);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userId, title, url, category, quantity, pointsPerTask } = req.body;

    // --- বেসিক ডেটা ভ্যালিডেশন ---
    if (!userId || !title || !url || !category || !quantity || !pointsPerTask) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    // ... অন্যান্য ভ্যালিডেশন অপরিবর্তিত ...

    // ধাপ ১: URL থেকে চ্যাট আইডি (@username) বের করা
    let chatId;
    try {
        const chatUrl = new URL(url);
        chatId = `@${chatUrl.pathname.split('/')[1]}`;
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid URL format.' });
    }

    // ধাপ ২: বটটি ওই চ্যাটে অ্যাডমিন কিনা তা যাচাই করা
    try {
        const botInfo = await bot.telegram.getMe();
        const botMember = await bot.telegram.getChatMember(chatId, botInfo.id);

        if (!['administrator', 'creator'].includes(botMember.status)) {
            return res.status(403).json({ success: false, message: `Our bot (@${botInfo.username}) is not an admin. Please add it as an administrator.` });
        }
    } catch (error) {
        if (error.response && error.response.description) {
             return res.status(400).json({ success: false, message: `Telegram Error: ${error.response.description}.` });
        }
        throw error;
    }

    // ===== নতুন পরিবর্তন এখানে শুরু হচ্ছে =====

    // ধাপ ৩: ডুপ্লিকেট অ্যাক্টিভ প্রমোশন চেক করা
    const existingPromoQuery = await firestore.collection('promotions')
        .where('creatorId', '==', String(userId))
        .where('url', '==', url)
        .where('status', '==', 'active')
        .limit(1)
        .get();

    if (!existingPromoQuery.empty) {
        return res.status(400).json({ success: false, message: "You already have an active promotion with this URL. Please wait for it to complete or delete it first." });
    }
    
    // ===== নতুন পরিবর্তন এখানে শেষ হচ্ছে =====
    
    const totalCost = quantity * pointsPerTask;
    const userRef = firestore.collection('users').doc(String(userId));
    
    // --- Firestore Transaction ---
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
