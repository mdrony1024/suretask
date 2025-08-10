import admin from 'firebase-admin';

function initializeFirebase() { /* ... ( আগের মতোই ) ... */ }
initializeFirebase();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { userId, taskId } = req.body;
    
    try {
        const firestore = admin.firestore();
        const taskRef = firestore.collection('tasks').doc(taskId);
        const userRef = firestore.collection('users').doc(String(userId));
        const completedTaskRef = userRef.collection('completed_tasks').doc(taskId);

        const [taskDoc, userDoc, completedDoc] = await Promise.all([taskRef.get(), userRef.get(), completedTaskRef.get()]);

        if (!taskDoc.exists || !userDoc.exists) return res.status(404).json({ error: 'User or Task not found.' });
        if (completedDoc.exists) return res.status(400).json({ error: 'Task already completed.' });

        // ... (চ্যানেল জয়েন চেক করার কোড আগের মতোই থাকবে) ...

        const taskData = taskDoc.data();
        const userData = userDoc.data();
        const pointsToAdd = taskData.points;
        
        // Transaction to update points and task completions safely
        await firestore.runTransaction(async (transaction) => {
            transaction.update(userRef, { points: admin.firestore.FieldValue.increment(pointsToAdd) });
            transaction.update(taskRef, { completions: admin.firestore.FieldValue.increment(1) });
            transaction.set(completedTaskRef, { completedAt: new Date() });
        });

        // Referral Commission Logic
        if (userData.referredBy) {
            const settingsDoc = await firestore.collection('settings').doc('app').get();
            const commissionRate = settingsDoc.data()?.referralCommission || 10;
            const commission = Math.floor(pointsToAdd * (commissionRate / 100));
            if (commission > 0) {
                const referrerRef = firestore.collection('users').doc(userData.referredBy);
                await referrerRef.update({ points: admin.firestore.FieldValue.increment(commission) });
            }
        }
        res.status(200).json({ success: true, points_added: pointsToAdd });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
