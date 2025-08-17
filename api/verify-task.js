const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');

// Firebase Admin SDK Init
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) { console.error('Firebase init error:', e); }

const firestore = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_API_TOKEN);

const getTodayDate = () => new Date().toISOString().slice(0, 10);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { userId, taskId, isPromotion } = req.body;
        if (!userId || !taskId) {
            return res.status(400).json({ success: false, message: 'User ID and Task ID are required.' });
        }

        const taskCollectionName = isPromotion ? 'promotions' : 'tasks';
        const taskRef = firestore.collection(taskCollectionName).doc(taskId);
        const userRef = firestore.collection('users').doc(String(userId));
        
        const historyQuery = firestore.collection('userTaskHistory')
            .where('userId', '==', String(userId))
            .where('taskId', '==', taskId)
            .limit(1);

        await firestore.runTransaction(async (transaction) => {
            const [taskDoc, userDoc, historySnapshot] = await Promise.all([
                transaction.get(taskRef),
                transaction.get(userRef),
                transaction.get(historyQuery)
            ]);
            
            // ===== নতুন পরিবর্তন: undefined চেক যোগ করা হয়েছে =====
            if (!taskDoc || !taskDoc.exists) throw new Error('Task not found.');
            if (!userDoc || !userDoc.exists) throw new Error('User not found.');
            
            const taskData = taskDoc.data();
            const userTaskHistoryDoc = historySnapshot.docs[0];

            if (userTaskHistoryDoc && userTaskHistoryDoc.exists) {
                if (taskData.taskType === 'daily' && userTaskHistoryDoc.data().lastCompleted === getTodayDate()) {
                    throw new Error('You have already completed this daily task today.');
                }
                if (taskData.taskType === 'general' || isPromotion) {
                    throw new Error('You have already completed this task.');
                }
            }
            
            if (taskData.category === 'channel' || taskData.category === 'group') {
                const chatUrl = new URL(taskData.url);
                const chatId = `@${chatUrl.pathname.split('/')[1]}`;
                const chatMember = await bot.telegram.getChatMember(chatId, userId);
                if (!['creator', 'administrator', 'member'].includes(chatMember.status)) {
                    throw new Error("Verification failed. You haven't joined yet.");
                }
            }
            
            const pointsToAdd = taskData.points || taskData.pointsPerTask;
            transaction.update(userRef, { points: admin.firestore.FieldValue.increment(pointsToAdd) });
            
            if (userTaskHistoryDoc && userTaskHistoryDoc.exists) {
                 transaction.update(userTaskHistoryDoc.ref, { lastCompleted: getTodayDate() });
            } else {
                const newHistoryRef = firestore.collection('userTaskHistory').doc();
                transaction.set(newHistoryRef, {
                    userId: String(userId),
                    taskId: taskId,
                    lastCompleted: getTodayDate()
                });
            }

            if (isPromotion) {
                transaction.update(taskRef, { completedCount: admin.firestore.FieldValue.increment(1) });
            }
        });

        return res.status(200).json({ success: true, message: 'Verification successful! Points added.' });

    } catch (error) {
        console.error('Verification Error:', error);
        return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
    }
};
