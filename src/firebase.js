import { initializeApp } from "firebase/app"
import { getDatabase, ref, get, set, runTransaction } from "firebase/database"

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
    if (!snapshot.exists()) return null
    const raw = snapshot.val()
    if (typeof raw === "string") {
      try { return JSON.parse(raw) } catch { return raw }
    }
    return raw
  } catch (e) {
    console.error("Firebase read error:", e)
    return null
  }
}

export async function sSet(key, value) {
  try {
    await set(ref(db, `election/${key}`), JSON.stringify(value))
  } catch (e) {
    console.error("Firebase write error:", e)
  }
}

// Atomic ballot cast using Firebase transaction on a single parent node.
// Reads {ballots, checked, receipts} together, applies the voter's change,
// and writes them back. If another voter writes simultaneously, Firebase
// rejects this write and automatically retries with fresh data — so no
// ballot can ever overwrite another. Returns {success, reason}.
export async function castBallotAtomic(voterName, ballot, receiptCode) {
  try {
    const parentRef = ref(db, "election")
    const result = await runTransaction(parentRef, (current) => {
      // current might be null if the database is empty
      const cur = current || {}
      const ballots = cur.mta25_ballots ? JSON.parse(cur.mta25_ballots) : []
      const checked = cur.mta25_checked ? JSON.parse(cur.mta25_checked) : []
      const receipts = cur.mta25_receipts ? JSON.parse(cur.mta25_receipts) : []

      // Double-vote check using the fresh, transactionally-consistent data
      if (checked.includes(voterName)) {
        // Return undefined to abort the transaction
        return undefined
      }

      // Shuffle the new ballot into a random position so submission order
      // doesn't reveal which voter cast which ballot.
      const insertAt = Math.floor(Math.random() * (ballots.length + 1))
      const newBallots = [...ballots.slice(0, insertAt), ballot, ...ballots.slice(insertAt)]
      const newReceipts = [...receipts.slice(0, insertAt), receiptCode, ...receipts.slice(insertAt)]
      const newChecked = [...checked, voterName]

      return {
        ...cur,
        mta25_ballots: JSON.stringify(newBallots),
        mta25_checked: JSON.stringify(newChecked),
        mta25_receipts: JSON.stringify(newReceipts),
      }
    })

    if (!result.committed) {
      // Transaction aborted — either already voted, or failed after retries
      return { success: false, reason: "already_voted_or_conflict" }
    }
    return { success: true }
  } catch (e) {
    console.error("Firebase transaction error:", e)
    return { success: false, reason: "network_error" }
  }
}
