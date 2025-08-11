const admin = require('firebase-admin');
const { checkAdmin } = require('./middleware');
const firestore = admin.firestore();

module.exports = async (req, res) => {
    if (!(await checkAdmin(req))) return res.status(403).json({ message: 'Unauthorized' });

    try {
        if (req.method === 'GET') {
            const snapshot = await firestore.collection('promotions').orderBy('createdAt', 'desc').get();
            const promotions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.status(200).json(promotions);
        }
        
        if (req.method === 'DELETE') {
            const { promotionId } = req.query;
            if (!promotionId) return res.status(400).json({ message: 'Promotion ID is required' });
            await firestore.collection('promotions').doc(promotionId).delete();
            return res.status(200).json({ message: 'Promotion deleted' });
        }

        return res.status(405).json({ message: 'Method Not Allowed' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
