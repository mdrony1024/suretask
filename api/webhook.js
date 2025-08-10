import admin from 'firebase-admin';

function initializeFirebase() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CONFIG)) });
        }
    } catch (error) { console.error('Firebase Admin Init Error:', error); }
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
            const userData = { id: from.id, first_name: from.first_name, username: from.username || null };

            if (!doc.exists) {
                userData.points = 0;
                userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
                await userRef.set(userData);
            } else {
                await userRef.update({ first_name: from.first_name, username: from.username || null });
            }
            
            const APP_URL = `https://${process.env.VERCEL_URL}`;
            const welcomeText = `Hi *${from.first_name}*,\n\nWelcome to SureTask!`;
            const replyMarkup = { inline_keyboard: [[{ text: '🚀 Open App', web_app: { url: APP_URL } }]] };
            const url = `https://api.telegram.org/bot${process.env.TELEGRAM_API_TOKEN}/sendMessage`;
            await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat.id, text: welcomeText, parse_mode: 'Markdown', reply_markup: replyMarkup }) });
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error in webhook:', error);
        res.status(500).send('Internal Server Error');
    }
}
