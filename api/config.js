export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  // Realtime Database এবং হাইব্রিড সিস্টেমের জন্য প্রয়োজনীয় কী-গুলো পাঠানো হচ্ছে
  res.status(200).json({
    apiKey: process.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.PUBLIC_FIREBASE_DATABASE_URL, // Realtime Database এর জন্য এটি জরুরি
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID,
  });
}
