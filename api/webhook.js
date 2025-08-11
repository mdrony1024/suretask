const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    const serviceAccountString = process.env.FIREBASE_ADMIN_CONFIG;
    if (!serviceAccountString) {
      throw new Error('The FIREBASE_ADMIN_CONFIG environment variable is not set.');
    }
    const serviceAccount = JSON.parse(serviceAccountString);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error('CRITICAL: Firebase admin initialization failed!', e);
}

const firestore = admin.firestore();

module.exports = async (req, res) => {
  console.log("Webhook function was invoked."); // ফাংশন চলছে কিনা তা দেখার জন্য

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { message } = req.body;
    console.log("Received body:", JSON.stringify(req.body, null, 2)); // কী মেসেজ আসছে তা দেখার জন্য

    if (!message || !message.text || !message.text.startsWith('/start')) {
      console.log("Not a /start command or no message text. Exiting.");
      return res.status(200).send('OK');
    }

    const newUserId = String(message.from.id);
    const userDocRef = firestore.collection('users').doc(newUserId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.log(`User ${newUserId} does not exist. Creating new profile.`);
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

      if (parts.length > 1 && parts[1]) {
        const referrerId = parts[1];
        console.log(`User ${newUserId} was referred by ${referrerId}.`);
        newUserProfile.referredBy = referrerId;

        const referrerDocRef = firestore.collection('users').doc(referrerId);
        await referrerDocRef.update({
          referralCount: admin.firestore.FieldValue.increment(1)
        });
        console.log(`Incremented referralCount for referrer ${referrerId}.`);
      }
      
      await userDocRef.set(newUserProfile);
      console.log(`Successfully created profile for new user ${newUserId}.`);
    } else {
      console.log(`User ${newUserId} already exists. No action taken.`);
    }
  } catch (error) {
    console.error('FATAL_ERROR processing webhook:', error.stack);
  }
  
  res.status(200).send('OK');
};
