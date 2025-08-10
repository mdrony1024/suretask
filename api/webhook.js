import admin from 'firebase-admin';

// Firebase ইনিশিয়ালাইজেশন
function initializeFirebase() {
    try {
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    } catch (error) {
        console.error('Firebase Admin Initialization Error:', error);
    }
}
initializeFirebase();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    try {
        if (admin.apps.length === 0) throw new Error("Firebase not initialized");
        const { message } = req.body;
        if (!message) return res.status(200).send('OK');

        const { from, chat, text } = message;

        if (text === '/start') {
            const db = admin.firestore();
            const userRef = db.collection('users').doc(String(from.id));
            const doc = await userRef.get();
            const userData = { id: from.id, first_name: from.first_name, last_name: from.last_name || null, username: from.username || null, photo_url: from.photo_url || null };

            if (!doc.exists) {
                userData.points = 0;
                userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
                await userRef.set(userData);
            } else {
                await userRef.update(userData);
            }
            
            // =======================================================
            // !! এখানে আমরা URL টি সরাসরি লিখে দিয়েছি !!
            // =======================================================
            const APP_URL = "https://suretask.vercel.app"; 
            
            const welcomeText = `Hi *${from.first_name}*,\n\nWelcome to SureTask!`;
            const replyMarkup = { 
                inline_keyboard: [[{ 
                    text: '🫆 Open App', 
                    web_app: { url: APP_URL } // এখানে সরাসরি URL ব্যবহার করা হচ্ছে
                }]] 
            };
            
            const url = `https://api.telegram.org/bot${process.env.TELEGRAM_API_TOKEN}/sendMessage`;
            
            await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ chat_id: chat.id, text: welcomeText, parse_mode: 'Markdown', reply_markup: replyMarkup }) 
            });
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error in webhook handler:', error);
        res.status(500).send('Internal Server Error');
    }
}
