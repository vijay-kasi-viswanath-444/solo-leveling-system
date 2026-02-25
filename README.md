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

## Android (Capacitor)

This project now includes a Capacitor Android shell with native local notifications.

1. Install dependencies:

```bash
npm install
```

2. Sync web assets and Android project:

```bash
npm run android:sync
```

3. Open Android Studio:

```bash
npm run android:open
```

### Reminder notification behavior

- Web browser: uses the existing Notification API timer fallback.
- Native Android app: uses `@capacitor/local-notifications` schedules.
- Reminder schedules are regenerated when tasks/reminders are edited, loaded, or synced.
- On Android, reminder schedules are also refreshed when app returns to foreground.
- If exact alarms are denied by system settings, reminders still work but can fire later.

### Push notifications (FCM)

Native push registration is enabled in the app via `@capacitor/push-notifications`.
When logged in, each device stores its token at:

```txt
users/{uid}/devices/{installationId}
```

Required Android setup:
- Add your app in Firebase Console with package id `com.pmb.app`.
- Download `google-services.json`.
- Place it at `android/app/google-services.json`.
- Re-run:

```bash
npm run android:sync
```

## Cloud Functions (Push Sender)

Functions source is in `functions/` and includes callable `sendUserPush`.

1. Install functions deps:

```bash
npm run functions:install
```

2. Deploy:

```bash
npm run functions:deploy
```

`sendUserPush` sends a notification (`title`, `body`, optional `data`) to all registered tokens for the authenticated user and removes invalid tokens.

## Notes

- PWA icon updates may require uninstall/reinstall due to cache.
- If Firebase changes do not appear, hard refresh (`Ctrl+F5`) and verify auth/domain/rules.
