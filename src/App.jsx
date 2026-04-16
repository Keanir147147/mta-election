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
const ADMIN_CODE = "MTA2025"
const ORDINALS = ["1st", "2nd", "3rd", "4th"]
const RANK_COLORS = ["#c2410c", "#1d4ed8", "#15803d", "#7e22ce"]
const RANK_LIGHT = ["#fff7ed", "#eff6ff", "#f0fdf4", "#faf5ff"]

// ─────────────────────────────────────────────────────────────────────────────
// STV ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function runSTV(ballots) {
  const rankLists = ballots.map(b =>
    b.map((r, i) => ({ r, i })).filter(x => x.r !== null).sort((a, b) => a.r - b.r).map(x => x.i)
  )
  let weights = ballots.map(() => 1.0)
  let eliminated = new Set()
  let elected = []
  let rounds = []
  const isActive = ci => !eliminated.has(ci) && !elected.find(e => e.ci === ci)
  const countVotes = () => {
    const c = Array(CANDIDATES.length).fill(0)
    rankLists.forEach((list, bi) => {
      for (const ci of list) { if (isActive(ci)) { c[ci] += weights[bi]; break } }
    })
    return c
  }
  const transferSurplus = (winCi, total) => {
    const tw = (total - QUOTA) / total
    if (tw <= 0) return
    rankLists.forEach((list, bi) => {
      for (const ci of list) { if (isActive(ci)) { if (ci === winCi) weights[bi] *= tw; break } }
    })
  }
  let rn = 1
  while (elected.length < SEATS && rn <= 20) {
    const counts = countVotes()
    const active = CANDIDATES.map((_, i) => i).filter(isActive)
    if (!active.length) break
    const snapshot = active.map(ci => ({ ci, name: CANDIDATES[ci], votes: +counts[ci].toFixed(3) }))
    let actions = [], found = false
    for (const ci of active) {
      if (counts[ci] >= QUOTA && elected.length < SEATS) {
        transferSurplus(ci, counts[ci]); elected.push({ ci, round: rn }); actions.push({ type: "elected", ci }); found = true
      }
    }
    if (!found) {
      const minV = Math.min(...active.map(ci => counts[ci]))
      const toElim = active.filter(ci => counts[ci] === minV).pop()
      eliminated.add(toElim); actions.push({ type: "eliminated", ci: toElim })
    }
    rounds.push({ rn, snapshot, actions }); rn++
    const rem = CANDIDATES.map((_, i) => i).filter(isActive)
    if (rem.length > 0 && rem.length <= SEATS - elected.length) {
      rem.forEach(ci => elected.push({ ci, round: rn }))
      const fc = countVotes()
      rounds.push({ rn, snapshot: rem.map(ci => ({ ci, name: CANDIDATES[ci], votes: +fc[ci].toFixed(3) })), actions: rem.map(ci => ({ type: "elected", ci })) })
      break
    }
  }
  return { rounds, elected }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const SK = { phase: "mta25_phase", ballots: "mta25_ballots", checked: "mta25_checked" }
async function sGet(k) {
  try { const r = await window.storage.get(k, true); return r ? JSON.parse(r.value) : null } catch { return null }
}
async function sSet(k, v) {
  try { await window.storage.set(k, JSON.stringify(v), true) } catch(e) { console.error(e) }
}

// ─────────────────────────────────────────────────────────────────────────────
// MTA LOGO SVG
// ─────────────────────────────────────────────────────────────────────────────
function MTALogo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="50" fill="#e07b39"/>
      <circle cx="50" cy="50" r="46" fill="#d4a017"/>
      <text x="50" y="38" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="22" fill="#2338a8" letterSpacing="1">Mana</text>
      <text x="50" y="52" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="13" fill="#2338a8" letterSpacing="2">TELUGU</text>
      <text x="50" y="64" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="11" fill="#2338a8" letterSpacing="1">association</text>
      <rect x="22" y="70" width="10" height="14" rx="2" fill="#5a8a3a"/>
      <rect x="18" y="74" width="6" height="10" rx="1" fill="#3d6b22"/>
      <ellipse cx="27" cy="70" rx="5" ry="3" fill="#b5651d"/>
      <rect x="68" y="68" width="15" height="10" rx="1" fill="#1a1a1a"/>
      <rect x="68" y="65" width="15" height="4" rx="1" fill="#333"/>
      <line x1="70" y1="65" x2="70" y2="69" stroke="white" strokeWidth="0.8"/>
      <line x1="74" y1="65" x2="74" y2="69" stroke="white" strokeWidth="0.8"/>
      <line x1="78" y1="65" x2="78" y2="69" stroke="white" strokeWidth="0.8"/>
    </svg>
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
  const phaseInfo = {
    setup: { emoji: "🔒", label: "Election Not Started", desc: "The admin needs to unlock voting using the admin code before anyone can cast a ballot.", color: "gray", btnLabel: "Go to Admin →", btnTab: "admin" },
    open: { emoji: "🗳️", label: "Voting is Open!", desc: "All eligible members can now cast their secret ballot. Select your name and rank your candidates.", color: "green", btnLabel: "Vote Now →", btnTab: "vote" },
    closed: { emoji: "⏳", label: "Voting Closed", desc: "All votes are in. The admin will reveal results shortly.", color: "orange", btnLabel: null },
    revealed: { emoji: "🏆", label: "Results Published!", desc: "The election is complete. View the full STV tally in the Admin panel.", color: "blue", btnLabel: "See Results →", btnTab: "admin" },
  }
  const info = phaseInfo[phase] || phaseInfo.setup
  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fef9c3 50%, #f0fdf4 100%)", border: "1px solid #fed7aa", borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
        <MTALogo size={80} />
        <div style={{ fontSize: 24, fontWeight: 800, color: "#1e1b4b", marginTop: 14, marginBottom: 4 }}>Mana Telugu Association</div>
        <div style={{ fontSize: 14, color: "#92400e", fontWeight: 600, letterSpacing: "0.08em" }}>PURDUE UNIVERSITY · CO-PRESIDENT ELECTION 2025</div>
        <div style={{ marginTop: 16 }}>
          <Chip color={info.color}>{info.emoji} {info.label}</Chip>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10, maxWidth: 360, margin: "10px auto 0" }}>{info.desc}</div>
        {info.btnLabel && (
          <button onClick={() => setTab(info.btnTab)} style={{ marginTop: 16, padding: "11px 28px", background: "#ea580c", color: "white", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {info.btnLabel}
          </button>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS PAGE
// ─────────────────────────────────────────────────────────────────────────────
function HowPage() {
  return (
    <div>
      <Card>
        <CardHead>
          <H1>How this election works</H1>
          <Sub>Ranked Choice Voting (RCV) · Single Transferable Vote (STV) · 2 winners from 4 candidates</Sub>
        </CardHead>
        <CardBody>
          {[
            { n: "1", icon: "✍️", t: "Rank your candidates", d: `Mark 1 for your top choice, 2 for second, and so on. You must rank at least 2 of the ${CANDIDATES.length} candidates. You may rank all 4.` },
            { n: "2", icon: "🎯", t: `Winning quota = ${QUOTA} votes`, d: `With ${TOTAL} voters electing ${SEATS} Co-Presidents: ⌊${TOTAL} ÷ (${SEATS}+1)⌋ + 1 = ${QUOTA}. Any candidate hitting ${QUOTA} votes wins a seat immediately.` },
            { n: "3", icon: "🔄", t: "Surplus votes transfer", d: `If a winner got more than ${QUOTA} votes, their extra votes don't vanish — they flow to those voters' next choices at a proportionally reduced weight.` },
            { n: "4", icon: "❌", t: "Weakest candidate is eliminated", d: "If nobody new hits the quota, the candidate with fewest votes is eliminated and their supporters' ballots transfer to each ballot's next valid pick." },
            { n: "5", icon: "🏆", t: "Repeat until 2 winners", d: "Steps 3–4 repeat until 2 Co-Presidents are elected. No second election needed — your one ballot does all the work." },
          ].map(s => (
            <div key={s.n} style={{ display: "flex", gap: 14, marginBottom: 14, padding: 14, background: "#fafaf9", borderRadius: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#ea580c", color: "white", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.icon} {s.t}</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{s.d}</div>
              </div>
            </div>
          ))}

          <div style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, fontSize: 13, color: "#166534", lineHeight: 1.6, marginBottom: 16 }}>
            <strong>Your privacy is protected.</strong> Your name only confirms you're on the voter list. It is never stored alongside your vote. Even the admin cannot see who you voted for.
          </div>

          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em" }}>Want to understand RCV better?</div>
          {[
            { title: "Ranked Choice Voting Explained", ch: "CGP Grey", tag: "3 min · best intro", url: "https://www.youtube.com/watch?v=oHRPMJmzBBw" },
            { title: "How Does Ranked Choice Voting Work?", ch: "Vox", tag: "4 min · visual", url: "https://www.youtube.com/watch?v=NH3PYuOHBwk" },
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
  const { phase, checkedIn, addBallot, addCheckedIn } = ctx
  const [step, setStep] = useState("select") // select | ballot | done
  const [sel, setSel] = useState([null, null, null, null])
  const [confirm, setConfirm] = useState(false)
  const [localChecked, setLocalChecked] = useState([...checkedIn])

  // Sync checkedIn
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
      <Chip color="green">{localChecked.length} of {TOTAL} votes recorded</Chip>
      <div style={{ marginTop: 20 }}>
        <button onClick={() => { setStep("select"); setSel([null,null,null,null]) }} style={{ padding: "10px 22px", border: "1px solid #e5e7eb", borderRadius: 9, background: "white", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>← Back to voter list</button>
      </div>
    </div>
  )

  if (step === "ballot") return (
    <div>
      <div style={{ padding: "14px 16px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, marginBottom: 14, fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
        🔒 <strong>Secret ballot active.</strong> Your name is not stored with this vote. Tap a number to rank. Tap again to deselect. Rank at least 2 candidates.
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 50px)", padding: "10px 18px", background: "#fafaf9", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Candidate</div>
          {ORDINALS.map((o, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: RANK_COLORS[i], textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{o}</div>
          ))}
        </div>

        {CANDIDATES.map((name, ci) => (
          <div key={ci} style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 50px)", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid #f9fafb", background: sel[ci] !== null ? RANK_LIGHT[sel[ci] - 1] : "white", transition: "background 0.15s" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1f2937" }}>{name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Co-President candidate</div>
            </div>
            {[1,2,3,4].map(r => {
              const active = sel[ci] === r
              return (
                <div key={r} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <button onClick={() => setSel(prev => {
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
        ))}
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
        <button onClick={() => { setStep("select"); setSel([null,null,null,null]) }} style={{ width: "100%", marginTop: 8, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "transparent", fontSize: 13, color: "#6b7280", cursor: "pointer" }}>
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
              {sel.map((r, ci) => r !== null ? (
                <div key={ci} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: RANK_COLORS[r-1], color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{r}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{ORDINALS[r-1]}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{CANDIDATES[ci]}</span>
                </div>
              ) : null).filter(Boolean)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: "12px", border: "1px solid #e5e7eb", borderRadius: 9, background: "white", cursor: "pointer", fontSize: 13 }}>← Edit</button>
              <button onClick={async () => {
                await addBallot([...sel])
                await addCheckedIn("_voter_")
                setLocalChecked(prev => [...prev, "_voter_"])
                setConfirm(false)
                setStep("done")
              }} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 9, background: "#16a34a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cast Ballot ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Select screen
  return (
    <div>
      <Card>
        <CardHead>
          <H1>Select your name</H1>
          <Sub>Tap your name to begin voting. Names marked ✓ have already voted and are locked.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 8 }}>
            {VOTERS.map((name, i) => {
              const voted = i < localChecked.length
              return (
                <button key={name} disabled={voted} onClick={() => setStep("ballot")}
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
            <strong>Privacy guarantee:</strong> Your name only verifies you're eligible. The moment your ballot is submitted, the connection to your name is permanently discarded. Nobody can see how anyone voted.
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
  const [results, setResults] = useState(null)
  const [ran, setRan] = useState(false)

  // Realistic dummy ballots for all 13 voters
  const DUMMY = [
    [1, 4, 2, 3], // Navdhir:     Veda 1st
    [2, 1, 3, 4], // Praharsha:   Venkata 1st
    [1, 4, 2, 3], // Veda:        herself 1st
    [2, 1, 4, 3], // Venkata:     himself 1st
    [2, 4, 1, 3], // Pranav K:    Sneha 1st
    [3, 4, 2, 1], // Juhitha:     Ananya 1st
    [1, 2, 3, 4], // Mohit:       Veda 1st
    [3, 4, 1, 2], // Sneha:       herself 1st
    [2, 4, 3, 1], // Pranav Konda:Ananya 1st
    [1, 4, 3, 2], // Prathami:    Veda 1st
    [3, 4, 2, 1], // Ananya:      herself 1st
    [4, 3, 1, 2], // Sahasra:     Sneha 1st
    [3, 1, 2, 4], // Keshav:      Venkata 1st
  ]

  const firstChoices = CANDIDATES.map((_, ci) => DUMMY.filter(b => b.indexOf(1) === ci).length)
  const maxFC = Math.max(...firstChoices)

  const run = () => { setResults(runSTV(DUMMY)); setRan(true) }

  return (
    <div>
      <div style={{ padding: "14px 16px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 12, marginBottom: 14, fontSize: 13, color: "#1d4ed8", lineHeight: 1.6 }}>
        🧪 <strong>Trial run mode.</strong> This uses realistic dummy ballots for all {TOTAL} voters. No real votes are affected. Use this to understand how the STV count works before election day.
      </div>

      <Card>
        <CardHead>
          <H1>Dummy ballots — all 13 voters</H1>
          <Sub>These are pre-set rankings used for the trial. Candidates voting for themselves is intentionally included.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {DUMMY.map((ballot, idx) => {
              const ranked = ballot.map((r, ci) => ({ r, ci })).filter(x => x.r !== null).sort((a, b) => a.r - b.r)
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fafaf9", borderRadius: 8, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", minWidth: 80 }}>{VOTERS[idx].split(" ")[0]}</span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {ranked.map(({ r, ci }) => (
                      <div key={r} style={{ display: "flex", alignItems: "center", gap: 4, background: RANK_LIGHT[r-1], border: `1px solid ${RANK_COLORS[r-1]}33`, borderRadius: 6, padding: "3px 9px" }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: RANK_COLORS[r-1], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", fontWeight: 800 }}>{r}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{CANDIDATES[ci].split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 16, padding: "14px 16px", background: "#fff7ed", borderRadius: 10, border: "1px solid #fed7aa" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>First-choice snapshot (before transfers)</div>
            {CANDIDATES.map((name, ci) => (
              <div key={ci} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 160, color: "#374151" }}>{name.split(" ")[0]}</span>
                <div style={{ flex: 1, height: 7, background: "#f3f4f6", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: 7, background: RANK_COLORS[ci], width: `${firstChoices[ci] / maxFC * 100}%`, borderRadius: 100 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", minWidth: 20 }}>{firstChoices[ci]}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 6 }}>Quota to win: {QUOTA} votes · {TOTAL} voters · {SEATS} seats</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Btn onClick={run}>{ran ? "Re-run STV tally →" : "Run STV tally now →"}</Btn>
          </div>
        </CardBody>
      </Card>

      {ran && results && <STVResults results={results} ballots={DUMMY} isDemo />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STV RESULTS COMPONENT (shared by Demo + Admin)
// ─────────────────────────────────────────────────────────────────────────────
function STVResults({ results, ballots, isDemo = false }) {
  const maxV = Math.max(...results.rounds.flatMap(r => r.snapshot.map(s => s.votes)), QUOTA, 1)
  return (
    <div>
      {/* Winner banner */}
      <div style={{ background: "linear-gradient(135deg, #f0fdf4, #fef9c3)", border: "2px solid #86efac", borderRadius: 14, padding: "24px 20px", textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b", marginBottom: 6 }}>
          {isDemo ? "Trial Result — MTA Co-Presidents" : "MTA Co-Presidents Elected!"}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {results.elected.map(e => (
            <div key={e.ci} style={{ background: "#15803d", color: "white", fontWeight: 800, fontSize: 15, padding: "10px 24px", borderRadius: 100 }}>
              {CANDIDATES[e.ci]}
            </div>
          ))}
        </div>
      </div>

      {/* Round by round */}
      <Card>
        <CardHead>
          <H2>STV count — round by round</H2>
          <Sub>Quota = {QUOTA} votes · vertical bar = quota threshold · numbers = vote totals</Sub>
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
                    {electedCis.map(ci => `✓ ${CANDIDATES[ci].split(" ")[0]} elected`).join(" · ")}
                    {elimCis.map(ci => ` ✗ ${CANDIDATES[ci].split(" ")[0]} eliminated`).join("")}
                  </span>
                </div>
                {round.snapshot.sort((a, b) => b.votes - a.votes).map(row => {
                  const isWin = electedCis.includes(row.ci)
                  const isOut = elimCis.includes(row.ci)
                  const pct = row.votes / maxV * 100
                  const qpct = QUOTA / maxV * 100
                  return (
                    <div key={row.ci} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid #f9fafb" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 55, color: isWin ? "#15803d" : isOut ? "#9ca3af" : "#1f2937" }}>
                        {row.name.split(" ")[0]}
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
                    const surplus = row ? +(row.votes - QUOTA).toFixed(3) : 0
                    return (
                      <span key={ci}><strong style={{ color: "#15803d" }}>{CANDIDATES[ci]}</strong> reached {row?.votes} votes (quota: {QUOTA}). {surplus > 0 ? `Surplus of ${surplus} votes transferred proportionally to next choices.` : "No surplus to transfer."} </span>
                    )
                  })}
                  {elimCis.map(ci => (
                    <span key={ci}>Nobody reached the quota. <strong style={{ color: "#dc2626" }}>{CANDIDATES[ci]}</strong> had the fewest votes and was eliminated. Their supporters' ballots moved to each ballot's next valid choice.</span>
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
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{CANDIDATES[ci].split(" ")[0]}</span>
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
              `Total ballots = ${ballots.length} (should be ${TOTAL})`,
              `Droop Quota: ⌊${TOTAL} ÷ ${SEATS + 1}⌋ + 1 = ${QUOTA} votes to win`,
              "Every ballot has at least 2 rankings",
              "No ballot assigns the same rank to two candidates",
              `Round 1 first-choice totals sum to ${ballots.length}`,
              `Surplus above ${QUOTA} redistributes proportionally`,
              "Elimination = lowest vote-getter each round",
              "Exactly 2 candidates elected",
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
// ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage({ ctx }) {
  const { phase, ballots, checkedIn, updatePhase, resetElection } = ctx
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState("")
  const [pinErr, setPinErr] = useState(false)
  const [results, setResults] = useState(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [liveChecked, setLiveChecked] = useState([...checkedIn])
  const [liveBallots, setLiveBallots] = useState([...ballots])
  const [livePhase, setLivePhase] = useState(phase)

  useEffect(() => { setLiveChecked([...checkedIn]); setLiveBallots([...ballots]); setLivePhase(phase) }, [checkedIn, ballots, phase])
  useEffect(() => {
    const interval = setInterval(async () => {
      const [p, b, c] = await Promise.all([sGet(SK.phase), sGet(SK.ballots), sGet(SK.checked)])
      if (p) setLivePhase(p)
      if (b) setLiveBallots(b)
      if (c) setLiveChecked(c)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const tryUnlock = () => {
    if (pin === ADMIN_CODE) { setUnlocked(true); setPinErr(false) }
    else { setPinErr(true) }
  }

  const openVoting = async () => { await updatePhase("open"); setLivePhase("open") }
  const closeVoting = async () => { await updatePhase("closed"); setLivePhase("closed") }
  const revealResults = async () => {
    await updatePhase("revealed"); setLivePhase("revealed")
    setResults(runSTV(liveBallots))
  }
  const doReset = async () => { await resetElection(); setResults(null); setResetConfirm(false); setLivePhase("setup"); setLiveBallots([]); setLiveChecked([]) }

  const voteCount = liveBallots.length
  const allVoted = voteCount === TOTAL

  if (!unlocked) return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      <Card>
        <CardHead>
          <H1>🔐 Admin panel</H1>
          <Sub>Enter the admin code to manage the election.</Sub>
        </CardHead>
        <CardBody>
          <div style={{ padding: "16px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Admin code for this election</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#1e1b4b", letterSpacing: "0.15em", fontFamily: "monospace" }}>{ADMIN_CODE}</div>
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>Share this only with the election organiser and club president.</div>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <H1>Election control</H1>
            <Chip color={livePhase === "open" ? "green" : livePhase === "revealed" ? "blue" : livePhase === "closed" ? "orange" : "gray"}>
              {livePhase === "setup" ? "Not started" : livePhase === "open" ? "Voting open" : livePhase === "closed" ? "Closed" : "Results out"}
            </Chip>
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
            <div style={{ ...{}, padding: "12px 16px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, fontSize: 13, color: "#1d4ed8" }}>
              Results have been revealed. Scroll down to see the full count.
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
            {VOTERS.map((name, i) => {
              const voted = i < liveChecked.length
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [p, b, c] = await Promise.all([sGet(SK.phase), sGet(SK.ballots), sGet(SK.checked)])
      setPhase(p || "setup")
      setBallots(b || [])
      setCheckedIn(c || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const iv = setInterval(async () => {
      const [p, b, c] = await Promise.all([sGet(SK.phase), sGet(SK.ballots), sGet(SK.checked)])
      if (p) setPhase(p); if (b) setBallots(b); if (c) setCheckedIn(c)
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const updatePhase = async (np) => { await sSet(SK.phase, np); setPhase(np) }
  const addBallot = async (b) => {
    const nb = [...ballots, b]; await sSet(SK.ballots, nb); setBallots(nb)
  }
  const addCheckedIn = async (n) => {
    const nc = [...checkedIn, n]; await sSet(SK.checked, nc); setCheckedIn(nc)
  }
  const resetElection = async () => {
    await Promise.all([sSet(SK.phase, "setup"), sSet(SK.ballots, []), sSet(SK.checked, [])])
    setPhase("setup"); setBallots([]); setCheckedIn([])
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff7ed" }}>
      <div style={{ textAlign: "center" }}>
        <MTALogo size={64} />
        <div style={{ marginTop: 16, color: "#ea580c", fontWeight: 600 }}>Loading MTA Election...</div>
      </div>
    </div>
  )

  const ctx = { phase, ballots, checkedIn, updatePhase, addBallot, addCheckedIn, resetElection }

  const tabs = [
    { id: "home", label: "Home" },
    { id: "how", label: "How it Works" },
    { id: "vote", label: "Vote" },
    { id: "demo", label: "Trial Run" },
    { id: "admin", label: "Admin 🔐" },
  ]

  const phaseColor = phase === "open" ? "#16a34a" : phase === "revealed" ? "#1d4ed8" : phase === "closed" ? "#d97706" : "#9ca3af"
  const phaseLabel = phase === "setup" ? "Not started" : phase === "open" ? "Voting open" : phase === "closed" ? "Voting closed" : "Results out"

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Nav */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MTALogo size={38} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b", lineHeight: 1.2 }}>
                  <span style={{ color: "#ea580c" }}>MTA</span> Election 2025
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>Mana Telugu Association · Purdue</div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: `${phaseColor}18`, color: phaseColor, border: `1px solid ${phaseColor}44` }}>
              {phaseLabel}
            </div>
          </div>
          <div style={{ display: "flex", gap: 3, paddingBottom: 10, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flexShrink: 0, padding: "7px 14px", borderRadius: 8, border: "none",
                fontSize: 12, fontWeight: 600,
                background: tab === t.id ? "#ea580c" : "transparent",
                color: tab === t.id ? "white" : "#6b7280",
                cursor: "pointer", transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 14px 48px" }}>
        {tab === "home" && <HomePage ctx={ctx} setTab={setTab} />}
        {tab === "how" && <HowPage />}
        {tab === "vote" && <VotePage ctx={ctx} />}
        {tab === "demo" && <DemoPage />}
        {tab === "admin" && <AdminPage ctx={ctx} />}
      </div>
    </div>
  )
}
