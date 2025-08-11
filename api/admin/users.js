const admin = require('firebase-admin');
const { checkAdmin } = require('./middleware'); // নিরাপত্তা চেক করার জন্য
const firestore = admin.firestore();

module.exports = async (req, res) => {
    // প্রথমে চেক করা হবে রিকোয়েস্টটি অ্যাডমিন পাঠিয়েছে কিনা
    if (!(await checkAdmin(req))) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    try {
        // --- ব্যবহারকারীদের তালিকা এবং সার্চ পরিচালনা করা ---
        if (req.method === 'GET') {
            const { search } = req.query;
            let query = firestore.collection('users');
            
            // আপাতত আমরা সব ইউজার এনে সার্ভারে ফিল্টার করব, যা সহজ
            const snapshot = await query.get();
            let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (search) {
                const searchTerm = search.toLowerCase();
                users = users.filter(user => 
                    (user.name && user.name.toLowerCase().includes(searchTerm)) ||
                    (user.id && user.id.includes(searchTerm))
                );
            }
            
            return res.status(200).json(users);
        }
        
        // --- ব্যবহারকারীর তথ্য আপডেট করা (পয়েন্ট, ব্যান) ---
        if (req.method === 'PUT') {
            const { userId, action, value } = req.body;
            if (!userId || !action) {
                return res.status(400).json({ message: 'User ID and action are required.' });
            }

            const userRef = firestore.collection('users').doc(userId);

            switch (action) {
                case 'update_points':
                    const pointsToAdd = Number(value);
                    if (isNaN(pointsToAdd)) {
                        return res.status(400).json({ message: 'Invalid points value.' });
                    }
                    await userRef.update({
                        points: admin.firestore.FieldValue.increment(pointsToAdd)
                    });
                    return res.status(200).json({ message: `Points updated for user ${userId}.` });

                case 'toggle_ban':
                    const userDoc = await userRef.get();
                    if (!userDoc.exists) return res.status(404).json({ message: 'User not found.' });
                    
                    const isCurrentlyBanned = userDoc.data().banned === true;
                    await userRef.update({ banned: !isCurrentlyBanned });
                    return res.status(200).json({ message: `User ban status toggled for ${userId}.` });
                    
                default:
                    return res.status(400).json({ message: 'Invalid action.' });
            }
        }

        return res.status(405).json({ message: 'Method Not Allowed' });

    } catch (error) {
        console.error("Error in /api/admin/users:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
