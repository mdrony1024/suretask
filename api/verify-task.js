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
        
        // ... বাকি কোড অপরিবর্তিত ...

        await firestore.runTransaction(async (transaction) => {
            const [taskDoc, userDoc, historySnapshot] = await Promise.all([
                // ... Promise.all এর ভেতরের কোড অপরিবর্তিত ...
            ]);

            if (!taskDoc.exists) throw new Error('Task not found.');
            if (!userDoc.exists) throw new Error('User not found.');
            
            const taskData = taskDoc.data();
            
            // ... টাস্ক হিস্টোরি চেক করার কোড অপরিবর্তিত ...

            // ===== টেলিগ্রাম ভেরিফিকেশন সেকশনে পরিবর্তন =====
            if (taskData.category === 'channel' || taskData.category === 'group') {
                let chatId;
                try {
                    // প্রথমে URL থেকে @username বের করার চেষ্টা করা হচ্ছে
                    const chatUrl = new URL(taskData.url);
                    chatId = `@${chatUrl.pathname.split('/')[1]}`;
                } catch (e) {
                    throw new Error('Invalid URL format in the task.');
                }
                
                try {
                    const chatMember = await bot.telegram.getChatMember(chatId, userId);
                    if (!['creator', 'administrator', 'member'].includes(chatMember.status)) {
                        throw new Error("Verification failed. You haven't joined the channel/group yet.");
                    }
                } catch (error) {
                    // এররটি আরও তথ্যপূর্ণ করার জন্য
                    if (error.response && error.response.description) {
                        // "member list is inaccessible" এররটি এখানে ধরা পড়বে
                        throw new Error(`Telegram API Error: ${error.response.description}. Please check bot permissions.`);
                    }
                    throw error; // অন্য কোনো অজানা এররের জন্য
                }
            }
            
            // ... পয়েন্ট যোগ করা এবং হিস্টোরি সেভ করার কোড অপরিবর্তিত ...
        });

        return res.status(200).json({ success: true, message: 'Verification successful! Points have been added.' });

    } catch (error) {
        console.error('Verification Error:', error);
        // ব্যবহারকারীকে দেখানো এরর বার্তাটি আরও উন্নত করা হয়েছে
        return res.status(500).json({ success: false, message: error.message || 'An internal error occurred.' });
    }
};
