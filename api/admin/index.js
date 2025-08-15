// File: /api/admin/index.js
// এই একটি ফাইল এখন users, tasks, promotions, এবং settings পরিচালনা করবে

const admin = require('firebase-admin');

// --- Firebase Admin SDK Init ---
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (e) { console.error('Firebase init error:', e); }

const firestore = admin.firestore();

// --- নিরাপত্তা চেক করার ফাংশন (Middleware) ---
const checkAdmin = async (req) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return false;
    }
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken.admin === true;
    } catch (error) {
        return false;
    }
};

// --- Main Handler ---
module.exports = async (req, res) => {
    if (!(await checkAdmin(req))) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { type } = req.query;

    try {
        switch (type) {
            case 'users':
                // --- ইউজারদের লজিক (অপরিবর্তিত) ---
                if (req.method === 'GET') {
                    const { search } = req.query;
                    let query = firestore.collection('users');
                    const snapshot = await query.get();
                    let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (search) {
                        const searchTerm = search.toLowerCase();
                        users = users.filter(user => (user.name && user.name.toLowerCase().includes(searchTerm)) || (user.id && user.id.includes(searchTerm)));
                    }
                    return res.status(200).json(users);
                }
                if (req.method === 'PUT') {
                    const { userId, action, value } = req.body;
                    const userRef = firestore.collection('users').doc(userId);
                    if (action === 'update_points') {
                        await userRef.update({ points: admin.firestore.FieldValue.increment(Number(value)) });
                    } else if (action === 'toggle_ban') {
                        const userDoc = await userRef.get();
                        const isBanned = userDoc.data().banned === true;
                        await userRef.update({ banned: !isBanned });
                    }
                    return res.status(200).json({ message: 'User updated.' });
                }
                break;

            case 'tasks':
                // --- টাস্কের লজিক (আপডেট করা হয়েছে) ---
                if (req.method === 'GET') {
                    const snapshot = await firestore.collection('tasks').orderBy('createdAt', 'desc').get();
                    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    return res.status(200).json(tasks);
                }
                if (req.method === 'POST') {
                    const { title, points, category, taskType, url } = req.body;
                     if (!title || !points || !category || !taskType || !url) {
                        return res.status(400).json({ message: 'All fields are required for creating a task.' });
                    }
                    await firestore.collection('tasks').add({ 
                        title, 
                        points, 
                        category, // নতুন ফিল্ড
                        taskType, // নতুন ফিল্ড
                        url, 
                        createdAt: admin.firestore.FieldValue.serverTimestamp() 
                    });
                    return res.status(201).json({ message: 'Task created' });
                }
                if (req.method === 'DELETE') {
                    const { taskId } = req.query;
                    await firestore.collection('tasks').doc(taskId).delete();
                    return res.status(200).json({ message: 'Task deleted' });
                }
                break;
            
            case 'promotions':
                // --- প্রোমোশনের লজিক (অপরিবর্তিত) ---
                if (req.method === 'GET') {
                    const snapshot = await firestore.collection('promotions').orderBy('createdAt', 'desc').get();
                    const promotions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    return res.status(200).json(promotions);
                }
                if (req.method === 'DELETE') {
                    const { promotionId } = req.query;
                    await firestore.collection('promotions').doc(promotionId).delete();
                    return res.status(200).json({ message: 'Promotion deleted' });
                }
                break;

            case 'settings':
                 // --- সেটিংসের লজিক (আপডেট করা হয়েছে) ---
                const settingsRef = firestore.collection('settings').doc('global');
                if (req.method === 'GET') {
                    const doc = await settingsRef.get();
                    return res.status(200).json(doc.exists ? doc.data() : {});
                }
                if (req.method === 'POST') {
                    const { referralCommission, promotionSettings } = req.body; // promotionSettings এখন একটি অবজেক্ট
                    if (referralCommission === undefined || promotionSettings === undefined) {
                         return res.status(400).json({ message: 'Invalid settings data.' });
                    }
                    await settingsRef.set({ referralCommission, promotionSettings }, { merge: true });
                    return res.status(200).json({ message: 'Settings updated' });
                }
                break;

            default:
                return res.status(400).json({ message: 'Invalid admin action type' });
        }
        
        return res.status(405).json({ message: 'Method Not Allowed for this type' });

    } catch (error) {
        console.error(`Error in /api/admin for type ${type}:`, error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
