const admin = require('firebase-admin');
const { checkAdmin } = require('./middleware');
const firestore = admin.firestore();

const settingsRef = firestore.collection('settings').doc('global');

module.exports = async (req, res) => {
    if (!(await checkAdmin(req))) return res.status(403).json({ message: 'Unauthorized' });

    try {
        if (req.method === 'GET') {
            const doc = await settingsRef.get();
            if (!doc.exists) {
                // যদি কোনো সেটিংস না থাকে, ডিফল্ট ভ্যালু পাঠানো হবে
                return res.status(200).json({
                    referralCommission: 20,
                    minReward: 1,
                    maxReward: 1000
                });
            }
            return res.status(200).json(doc.data());
        }
        
        if (req.method === 'POST') {
            const { referralCommission, minReward, maxReward } = req.body;
            
            const newSettings = {
                referralCommission: Number(referralCommission),
                minReward: Number(minReward),
                maxReward: Number(maxReward)
            };
            
            await settingsRef.set(newSettings, { merge: true });
            return res.status(200).json({ message: 'Settings updated successfully' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
