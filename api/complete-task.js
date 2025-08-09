import admin from 'firebase-admin';

// Firebase Admin SDK ইনিশিয়ালাইজেশন
if (!admin.apps.length) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) });
    } catch (e) { console.error('Firebase Admin Init Error', e.stack); }
}

const db = admin.firestore();
const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN;

// টেলিগ্রাম API ব্যবহার করে চেক করার ফাংশন
async function checkChannelMembership(userId, channelId) {
    // 채널 ID তে '@' যুক্ত করতে হবে
    const channelUsername = channelId.startsWith('@') ? channelId : `@${channelId}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_API_TOKEN}/getChatMember?chat_id=${channelUsername}&user_id=${userId}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        // স্ট্যাটাস যদি 'member', 'administrator' বা 'creator' হয় তাহলে ব্যবহারকারী জয়েন করেছে
        return data.ok && ['member', 'administrator', 'creator'].includes(data.result.status);
    } catch (error) {
        console.error('Error checking membership:', error);
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { userId, taskId } = req.body;
    if (!userId || !taskId) {
        return res.status(400).json({ error: 'User ID and Task ID are required.' });
    }

    const userRef = db.collection('users').doc(String(userId));
    const taskRef = db.collection('tasks').doc(taskId);

    try {
        const [userDoc, taskDoc] = await Promise.all([userRef.get(), taskRef.get()]);

        if (!userDoc.exists || !taskDoc.exists) {
            return res.status(404).json({ error: 'User or Task not found.' });
        }
        
        // টাস্কের লিঙ্ক থেকে চ্যানেল ইউজারনেম বের করা
        const taskData = taskDoc.data();
        const channelUsername = taskData.link.substring(taskData.link.lastIndexOf('/') + 1);

        const isMember = await checkChannelMembership(userId, channelUsername);

        if (!isMember) {
            return res.status(400).json({ error: "You haven't joined the channel yet." });
        }
        
        // পয়েন্ট যোগ করা
        const pointsToAdd = taskData.points;
        await userRef.update({
            points: admin.firestore.FieldValue.increment(pointsToAdd)
        });

        // এখানে একটি completed_tasks সাব-কালেকশন তৈরি করে রেকর্ড রাখা যেতে পারে, যাতে একই টাস্ক বারবার না করে।

        res.status(200).json({ success: true, points_added: pointsToAdd });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
