import admin from 'firebase-admin';

function initializeFirebase() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) });
        }
    } catch (error) { console.error('Firebase Admin Init Error:', error); }
}
initializeFirebase();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (admin.apps.length === 0) return res.status(500).json({ error: 'Firebase initialization failed' });

    const { userId, firstName, photoUrl } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    try {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(String(userId));
        const updates = {
            first_name: firstName,
            photo_url: photoUrl || null
        };
        await userRef.update(updates);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}```
