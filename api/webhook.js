const admin = require('firebase-admin');

// --- Firebase Admin SDK চালু করা ---
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
      })
    });
  }
} catch (e) {
  console.error('Firebase admin initialization error', e.stack);
}

// Firestore এর ইনস্ট্যান্স নিন
const firestore = admin.firestore();

// --- বট এর মূল লজিক ---
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { message } = req.body;

    if (!message || !message.text || !message.text.startsWith('/start')) {
      return res.status(200).send('OK');
    }

    const newUserId = String(message.from.id);
    const userDocRef = firestore.collection('users').doc(newUserId);
    const userDoc = await userDocRef.get();

    // শুধুমাত্র নতুন ব্যবহারকারীদের জন্য রেফারেল কাজ করবে
    if (!userDoc.exists) {
      const parts = message.text.split(' ');
      
      const newUserProfile = {
        id: newUserId,
        name: message.from.first_name || 'User',
        username: message.from.username || null,
        points: 0,
        referralCount: 0,
        referralEarnings: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp() // Firestore এর জন্য সঠিক টাইমস্ট্যাম্প
      };

      // যদি রেফারেল কোড থাকে
      if (parts.length > 1 && parts[1]) {
        const referrerId = parts[1];
        newUserProfile.referredBy = referrerId;

        // যিনি রেফার করেছেন, তার referralCount ১ বাড়িয়ে দেওয়া
        const referrerDocRef = firestore.collection('users').doc(referrerId);
        // Firestore এর নিজস্ব increment পদ্ধতি ব্যবহার করা হয়েছে
        await referrerDocRef.update({
          referralCount: admin.firestore.FieldValue.increment(1)
        });
      }
      
      // নতুন ব্যবহারকারীকে Firestore-এ সেভ করা
      await userDocRef.set(newUserProfile);
    }
  } catch (error) {
    console.error('Error processing webhook:', error.message);
  }
  
  res.status(200).send('OK');
};
