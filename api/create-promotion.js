const admin = require('firebase-admin');

// ... Firebase Admin SDK Init ...
const firestore = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  try {
    const { userId, title, link, type, budget, rewardPerUser } = req.body;
    if (!userId || !title || !link || !type || !budget || !rewardPerUser) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // --- নতুন ভ্যালিডেশন ---
    const settingsDoc = await firestore.collection('settings').doc('global').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { minReward: 1, maxReward: 1000 };
    
    if (rewardPerUser < settings.minReward || rewardPerUser > settings.maxReward) {
      return res.status(400).json({ message: `Reward per user must be between ${settings.minReward} and ${settings.maxReward} points.` });
    }
    // --- ভ্যালিডেশন শেষ ---

    const userRef = firestore.collection('users').doc(userId);
    await firestore.runTransaction(async (transaction) => {
        // ... আপনার আগের transaction কোড এখানে অপরিবর্তিত থাকবে ...
    });
    
    return res.status(200).json({ message: 'Promotion created successfully!' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'An internal error occurred.' });
  }
};
