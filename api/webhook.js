// প্রয়োজনীয় লাইব্রেরি
const admin = require('firebase-admin');

// --- Firebase Admin SDK চালু করা ---
// আপনার config.js থেকে serviceAccount তথ্য লোড করুন অথবা Vercel Environment Variables ব্যবহার করুন
// আমরা ধরে নিচ্ছি আপনার serviceAccount তথ্য Vercel এর Environment Variable এ আছে

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        "type": process.env.FIREBASE_TYPE,
        "project_id": process.env.FIREBASE_PROJECT_ID,
        "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
        "private_key": (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        "client_email": process.env.FIREBASE_CLIENT_EMAIL,
        "client_id": process.env.FIREBASE_CLIENT_ID,
        "auth_uri": process.env.FIREBASE_AUTH_URI,
        "token_uri": process.env.FIREBASE_TOKEN_URI,
        "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
      }),
      databaseURL: `https://detpocket-default-rtdb.firebaseio.com` // এখানে আপনার Realtime Database URL দিন
    });
  }
} catch (e) {
  console.error('Firebase admin initialization error', e.stack);
}

const db = admin.database();

// --- বট এর মূল লজিক ---
module.exports = async (req, res) => {
  // নিশ্চিত করুন যে রিকোয়েস্টটি POST মেথডে এসেছে
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { message } = req.body;

    // যদি কোনো মেসেজ না থাকে, তাহলে কিছুই করার নেই
    if (!message) {
      return res.status(200).send('OK');
    }

    const newUserId = String(message.from.id);

    // শুধু /start কমান্ড নিয়ে কাজ করা হবে
    if (message.text && message.text.startsWith('/start')) {
      const userRef = db.ref(`users/${newUserId}`);
      const snapshot = await userRef.once('value');

      // শুধুমাত্র নতুন ব্যবহারকারীদের জন্য রেফারেল লজিক কাজ করবে
      if (!snapshot.exists()) {
        const parts = message.text.split(' ');
        
        // ব্যবহারকারীর প্রোফাইল তৈরি করা
        const newUserProfile = {
          id: newUserId,
          name: message.from.first_name || 'User',
          username: message.from.username || null,
          points: 0,
          createdAt: admin.database.ServerValue.TIMESTAMP
        };

        // যদি রেফারেল কোড থাকে (যেমন: /start 12345678)
        if (parts.length > 1 && parts[1]) {
          const referrerId = parts[1];
          newUserProfile.referredBy = referrerId; // রেফারার আইডি সেভ করা

          // যিনি রেফার করেছেন, তার referralCount ১ বাড়িয়ে দেওয়া
          const referrerRef = db.ref(`users/${referrerId}/referralCount`);
          await referrerRef.transaction((currentCount) => {
            return (currentCount || 0) + 1;
          });
        }
        
        // নতুন ব্যবহারকারীকে ডাটাবেসে সেভ করা
        await userRef.set(newUserProfile);
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }

  // টেলিগ্রামকে জানানো যে আমরা মেসেজ পেয়েছি, যাতে সে আবার না পাঠায়
  res.status(200).send('OK');
};
