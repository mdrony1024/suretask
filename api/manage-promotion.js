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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { userId, promotionId, action } = req.body;

    // --- বেসিক ডেটা ভ্যালিডেশন ---
    if (!userId || !promotionId || !action) {
      return res.status(400).json({ success: false, message: 'Missing required fields (userId, promotionId, action).' });
    }

    const promotionRef = firestore.collection('promotions').doc(promotionId);
    const promotionDoc = await promotionRef.get();

    // প্রমোশনটি আছে কিনা এবং সঠিক ব্যবহারকারী অনুরোধ করছে কিনা তা যাচাই করা
    if (!promotionDoc.exists) {
      return res.status(404).json({ success: false, message: 'Promotion not found.' });
    }
    
    const promotionData = promotionDoc.data();
    if (promotionData.creatorId !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not the owner of this promotion.' });
    }

    // --- অ্যাকশন অনুযায়ী কাজ করা ---
    switch (action) {
      case 'toggle_status':
        // প্রমোশনের বর্তমান অবস্থা পরিবর্তন করা (active <-> paused)
        const newStatus = promotionData.status === 'active' ? 'paused' : 'active';
        await promotionRef.update({ status: newStatus });
        return res.status(200).json({ success: true, message: `Promotion status changed to ${newStatus}.` });

      case 'delete':
        // প্রমোশন ডিলিট করা এবং পয়েন্ট ফেরত দেওয়া
        const totalCost = promotionData.quantity * promotionData.pointsPerTask;
        const completedCost = promotionData.completedCount * promotionData.pointsPerTask;
        const refundAmount = totalCost - completedCost;
        
        const userRef = firestore.collection('users').doc(String(userId));
        
        // Transaction ব্যবহার করে পয়েন্ট ফেরত দেওয়া এবং প্রমোশন ডিলিট করা
        await firestore.runTransaction(async (transaction) => {
            transaction.update(userRef, {
                points: admin.firestore.FieldValue.increment(refundAmount)
            });
            transaction.delete(promotionRef);
        });
        
        return res.status(200).json({ success: true, message: `Promotion deleted. ${refundAmount} points have been refunded to your account.` });

      default:
        return res.status(400).json({ success: false, message: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error('Error managing promotion:', error);
    return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
  }
};
