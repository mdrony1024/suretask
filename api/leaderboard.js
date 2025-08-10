import admin from 'firebase-admin';

// Firebase ইনিশিয়ালাইজেশন
function initializeFirebase() {
    try { 
        if (!admin.apps.length) {
            admin.initializeApp({ 
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) 
            }); 
        }
    } catch (error) { 
        console.error('Firebase Admin Initialization Error in leaderboard.js:', error); 
    }
}
initializeFirebase();

export default async function handler(req, res) {
    if (admin.apps.length === 0) {
        return res.status(500).json({ error: 'Firebase initialization failed. Check server logs.' });
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const db = admin.firestore();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.orderBy('points', 'desc').limit(10).get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }
        
        // এখানে photo_url সহ সব ডেটা সঠিকভাবে পাঠানো হচ্ছে
        const leaderboard = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: data.id,
                first_name: data.first_name,
                points: data.points,
                photo_url: data.photo_url || null // যদি ছবি না থাকে তাহলে null পাঠানো হচ্ছে
            };
        });

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
