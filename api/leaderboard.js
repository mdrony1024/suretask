import admin from 'firebase-admin';

// Firebase Admin SDK ইনিশিয়ালাইজেশন
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.orderBy('points', 'desc').limit(10).get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const leaderboard = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: data.id,
            first_name: data.first_name,
            points: data.points,
            photo_url: data.photo_url // photo_url এখানে যোগ করা হয়েছে
        };
    });
    
    res.status(200).json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
