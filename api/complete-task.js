import admin from 'firebase-admin';

// Firebase Admin SDK ইনিশিয়ালাইজেশন
function initializeFirebase() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({ 
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) 
            });
        }
    } catch (e) { console.error('Firebase Admin Init Error in complete-task.js', e.stack); }
}
initializeFirebase();

const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN;

async function checkChannelMembership(userId, channelId) {
    const channelUsername = channelId.startsWith('@') ? channelId : `@${channelId}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_API_TOKEN}/getChatMember?chat_id=${channelUsername}&user_id=${userId}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
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
    
    if (admin.apps.length === 0) {
        return res.status(500).json({ error: 'Firebase initialization failed.' });
    }

    try {
        // --- ডেটা এখন Cloud Firestore থেকে আসছে এবং সেখানেই আপডেট হচ্ছে ---
        const firestore = admin.firestore();
        const userRef = firestore.collection('users').doc(String(userId));
        const taskRef = firestore.collection('tasks').doc(taskId);

        const [userDoc, taskDoc] = await Promise.all([userRef.get(), taskRef.get()]);

        if (!userDoc.exists || !taskDoc.exists) {
            return res.status(404).json({ error: 'User or Task not found.' });
        }
        
        const taskData = taskDoc.data();
        const channelUsername = taskData.link.substring(taskData.link.lastIndexOf('/') + 1);
        const isMember = await checkChannelMembership(userId, channelUsername);

        if (!isMember) {
            return res.status(400).json({ error: "You haven't joined the channel yet." });
        }
        
        await userRef.update({
            points: admin.firestore.FieldValue.increment(taskData.points)
        });

        res.status(200).json({ success: true, points_added: taskData.points });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
}
