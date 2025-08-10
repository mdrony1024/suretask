import admin from 'firebase-admin';
// ... (Firebase ইনিশিয়ালাইজেশন) ...
export default async function handler(req, res) {
    if (admin.apps.length === 0) return res.status(500).json({ error: 'Firebase init failed' });
    const { userId, taskId } = req.body;
    if (!userId || !taskId) return res.status(400).json({ error: 'Missing params' });
    
    const firestore = admin.firestore();
    const realtimeDb = admin.database(); // Realtime Database
    
    const taskRef = firestore.collection('tasks').doc(taskId);
    const userRefRtdb = realtimeDb.ref(`users/${userId}`); // Realtime DB তে ইউজার
    
    try {
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });
        
        // ... (চ্যানেলে জয়েন করেছে কি না, তা চেক করার কোড এখানে থাকবে) ...
        
        const taskData = taskDoc.data();
        const pointsToAdd = taskData.points;
        
        // Realtime DB তে পয়েন্ট যোগ করা
        await userRefRtdb.child('points').set(admin.database.ServerValue.increment(pointsToAdd));
        
        res.status(200).json({ success: true, points_added: pointsToAdd });
    } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
}
