const admin = require('firebase-admin');

// Firebase Admin SDK ইনিশিয়ালাইজেশন
// নিশ্চিত করুন যে আপনার এনভায়রনমেন্ট ভ্যারিয়েবল সঠিকভাবে সেট করা আছে
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

module.exports = async (req, res) => {
  // মেথড POST কিনা তা চেক করা হচ্ছে
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // বডি থেকে ডেটা নেওয়া হচ্ছে
    const { userId, title, url, category, quantity, pointsPerTask } = req.body;

    // --- ডেটা ভ্যালিডেশন ---
    if (!userId || !title || !url || !category || !quantity || !pointsPerTask) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (typeof quantity !== 'number' || quantity < 5) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 5.' });
    }
    if (typeof pointsPerTask !== 'number' || pointsPerTask < 5) {
        return res.status(400).json({ success: false, message: 'Points per task must be at least 5.' });
    }

    const totalCost = quantity * pointsPerTask;
    const userRef = firestore.collection('users').doc(String(userId));

    // --- Firestore Transaction শুরু হচ্ছে ---
    // Transaction ব্যবহার করা হয় যাতে একাধিক ডেটা অপারেশন একসাথে সফল বা ব্যর্থ হয়,
    // যা ডেটাবেসের সঙ্গতি বজায় রাখে।
    await firestore.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found.'); // এটি একটি কাস্টম এরর তৈরি করবে
      }

      const userData = userDoc.data();
      const currentUserPoints = userData.points || 0;

      // ব্যবহারকারীর যথেষ্ট পয়েন্ট আছে কিনা তা চেক করা হচ্ছে
      if (currentUserPoints < totalCost) {
        throw new Error("You don't have enough points to create this promotion.");
      }

      // ব্যবহারকারীর পয়েন্ট থেকে মোট খরচ বিয়োগ করা হচ্ছে
      const newPoints = currentUserPoints - totalCost;
      transaction.update(userRef, { points: newPoints });

      // `promotions` কালেকশনে নতুন ডকুমেন্ট তৈরি করা হচ্ছে
      const promotionRef = firestore.collection('promotions').doc(); // নতুন ডকুমেন্ট রেফারেন্স
      transaction.set(promotionRef, {
        title,
        url,
        category,
        pointsPerTask,
        quantity,
        completedCount: 0,
        creatorId: String(userId),
        status: 'active',
        createdAt: FieldValue.serverTimestamp(), // বর্তমান সার্ভার সময়
      });
    });
    
    // সফলভাবে সম্পন্ন হলে একটি বার্তা পাঠানো হচ্ছে
    return res.status(200).json({ success: true, message: 'Promotion created successfully!' });

  } catch (error) {
    // কোনো এরর হলে বার্তা পাঠানো হচ্ছে
    console.error('Error creating promotion:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
  }
};
