const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (e) { /* Error handling */ }

exports.checkAdmin = async (req) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return false;
    }
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.admin === true;
    } catch (error) {
        return false;
    }
};
