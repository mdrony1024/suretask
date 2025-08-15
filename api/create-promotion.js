const admin = require('firebase-admin');
const { Telegraf } = require('telegraf'); // টেলিগ্রাম এপিআই ব্যবহারের জন্য

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
const bot = new Telegraf(process.env.TELEGRAM_API_TOKEN); // আপনার বট টোকেন

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

    // ===== নতুন পরিবর্তন এখানে শুরু হচ্ছে =====

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
        const botInfo = await bot.telegram.getMe(); // বটের নিজের তথ্য নেওয়া
        const botMember = await bot.telegram.getChatMember(chatId, botInfo.id);

        if (!['administrator', 'creator'].includes(botMember.status)) {
            // যদি বট অ্যাডমিন না হয়
            return res.status(403).json({ success: false, message: `Our bot (@${botInfo.username}) is not an admin in this channel/group. Please add it as an administrator to create the promotion.` });
        }
    } catch (error) {
        // যদি চ্যাট খুঁজে না পাওয়া যায় বা অন্য কোনো টেলিগ্রাম এপিআই এরর হয়
        if (error.response && error.response.description) {
             return res.status(400).json({ success: false, message: `Telegram Error: ${error.response.description}. Make sure the URL is correct and public.` });
        }
        throw error; // অন্য কোনো অভ্যন্তরীণ এররের জন্য
    }

    // ===== নতুন পরিবর্তন এখানে শেষ হচ্ছে =====
    
    // যদি উপরের ধাপগুলো সফল হয়, তাহলেই কেবল প্রমোশন তৈরি হবে

    const totalCost = quantity * pointsPerTask;
    const userRef = firestore.collection('users').doc(String(userId));
    
    // --- Firestore Transaction ---
    await firestore.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('User not found.');
      
      const currentUserPoints = userDoc.data().points || 0;
      if (currentUserPoints < totalCost) throw new Error("You don't have enough points.");

      // পয়েন্ট কাটা এবং প্রমোশন তৈরি করা
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
