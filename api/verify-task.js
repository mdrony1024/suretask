const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');

// Firebase Admin SDK ইনিশিয়ালাইজেশন
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

// আজকের তারিখ পাওয়ার জন্য একটি হেল্পার ফাংশন
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
        const userTaskHistoryRef = firestore.collection('userTaskHistory').doc(`${userId}_${taskId}`);

        // Firestore Transaction ব্যবহার করে সম্পূর্ণ প্রক্রিয়াটি সম্পন্ন করা হবে
        await firestore.runTransaction(async (transaction) => {
            const [taskDoc, userTaskHistoryDoc] = await Promise.all([
                transaction.get(taskRef),
                transaction.get(userTaskHistoryRef)
            ]);

            if (!taskDoc.exists) {
                throw new Error('Task not found.');
            }
            const taskData = taskDoc.data();

            // ডেইলি টাস্ক চেক
            if (taskData.taskType === 'daily' && userTaskHistoryDoc.exists && userTaskHistoryDoc.data().lastCompleted === getTodayDate()) {
                throw new Error('You have already completed this daily task today.');
            }
            // জেনারেল টাস্ক চেক
            if (taskData.taskType === 'general' && userTaskHistoryDoc.exists) {
                throw new Error('You have already completed this task.');
            }

            // টেলিগ্রাম ভেরিফিকেশন (চ্যানেল এবং গ্রুপের জন্য)
            if (taskData.category === 'channel' || taskData.category === 'group') {
                const chatUrl = new URL(taskData.url);
                const chatId = `@${chatUrl.pathname.split('/')[1]}`;
                const chatMember = await bot.telegram.getChatMember(chatId, userId);
                
                if (!['creator', 'administrator', 'member'].includes(chatMember.status)) {
                    throw new Error("Verification failed. You haven't joined the channel/group yet.");
                }
            }
            // এখানে অন্যান্য ক্যাটাগরির (yt_views, bot_start) ভেরিফিকেশন লজিক যোগ করা যেতে পারে

            // ভেরিফিকেশন সফল হলে পয়েন্ট যোগ করা হবে
            const pointsToAdd = taskData.points || taskData.pointsPerTask;
            transaction.update(userRef, { points: admin.firestore.FieldValue.increment(pointsToAdd) });
            
            // টাস্ক হিস্টোরি আপডেট করা হবে
            if (taskData.taskType === 'daily') {
                transaction.set(userTaskHistoryRef, { lastCompleted: getTodayDate() }, { merge: true });
            } else { // General এবং Promotion টাস্কের জন্য
                transaction.set(userTaskHistoryRef, { completed: true }, { merge: true });
            }

            // যদি এটি একটি প্রমোশন হয়, তাহলে completedCount বাড়ানো হবে
            if (isPromotion) {
                transaction.update(taskRef, { completedCount: admin.firestore.FieldValue.increment(1) });
            }
        });

        return res.status(200).json({ success: true, message: 'Verification successful! Points have been added.' });

    } catch (error) {
        console.error('Verification Error:', error);
        if (error.response && error.response.description) {
            if (error.response.description.includes('user not found')) return res.status(400).json({ success: false, message: "Please ensure you have started our bot." });
            if (error.response.description.includes('chat not found')) return res.status(400).json({ success: false, message: "Verification failed. Our bot may not be in the channel/group." });
        }
        return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
    }
};
