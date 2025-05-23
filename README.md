This is a Twitch bot for Ciri_VT built with Node.js, Express, and `tmi.js`. It supports:

- ✅ Twitch chat interaction
- ✅ EventSub webhook handling
- ✅ Channel point reward tracking
- ✅ Attendance streak tracking for viewers
- ✅ Dynamic EventSub subscription
- ✅ Easy deployment to services like Render

---

🧰 Features

- Tracks attendance based on channel point reward redemption
- Uses EventSub to receive Twitch events (webhook transport)
- Verifies request signatures securely with HMAC
- Stores viewer streaks and attendance per stream
- Works with `ngrok` or public hosting platforms

---

🛠️ Tech Stack

- Node.js
- Express
- tmi.js (Twitch chat bot)
- dotenv (for environment variables)
- crypto (HMAC signature verification)

---
