const admin = require('firebase-admin');

// --- Firebase Admin SDK চালু করা ---
try {
  // শুধুমাত্র যদি Firebase চালু না থাকে, তাহলেই চালু করা হবে
  if (!admin.apps.length) {
    // Vercel-এর Environment Variable থেকে সম্পূর্ণ কনফিগারেশনটি নেওয়া হচ্ছে
    const serviceAccountString = process.env.FIREBASE_ADMIN_CONFIG;

    if (!serviceAccountString) {
      throw new Error('The FIREBASE_ADMIN_CONFIG environment variable is not set.');
    }

    // JSON স্ট্রিং-কে অবজেক্টে পরিণত করা হচ্ছে
    const serviceAccount = JSON.parse(serviceAccountString);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  // যদি Firebase চালু হতে কোনো সমস্যা হয়, তাহলে Vercel Logs-এ এরর দেখানো হবে
  console.error('Firebase admin initialization error:', e);
}

// Firestore এর ইনস্ট্যান্স নেওয়া হচ্ছে
const firestore = admin.firestore();

// --- বট এর মূল লজিক (Webhook Handler) ---
module.exports = async (req, res) => {
  // শুধু POST রিকোয়েস্ট গ্রহণ করা হবে
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { message } = req.body;

    // যদি মেসেজ না থাকে অথবা /start দিয়ে শুরু না হয়, তাহলে কিছু না করে বেরিয়ে যাবে
    if (!message || !message.text || !message.text.startsWith('/start')) {
      return res.status(200).send('OK');
    }

    const newUserId = String(message.from.id);
    const userDocRef = firestore.collection('users').doc(newUserId);
    const userDoc = await userDocRef.get();

    // শুধুমাত্র নতুন ব্যবহারকারীদের জন্য রেফারেল লজিক কাজ করবে
    if (!userDoc.exists) {
      const parts = message.text.split(' ');
      
      const newUserProfile = {
        id: newUserId,
        name: message.from.first_name || 'User',
        username: message.from.username || null,
        points: 0,
        referralCount: 0,
        referralEarnings: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // যদি রেফারেল কোড থাকে (যেমন: /start 12345)
      if (parts.length > 1 && parts[1]) {
        const referrerId = parts[1];
        newUserProfile.referredBy = referrerId;

        // যিনি রেফার করেছেন, তার referralCount ১ বাড়িয়ে দেওয়া
        const referrerDocRef = firestore.collection('users').doc(referrerId);
        await referrerDocRef.update({
          referralCount: admin.firestore.FieldValue.increment(1)
        });
      }
      
      // নতুন ব্যবহারকারীকে Firestore-এ সেভ করা
      await userDocRef.set(newUserProfile);
    }
  } catch (error) {
    // যদি কোড চলতে কোনো সমস্যা হয়, Vercel Logs-এ বিস্তারিত এরর দেখানো হবে
    console.error('Error processing webhook:', error.message, error.stack);
  }
  
  // টেলিগ্রামকে জানানো যে রিকোয়েস্ট সফল হয়েছে
  res.status(200).send('OK');
};```
