const admin = require('firebase-admin');
const { checkAdmin } = require('./middleware');
const firestore = admin.firestore();

module.exports = async (req, res) => {
    if (!(await checkAdmin(req))) return res.status(403).json({ message: 'Unauthorized' });

    try {
        const snapshot = await firestore.collection('users').get();
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
