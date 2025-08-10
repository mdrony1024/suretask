import admin from 'firebase-admin';

// Firebase Admin SDK ইনিশিয়ালাইজেশন
function initializeFirebase() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({ 
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) 
            });
        }
    } catch (e) { console.error('Firebase Admin Init Error in tasks.js', e.stack); }
}
initializeFirebase();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    if (admin.apps.length === 0) {
        return res.status(500).json({ error: 'Firebase initialization failed.' });
    }

    try {
        // --- ডেটা এখন Cloud Firestore থেকে আসছে ---
        const firestore = admin.firestore();
        const snapshot = await firestore.collection('tasks').get();
        
        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks from Firestore:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
}
