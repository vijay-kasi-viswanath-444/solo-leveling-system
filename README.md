# Solo Leveling System

Solo Leveling inspired mobile-first web app with:
- Hunter profile (level, rank, title, XP, streak)
- Quest management (single/overall tasks, done/undone, edit, reminders)
- Analytics (weekly completion + progress calendar)
- Achievements (dynamic unlocks)
- Firebase Google Auth + Firestore sync
- PWA support (installable web app)

## Tech Stack

- HTML, CSS, Vanilla JavaScript
- Firebase Auth (Google provider)
- Cloud Firestore
- Firebase Cloud Messaging (web push)
- Cloud Functions (scheduled reminders)
- Firebase Hosting
- Service Worker + Web App Manifest

## Project Structure

```txt
.
├─ index.html
├─ home.html
├─ quests.html
├─ analytics.html
├─ achievements.html
├─ manifest.webmanifest
├─ sw.js
├─ firebase.json
├─ .firebaserc
├─ .env.example
├─ config/
│  ├─ firebase.public.js
│  └─ firebase.example.js
├─ assets/icons/
│  ├─ icon-192.png
│  └─ icon-512.png
└─ scripts/
   └─ generate-firebase-config.mjs
```

## Local Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Fill `.env` with your Firebase values.

3. Generate runtime config:

```bash
node scripts/generate-firebase-config.mjs
```

Add web push key in `.env` before generating config:

```bash
FIREBASE_WEB_PUSH_VAPID_KEY=YOUR_WEB_PUSH_VAPID_KEY
```

4. Run local server:

```bash
python -m http.server 5500
```

5. Open:

```txt
http://localhost:5500
```

## Firebase Setup

In Firebase Console:

1. Enable Google sign-in:
- `Authentication` -> `Sign-in method` -> `Google` -> Enable

2. Create Firestore Database.

3. Use Firestore rules:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. Enable Cloud Messaging and generate a Web Push certificate key pair.
6. Put the public key into `.env` as `FIREBASE_WEB_PUSH_VAPID_KEY`.

## Android Push Setup

1. Install function dependencies:

```bash
npm --prefix functions install
```

2. Deploy functions + hosting:

```bash
firebase deploy --only functions,hosting
```

3. On Android Chrome:
- Open the HTTPS site
- Sign in
- Enable notification permission when prompted
- Keep at least one reminder-enabled task

Scheduler runs every 5 minutes and sends due reminders via FCM.

4. Add authorized domains:
- `localhost`
- `127.0.0.1`
- Your production hosting domain(s)

## Data Path

App stores synced user data at:

```txt
users/{uid}/profile/main
```

Includes profile, level/xp, quests, reminder settings, and sync timestamps.

## Environment & Secrets

- Keep real keys in `.env` only (ignored by git).
- Runtime config is generated to:
  - `config/firebase.runtime.js` (ignored by git)
- Public fallback file:
  - `config/firebase.public.js` (tracked, can stay empty)

If a key was exposed, rotate it in Google Cloud Console.

## Deploy (Firebase Hosting)

1. Login:

```bash
firebase login
```

2. Select project (if needed):

```bash
firebase use <project-id>
```

3. Deploy:

```bash
firebase deploy --only hosting
```

`firebase.json` predeploy automatically generates runtime config from `.env`.

## PWA

This app is installable:
- Manifest: `manifest.webmanifest`
- Service Worker: `sw.js`
- Icons: `assets/icons/icon-192.png`, `assets/icons/icon-512.png`

After deploy:
- Open in Chrome/Edge
- Use Install/Add to Home Screen

## Notes

- PWA icon updates may require uninstall/reinstall due to cache.
- If Firebase changes do not appear, hard refresh (`Ctrl+F5`) and verify auth/domain/rules.
