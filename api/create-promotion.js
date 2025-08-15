const admin = require('firebase-admin');

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
    if (typeof quantity !== 'number' || quantity < 5) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 5.' });
    }
    if (typeof pointsPerTask !== 'number') {
        return res.status(400).json({ success: false, message: 'Points per task must be a number.' });
    }

    // ===== নতুন পরিবর্তন এখানে শুরু হচ্ছে =====

    // ধাপ ১: Firestore থেকে সেটিংস লোড করা হচ্ছে
    const settingsDoc = await firestore.collection('settings').doc('global').get();
    if (!settingsDoc.exists || !settingsDoc.data().promotionSettings) {
        throw new Error('Promotion settings are not configured in the admin panel.');
    }
    const promotionSettings = settingsDoc.data().promotionSettings;
    
    // ধাপ ২: নির্দিষ্ট ক্যাটাগরির জন্য min/max সীমা বের করা হচ্ছে
    const categorySettings = promotionSettings[category];
    if (!categorySettings) {
        throw new Error(`Settings for category '${category}' not found.`);
    }

    // ধাপ ৩: ব্যবহারকারীর দেওয়া পয়েন্টের মান যাচাই করা হচ্ছে
    if (pointsPerTask < categorySettings.min || pointsPerTask > categorySettings.max) {
      return res.status(400).json({ 
          success: false, 
          message: `For this category, points per user must be between ${categorySettings.min} and ${categorySettings.max}.` 
      });
    }

    // ===== নতুন পরিবর্তন এখানে শেষ হচ্ছে =====

    const totalCost = quantity * pointsPerTask;
    const userRef = firestore.collection('users').doc(String(userId));

    // --- Firestore Transaction শুরু হচ্ছে ---
    await firestore.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found.');
      }

      const userData = userDoc.data();
      const currentUserPoints = userData.points || 0;

      if (currentUserPoints < totalCost) {
        throw new Error("You don't have enough points to create this promotion.");
      }

      const newPoints = currentUserPoints - totalCost;
      transaction.update(userRef, { points: newPoints });

      const promotionRef = firestore.collection('promotions').doc();
      transaction.set(promotionRef, {
        title,
        url,
        category,
        pointsPerTask,
        quantity,
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
