const admin = require('firebase-admin');
const { checkAdmin } = require('./middleware');
const firestore = admin.firestore();

module.exports = async (req, res) => {
    if (!(await checkAdmin(req))) return res.status(403).json({ message: 'Unauthorized' });

    try {
        if (req.method === 'GET') {
            const snapshot = await firestore.collection('tasks').get();
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.status(200).json(tasks);
        }
        
        if (req.method === 'POST') {
            const { title, points, taskType, url } = req.body;
            await firestore.collection('tasks').add({
                title, points, taskType, url, isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(201).json({ message: 'Task created' });
        }
        
        if (req.method === 'DELETE') {
            const { taskId } = req.query;
            await firestore.collection('tasks').doc(taskId).delete();
            return res.status(200).json({ message: 'Task deleted' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
