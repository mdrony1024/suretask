import admin from 'firebase-admin';

// Firebase Admin SDK ইনিশিয়ালাইজেশন
if (!admin.apps.length) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) });
    } catch (e) { console.error('Firebase Admin Init Error', e.stack); }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const snapshot = await db.collection('tasks').get();
        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
}
