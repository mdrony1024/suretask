const admin = require('firebase-admin');
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (e) { console.error('Firebase init error:', e); }

module.exports = async (req, res) => {
    const { secret, uid } = req.query;
    if (secret !== 'SURETASK_ADMIN_SECRET_KEY_12345') { // একটি গোপন কী
        return res.status(401).send('Unauthorized');
    }
    if (!uid) { return res.status(400).send('UID is required'); }
    
    try {
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        return res.status(200).send(`Success! User ${uid} is now an admin.`);
    } catch (error) {
        return res.status(500).send('Error setting custom claim.');
    }
};
