import admin from 'firebase-admin';

function initializeFirebase() { /* ... ( আগের মতোই ) ... */ }
initializeFirebase();

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
    const { userId } = req.query; // ফ্রন্টএন্ড থেকে ইউজার আইডি নেওয়া হচ্ছে
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    try {
        const firestore = admin.firestore();
        const tasksSnapshot = await firestore.collection('tasks').where('active', '==', true).get();
        const completedSnapshot = await firestore.collection('users').doc(userId).collection('completed_tasks').get();
        
        const completedTaskIds = new Set(completedSnapshot.docs.map(doc => doc.id));
        
        const availableTasks = tasksSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(task => !completedTaskIds.has(task.id) && task.completions < task.limit);

        res.status(200).json(availableTasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
}
