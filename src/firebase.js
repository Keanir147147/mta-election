// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
// Firebase is Google's free real-time database. It replaces Claude's
// window.storage so that votes sync across devices on a real website.
//
// TO SET UP (one-time, takes 3 minutes):
// 1. Go to https://console.firebase.google.com
// 2. Click "Create a project" → name it "mta-election" → Continue
// 3. Disable Google Analytics (not needed) → Create Project
// 4. In the left sidebar, click "Build" → "Realtime Database"
// 5. Click "Create Database" → choose any location → Start in TEST MODE
// 6. Go to Project Settings (gear icon top left) → scroll to "Your apps"
// 7. Click the </> icon (Web) → register app name "mta-election"
// 8. Copy the firebaseConfig object and paste it below
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp } from "firebase/app"
import { getDatabase, ref, get, set } from "firebase/database"

// ⬇️ PASTE YOUR FIREBASE CONFIG HERE (replace the placeholder values)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

// These two functions replace Claude's window.storage.get() and .set()
// They work exactly the same way but store data in Firebase instead.

export async function sGet(key) {
  try {
    const snapshot = await get(ref(db, `election/${key}`))
    return snapshot.exists() ? snapshot.val() : null
  } catch (e) {
    console.error("Firebase read error:", e)
    return null
  }
}

export async function sSet(key, value) {
  try {
    await set(ref(db, `election/${key}`), value)
  } catch (e) {
    console.error("Firebase write error:", e)
  }
}
