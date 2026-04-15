import { initializeApp } from "firebase/app"
import { getDatabase, ref, get, set } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyBDgQo5CF0U5kUwk9FrV4uJEuuDP-VRXxY",
  authDomain: "mta-election.firebaseapp.com",
  databaseURL: "https://mta-election-default-rtdb.firebaseio.com",
  projectId: "mta-election",
  storageBucket: "mta-election.firebasestorage.app",
  messagingSenderId: "577971840093",
  appId: "1:577971840093:web:60efdd68aeabd33ccc99b4"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

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
