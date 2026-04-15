# MTA Co-President Election 2025

Ranked Choice Voting (STV) election system for Mana Telugu Association at Purdue University.

## Quick Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Firebase (free, 3 minutes)
1. Go to https://console.firebase.google.com
2. Click "Create a project" → name it `mta-election` → Continue
3. Disable Google Analytics → Create Project
4. Left sidebar → Build → Realtime Database → Create Database → TEST MODE
5. Project Settings (gear icon) → scroll to "Your apps" → click `</>` (Web)
6. Register app name `mta-election` → copy the `firebaseConfig` object
7. Paste it into `src/firebase.js` (replace the placeholder values)

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:5173 in your browser.

### 4. Deploy to Netlify
1. Push this project to GitHub
2. Go to https://app.netlify.com → "Add new site" → "Import from Git"
3. Connect your GitHub repo → Deploy

## Admin Code
Default: `MTA2025` — change it in `src/App.jsx` line 12.

## Making Changes After Deployment
Edit files → push to GitHub → Netlify auto-deploys in ~30 seconds.
