import { useState, useEffect, useCallback, useRef } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const CANDIDATES = [
  "Veda Vennela Thangudu",
  "Venkata Chelliboyina",
  "Sneha Reddy Tamma",
  "Ananya Reddy Depa",
]

const VOTERS = [
  "Navdhir Polkampalli",
  "Praharsha Manda",
  "Veda Vennela Thangudu",
  "Venkata Chelliboyina",
  "Pranav Kalakota",
  "Juhitha Reddy Kanduluru",
  "Mohit Manna",
  "Sneha Reddy Tamma",
  "Pranav Konda",
  "Prathami Panabakam",
  "Ananya Reddy Depa",
  "Sahasra Kandula",
  "Keshav Anirudh Nagubandi",
]

const TOTAL = VOTERS.length
const SEATS = 2
const QUOTA = Math.floor(TOTAL / (SEATS + 1)) + 1 // 5

// ⚠️ ADMIN CODE — loaded from an environment variable at build time.
//
// On Netlify: Site configuration → Environment variables → VITE_ADMIN_CODE
// Locally: create `.env.local` in project root with:  VITE_ADMIN_CODE=your-code
// The `.env.local` file is in .gitignore so it never touches GitHub.
//
// NOTE: we reference `import.meta.env.VITE_ADMIN_CODE` DIRECTLY (not wrapped
// in `new Function`) because Vite performs a build-time string substitution
// pass — it literally finds the text `import.meta.env.VITE_ADMIN_CODE` in
// source and replaces it with the actual value. Any indirection (Function
// constructor, dynamic property access, etc.) breaks that substitution and
// the value ends up undefined at runtime.
//
// This means the code will NOT work in Claude's artifact preview — that's
// fine, we're testing on Netlify now. If you ever need to open it in the
// preview again, temporarily change this to a hardcoded string.
const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE || "NOT_CONFIGURED"

const ORDINALS = ["1st", "2nd", "3rd", "4th"]
const RANK_COLORS = ["#c2410c", "#1d4ed8", "#15803d", "#7e22ce"]
const RANK_LIGHT = ["#fff7ed", "#eff6ff", "#f0fdf4", "#faf5ff"]

// ─────────────────────────────────────────────────────────────────────────────
// RANDOM NAME / CODE / SHUFFLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const FIRST_NAMES = ["Aarav","Aditi","Aisha","Akash","Amara","Anil","Anita","Arjun","Arya","Bhavya","Chandra","Deepa","Dev","Diya","Farhan","Gauri","Hari","Isha","Jay","Kavya","Kiran","Lakshmi","Manoj","Meera","Nadia","Nikhil","Nisha","Omkar","Pooja","Priya","Rahul","Ravi","Riya","Rohan","Sahana","Sanjay","Sara","Shreya","Siddharth","Simran","Sunita","Tanvi","Uma","Varun","Vimal","Yash","Zara","Neha","Vikram","Arun","Pallavi","Kunal","Divya","Harsh","Jaya","Manish","Rekha","Suresh","Tara","Vijay"]
const LAST_NAMES = ["Acharya","Bhat","Chakraborty","Desai","Garg","Iyer","Joshi","Kapoor","Kumar","Malhotra","Menon","Nair","Patel","Pillai","Rao","Reddy","Shah","Sharma","Singh","Srinivasan","Thakur","Verma","Yadav","Banerjee","Chopra","Dutta","Ghosh","Gupta","Hegde","Jain","Kulkarni","Mehta","Mishra","Mukherjee","Pandey","Prasad","Rajan","Saxena","Sethi","Trivedi"]

// Fresh random names — pass a fresh Set each time you want new ones
function genRandomNames(n) {
  const names = new Set()
  while (names.size < n) {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    names.add(`${f} ${l}`)
  }
  return [...names]
}

// Fisher–Yates shuffle; returns a new array
function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 6-char receipt code using unambiguous chars (no 0/O/1/I)
function genReceipt() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let s = ""
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// Generate N random ballots with given min-rank requirement
function genRandomBallots(nVoters, nCandidates, minRank = 2) {
  const out = []
  for (let v = 0; v < nVoters; v++) {
    const ballot = Array(nCandidates).fill(null)
    const nToRank = minRank + Math.floor(Math.random() * (nCandidates - minRank + 1))
    const order = shuffled(Array.from({ length: nCandidates }, (_, i) => i))
    for (let r = 0; r < nToRank; r++) ballot[order[r]] = r + 1
    out.push(ballot)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// STV ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function runSTV(ballots, candidates = CANDIDATES) {
  // Droop quota computed from the actual ballot count — so this function
  // works for the real election AND for trial simulations with any N.
  const quota = Math.floor(ballots.length / (SEATS + 1)) + 1
  const rankLists = ballots.map(b =>
    b.map((r, i) => ({ r, i })).filter(x => x.r !== null).sort((a, b) => a.r - b.r).map(x => x.i)
  )
  let weights = ballots.map(() => 1.0)
  let eliminated = new Set()
  let elected = []
  let rounds = []
  const isActive = ci => !eliminated.has(ci) && !elected.find(e => e.ci === ci)
  const countVotes = () => {
    const c = Array(candidates.length).fill(0)
    rankLists.forEach((list, bi) => {
      for (const ci of list) { if (isActive(ci)) { c[ci] += weights[bi]; break } }
    })
    return c
  }
  const transferSurplus = (winCi, total) => {
    const tw = (total - quota) / total
    if (tw <= 0) return
    rankLists.forEach((list, bi) => {
      for (const ci of list) { if (isActive(ci)) { if (ci === winCi) weights[bi] *= tw; break } }
    })
  }
  let rn = 1
  while (elected.length < SEATS && rn <= 20) {
    const counts = countVotes()
    const active = candidates.map((_, i) => i).filter(isActive)
    if (!active.length) break
    const snapshot = active.map(ci => ({ ci, name: candidates[ci], votes: +counts[ci].toFixed(3) }))
    let actions = [], found = false
    // BUG FIX: sort by votes descending so the candidate with the highest vote
    // total is elected FIRST when multiple candidates cross the quota in the
    // same round. Previously we iterated array-order which meant a lower-index
    // candidate with fewer votes could win the last seat ahead of a
    // higher-vote candidate.
    const byVotesDesc = [...active].sort((a, b) => counts[b] - counts[a])
    for (const ci of byVotesDesc) {
      if (counts[ci] >= quota && elected.length < SEATS) {
        transferSurplus(ci, counts[ci]); elected.push({ ci, round: rn }); actions.push({ type: "elected", ci }); found = true
      }
    }
    if (!found) {
      // Tie-break elimination: if multiple candidates tie for lowest, look
      // back at earlier rounds and eliminate whoever had the fewest votes
      // earliest. If still tied all the way back, fall back to highest index
      // (i.e. alphabetically later in the list).
      const minV = Math.min(...active.map(ci => counts[ci]))
      const tied = active.filter(ci => counts[ci] === minV)
      let toElim = tied[tied.length - 1]
      if (tied.length > 1) {
        for (let past = rounds.length - 1; past >= 0; past--) {
          const pastSnap = rounds[past].snapshot
          let earliestLowest = null, lowestVotes = Infinity
          for (const ci of tied) {
            const row = pastSnap.find(r => r.ci === ci)
            if (row && row.votes < lowestVotes) { lowestVotes = row.votes; earliestLowest = ci }
          }
          if (earliestLowest !== null && tied.filter(ci => {
            const r = pastSnap.find(x => x.ci === ci); return r && r.votes === lowestVotes
          }).length === 1) { toElim = earliestLowest; break }
        }
      }
      eliminated.add(toElim); actions.push({ type: "eliminated", ci: toElim })
    }
    rounds.push({ rn, snapshot, actions }); rn++
    const rem = candidates.map((_, i) => i).filter(isActive)
    if (rem.length > 0 && rem.length <= SEATS - elected.length) {
      rem.forEach(ci => elected.push({ ci, round: rn }))
      const fc = countVotes()
      rounds.push({ rn, snapshot: rem.map(ci => ({ ci, name: candidates[ci], votes: +fc[ci].toFixed(3) })), actions: rem.map(ci => ({ type: "elected", ci })) })
      break
    }
  }
  return { rounds, elected, quota }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const SK = { phase: "mta25_phase", ballots: "mta25_ballots", checked: "mta25_checked", receipts: "mta25_receipts", release: "mta25_release" }
async function sGet(k) {
  try { const r = await window.storage.get(k, true); return r ? JSON.parse(r.value) : null } catch { return null }
}
async function sSet(k, v) {
  try { await window.storage.set(k, JSON.stringify(v), true) } catch(e) { console.error(e) }
}

// ─────────────────────────────────────────────────────────────────────────────
// MTA LOGO — real logo embedded as base64 so it works offline and on any host
// ─────────────────────────────────────────────────────────────────────────────
const LOGO_SMALL = "data:image/jpeg;base64,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"
const LOGO_LARGE = "data:image/jpeg;base64,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"

function MTALogo({ size = 48 }) {
  const src = size >= 100 ? LOGO_LARGE : LOGO_SMALL
  return (
    <img
      src={src}
      alt="Mana Telugu Association"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "inline-block", flexShrink: 0 }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 14, ...{} }} className={className}>{children}</div>
}
function CardHead({ children }) {
  return <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafaf9" }}>{children}</div>
}
function CardBody({ children }) {
  return <div style={{ padding: "18px 20px" }}>{children}</div>
}
function H1({ children }) { return <div style={{ fontSize: 20, fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>{children}</div> }
function H2({ children }) { return <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 4 }}>{children}</div> }
function Sub({ children }) { return <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{children}</div> }
function Chip({ color, children }) {
  const map = {
    green: { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
    orange: { bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
    blue: { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
    red: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
    gray: { bg: "#f9fafb", color: "#6b7280", border: "#d1d5db" },
  }
  const s = map[color] || map.gray
  return <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{children}</span>
}
function Btn({ onClick, disabled, color = "orange", children, full = true, sm = false }) {
  const bg = { orange: "#ea580c", green: "#16a34a", red: "#dc2626", gray: "#9ca3af", blue: "#2563eb" }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : "auto",
      padding: sm ? "8px 18px" : "13px 20px",
      borderRadius: 10, border: "none",
      fontSize: sm ? 13 : 15, fontWeight: 700,
      background: disabled ? "#e5e7eb" : bg[color],
      color: disabled ? "#9ca3af" : "white",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "opacity 0.15s",
    }}>{children}</button>
  )
}
function PinInput({ value, onChange, placeholder = "Enter code", onEnter }) {
  return (
    <input
      type="password" value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === "Enter" && onEnter && onEnter()}
      placeholder={placeholder}
      style={{ width: "100%", padding: "12px 14px", borderRadius: 9, border: "1.5px solid #d1d5db", fontSize: 16, outline: "none", letterSpacing: "0.2em", fontFamily: "monospace" }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
function HomePage({ ctx, setTab }) {
  const { phase, ballots, checkedIn } = ctx
  const [showQR, setShowQR] = useState(false)
  // Build the share URL from whatever host the app is running on — works
  // on Netlify, custom domains, localhost, anywhere.
  const shareUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname : ""
  // Use the free public QR API. No library dependency, works offline-ish
  // (as long as the voter has internet, which they need anyway to vote).
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(shareUrl)}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert("Link copied to clipboard!")
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea")
      ta.value = shareUrl; document.body.appendChild(ta); ta.select()
      document.execCommand("copy"); document.body.removeChild(ta)
      alert("Link copied!")
    }
  }
  const phaseInfo = {
    setup: { emoji: "🔒", label: "Election Not Started", desc: "The admin needs to unlock voting using the admin code before anyone can cast a ballot.", color: "gray", btnLabel: "Go to Admin →", btnTab: "admin" },
    open: { emoji: "🗳️", label: "Voting is Open!", desc: "All eligible members can now cast their secret ballot. Select your name and rank your candidates.", color: "green", btnLabel: "Vote Now →", btnTab: "vote" },
    closed: { emoji: "⏳", label: "Voting Closed", desc: "All votes are in. The admin will reveal results shortly.", color: "orange", btnLabel: null },
    revealed: { emoji: "🏆", label: "Results Published!", desc: "The election is complete. View the winners and verify your ballot.", color: "blue", btnLabel: "See Results →", btnTab: "results" },
  }
  const info = phaseInfo[phase] || phaseInfo.setup
  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fef9c3 50%, #f0fdf4 100%)", border: "1px solid #fed7aa", borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
        <MTALogo size={80} />
        <div style={{ fontSize: 24, fontWeight: 800, color: "#1e1b4b", marginTop: 14, marginBottom: 4 }}>Mana Telugu Association</div>
        <div style={{ fontSize: 14, color: "#92400e", fontWeight: 600, letterSpacing: "0.08em" }}>PURDUE UNIVERSITY · CO-PRESIDENT ELECTION 2026</div>
        <div style={{ marginTop: 16 }}>
          <Chip color={info.color}>{info.emoji} {info.label}</Chip>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10, maxWidth: 360, margin: "10px auto 0" }}>{info.desc}</div>
        {info.btnLabel && (
          <button onClick={() => setTab(info.btnTab)} style={{ marginTop: 16, padding: "11px 28px", background: "#ea580c", color: "white", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {info.btnLabel}
          </button>
        )}
        {(phase === "setup" || phase === "open") && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowQR(true)} style={{ padding: "8px 20px", background: "white", color: "#ea580c", border: "1.5px solid #fed7aa", borderRadius: 100, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📱 Share link · QR code
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { val: CANDIDATES.length, label: "Candidates", icon: "👤" },
          { val: TOTAL, label: "Eligible voters", icon: "🧑‍🤝‍🧑" },
          { val: QUOTA, label: "Votes to win", icon: "🏆" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#ea580c" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {phase !== "setup" && (
        <Card>
          <CardBody>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <H2>Voting progress</H2>
              <Chip color={ballots.length === TOTAL ? "green" : "orange"}>{ballots.length}/{TOTAL} voted</Chip>
            </div>
            <div style={{ height: 8, background: "#f3f4f6", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: 8, background: ballots.length === TOTAL ? "#16a34a" : "#ea580c", width: `${ballots.length / TOTAL * 100}%`, borderRadius: 100, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
              {ballots.length === TOTAL ? "All votes received!" : `${TOTAL - ballots.length} still to vote`}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Candidates */}
      <Card>
        <CardHead><H2>Candidates for Co-President</H2></CardHead>
        <CardBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CANDIDATES.map((name, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: RANK_LIGHT[i], borderRadius: 10, border: `1px solid ${RANK_COLORS[i]}22` }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: RANK_COLORS[i], color: "white", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1f2937" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Candidate for Co-President</div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Voting method */}
      <div style={{ padding: "14px 16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, fontSize: 13, color: "#92400e", lineHeight: 1.7 }}>
        <strong>Voting method:</strong> Ranked Choice Voting (Single Transferable Vote). You rank candidates 1–4. The two winners are whoever reaches {QUOTA} votes first, with transfers ensuring every vote counts.
      </div>

      {/* QR share modal */}
      {showQR && (
        <div onClick={() => setShowQR(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="mta-keep-color" style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 380, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e1b4b", marginBottom: 4 }}>Share this election</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 18 }}>Scan with any phone camera to open the ballot.</div>
            <div style={{ padding: 12, background: "#fafaf9", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 14 }}>
              <img src={qrSrc} alt="QR code for ballot link" style={{ width: "100%", maxWidth: 260, height: "auto", display: "block", margin: "0 auto" }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Direct link</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", background: "#fafaf9", padding: "8px 12px", borderRadius: 8, marginBottom: 14, wordBreak: "break-all", color: "#1f2937" }}>{shareUrl}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={copyLink} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 9, background: "#1d4ed8", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                📋 Copy link
              </button>
              <button onClick={() => setShowQR(false)} style={{ flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 9, background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#6b7280" }}>
                Close
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>Tip: hold your laptop up so multiple people can scan at once.</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS PAGE — narrative + visual walkthrough with placeholder names
// ─────────────────────────────────────────────────────────────────────────────
// These names are deliberate placeholders. They are NOT the real candidates.
// They stay the same every page load so readers can follow the walkthrough,
// but they are generic enough that no bias toward any real candidate is created.
const EX = ["Arjun", "Priya", "Meera", "Rohan"]

// Small reusable "step card" with a colored number badge
function StepCard({ n, title, color, children }) {
  return (
    <div style={{ border: `1.5px solid ${color}44`, borderRadius: 12, padding: "16px 18px", marginBottom: 10, background: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: color, color: "white", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b" }}>{title}</div>
      </div>
      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{children}</div>
    </div>
  )
}

// Horizontal bar used in the walkthrough example
function ExBar({ name, votes, max, color, tag }) {
  const pct = Math.max(4, (votes / max) * 100)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 58, color: "#374151" }}>{name}</span>
      <div style={{ flex: 1, position: "relative", height: 22, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, color: "white", fontSize: 12, fontWeight: 800 }}>{votes}</div>
      </div>
      {tag && <span style={{ fontSize: 11, fontWeight: 700, color: tag === "WIN" ? "#15803d" : "#dc2626", minWidth: 30 }}>{tag === "WIN" ? "✓ WIN" : "✗ OUT"}</span>}
    </div>
  )
}

function HowPage() {
  return (
    <div>
      <Card>
        <CardHead>
          <H1>How this election works</H1>
          <Sub>If you've only ever known "most votes wins" — this explains everything.</Sub>
        </CardHead>
        <CardBody>
          {/* What you're used to */}
          <div style={{ padding: "16px 18px", background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 8 }}>What you're used to</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 8 }}>
              In a normal election, everyone picks <strong>one person</strong>. Whoever gets the most votes wins. Simple.
            </div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
              But we're electing <strong>{SEATS} Co-Presidents</strong>, not 1. And with "just pick one," some people's votes get completely wasted — their candidate loses and their voice disappears. That's not fair.
            </div>
          </div>

          {/* What we do instead */}
          <div style={{ padding: "16px 18px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 8 }}>What we do instead — Ranked Choice</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 12 }}>
              Instead of picking just one person, you <strong>rank all the candidates in order</strong>: "I like this person most, this person second, this person third…" and so on.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {EX.map((nm, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 5px", background: "white", border: `1px solid ${RANK_COLORS[i]}33`, borderRadius: 100 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: RANK_COLORS[i], color: "white", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{nm}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
              ☝️ This is what your ballot looks like — you rank everyone 1st, 2nd, 3rd, 4th. <em>(These are example names, not the real candidates.)</em>
            </div>
          </div>

          {/* Why ranking matters */}
          <div style={{ padding: "16px 18px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 8 }}>Why does ranking matter?</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 10 }}>
              Because your vote <strong>never gets wasted</strong>. If your #1 pick gets eliminated, your vote automatically moves to your #2 pick. It's like saying: "I want {EX[0]}, but if they can't win, give my vote to {EX[2]} instead."
            </div>
            <div style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600, lineHeight: 1.6 }}>
              Think of it this way: you're giving your vote a backup plan, and a backup for the backup.
            </div>
          </div>

          {/* Magic number */}
          <div style={{ padding: "16px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 8 }}>The magic number: {QUOTA}</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 8 }}>
              To win a seat, a candidate needs <strong>{QUOTA} votes out of {TOTAL}</strong>. Why {QUOTA}? Because it's mathematically impossible for {SEATS + 1} people to all get {QUOTA} votes (that would need {(SEATS + 1) * QUOTA} votes, but there are only {TOTAL}). So at most <strong>{SEATS} people can reach {QUOTA}</strong> — which is exactly how many Co-Presidents we're electing.
            </div>
            <div style={{ fontSize: 12, color: "#166534", fontFamily: "monospace", background: "white", padding: "6px 10px", borderRadius: 6, display: "inline-block", marginBottom: 8 }}>
              ⌊{TOTAL} ÷ ({SEATS}+1)⌋ + 1 = {QUOTA}
            </div>
            <div style={{ fontSize: 12, color: "#166534", fontStyle: "italic" }}>It guarantees exactly {SEATS} winners. No more, no less.</div>
          </div>

          {/* Walkthrough example */}
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b", marginTop: 22, marginBottom: 12 }}>Let's walk through an example</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, fontStyle: "italic" }}>
            Imagine {EX.join(", ")} are running. All {TOTAL} voters submit ranked ballots. Here's how the count unfolds.
          </div>

          <StepCard n="1" title={`Count everyone's #1 pick`} color="#ea580c">
            All {TOTAL} voters submit their ranked ballots. We look at ONLY the #1 picks first:
            <div style={{ background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
              <ExBar name={EX[0]} votes={6} max={6} color={RANK_COLORS[0]} tag="WIN" />
              <ExBar name={EX[2]} votes={4} max={6} color={RANK_COLORS[3]} />
              <ExBar name={EX[1]} votes={2} max={6} color={RANK_COLORS[2]} />
              <ExBar name={EX[3]} votes={1} max={6} color={RANK_COLORS[1]} />
              <div style={{ fontSize: 11, color: "#ea580c", fontWeight: 600, marginTop: 6 }}>The vertical bar at {QUOTA} votes = the magic number to win</div>
            </div>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 13, color: "#166534" }}>
              <strong>{EX[0]} has 6!</strong> That's more than {QUOTA}, so <strong>they win the first seat</strong> immediately.
            </div>
          </StepCard>

          <div style={{ textAlign: "center", color: "#9ca3af", margin: "4px 0 4px" }}>⬇</div>

          <StepCard n="2" title="Winner's extra votes help others" color="#7e22ce">
            {EX[0]} needed {QUOTA} votes but got 6. That means <strong>1 vote is extra</strong>. Where does it go? It doesn't disappear — it flows to what {EX[0]}'s voters picked as their <strong>#2 choice</strong>.
            <div style={{ background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", marginTop: 10, fontSize: 13 }}>
              🪣 {EX[0]} had 6 voters. They only needed {QUOTA}.<br />
              💧 1 extra vote gets shared among their #2 picks:
              <div style={{ marginTop: 6, marginLeft: 14, color: "#6b7280" }}>
                → 3 voters had {EX[2]} as #2 → {EX[2]} gets <strong style={{ color: "#15803d" }}>+0.5</strong><br />
                → 3 voters had {EX[1]} as #2 → {EX[1]} gets <strong style={{ color: "#15803d" }}>+0.5</strong>
              </div>
            </div>
            <div style={{ background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 13, color: "#6b21a8" }}>
              <strong>Why not just +1?</strong> Because the extra vote gets split fairly among all of {EX[0]}'s voters' second choices. Each voter's leftover influence is small but adds up.
            </div>
          </StepCard>

          <div style={{ textAlign: "center", color: "#9ca3af", margin: "4px 0 4px" }}>⬇</div>

          <StepCard n="3" title="Weakest person is eliminated" color="#dc2626">
            After the transfer, nobody else hit {QUOTA} yet. So the person with the <strong>fewest votes gets eliminated</strong>, and their voters' ballots move to their next choice.
            <div style={{ background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
              <ExBar name={EX[2]} votes={4.5} max={5} color={RANK_COLORS[3]} />
              <ExBar name={EX[1]} votes={2.5} max={5} color={RANK_COLORS[2]} />
              <ExBar name={EX[3]} votes={1} max={5} color={RANK_COLORS[1]} tag="OUT" />
              <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginTop: 8 }}>✗ {EX[3]} has fewest (1) → eliminated</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{EX[3]}'s voter ranked {EX[2]} #2 → {EX[2]} gets +1</div>
            </div>
          </StepCard>

          <div style={{ textAlign: "center", color: "#9ca3af", margin: "4px 0 4px" }}>⬇</div>

          <StepCard n="4" title="Second winner found!" color="#16a34a">
            <div style={{ background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px" }}>
              <ExBar name={EX[2]} votes={5.5} max={5.5} color="#16a34a" tag="WIN" />
              <ExBar name={EX[1]} votes={2.5} max={5.5} color={RANK_COLORS[2]} />
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>✓ {EX[2]} hits {QUOTA}+ → wins the second seat!</div>
            </div>
            <div style={{ textAlign: "center", marginTop: 14, padding: "14px 12px", background: "linear-gradient(135deg, #f0fdf4, #fef9c3)", borderRadius: 10 }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🏆 🏆</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1e1b4b" }}>Winners: {EX[0]} & {EX[2]}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>All from one ballot. No second election needed.</div>
            </div>
          </StepCard>

          {/* Key takeaways */}
          <div style={{ padding: "14px 18px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, marginTop: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e1b4b", marginBottom: 10 }}>Key things to remember</div>
            {[
              "You rank candidates 1st, 2nd, 3rd, 4th — not just pick one",
              `A candidate needs ${QUOTA} votes to win (not just "the most")`,
              "If your top pick loses, your vote moves to your next pick — never wasted",
              "If someone wins with extra votes, those extras help other candidates",
              "The person with the fewest votes gets eliminated each round",
              `This continues until ${SEATS} Co-Presidents are elected`,
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: "#92400e", lineHeight: 1.8 }}>✅ {item}</div>
            ))}
          </div>

          {/* Tie-break */}
          <div style={{ padding: "14px 18px", background: "#fafaf9", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b", marginBottom: 6 }}>⚖️ What if two people are tied for last?</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
              The system looks back at earlier rounds — whoever had fewer votes first gets eliminated. If they were tied all the way back to Round 1, the one whose name comes last alphabetically is eliminated. The same ballots always produce the same result — no coin flips.
            </div>
          </div>

          {/* Receipt code note */}
          <div style={{ padding: "14px 18px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#1d4ed8", lineHeight: 1.7 }}>
            📃 <strong>Ballot receipt:</strong> After voting, you get a 6-character code (like "K7X2M9"). Write it down or screenshot it! After results come out, you can type it in to confirm your vote was counted. Nobody else can see your code.
          </div>

          {/* Privacy note */}
          <div style={{ padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 10, fontSize: 13, color: "#166534", lineHeight: 1.7 }}>
            🔒 <strong>Your vote is secret.</strong> When you tap your name, it only checks you off the list. Your actual rankings are stored separately with no connection to your name. Not even the admin can see who voted for whom.
          </div>

          {/* Ballot-order note */}
          <div style={{ padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 16, fontSize: 13, color: "#166534", lineHeight: 1.7 }}>
            🎲 <strong>Fair ballot order.</strong> Every voter sees the candidates in a different random order on their ballot. This prevents any candidate from getting an unfair advantage just by being listed first — a well-documented effect worth a few percentage points in small elections.
          </div>

          {/* Videos */}
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em" }}>Still not sure? These short videos explain it perfectly</div>
          {[
            { title: "Ranked Choice Voting Explained", ch: "CGP Grey", tag: "3 min · best intro", url: "https://www.youtube.com/watch?v=oHRPMJmzBBw" },
            { title: "How Does RCV Work?", ch: "Vox", tag: "4 min · visual", url: "https://www.youtube.com/watch?v=NH3PYuOHBwk" },
            { title: "The Single Transferable Vote", ch: "CGP Grey", tag: "5 min · multi-winner", url: "https://www.youtube.com/watch?v=l8XOZJkozfI" },
          ].map(v => (
            <a key={v.url} href={v.url} target="_blank" rel="noopener" style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "#fafaf9", borderRadius: 10, border: "1px solid #e5e7eb", textDecoration: "none", color: "inherit", marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "white", flexShrink: 0 }}>▶</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{v.ch} · <span style={{ color: "#ea580c", fontWeight: 600 }}>{v.tag}</span></div>
              </div>
            </a>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VOTE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function VotePage({ ctx }) {
  const { phase, checkedIn, castBallot } = ctx
  const [step, setStep] = useState("select") // select | ballot | done
  const [sel, setSel] = useState([null, null, null, null])
  const [confirm, setConfirm] = useState(false)
  const [localChecked, setLocalChecked] = useState([...checkedIn])
  const [selectedVoter, setSelectedVoter] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [submitErr, setSubmitErr] = useState(null)
  // Per-voter ballot randomization — the display order of candidates on the
  // ballot. Stored as an array of real candidate indices, shuffled fresh each
  // time a voter taps their name. This prevents ballot-order bias ("primacy
  // effect") — a well-documented ~2-3% advantage candidates get from being
  // listed first. Many US states (e.g. California) require randomized order
  // by law. The STORED ballot still uses real candidate indices, so counting,
  // audits, and receipts are unaffected — only the visual order changes.
  const [displayOrder, setDisplayOrder] = useState(() => shuffled(CANDIDATES.map((_, i) => i)))

  // Sync checkedIn from parent
  useEffect(() => { setLocalChecked([...checkedIn]) }, [checkedIn])

  if (phase === "setup") return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>Voting hasn't started yet</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>The election admin needs to unlock voting first. Please wait for an announcement.</div>
    </div>
  )

  if (phase === "closed" || phase === "revealed") return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>Voting is closed</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>All votes have been collected. The admin will reveal results shortly.</div>
    </div>
  )

  if (step === "done") return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 30 }}>✓</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#15803d", marginBottom: 8 }}>Ballot cast!</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>Your vote has been recorded anonymously. Your name is not connected to what you voted.</div>

      {receipt && (
        <div style={{ maxWidth: 360, margin: "0 auto 20px", padding: "18px 20px", background: "#fffbeb", border: "2px solid #fcd34d", borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Your receipt code — save it</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#1e1b4b", letterSpacing: "0.2em", fontFamily: "monospace", marginBottom: 8 }}>{receipt}</div>
          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>After results are revealed, you can enter this code on the Results page to verify your ballot was counted correctly. We don't know who you are — only you know this code belongs to you.</div>
        </div>
      )}

      <Chip color="green">{localChecked.length} of {TOTAL} votes recorded</Chip>
      <div style={{ marginTop: 20 }}>
        <button onClick={() => { setStep("select"); setSel([null,null,null,null]); setSelectedVoter(null); setReceipt(null) }} style={{ padding: "10px 22px", border: "1px solid #e5e7eb", borderRadius: 9, background: "white", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>← Back to voter list</button>
      </div>
    </div>
  )

  if (step === "ballot") return (
    <div>
      <div style={{ padding: "14px 16px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, marginBottom: 14, fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
        🔒 <strong>Secret ballot — voting as {selectedVoter}.</strong> Your name is not stored with this vote. Candidates are shown in a random order (unique to you) to prevent ballot-position bias. Tap a number to rank. Tap again to deselect. Rank at least 2 candidates.
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 50px)", padding: "10px 18px", background: "#fafaf9", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Candidate</div>
          {ORDINALS.map((o, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: RANK_COLORS[i], textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{o}</div>
          ))}
        </div>

        {displayOrder.map(ci => {
          const name = CANDIDATES[ci]
          return (
          <div key={ci} style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 50px)", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #f9fafb", background: sel[ci] !== null ? RANK_LIGHT[sel[ci] - 1] : "white", transition: "background 0.15s" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1f2937" }}>{name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Co-President candidate</div>
            </div>
            {[1,2,3,4].map(r => {
              const active = sel[ci] === r
              return (
                <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <button aria-label={`Rank ${r} for ${name}`} onClick={() => setSel(prev => {
                    const n = [...prev]
                    if (n[ci] === r) { n[ci] = null; return n }
                    const c = n.indexOf(r); if (c !== -1) n[c] = null
                    n[ci] = r; return n
                  })} style={{
                    width: 40, height: 40, borderRadius: "50%",
                    border: active ? "none" : "2px solid #e5e7eb",
                    background: active ? RANK_COLORS[r-1] : "transparent",
                    color: active ? "white" : "#d1d5db",
                    fontSize: 14, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transform: active ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.15s", cursor: "pointer",
                  }}>{r}</button>
                </div>
              )
            })}
          </div>
        )})}
      </Card>

      {/* Footer */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ height: 5, background: "#f3f4f6", borderRadius: 100, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ height: 5, background: sel.filter(Boolean).length >= 2 ? "#16a34a" : "#ea580c", width: `${sel.filter(Boolean).length / 4 * 100}%`, borderRadius: 100, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
          {sel.filter(Boolean).length === 0 && "Rank at least 2 candidates to enable submit"}
          {sel.filter(Boolean).length === 1 && "Rank 1 more candidate to enable submit"}
          {sel.filter(Boolean).length >= 2 && `${sel.filter(Boolean).length} candidates ranked — ready!`}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {ORDINALS.map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: RANK_COLORS[i] }} />{o}
            </div>
          ))}
        </div>
        <Btn disabled={sel.filter(Boolean).length < 2} onClick={() => setConfirm(true)}>Review & Cast Ballot</Btn>
        <button onClick={() => { setStep("select"); setSel([null,null,null,null]); setSelectedVoter(null) }} style={{ width: "100%", marginTop: 8, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "transparent", fontSize: 13, color: "#6b7280", cursor: "pointer" }}>
          ← Cancel, go back
        </button>
      </div>

      {/* Confirm overlay */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 380, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🗳️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e1b4b", marginBottom: 6 }}>Confirm your ballot</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>Once cast, your vote cannot be changed or traced to you.</div>
            <div style={{ background: "#fafaf9", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
              {[1, 2, 3, 4].map(rank => {
                const ci = sel.indexOf(rank)
                if (ci === -1) return null
                return (
                  <div key={rank} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: RANK_COLORS[rank-1], color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{rank}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{ORDINALS[rank-1]}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{CANDIDATES[ci]}</span>
                  </div>
                )
              })}
            </div>

            {submitErr && (
              <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 9, fontSize: 12, color: "#b91c1c", marginBottom: 12, lineHeight: 1.5 }}>
                {submitErr}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setConfirm(false); setSubmitErr(null) }} style={{ flex: 1, padding: "12px", border: "1px solid #e5e7eb", borderRadius: 9, background: "white", cursor: "pointer", fontSize: 13 }}>← Edit</button>
              <button onClick={async () => {
                // Re-check just-in-time to prevent double-vote via 2 tabs
                const latest = await sGet(SK.checked) || []
                if (latest.includes(selectedVoter)) {
                  setSubmitErr(`${selectedVoter} has already voted on another device. You cannot submit another ballot.`)
                  return
                }
                const code = genReceipt()
                const ok = await castBallot([...sel], selectedVoter, code)
                if (!ok) { setSubmitErr("Could not save your ballot. Please try again."); return }
                setReceipt(code)
                setLocalChecked(prev => [...prev, selectedVoter])
                setConfirm(false); setStep("done"); setSubmitErr(null)
              }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 9, background: "#16a34a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cast Ballot ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Select screen — FIXED: uses identity, not array position
  return (
    <div>
      <Card>
        <CardHead>
          <H1>Select your name</H1>
          <Sub>Tap your name to begin voting. Names marked ✓ have already voted and are locked.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 8 }}>
            {VOTERS.map(name => {
              const voted = localChecked.includes(name)
              return (
                <button key={name} disabled={voted} onClick={() => {
                  setSelectedVoter(name)
                  // Fresh random ballot order for this voter — kills primacy bias
                  setDisplayOrder(shuffled(CANDIDATES.map((_, i) => i)))
                  setStep("ballot")
                }}
                  style={{
                    padding: "12px 14px", borderRadius: 10, textAlign: "left",
                    border: `1px solid ${voted ? "#86efac" : "#e5e7eb"}`,
                    background: voted ? "#f0fdf4" : "white",
                    color: voted ? "#15803d" : "#1f2937",
                    fontSize: 13, fontWeight: voted ? 600 : 500,
                    cursor: voted ? "not-allowed" : "pointer",
                    opacity: voted ? 0.75 : 1,
                    transition: "all 0.15s",
                  }}>
                  {voted && <span style={{ display: "block", fontSize: 11, color: "#16a34a", fontWeight: 700, marginBottom: 2 }}>✓ Voted</span>}
                  {name}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", background: "#fffbeb", borderRadius: 9, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
            <strong>Privacy guarantee:</strong> Your name only verifies you're eligible. The moment your ballot is submitted, the connection to your name is permanently discarded. Ballots are shuffled into random positions so even the order of submission can't identify you.
          </div>
        </CardBody>
      </Card>
      <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
        {localChecked.length} of {TOTAL} members have voted
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIAL / DEMO PAGE
// ─────────────────────────────────────────────────────────────────────────────
function DemoPage() {
  const [trials, setTrials] = useState([]) // [{id, numVoters, minRank, ballots, results, candidateNames}]
  const [expandedId, setExpandedId] = useState(null)
  const [mode, setMode] = useState(null) // "real" | "custom"
  const [customN, setCustomN] = useState(50)
  const [minRank, setMinRank] = useState(2)

  const runTrial = (numVoters) => {
    const trialCandidates = genRandomNames(CANDIDATES.length)
    const ballots = genRandomBallots(numVoters, CANDIDATES.length, minRank)
    const results = runSTV(ballots, trialCandidates)
    const trial = {
      id: Date.now(),
      numVoters,
      minRank,
      ballots,
      results,
      candidateNames: trialCandidates,
    }
    setTrials(prev => [trial, ...prev])
    setExpandedId(trial.id)
  }

  return (
    <div>
      <div style={{ padding: "14px 16px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 12, marginBottom: 14, fontSize: 13, color: "#1d4ed8", lineHeight: 1.6 }}>
        🧪 <strong>Trial run mode.</strong> Simulate the election with random ballots and fresh random Indian names. Every trial uses different candidates — none of your real candidates or voters appear. No real votes are affected.
      </div>

      <Card>
        <CardHead>
          <H1>Run a new trial</H1>
          <Sub>Configure the scenario, click run — as many times as you like. Each trial is saved below for comparison.</Sub>
        </CardHead>
        <CardBody>
          {/* Step 1: voter count */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>1. How many voters?</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setMode("real")} style={{
              flex: "1 1 140px", padding: "12px 14px", borderRadius: 10,
              border: `2px solid ${mode === "real" ? "#ea580c" : "#e5e7eb"}`,
              background: mode === "real" ? "#fff7ed" : "white",
              color: mode === "real" ? "#c2410c" : "#6b7280",
              fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{TOTAL} voters</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Match the real election</div>
            </button>
            <button onClick={() => setMode("custom")} style={{
              flex: "1 1 140px", padding: "12px 14px", borderRadius: 10,
              border: `2px solid ${mode === "custom" ? "#7e22ce" : "#e5e7eb"}`,
              background: mode === "custom" ? "#faf5ff" : "white",
              color: mode === "custom" ? "#7e22ce" : "#6b7280",
              fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Custom N</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Pick anywhere from 5 to 500</div>
            </button>
          </div>

          {mode === "custom" && (
            <div style={{ padding: "12px 14px", background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Number of simulated voters:</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {[10, 25, 50, 100, 250].map(n => (
                  <button key={n} onClick={() => setCustomN(n)} style={{
                    padding: "6px 14px", borderRadius: 8,
                    border: `1px solid ${customN === n ? "#7e22ce" : "#d1d5db"}`,
                    background: customN === n ? "#7e22ce" : "white",
                    color: customN === n ? "white" : "#6b7280",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>{n}</button>
                ))}
                <input type="number" min="5" max="500" value={customN}
                  onChange={e => setCustomN(Math.max(5, Math.min(500, +e.target.value || 5)))}
                  style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: "1.5px solid #d8b4fe", fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none" }} />
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                Droop quota for {customN} voters: {Math.floor(customN / (SEATS + 1)) + 1} votes to win a seat
              </div>
            </div>
          )}

          {/* Step 2: min rank */}
          {mode && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>2. Each simulated voter must rank at least</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  { v: 2, label: "2 candidates" },
                  { v: 3, label: "3 candidates" },
                  { v: 4, label: "All 4" },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setMinRank(opt.v)} style={{
                    flex: "1 1 auto", padding: "9px 14px", borderRadius: 9,
                    border: `1px solid ${minRank === opt.v ? "#ea580c" : "#d1d5db"}`,
                    background: minRank === opt.v ? "#ea580c" : "white",
                    color: minRank === opt.v ? "white" : "#6b7280",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>{opt.label}</button>
                ))}
              </div>

              <Btn onClick={() => runTrial(mode === "real" ? TOTAL : customN)}>
                {trials.length > 0 ? `Run another trial (#${trials.length + 1}) →` : "Run trial →"}
              </Btn>
            </>
          )}
        </CardBody>
      </Card>

      {/* Trial history */}
      {trials.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, padding: "0 4px" }}>
            Trial history ({trials.length} run{trials.length === 1 ? "" : "s"})
          </div>
          {trials.map((t, idx) => (
            <Card key={t.id}>
              <CardHead>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <H2>Trial #{trials.length - idx}</H2>
                    <Sub>{t.numVoters} voters · min rank {t.minRank} · quota {Math.floor(t.numVoters / (SEATS + 1)) + 1}</Sub>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {t.results.elected.map(e => (
                      <span key={e.ci} style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, border: "1px solid #86efac" }}>
                        🏆 {t.candidateNames[e.ci]}
                      </span>
                    ))}
                    <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#6b7280" }}>
                      {expandedId === t.id ? "Hide details ↑" : "Show details ↓"}
                    </button>
                  </div>
                </div>
              </CardHead>
              {expandedId === t.id && (
                <div style={{ padding: "4px 20px 16px" }}>
                  <STVResults results={t.results} ballots={t.ballots} isDemo candidates={t.candidateNames} />
                </div>
              )}
            </Card>
          ))}

          <div style={{ textAlign: "center", marginTop: 8, marginBottom: 20 }}>
            <button onClick={() => { setTrials([]); setExpandedId(null) }} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Clear trial history
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STV RESULTS COMPONENT (shared by Demo + Admin)
// ─────────────────────────────────────────────────────────────────────────────
function STVResults({ results, ballots, isDemo = false, candidates = CANDIDATES }) {
  const quota = results.quota ?? QUOTA
  const totalBallots = ballots.length
  const maxV = Math.max(...results.rounds.flatMap(r => r.snapshot.map(s => s.votes)), quota, 1)
  const shortName = n => isDemo ? n : n.split(" ")[0]
  return (
    <div>
      {/* Winner banner */}
      <div style={{ background: "linear-gradient(135deg, #f0fdf4, #fef9c3)", border: "2px solid #86efac", borderRadius: 14, padding: "24px 20px", textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b", marginBottom: 6 }}>
          {isDemo ? "Trial Result — Sample Co-Presidents" : "MTA Co-Presidents Elected!"}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {results.elected.map(e => (
            <div key={e.ci} style={{ background: "#15803d", color: "white", fontWeight: 800, fontSize: 15, padding: "10px 24px", borderRadius: 100 }}>
              {candidates[e.ci]}
            </div>
          ))}
        </div>
      </div>

      {/* Round by round */}
      <Card>
        <CardHead>
          <H2>STV count — round by round</H2>
          <Sub>Quota = {quota} votes · vertical bar = quota threshold · numbers = vote totals</Sub>
        </CardHead>
        <div style={{ padding: "4px 20px 16px" }}>
          {results.rounds.map(round => {
            const electedCis = round.actions.filter(a => a.type === "elected").map(a => a.ci)
            const elimCis = round.actions.filter(a => a.type === "eliminated").map(a => a.ci)
            return (
              <div key={round.rn} style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "9px 16px", background: "#fafaf9", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Round {round.rn}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {electedCis.map(ci => `✓ ${shortName(candidates[ci])} elected`).join(" · ")}
                    {elimCis.map(ci => ` ✗ ${shortName(candidates[ci])} eliminated`).join("")}
                  </span>
                </div>
                {round.snapshot.sort((a, b) => b.votes - a.votes).map(row => {
                  const isWin = electedCis.includes(row.ci)
                  const isOut = elimCis.includes(row.ci)
                  const pct = row.votes / maxV * 100
                  const qpct = quota / maxV * 100
                  return (
                    <div key={row.ci} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid #f9fafb" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 55, color: isWin ? "#15803d" : isOut ? "#9ca3af" : "#1f2937" }}>
                        {shortName(row.name)}
                      </span>
                      <div style={{ flex: 1, position: "relative", height: 9, background: "#f3f4f6", borderRadius: 100 }}>
                        <div style={{ position: "absolute", height: "100%", borderRadius: 100, background: isWin ? "#16a34a" : isOut ? "#d1d5db" : "#ea580c", width: `${pct}%`, transition: "width 0.6s" }} />
                        <div style={{ position: "absolute", top: -5, bottom: -5, width: 2, background: "#374151", left: `${qpct}%`, borderRadius: 1 }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, minWidth: 36, textAlign: "right", color: isWin ? "#15803d" : isOut ? "#9ca3af" : "#1f2937" }}>{row.votes}</span>
                      {isWin && <Chip color="green">✓ Elected</Chip>}
                      {isOut && <Chip color="red">✗ Eliminated</Chip>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Plain English explanation */}
      <Card>
        <CardHead><H2>What happened — plain English</H2></CardHead>
        <CardBody>
          {results.rounds.map(round => {
            const electedCis = round.actions.filter(a => a.type === "elected").map(a => a.ci)
            const elimCis = round.actions.filter(a => a.type === "eliminated").map(a => a.ci)
            return (
              <div key={round.rn} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5 }}>Round {round.rn}</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
                  {electedCis.map(ci => {
                    const row = round.snapshot.find(r => r.ci === ci)
                    const surplus = row ? +(row.votes - quota).toFixed(3) : 0
                    return (
                      <span key={ci}><strong style={{ color: "#15803d" }}>{candidates[ci]}</strong> reached {row?.votes} votes (quota: {quota}). {surplus > 0 ? `Surplus of ${surplus} votes transferred proportionally to next choices.` : "No surplus to transfer."} </span>
                    )
                  })}
                  {elimCis.map(ci => (
                    <span key={ci}>Nobody reached the quota. <strong style={{ color: "#dc2626" }}>{candidates[ci]}</strong> had the fewest votes and was eliminated. Their supporters' ballots moved to each ballot's next valid choice.</span>
                  ))}
                </div>
              </div>
            )
          })}
        </CardBody>
      </Card>

      {/* Human audit */}
      <Card>
        <CardHead>
          <H2>Human verification — all ballots</H2>
          <Sub>Every anonymous ballot listed. A human verifier can cross-check the STV count manually using this.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ padding: "12px 14px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 9, fontSize: 13, color: "#92400e", lineHeight: 1.6, marginBottom: 14 }}>
            <strong>How to verify:</strong> Tally all "1" circles below — they should match Round 1 totals. Then trace each elimination/transfer through the rounds above.
          </div>
          {ballots.map((ballot, idx) => {
            const ranked = ballot.map((r, ci) => ({ r, ci })).filter(x => x.r !== null).sort((a, b) => a.r - b.r)
            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fafaf9", borderRadius: 8, marginBottom: 6, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", minWidth: 68 }}>Ballot #{idx + 1}</span>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {ranked.map(({ r, ci }) => (
                    <div key={r} style={{ display: "flex", alignItems: "center", gap: 4, background: RANK_LIGHT[r-1], border: `1px solid ${RANK_COLORS[r-1]}44`, borderRadius: 6, padding: "3px 9px" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: RANK_COLORS[r-1], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", fontWeight: 800, flexShrink: 0 }}>{r}</div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{shortName(candidates[ci])}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Checklist */}
          <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#fafaf9", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 13 }}>Verifier checklist</div>
            {[
              `Total ballots = ${ballots.length}${isDemo ? "" : ` (should be ${TOTAL})`}`,
              `Droop Quota: ⌊${ballots.length} ÷ ${SEATS + 1}⌋ + 1 = ${quota} votes to win`,
              "Every ballot has at least 2 rankings",
              "No ballot assigns the same rank to two candidates",
              `Round 1 first-choice totals sum to ${ballots.length}`,
              `Surplus above ${quota} redistributes proportionally`,
              "Elimination = lowest vote-getter each round",
              `Exactly ${SEATS} candidates elected`,
            ].map((item, i) => (
              <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ color: "#6b7280" }}>{item}</span>
              </label>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC RESULTS PAGE — voters land here after admin reveals results
// ─────────────────────────────────────────────────────────────────────────────
function ResultsPage({ ctx }) {
  const { phase, ballots, receipts = [], release = "winners" } = ctx
  const [results, setResults] = useState(null)
  const [verifyCode, setVerifyCode] = useState("")
  const [verifyResult, setVerifyResult] = useState(null)

  useEffect(() => {
    if (phase === "revealed" && ballots.length > 0) {
      setResults(runSTV(ballots))
    }
  }, [phase, ballots])

  if (phase !== "revealed") return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>Results not yet released</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>The admin will publish results once voting closes. Check back soon.</div>
    </div>
  )

  if (!results) return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af" }}>Loading results…</div>
  )

  const checkReceipt = () => {
    const code = verifyCode.trim().toUpperCase()
    if (!code) { setVerifyResult({ ok: false, msg: "Please enter a code." }); return }
    const idx = receipts.indexOf(code)
    if (idx === -1) { setVerifyResult({ ok: false, msg: "This code doesn't match any ballot. Check for typos (numbers vs letters)." }); return }
    const ballot = ballots[idx]
    setVerifyResult({ ok: true, ballot })
  }

  return (
    <div>
      {/* Winner banner — always shown */}
      <div style={{ background: "linear-gradient(135deg, #f0fdf4, #fef9c3)", border: "2px solid #86efac", borderRadius: 14, padding: "28px 20px", textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>MTA Co-Presidents 2026</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
          {results.elected.map(e => (
            <div key={e.ci} style={{ background: "#15803d", color: "white", fontWeight: 800, fontSize: 16, padding: "12px 26px", borderRadius: 100 }}>
              {CANDIDATES[e.ci]}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 16 }}>
          {results.elected.length} of {SEATS} seats filled · {ballots.length} ballots · quota {results.quota}
        </div>
      </div>

      {release === "winners" && (
        <Card>
          <CardBody>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, textAlign: "center" }}>
              The election organiser has released <strong>winners only</strong>. Detailed round-by-round counts are not publicly visible. If you have questions about the tally, reach out to the admin.
            </div>
          </CardBody>
        </Card>
      )}

      {/* Summary or Full: show round-by-round + plain English */}
      {(release === "summary" || release === "full") && (
        <Card>
          <CardHead>
            <H2>How the count unfolded</H2>
            <Sub>Quota = {results.quota} votes · vertical bar = quota threshold</Sub>
          </CardHead>
          <div style={{ padding: "4px 20px 16px" }}>
            {results.rounds.map(round => {
              const electedCis = round.actions.filter(a => a.type === "elected").map(a => a.ci)
              const elimCis = round.actions.filter(a => a.type === "eliminated").map(a => a.ci)
              const maxV = Math.max(...results.rounds.flatMap(r => r.snapshot.map(s => s.votes)), results.quota, 1)
              return (
                <div key={round.rn} style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "9px 16px", background: "#fafaf9", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Round {round.rn}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {electedCis.map(ci => `✓ ${CANDIDATES[ci].split(" ")[0]} elected`).join(" · ")}
                      {elimCis.map(ci => ` ✗ ${CANDIDATES[ci].split(" ")[0]} eliminated`).join("")}
                    </span>
                  </div>
                  {round.snapshot.sort((a, b) => b.votes - a.votes).map(row => {
                    const isWin = electedCis.includes(row.ci)
                    const isOut = elimCis.includes(row.ci)
                    const pct = row.votes / maxV * 100
                    const qpct = results.quota / maxV * 100
                    return (
                      <div key={row.ci} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid #f9fafb" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 80, color: isWin ? "#15803d" : isOut ? "#9ca3af" : "#1f2937" }}>
                          {row.name.split(" ")[0]}
                        </span>
                        <div style={{ flex: 1, position: "relative", height: 9, background: "#f3f4f6", borderRadius: 100 }}>
                          <div style={{ position: "absolute", height: "100%", borderRadius: 100, background: isWin ? "#16a34a" : isOut ? "#d1d5db" : "#ea580c", width: `${pct}%`, transition: "width 0.6s" }} />
                          <div style={{ position: "absolute", top: -5, bottom: -5, width: 2, background: "#374151", left: `${qpct}%`, borderRadius: 1 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, minWidth: 36, textAlign: "right", color: isWin ? "#15803d" : isOut ? "#9ca3af" : "#1f2937" }}>{row.votes}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Full transparency: plain English + ballot audit */}
      {release === "full" && <STVResults results={results} ballots={ballots} />}

      {/* Receipt verification — always available so voters can check their ballot */}
      <Card>
        <CardHead>
          <H2>Verify your ballot</H2>
          <Sub>Enter the 6-character code you received after voting to see your anonymous ballot.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <input value={verifyCode} onChange={e => setVerifyCode(e.target.value.toUpperCase())} placeholder="e.g. K7X2M9"
              style={{ flex: "1 1 180px", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #d1d5db", fontSize: 16, fontFamily: "monospace", letterSpacing: "0.15em", outline: "none", textTransform: "uppercase" }} />
            <button onClick={checkReceipt} style={{ padding: "11px 20px", border: "none", borderRadius: 9, background: "#1d4ed8", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Verify →
            </button>
          </div>

          {verifyResult && !verifyResult.ok && (
            <div style={{ padding: "11px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 9, fontSize: 13, color: "#b91c1c" }}>
              {verifyResult.msg}
            </div>
          )}

          {verifyResult && verifyResult.ok && (
            <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>✓ Ballot found — your rankings:</div>
              {[1, 2, 3, 4].map(rank => {
                const ci = verifyResult.ballot.indexOf(rank)
                if (ci === -1) return null
                return (
                  <div key={rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: RANK_COLORS[rank - 1], color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{rank}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", minWidth: 30 }}>{ORDINALS[rank - 1]}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{CANDIDATES[ci]}</span>
                  </div>
                )
              })}
              <div style={{ fontSize: 11, color: "#166534", marginTop: 10, lineHeight: 1.5 }}>
                If this matches what you submitted, your ballot was counted correctly. If it doesn't match, contact the election organiser immediately.
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage({ ctx }) {
  const { phase, ballots, checkedIn, receipts = [], release = "winners", updatePhase, resetElection, adminUnlocked, setAdminUnlocked } = ctx
  const [pin, setPin] = useState("")
  const [pinErr, setPinErr] = useState(false)
  const [results, setResults] = useState(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [liveChecked, setLiveChecked] = useState([...checkedIn])
  const [liveBallots, setLiveBallots] = useState([...ballots])
  const [liveReceipts, setLiveReceipts] = useState([...receipts])
  const [liveRelease, setLiveRelease] = useState(release)
  const [livePhase, setLivePhase] = useState(phase)
  // Test mode: when ON, auto-backup downloads are disabled. Useful for
  // testing — you don't want 20 JSON files cluttering your Downloads folder
  // while you click through phases. The setting persists in localStorage so
  // you don't have to re-enable it every time you open the admin panel.
  // TURN THIS OFF BEFORE THE REAL ELECTION so you get your backup files.
  const [testMode, setTestMode] = useState(() => {
    try { return localStorage.getItem("mta25_testmode") === "1" } catch { return false }
  })
  const toggleTestMode = () => {
    setTestMode(prev => {
      const next = !prev
      try { localStorage.setItem("mta25_testmode", next ? "1" : "0") } catch {}
      return next
    })
  }

  useEffect(() => { setLiveChecked([...checkedIn]); setLiveBallots([...ballots]); setLiveReceipts([...receipts]); setLiveRelease(release); setLivePhase(phase) }, [checkedIn, ballots, receipts, release, phase])
  useEffect(() => {
    const interval = setInterval(async () => {
      const [p, b, c, r, rl] = await Promise.all([sGet(SK.phase), sGet(SK.ballots), sGet(SK.checked), sGet(SK.receipts), sGet(SK.release)])
      if (p) setLivePhase(p)
      if (b) setLiveBallots(b)
      if (c) setLiveChecked(c)
      if (r) setLiveReceipts(r)
      if (rl) setLiveRelease(rl)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const tryUnlock = () => {
    if (pin === ADMIN_CODE) { setAdminUnlocked(true); setPinErr(false) }
    else { setPinErr(true) }
  }

  // Auto-backup: silently downloads a timestamped JSON snapshot every time
  // the admin advances a phase (open/closed/revealed). This means the admin
  // ends up with at least 3 backup files on their computer without having to
  // remember to click anything. If Firebase ever loses data, these files are
  // the recovery path. Called inside each phase-change handler below.
  const autoBackup = (phaseTag) => {
    if (testMode) {
      console.info(`[test mode] auto-backup skipped for phase: ${phaseTag}`)
      return
    }
    try {
      const now = new Date()
      const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19) // 2026-04-16T23-45-12
      const payload = {
        backupType: "auto",
        phaseAtBackup: phaseTag,
        exportedAt: now.toISOString(),
        election: "MTA Co-President 2026",
        totalVoters: TOTAL,
        seats: SEATS,
        quota: QUOTA,
        candidates: CANDIDATES,
        ballotCount: liveBallots.length,
        ballots: liveBallots,
        receipts: liveReceipts,
        checkedInCount: liveChecked.length,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `mta-auto-backup-${phaseTag}-${stamp}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      // Auto-backup failures should never block a phase change — just log.
      console.warn("Auto-backup failed:", e)
    }
  }

  const openVoting = async () => {
    await updatePhase("open"); setLivePhase("open")
    autoBackup("opened") // snapshot at the moment voting opens (usually 0 ballots)
  }
  const closeVoting = async () => {
    await updatePhase("closed"); setLivePhase("closed")
    autoBackup("closed") // snapshot with ALL ballots right before results are tallied
  }
  const revealResults = async () => {
    await updatePhase("revealed"); setLivePhase("revealed")
    setResults(runSTV(liveBallots))
    autoBackup("revealed") // snapshot at reveal time — the authoritative record
  }
  const doReset = async () => { await resetElection(); setResults(null); setResetConfirm(false); setLivePhase("setup"); setLiveBallots([]); setLiveChecked([]); setLiveReceipts([]) }

  const voteCount = liveBallots.length
  const allVoted = voteCount === TOTAL

  if (!adminUnlocked) return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      <Card>
        <CardHead>
          <H1>🔐 Admin panel</H1>
          <Sub>Enter the admin code to manage the election.</Sub>
        </CardHead>
        <CardBody>
          {ADMIN_CODE === "NOT_CONFIGURED" && (
            <div style={{ padding: "12px 14px", background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 10, marginBottom: 14, fontSize: 12, color: "#991b1b", lineHeight: 1.6 }}>
              ⚠️ <strong>Admin code not set!</strong> No <code>VITE_ADMIN_CODE</code> environment variable found. Set one in your <code>.env.local</code> (local dev) or in Netlify's Site settings → Environment variables, then redeploy. Admin cannot unlock until this is configured.
            </div>
          )}
          <div style={{ padding: "14px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "#991b1b", lineHeight: 1.6 }}>
            <strong>Restricted area.</strong> Only the election organiser has this code. If you don't have it, close this page and go back to the Home tab.
          </div>
          <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Enter admin code</div>
          <PinInput value={pin} onChange={setPin} placeholder="Enter code..." onEnter={tryUnlock} />
          {pinErr && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>Incorrect code. Try again.</div>}
          <div style={{ marginTop: 12 }}>
            <Btn onClick={tryUnlock}>Unlock Admin Panel</Btn>
          </div>
        </CardBody>
      </Card>
    </div>
  )

  return (
    <div>
      {/* Phase control */}
      <Card>
        <CardHead>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <H1>Election control</H1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Chip color={livePhase === "open" ? "green" : livePhase === "revealed" ? "blue" : livePhase === "closed" ? "orange" : "gray"}>
                {livePhase === "setup" ? "Not started" : livePhase === "open" ? "Voting open" : livePhase === "closed" ? "Closed" : "Results out"}
              </Chip>
              <button onClick={() => { setAdminUnlocked(false); setPin("") }} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 11, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>🔒 Lock</button>
            </div>
          </div>
        </CardHead>
        <CardBody>
          {/* Timeline */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20, overflowX: "auto" }}>
            {[
              { key: "setup", label: "Setup" },
              { key: "open", label: "Voting" },
              { key: "closed", label: "Closed" },
              { key: "revealed", label: "Results" },
            ].map((s, i, arr) => {
              const phases = ["setup", "open", "closed", "revealed"]
              const active = phases.indexOf(livePhase) >= phases.indexOf(s.key)
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : 0 }}>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: active ? "#ea580c" : "#e5e7eb", color: active ? "white" : "#9ca3af", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>{i + 1}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: active ? "#ea580c" : "#9ca3af" }}>{s.label}</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: active && phases.indexOf(livePhase) > phases.indexOf(s.key) ? "#ea580c" : "#e5e7eb", margin: "0 4px 16px" }} />}
                </div>
              )
            })}
          </div>

          {livePhase === "setup" && (
            <>
              <div style={{ padding: "14px 16px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
                <strong>Ready to start?</strong> Click below to open voting for all members. Share the app link so people can vote from their phones.
              </div>
              <Btn onClick={openVoting} color="orange">Open Voting Now 🗳️</Btn>
            </>
          )}
          {livePhase === "open" && (
            <>
              <div style={{ height: 6, background: "#f3f4f6", borderRadius: 100, marginBottom: 10, overflow: "hidden" }}>
                <div style={{ height: 6, background: allVoted ? "#16a34a" : "#ea580c", width: `${voteCount / TOTAL * 100}%`, borderRadius: 100, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
                {allVoted ? "All votes in — ready to close and reveal!" : `${voteCount} of ${TOTAL} votes received. Waiting for ${TOTAL - voteCount} more.`}
              </div>
              <Btn onClick={closeVoting} color="orange" disabled={!allVoted}>
                {allVoted ? "Close Voting & Prepare Results" : `Waiting for ${TOTAL - voteCount} more voter${TOTAL - voteCount === 1 ? "" : "s"}...`}
              </Btn>
            </>
          )}
          {livePhase === "closed" && (
            <>
              <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 14, fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
                <strong>All {voteCount} votes received.</strong> When everyone is ready, click below to run the STV count and reveal the winners.
              </div>
              <Btn onClick={revealResults} color="green">Reveal Results & Run Tally 🏆</Btn>
            </>
          )}
          {livePhase === "revealed" && (
            <div style={{ padding: "12px 16px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, fontSize: 13, color: "#1d4ed8", marginBottom: 14 }}>
              Results have been revealed. Scroll down to see the full count.
            </div>
          )}

          {/* Test mode + auto-backup toggle */}
          <div style={{ marginTop: 8, padding: "12px 14px", background: testMode ? "#eff6ff" : "#fafaf9", border: `1px solid ${testMode ? "#93c5fd" : "#d1d5db"}`, borderRadius: 9 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: testMode ? 6 : 0 }}>
              <input type="checkbox" checked={testMode} onChange={toggleTestMode} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: testMode ? "#1d4ed8" : "#1f2937" }}>
                  🧪 Test mode {testMode ? "ON" : "OFF"}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, marginTop: 2 }}>
                  {testMode
                    ? "Auto-backup files WILL NOT download on phase changes. Use this while testing."
                    : "Auto-backup JSON files will download automatically when you open, close, or reveal voting."}
                </div>
              </div>
            </label>
            {testMode && (
              <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600, marginTop: 6, paddingTop: 6, borderTop: "1px dashed #93c5fd" }}>
                ⚠️ Remember to turn this OFF before the real election so you get your backup files.
              </div>
            )}
            {testMode && livePhase !== "setup" && (
              <button onClick={doReset} style={{
                marginTop: 10, width: "100%", padding: "9px 14px", borderRadius: 8,
                border: "1px solid #93c5fd", background: "white", color: "#1d4ed8",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                ↺ Reset to setup (test mode only)
              </button>
            )}
          </div>

          {/* Release level — only when closed or revealed */}
          {(livePhase === "closed" || livePhase === "revealed") && (
            <div style={{ marginTop: 8, padding: "14px 16px", background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7e22ce", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>What voters see on the public Results page</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { v: "winners", label: "Winners only", d: "Just the names of the two elected Co-Presidents. No vote counts, no rounds." },
                  { v: "summary", label: "Summary", d: "Winners + round-by-round bar chart. No individual ballots." },
                  { v: "full", label: "Full transparency", d: "Winners, rounds, plain-English explanation, and the full anonymous ballot audit." },
                ].map(opt => (
                  <button key={opt.v} onClick={async () => { await sSet(SK.release, opt.v); setLiveRelease(opt.v) }} style={{
                    padding: "10px 12px", borderRadius: 8, textAlign: "left",
                    border: `1.5px solid ${liveRelease === opt.v ? "#7e22ce" : "#e5e7eb"}`,
                    background: liveRelease === opt.v ? "#f3e8ff" : "white",
                    cursor: "pointer",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: liveRelease === opt.v ? "#7e22ce" : "#1f2937" }}>
                      {liveRelease === opt.v && "● "}{opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{opt.d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Live voter status */}
      <Card>
        <CardHead>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <H2>Voter check-in status</H2>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>auto-refreshing</span>
          </div>
          <Sub>You can see who has voted — you cannot see what they voted.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 6 }}>
            {VOTERS.map(name => {
              const voted = liveChecked.includes(name)
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, background: voted ? "#f0fdf4" : "#fafaf9", border: `1px solid ${voted ? "#86efac" : "#e5e7eb"}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: voted ? "#16a34a" : "#d1d5db", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: voted ? "#15803d" : "#6b7280", fontWeight: voted ? 700 : 400 }}>{name}</span>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* Results */}
      {livePhase === "revealed" && (results ? <STVResults results={results} ballots={liveBallots} /> : (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Btn onClick={() => setResults(runSTV(liveBallots))}>Load results</Btn>
        </div>
      ))}

      {/* Backup & export */}
      {liveBallots.length > 0 && (
        <Card>
          <CardHead>
            <H2>Backup & export</H2>
            <Sub>Download all anonymous ballots as a safety net. Contains NO voter names.</Sub>
          </CardHead>
          <CardBody>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 14 }}>
              This creates a downloadable file with every ballot, the candidate list, the Droop quota, and receipt codes. Pick the format you want. All three formats contain the same data — pick whichever opens in the tool you prefer.
            </div>

            {(() => {
              const today = new Date().toISOString().slice(0, 10)
              const base = `mta-election-ballots-${today}`

              const downloadBlob = (content, mime, ext) => {
                const blob = new Blob([content], { type: mime })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `${base}.${ext}`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }

              const exportJSON = () => {
                const payload = {
                  exportedAt: new Date().toISOString(),
                  election: "MTA Co-President 2026",
                  totalVoters: TOTAL,
                  seats: SEATS,
                  quota: QUOTA,
                  candidates: CANDIDATES,
                  ballotCount: liveBallots.length,
                  ballots: liveBallots,
                  receipts: liveReceipts,
                }
                downloadBlob(JSON.stringify(payload, null, 2), "application/json", "json")
              }

              const exportCSV = () => {
                // Columns: Ballot#, Receipt, then one column per candidate's rank
                const header = ["Ballot", "Receipt", ...CANDIDATES.map(c => `"${c.replace(/"/g, '""')}"`)].join(",")
                const rows = liveBallots.map((ballot, i) => {
                  const receipt = liveReceipts[i] || ""
                  const ranks = ballot.map(r => r === null || r === undefined ? "" : r).join(",")
                  return `${i + 1},${receipt},${ranks}`
                })
                const meta = [
                  `# MTA Co-President Election 2026`,
                  `# Exported: ${new Date().toISOString()}`,
                  `# Ballots: ${liveBallots.length} of ${TOTAL}`,
                  `# Quota: ${QUOTA} · Seats: ${SEATS}`,
                  `# Rank 1 = first choice, blank = not ranked`,
                ].join("\n")
                downloadBlob(`${meta}\n${header}\n${rows.join("\n")}`, "text/csv", "csv")
              }

              const exportTXT = () => {
                // Human-readable audit report — printable, signable
                const lines = [
                  "=" .repeat(64),
                  "   MTA CO-PRESIDENT ELECTION 2026 — BALLOT AUDIT REPORT",
                  "   Mana Telugu Association · Purdue University",
                  "=" .repeat(64),
                  "",
                  `Exported:       ${new Date().toString()}`,
                  `Total voters:   ${TOTAL}`,
                  `Seats:          ${SEATS}`,
                  `Droop quota:    ${QUOTA}  (= floor(${TOTAL} / ${SEATS + 1}) + 1)`,
                  `Ballots cast:   ${liveBallots.length}`,
                  `Candidates:`,
                  ...CANDIDATES.map((c, i) => `  [${i}] ${c}`),
                  "",
                  "-" .repeat(64),
                  "INDIVIDUAL BALLOTS (anonymized — no voter names)",
                  "-" .repeat(64),
                  "",
                  ...liveBallots.map((ballot, i) => {
                    const receipt = liveReceipts[i] || "n/a"
                    const ranked = ballot
                      .map((r, ci) => ({ r, ci }))
                      .filter(x => x.r !== null && x.r !== undefined)
                      .sort((a, b) => a.r - b.r)
                      .map(x => `${x.r}: ${CANDIDATES[x.ci]}`)
                      .join(" | ")
                    return `Ballot #${String(i + 1).padStart(3, "0")}  [${receipt}]  ${ranked}`
                  }),
                  "",
                  "-" .repeat(64),
                  "VERIFIER CHECKLIST",
                  "-" .repeat(64),
                  "",
                  `[ ] Total ballots count = ${liveBallots.length}`,
                  `[ ] Every ballot has at least 2 rankings`,
                  `[ ] No ballot assigns the same rank to two candidates`,
                  `[ ] Round 1 first-choice totals sum to ${liveBallots.length}`,
                  `[ ] Surplus above ${QUOTA} redistributes proportionally`,
                  `[ ] Elimination = lowest vote-getter each round`,
                  `[ ] Exactly ${SEATS} candidates elected`,
                  "",
                  "Verified by: _________________________   Date: ____________",
                  "",
                  "=" .repeat(64),
                  "END OF REPORT",
                  "=" .repeat(64),
                ]
                downloadBlob(lines.join("\n"), "text/plain", "txt")
              }

              return (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={exportJSON} style={{ padding: "10px 16px", border: "none", borderRadius: 9, background: "#1d4ed8", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ⬇ JSON (raw data)
                  </button>
                  <button onClick={exportCSV} style={{ padding: "10px 16px", border: "none", borderRadius: 9, background: "#15803d", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ⬇ CSV (Excel / Sheets)
                  </button>
                  <button onClick={exportTXT} style={{ padding: "10px 16px", border: "none", borderRadius: 9, background: "#6b21a8", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ⬇ TXT (printable audit)
                  </button>
                </div>
              )
            })()}
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
              {liveBallots.length} ballot{liveBallots.length === 1 ? "" : "s"} · {liveReceipts.length} receipt code{liveReceipts.length === 1 ? "" : "s"} · Names of voters are NOT included in any export.
            </div>
          </CardBody>
        </Card>
      )}

      {/* Reset */}
      <div style={{ marginTop: 8, marginBottom: 24, textAlign: "center" }}>
        {!resetConfirm ? (
          <button onClick={() => setResetConfirm(true)} style={{ padding: "9px 20px", border: "1px solid #fca5a5", borderRadius: 9, background: "#fef2f2", color: "#b91c1c", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Reset entire election
          </button>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 700, marginBottom: 12 }}>⚠️ This deletes all votes permanently. Are you sure?</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setResetConfirm(false)} style={{ padding: "10px 20px", border: "1px solid #e5e7eb", borderRadius: 8, background: "white", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={doReset} style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#dc2626", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Yes, reset everything</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home")
  const [phase, setPhase] = useState(null)
  const [ballots, setBallots] = useState([])
  const [checkedIn, setCheckedIn] = useState([])
  const [receipts, setReceipts] = useState([])
  const [release, setRelease] = useState("winners")
  const [loading, setLoading] = useState(true)
  // Admin unlock persists across refreshes via sessionStorage — survives
  // reload, but auto-clears when the tab/browser closes. That way the admin
  // can hit refresh while testing without re-typing the code, but anyone
  // who opens the site fresh in a new browser still has to authenticate.
  const [adminUnlocked, setAdminUnlockedRaw] = useState(() => {
    try { return sessionStorage.getItem("mta25_admin_unlocked") === "1" } catch { return false }
  })
  const setAdminUnlocked = (value) => {
    setAdminUnlockedRaw(value)
    try {
      if (value) sessionStorage.setItem("mta25_admin_unlocked", "1")
      else sessionStorage.removeItem("mta25_admin_unlocked")
    } catch {}
  }
  // Dark mode — pref stored in localStorage if available, else in-memory
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("mta25_dark") === "1" } catch { return false }
  })
  const toggleDark = () => {
    setDark(d => {
      const next = !d
      try { localStorage.setItem("mta25_dark", next ? "1" : "0") } catch {}
      return next
    })
  }

  useEffect(() => {
    async function load() {
      const [p, b, c, r, rl] = await Promise.all([sGet(SK.phase), sGet(SK.ballots), sGet(SK.checked), sGet(SK.receipts), sGet(SK.release)])
      setPhase(p || "setup")
      setBallots(b || [])
      setCheckedIn(c || [])
      setReceipts(r || [])
      setRelease(rl || "winners")
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const iv = setInterval(async () => {
      const [p, b, c, r, rl] = await Promise.all([sGet(SK.phase), sGet(SK.ballots), sGet(SK.checked), sGet(SK.receipts), sGet(SK.release)])
      if (p) setPhase(p); if (b) setBallots(b); if (c) setCheckedIn(c); if (r) setReceipts(r); if (rl) setRelease(rl)
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const updatePhase = async (np) => { await sSet(SK.phase, np); setPhase(np) }

  // Atomic ballot cast — reads latest server state, checks double-vote, shuffles in,
  // stores receipt-code+ballot mapping (the mapping has NO voter name).
  const castBallot = async (ballot, voterName, receiptCode) => {
    try {
      const [latestB, latestC, latestR] = await Promise.all([sGet(SK.ballots), sGet(SK.checked), sGet(SK.receipts)])
      const curB = latestB || [], curC = latestC || [], curR = latestR || []
      if (curC.includes(voterName)) return false // already voted

      // SHUFFLE: insert the new ballot at a random position so submission order
      // doesn't reveal which voter cast which ballot.
      const insertAt = Math.floor(Math.random() * (curB.length + 1))
      const newBallots = [...curB.slice(0, insertAt), ballot, ...curB.slice(insertAt)]
      const newChecked = [...curC, voterName]
      // Receipt stored with ballot (NOT voter name). Same shuffle index.
      const newReceipts = [...curR.slice(0, insertAt), receiptCode, ...curR.slice(insertAt)]

      await Promise.all([
        sSet(SK.ballots, newBallots),
        sSet(SK.checked, newChecked),
        sSet(SK.receipts, newReceipts),
      ])
      setBallots(newBallots); setCheckedIn(newChecked); setReceipts(newReceipts)
      return true
    } catch (e) { console.error(e); return false }
  }

  const resetElection = async () => {
    await Promise.all([sSet(SK.phase, "setup"), sSet(SK.ballots, []), sSet(SK.checked, []), sSet(SK.receipts, []), sSet(SK.release, "winners")])
    setPhase("setup"); setBallots([]); setCheckedIn([]); setReceipts([]); setRelease("winners")
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff7ed" }}>
      <div style={{ textAlign: "center" }}>
        <MTALogo size={64} />
        <div style={{ marginTop: 16, color: "#ea580c", fontWeight: 600 }}>Loading MTA Election...</div>
      </div>
    </div>
  )

  const ctx = { phase, ballots, checkedIn, receipts, release, updatePhase, castBallot, resetElection, adminUnlocked, setAdminUnlocked }

  const tabs = [
    { id: "home", label: "Home" },
    { id: "how", label: "How it Works" },
    // Vote tab only when voting is open
    ...(phase === "open" ? [{ id: "vote", label: "Vote" }] : []),
    // Results tab once revealed
    ...(phase === "revealed" ? [{ id: "results", label: "Results 🏆" }] : []),
    // Trial stays visible at all times — some voters will want to understand
    // the system while voting is live, and the page is clearly labeled as
    // non-real ("🧪 Trial run mode"). Hiding it would be user-hostile.
    { id: "demo", label: "Trial Run" },
    { id: "admin", label: "Admin 🔐" },
  ]

  // If the active tab was just filtered out (e.g. voting just opened and
  // we were on Trial), fall back to Home.
  const validTabIds = tabs.map(t => t.id)
  const safeTab = validTabIds.includes(tab) ? tab : "home"

  const phaseColor = phase === "open" ? "#16a34a" : phase === "revealed" ? "#1d4ed8" : phase === "closed" ? "#d97706" : "#9ca3af"
  const phaseLabel = phase === "setup" ? "Not started" : phase === "open" ? "Voting open" : phase === "closed" ? "Voting closed" : "Results out"

  // Dark-mode CSS filter: inverts backgrounds/text but keeps the warm accent
  // colors readable. Images get double-inverted so they look correct.
  const darkStyle = dark ? {
    filter: "invert(0.92) hue-rotate(180deg)",
  } : {}
  const imgFixStyle = `
    .mta-dark img, .mta-dark svg, .mta-dark .mta-keep-color {
      filter: invert(0.92) hue-rotate(180deg);
    }
  `

  return (
    <div className={dark ? "mta-dark" : ""} style={{ minHeight: "100vh", background: dark ? "#1a1a1a" : "#f9fafb", ...darkStyle }}>
      <style>{imgFixStyle}</style>
      {/* Nav */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MTALogo size={38} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b", lineHeight: 1.2 }}>
                  <span style={{ color: "#ea580c" }}>MTA</span> Election 2026
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>Mana Telugu Association · Purdue</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={toggleDark} aria-label="Toggle dark mode" className="mta-keep-color" style={{ padding: "4px 10px", borderRadius: 100, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 14, lineHeight: 1 }} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
                {dark ? "☀️" : "🌙"}
              </button>
              <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: `${phaseColor}18`, color: phaseColor, border: `1px solid ${phaseColor}44` }}>
                {phaseLabel}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 3, paddingBottom: 10, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flexShrink: 0, padding: "7px 14px", borderRadius: 8, border: "none",
                fontSize: 12, fontWeight: 600,
                background: safeTab === t.id ? "#ea580c" : "transparent",
                color: safeTab === t.id ? "white" : "#6b7280",
                cursor: "pointer", transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 14px 48px" }}>
        {safeTab === "home" && <HomePage ctx={ctx} setTab={setTab} />}
        {safeTab === "how" && <HowPage />}
        {safeTab === "vote" && <VotePage ctx={ctx} />}
        {safeTab === "demo" && <DemoPage />}
        {safeTab === "results" && <ResultsPage ctx={ctx} />}
        {safeTab === "admin" && <AdminPage ctx={ctx} />}
      </div>
    </div>
  )
}
