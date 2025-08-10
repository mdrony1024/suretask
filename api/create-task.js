import admin from 'firebase-admin';

function initializeFirebase() { /* ... ( আগের মতোই ) ... */ }
initializeFirebase();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { userId, link, limit, pointsPerCompletion } = req.body;
    
    try {
        const firestore = admin.firestore();
        const settingsDoc = await firestore.collection('settings').doc('app').get();
        const settings = settingsDoc.data();

        if (pointsPerCompletion < settings.minPointsPerTask) {
            return res.status(400).json({ error: `Minimum points per completion is ${settings.minPointsPerTask}` });
        }

        const totalCost = limit * pointsPerCompletion;
        const userRef = firestore.collection('users').doc(String(userId));
        const userDoc = await userRef.get();

        if (!userDoc.exists || userDoc.data().points < totalCost) {
            return res.status(400).json({ error: "You don't have enough points." });
        }

        // Deduct points and create the task
        await userRef.update({ points: admin.firestore.FieldValue.increment(-totalCost) });
        await firestore.collection('tasks').add({
            title: `Join Channel/Group`, // You can make this dynamic
            link: link,
            points: pointsPerCompletion,
            limit: limit,
            completions: 0,
            active: true, // Needs admin approval in a real app
            createdBy: userId,
            createdAt: new Date(),
        });

        res.status(200).json({ success: true, message: 'Task created successfully!' });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task.' });
    }
}
