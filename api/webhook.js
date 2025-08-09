import admin from 'firebase-admin';

// Firebase Admin SDK ইনিশিয়ালাইজেশন
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(200).send('OK');
    }

    const { from, chat, text } = message;

    if (text === '/start') {
      const userRef = db.collection('users').doc(String(from.id));
      const doc = await userRef.get();

      const userData = {
        id: from.id,
        first_name: from.first_name,
        last_name: from.last_name || null,
        username: from.username || null,
        photo_url: from.photo_url || null, // এটি পরে ব্যবহার করা হবে
      };

      if (!doc.exists) {
        // নতুন ব্যবহারকারী হলে পয়েন্ট ০ দিয়ে শুরু হবে
        userData.points = 0;
        userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await userRef.set(userData);
      } else {
        // পুরোনো ব্যবহারকারী হলে তথ্য আপডেট করা হবে
        await userRef.update(userData);
      }

      const welcomeText = `Hi *${from.first_name}*,\n\nWelcome to SureTask! Your trusted platform.`;
      const replyMarkup = {
        inline_keyboard: [
          [{
            text: '🚀 Open App',
            web_app: { url: `https://${process.env.VERCEL_URL}` }
          }]
        ]
      };

      const TELEGRAM_API_TOKEN = process.env.TELEGRAM_API_TOKEN;
      const url = `https://api.telegram.org/bot${TELEGRAM_API_TOKEN}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat.id,
          text: welcomeText,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }),
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in webhook:', error);
    res.status(500).send('Internal Server Error');
  }
}
