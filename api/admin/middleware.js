const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (e) { /* Error handling */ }

// --- নতুন নিরাপত্তা চেক ---
// এই ফাংশনটি এখন Admin Claim এর পরিবর্তে ইমেইল চেক করবে
exports.checkAdmin = async (req) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return false;
    }
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        // Vercel-এ সেট করা ADMIN_EMAIL এর সাথে টোকেনের ইমেইল মেলানো হচ্ছে
        return decodedToken.email === process.env.ADMIN_EMAIL;
    } catch (error) {
        return false;
    }
};
