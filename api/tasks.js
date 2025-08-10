import admin from 'firebase-admin';
// ... (Firebase ইনিশিয়ালাইজেশন) ...
export default async function handler(req, res) {
    if (admin.apps.length === 0) return res.status(500).json({ error: 'Firebase init failed' });
    const db = admin.firestore(); // Firestore ব্যবহার করা হচ্ছে
    try {
        const snapshot = await db.collection('tasks').get();
        if (snapshot.empty) return res.status(200).json([]);
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(tasks);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch tasks' }); }
}
