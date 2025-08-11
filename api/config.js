// File: /api/config.js
module.exports = (req, res) => {
  try {
    const firebaseConfig = {
      apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.PUBLIC_FIREBASE_DATABASE_URL,
      projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.PUBLIC_FIREBASE_APP_ID,
    };
    
    // চেক করা হচ্ছে যে সব ভ্যারিয়েबल পাওয়া গেছে কিনা
    for (const key in firebaseConfig) {
      if (!firebaseConfig[key]) {
        return res.status(500).json({ 
            message: `Server configuration error: Missing environment variable ${key}` 
        });
      }
    }

    // সফল হলে, কনফিগারেশন পাঠানো হচ্ছে
    res.status(200).json(firebaseConfig);

  } catch (error) {
    console.error("Error in /api/config:", error.message);
    res.status(500).json({ 
        message: "Internal server error while loading configuration.", 
        error: error.message 
    });
  }
};
