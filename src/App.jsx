import { sGet, sSet } from "./firebase.js"
import { useState, useEffect, useRef } from "react"

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: ELECTION DATA — edit these to configure your election
// ═══════════════════════════════════════════════════════════════════════════════
const CANDIDATES = ["Veda Vennela Thangudu","Venkata Chelliboyina","Sneha Reddy Tamma","Ananya Reddy Depa"]
const VOTERS = ["Navdhir Polkampalli","Praharsha Manda","Veda Vennela Thangudu","Venkata Chelliboyina","Pranav Kalakota","Juhitha Reddy Kanduluru","Mohit Manna","Sneha Reddy Tamma","Pranav Konda","Prathami Panabakam","Ananya Reddy Depa","Sahasra Kandula","Keshav Anirudh Nagubandi"]
const TOTAL = VOTERS.length, SEATS = 2
const QUOTA = Math.floor(TOTAL / (SEATS + 1)) + 1
// ⬇️ CHANGE THIS to your own admin password. NOT shown anywhere in the app.
const ADMIN_CODE = "MTA2026"
const ORDINALS = ["1st","2nd","3rd","4th"]
const RC = ["#c2410c","#1d4ed8","#15803d","#7e22ce"]
const RL = ["#fff7ed","#eff6ff","#f0fdf4","#faf5ff"]

// Real MTA logo embedded as base64 (no external files needed)
const LOGO_LG = "data:image/jpeg;base64,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"
const LOGO_SM = "data:image/jpeg;base64,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"

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: RECEIPT CODE + ANIMATION CSS
// ═══════════════════════════════════════════════════════════════════════════════
function generateReceipt() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = ""
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}
// Fonts and animations loaded from index.html

const FF = "'DM Sans', system-ui, sans-serif"
const FH = "'Playfair Display', Georgia, serif"

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: STV ENGINE — with proper tie-breaking
// ═══════════════════════════════════════════════════════════════════════════════
function runSTV(ballots, numC = CANDIDATES.length, seats = SEATS) {
  const quota = Math.floor(ballots.length / (seats + 1)) + 1
  const raw = ballots.map(b => Array.isArray(b) ? b : b.ballot)
  const rl = raw.map(b => b.map((r,i)=>({r,i})).filter(x=>x.r!==null).sort((a,b)=>a.r-b.r).map(x=>x.i))
  let w = raw.map(()=>1.0), elim = new Set(), elected = [], rounds = [], hist = []
  const isA = ci => !elim.has(ci) && !elected.find(e=>e.ci===ci)
  const count = () => { const c = Array(numC).fill(0); rl.forEach((l,bi)=>{for(const ci of l){if(isA(ci)){c[ci]+=w[bi];break}}}); return c }
  const xfer = (ci,tot) => { const tw=(tot-quota)/tot; if(tw<=0)return; rl.forEach((l,bi)=>{for(const c of l){if(isA(c)){if(c===ci)w[bi]*=tw;break}}}) }
  const gn = ci => ci<CANDIDATES.length?CANDIDATES[ci]:`Candidate ${ci+1}`
  let rn = 1
  while(elected.length<seats&&rn<=20){
    const c=count(),act=Array.from({length:numC},(_,i)=>i).filter(isA);if(!act.length)break
    hist.push([...c])
    const snap=act.map(ci=>({ci,name:gn(ci),votes:+c[ci].toFixed(3)}))
    let actions=[],found=false
    // FIX: Sort candidates who crossed quota by MOST VOTES FIRST
    // so the person with the most support wins, not whoever has the lowest index
    const crossedQuota = act.filter(ci => c[ci] >= quota).sort((a,b) => c[b] - c[a])
    for(const ci of crossedQuota){if(elected.length<seats){xfer(ci,c[ci]);elected.push({ci,round:rn});actions.push({type:"elected",ci});found=true}}
    if(!found){const mv=Math.min(...act.map(ci=>c[ci])),tied=act.filter(ci=>c[ci]===mv);let te=tied[0]
      if(tied.length>1){for(let h=hist.length-2;h>=0;h--){const pc=hist[h],pm=Math.min(...tied.map(ci=>pc[ci])),st=tied.filter(ci=>pc[ci]===pm);if(st.length<tied.length){te=st[0];break}}
        if(tied.length>1){tied.sort((a,b)=>gn(a).localeCompare(gn(b)));te=tied[tied.length-1]}}
      elim.add(te);actions.push({type:"eliminated",ci:te})}
    rounds.push({rn,snapshot:snap,actions,quota});rn++
    const rem=Array.from({length:numC},(_,i)=>i).filter(isA)
    if(rem.length>0&&rem.length<=seats-elected.length){rem.forEach(ci=>elected.push({ci,round:rn}));const fc=count()
      rounds.push({rn,snapshot:rem.map(ci=>({ci,name:gn(ci),votes:+fc[ci].toFixed(3)})),actions:rem.map(ci=>({type:"elected",ci})),quota});break}
  }
  return {rounds,elected,quota}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: SHARED STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const SK={phase:"mta25_phase",ballots:"mta25_ballots",checked:"mta25_checked",config:"mta25_config"}
// Storage functions imported from firebase.js

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: REAL MTA LOGO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function MTALogo({size=48}){return <img src={size>60?LOGO_LG:LOGO_SM} alt="MTA" style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid #d4a017`,flexShrink:0}}/>}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: UI COMPONENTS — with DM Sans font
// ═══════════════════════════════════════════════════════════════════════════════
function Card({children,className=""}){return <div className={`mta-fade ${className}`} style={{background:"white",border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden",marginBottom:14,fontFamily:FF}}>{children}</div>}
function CardH({children}){return <div style={{padding:"16px 20px",borderBottom:"1px solid #f3f4f6",background:"#fafaf9"}}>{children}</div>}
function CardB({children}){return <div style={{padding:"18px 20px"}}>{children}</div>}
function H1({children}){return <div style={{fontSize:20,fontWeight:700,color:"#1e1b4b",marginBottom:4,fontFamily:FH}}>{children}</div>}
function H2({children}){return <div style={{fontSize:16,fontWeight:600,color:"#1f2937",marginBottom:4}}>{children}</div>}
function Sub({children}){return <div style={{fontSize:13,color:"#6b7280",lineHeight:1.6}}>{children}</div>}
function Chip({color,children}){const m={green:{bg:"#f0fdf4",c:"#15803d",b:"#86efac"},orange:{bg:"#fff7ed",c:"#c2410c",b:"#fdba74"},blue:{bg:"#eff6ff",c:"#1d4ed8",b:"#93c5fd"},red:{bg:"#fef2f2",c:"#b91c1c",b:"#fca5a5"},gray:{bg:"#f9fafb",c:"#6b7280",b:"#d1d5db"},purple:{bg:"#faf5ff",c:"#7e22ce",b:"#c084fc"}};const s=m[color]||m.gray;return <span style={{display:"inline-block",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:100,background:s.bg,color:s.c,border:`1px solid ${s.b}`}}>{children}</span>}
function Btn({onClick,disabled,color="orange",children,full=true,sm=false}){const bg={orange:"#ea580c",green:"#16a34a",red:"#dc2626",gray:"#9ca3af",blue:"#2563eb",purple:"#7e22ce"};return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:sm?"8px 18px":"13px 20px",borderRadius:10,border:"none",fontSize:sm?13:15,fontWeight:700,background:disabled?"#e5e7eb":bg[color],color:disabled?"#9ca3af":"white",cursor:disabled?"not-allowed":"pointer",transition:"all 0.2s",fontFamily:FF}}>{children}</button>}
function PinInput({value,onChange,placeholder="Enter code",onEnter}){return <input type="password" value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()} placeholder={placeholder} style={{width:"100%",padding:"12px 14px",borderRadius:9,border:"1.5px solid #d1d5db",fontSize:16,outline:"none",letterSpacing:"0.2em",fontFamily:"monospace",boxSizing:"border-box"}}/>}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function HomePage({ctx,setTab}){
  const {phase,ballots}=ctx
  const info={setup:{e:"🔒",l:"Election Not Started",d:"The admin needs to unlock voting first.",c:"gray",btn:"Go to Admin →",t:"admin"},open:{e:"🗳️",l:"Voting is Open!",d:"Cast your secret ballot now.",c:"green",btn:"Vote Now →",t:"vote"},closed:{e:"⏳",l:"Voting Closed",d:"All votes are in. Awaiting admin to release results.",c:"orange",btn:null},revealed:{e:"🏆",l:"Results Published!",d:"The election is complete.",c:"blue",btn:"See Results →",t:"admin"}}[phase]||{e:"🔒",l:"Loading...",d:"",c:"gray",btn:null}
  return(<div className="mta-slide">
    <div style={{background:"linear-gradient(135deg,#fff7ed 0%,#fef9c3 50%,#f0fdf4 100%)",border:"1px solid #fed7aa",borderRadius:16,padding:"28px 20px",textAlign:"center",marginBottom:16}}>
      <MTALogo size={90}/>
      <div style={{fontSize:26,fontWeight:800,color:"#1e1b4b",marginTop:14,marginBottom:4,fontFamily:FH}}>Mana Telugu Association</div>
      <div style={{fontSize:13,color:"#92400e",fontWeight:600,letterSpacing:"0.08em",fontFamily:FF}}>PURDUE UNIVERSITY · CO-PRESIDENT ELECTION 2026</div>
      <div style={{marginTop:16}}><Chip color={info.c}>{info.e} {info.l}</Chip></div>
      <div style={{fontSize:13,color:"#6b7280",marginTop:10,maxWidth:360,margin:"10px auto 0",fontFamily:FF}}>{info.d}</div>
      {info.btn&&<button onClick={()=>setTab(info.t)} style={{marginTop:16,padding:"11px 28px",background:"#ea580c",color:"white",border:"none",borderRadius:100,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:FF}}>{info.btn}</button>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
      {[{v:CANDIDATES.length,l:"Candidates",i:"👤"},{v:TOTAL,l:"Eligible voters",i:"🧑‍🤝‍🧑"},{v:QUOTA,l:"Votes to win",i:"🏆"}].map((s,idx)=>(
        <div key={s.l} className={`mta-fade mta-d${idx+1}`} style={{background:"white",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 10px",textAlign:"center",fontFamily:FF}}>
          <div style={{fontSize:20}}>{s.i}</div><div style={{fontSize:26,fontWeight:800,color:"#ea580c"}}>{s.v}</div>
          <div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.l}</div>
        </div>))}
    </div>
    {phase!=="setup"&&<Card><CardB>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><H2>Voting progress</H2><Chip color={ballots.length===TOTAL?"green":"orange"}>{ballots.length}/{TOTAL}</Chip></div>
      <div style={{height:8,background:"#f3f4f6",borderRadius:100,overflow:"hidden"}}><div style={{height:8,borderRadius:100,transition:"width 0.5s",background:ballots.length===TOTAL?"#16a34a":"#ea580c",width:`${ballots.length/TOTAL*100}%`}}/></div>
      <div style={{fontSize:12,color:"#9ca3af",marginTop:8}}>{ballots.length===TOTAL?"All votes received!":`${TOTAL-ballots.length} still to vote`}</div>
    </CardB></Card>}
    <Card><CardH><H2>Candidates for Co-President</H2></CardH><CardB>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>{CANDIDATES.map((name,i)=>(
        <div key={i} className={`mta-fade mta-d${i+1}`} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:RL[i],borderRadius:10,border:`1px solid ${RC[i]}22`}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:RC[i],color:"white",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{name.split(" ").map(w=>w[0]).slice(0,2).join("")}</div>
          <div><div style={{fontWeight:600,fontSize:14,color:"#1f2937"}}>{name}</div><div style={{fontSize:11,color:"#9ca3af"}}>Candidate for Co-President</div></div>
        </div>))}</div>
    </CardB></Card>
    <div style={{padding:"14px 16px",background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:12,fontSize:13,color:"#92400e",lineHeight:1.7,fontFamily:FF}}>
      <strong>Voting method:</strong> Ranked Choice Voting (STV). Rank candidates 1–{CANDIDATES.length}. Two who reach {QUOTA} votes win.
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: HOW IT WORKS — includes tie-breaking + receipt info
// ═══════════════════════════════════════════════════════════════════════════════
function HowPage(){
  const bx={borderRadius:12,padding:"16px 18px",marginBottom:14}
  const ar={textAlign:"center",fontSize:22,color:"#ea580c",margin:"2px 0 6px",fontWeight:800}
  const exBox={marginTop:10,background:"white",borderRadius:10,border:"1px solid #e5e7eb",padding:"12px 14px"}
  const bar=(name,votes,max,color,won)=>(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
    <span style={{fontSize:12,fontWeight:600,minWidth:65,color:"#374151"}}>{name}</span>
    <div style={{flex:1,height:22,background:"#f3f4f6",borderRadius:6,position:"relative",overflow:"hidden"}}>
      <div style={{height:"100%",background:color,borderRadius:6,width:`${votes/max*100}%`,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6}}>
        {votes>=2&&<span style={{fontSize:11,fontWeight:800,color:"white"}}>{votes}</span>}
      </div>
    </div>
    {votes<2&&<span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{votes}</span>}
    {won&&<span style={{fontSize:11,fontWeight:700,color:"#15803d",whiteSpace:"nowrap"}}>✓ WIN</span>}
  </div>)

  return(<div className="mta-slide" style={{fontFamily:FF}}>
    {/* WHAT YOU'RE USED TO */}
    <Card><CardH>
      <H1>How this election works</H1>
      <Sub>If you've only ever known "most votes wins" — this explains everything.</Sub>
    </CardH><CardB>

      <div style={{...bx,background:"#f9fafb",border:"1px solid #e5e7eb"}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>What you're used to</div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8,marginBottom:10}}>
          In a normal election, everyone picks <strong>one person</strong>. Whoever gets the most votes wins. Simple.
        </div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8}}>
          But we're electing <strong>2 Co-Presidents</strong>, not 1. And with "just pick one," some people's votes get completely wasted — their candidate loses and their voice disappears. That's not fair.
        </div>
      </div>

      <div style={{...bx,background:"linear-gradient(135deg,#fff7ed,#fef9c3)",border:"1px solid #fed7aa"}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>What we do instead — Ranked Choice</div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8}}>
          Instead of picking just one person, you <strong>rank all the candidates in order</strong>: "I like this person most, this person second, this person third..." and so on.
        </div>
        <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
          {CANDIDATES.map((n,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"white",border:`1px solid ${RC[i]}44`,borderRadius:8,padding:"6px 12px"}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:RC[i],color:"white",fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
            <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{n.split(" ")[0]}</span>
          </div>))}
        </div>
        <div style={{fontSize:12,color:"#92400e",marginTop:8}}>☝️ This is what your ballot looks like — you rank everyone 1st, 2nd, 3rd, 4th</div>
      </div>

      {/* WHY RANKING MATTERS */}
      <div style={{...bx,background:"#eff6ff",border:"1px solid #93c5fd"}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>Why does ranking matter?</div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8}}>
          Because your vote <strong>never gets wasted</strong>. If your #1 pick gets eliminated, your vote automatically moves to your #2 pick. It's like saying: "I want Veda, but if she can't win, give my vote to Sneha instead."
        </div>
        <div style={{fontSize:13,color:"#1d4ed8",marginTop:8,fontWeight:600}}>
          Think of it this way: you're giving your vote a backup plan, and a backup for the backup.
        </div>
      </div>

      {/* THE MAGIC NUMBER */}
      <div style={{...bx,background:"#f0fdf4",border:"1px solid #86efac"}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>The magic number: {QUOTA}</div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8}}>
          To win a seat, a candidate needs <strong>{QUOTA} votes out of {TOTAL}</strong>. Why {QUOTA}? Because it's mathematically impossible for 3 people to all get {QUOTA} votes (that would need {QUOTA*3} votes, but there are only {TOTAL}). So at most <strong>2 people can reach {QUOTA}</strong> — which is exactly how many Co-Presidents we're electing.
        </div>
        <div style={{fontSize:13,color:"#166534",marginTop:8,fontWeight:600}}>
          It guarantees exactly 2 winners. No more, no less.
        </div>
      </div>

      {/* STEP BY STEP EXAMPLE */}
      <div style={{fontSize:15,fontWeight:800,color:"#1e1b4b",marginBottom:12,marginTop:8,fontFamily:FH}}>
        Let's walk through an example
      </div>

      {/* STEP 1 */}
      <div style={{...bx,background:"white",border:"2px solid #ea580c"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"#ea580c",color:"white",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>1</div>
          <div style={{fontWeight:700,fontSize:15,color:"#1f2937"}}>Count everyone's #1 pick</div>
        </div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7,marginBottom:8}}>
          All {TOTAL} voters submit their ranked ballots. We look at ONLY the #1 picks first:
        </div>
        <div style={exBox}>
          {bar("Veda",6,7,RC[0],true)}
          {bar("Ananya",4,7,RC[3],false)}
          {bar("Sneha",2,7,RC[2],false)}
          {bar("Venkata",1,7,RC[1],false)}
          <div style={{marginTop:8,fontSize:12,color:"#ea580c",fontWeight:600,borderTop:"1px dashed #e5e7eb",paddingTop:8}}>
            The dashed line at {QUOTA} votes = the magic number to win
          </div>
        </div>
        <div style={{marginTop:10,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,fontSize:13,color:"#166534",lineHeight:1.6}}>
          <strong>Veda has 6!</strong> That's more than {QUOTA}, so she <strong>wins the first seat</strong> immediately.
        </div>
      </div>

      {/* STEP 2 */}
      <div style={ar}>⬇️</div>
      <div style={{...bx,background:"white",border:"2px solid #7e22ce"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"#7e22ce",color:"white",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>2</div>
          <div style={{fontWeight:700,fontSize:15,color:"#1f2937"}}>Winner's extra votes help others</div>
        </div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7}}>
          Veda needed {QUOTA} votes but got 6. That means <strong>1 vote is extra</strong>. Where does it go? It doesn't disappear — it flows to what Veda's voters picked as their <strong>#2 choice</strong>.
        </div>
        <div style={exBox}>
          <div style={{fontSize:13,color:"#6b7280",lineHeight:1.8}}>
            🗳️ Veda had 6 voters. She only needed 5.<br/>
            💧 1 extra vote gets shared among their #2 picks:<br/>
            <div style={{paddingLeft:20,marginTop:4}}>
              → 3 voters had Sneha as #2 → Sneha gets <strong>+0.5</strong><br/>
              → 3 voters had Ananya as #2 → Ananya gets <strong>+0.5</strong>
            </div>
          </div>
        </div>
        <div style={{marginTop:10,padding:"10px 14px",background:"#faf5ff",border:"1px solid #c084fc",borderRadius:8,fontSize:13,color:"#7e22ce",lineHeight:1.6}}>
          <strong>Why not just +1?</strong> Because the extra vote gets split fairly among all of Veda's voters' second choices. Each voter's leftover influence is small but adds up.
        </div>
      </div>

      {/* STEP 3 */}
      <div style={ar}>⬇️</div>
      <div style={{...bx,background:"white",border:"2px solid #dc2626"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"#dc2626",color:"white",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>3</div>
          <div style={{fontWeight:700,fontSize:15,color:"#1f2937"}}>Weakest person is eliminated</div>
        </div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7,marginBottom:8}}>
          After the transfer, nobody else hit {QUOTA} yet. So the person with the <strong>fewest votes gets eliminated</strong>, and their voters' ballots move to their next choice.
        </div>
        <div style={exBox}>
          {bar("Ananya",4.5,6,RC[3],false)}
          {bar("Sneha",2.5,6,RC[2],false)}
          {bar("Venkata",1,6,RC[1],false)}
          <div style={{marginTop:6,fontSize:12,color:"#dc2626",fontWeight:600}}>❌ Venkata has fewest (1) → eliminated</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>Venkata's voter ranked Ananya #2 → Ananya gets +1</div>
        </div>
      </div>

      {/* STEP 4 */}
      <div style={ar}>⬇️</div>
      <div style={{...bx,background:"linear-gradient(135deg,#f0fdf4,#fef9c3)",border:"2px solid #86efac"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"#15803d",color:"white",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>4</div>
          <div style={{fontWeight:700,fontSize:15,color:"#1f2937"}}>Second winner found!</div>
        </div>
        <div style={exBox}>
          {bar("Ananya",5.5,6,"#16a34a",true)}
          {bar("Sneha",2.5,6,RC[2],false)}
          <div style={{marginTop:6,fontSize:12,color:"#15803d",fontWeight:600}}>✓ Ananya hits {QUOTA}+ → wins the second seat!</div>
        </div>
        <div style={{marginTop:10,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:6}}>🏆🏆</div>
          <div style={{fontSize:16,fontWeight:800,color:"#1e1b4b",fontFamily:FH}}>Winners: Veda & Ananya</div>
          <div style={{fontSize:13,color:"#6b7280",marginTop:4}}>All from one ballot. No second election needed.</div>
        </div>
      </div>

      {/* KEY TAKEAWAYS */}
      <div style={{...bx,background:"#fffbeb",border:"1px solid #fcd34d"}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1e1b4b",marginBottom:10,fontFamily:FH}}>Key things to remember</div>
        <div style={{fontSize:13,color:"#92400e",lineHeight:2}}>
          ✅ You rank candidates 1st, 2nd, 3rd, 4th — not just pick one<br/>
          ✅ A candidate needs <strong>{QUOTA} votes</strong> to win (not just "the most")<br/>
          ✅ If your top pick loses, your vote moves to your next pick — <strong>never wasted</strong><br/>
          ✅ If someone wins with extra votes, those extras help other candidates<br/>
          ✅ The person with the fewest votes gets eliminated each round<br/>
          ✅ This continues until 2 Co-Presidents are elected
        </div>
      </div>

      {/* WHAT IF THERE'S A TIE */}
      <div style={{...bx,background:"#f9fafb",border:"1px solid #e5e7eb"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1f2937",marginBottom:6}}>⚖️ What if two people are tied for last?</div>
        <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7}}>
          The system looks back at earlier rounds — whoever had fewer votes first gets eliminated. If they were tied all the way back to Round 1, the one whose name comes last alphabetically is eliminated. The same ballots always produce the same result — no coin flips.
        </div>
      </div>

      {/* RECEIPT */}
      <div style={{padding:"12px 16px",background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:10,fontSize:13,color:"#1d4ed8",lineHeight:1.6,marginBottom:12}}>
        <strong>🧾 Ballot receipt:</strong> After voting, you get a 6-character code (like "K7X2M9"). Write it down or screenshot it! After results come out, you can type it in to confirm your vote was counted. Nobody else can see your code.
      </div>
      <div style={{padding:"12px 16px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,fontSize:13,color:"#166534",lineHeight:1.6,marginBottom:16}}>
        <strong>🔒 Your vote is secret.</strong> When you tap your name, it only checks you off the list. Your actual rankings are stored separately with no connection to your name. Not even the admin can see who voted for whom.
      </div>

      {/* VIDEOS */}
      <div style={{marginBottom:8,fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em"}}>Still not sure? These short videos explain it perfectly</div>
      {[{t:"Ranked Choice Voting Explained",c:"CGP Grey",g:"3 min · best intro",u:"https://www.youtube.com/watch?v=oHRPMJmzBBw"},{t:"How Does RCV Work?",c:"Vox",g:"4 min · visual",u:"https://www.youtube.com/watch?v=NH3PYuOHBwk"},{t:"The Single Transferable Vote",c:"CGP Grey",g:"5 min · multi-winner",u:"https://www.youtube.com/watch?v=l8XOZJkozfI"}].map(v=>(
        <a key={v.u} href={v.u} target="_blank" rel="noopener" style={{display:"flex",gap:12,alignItems:"center",padding:"12px 14px",background:"#fafaf9",borderRadius:10,border:"1px solid #e5e7eb",textDecoration:"none",color:"inherit",marginBottom:8}}>
          <div style={{width:36,height:36,borderRadius:8,background:"#dc2626",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"white",flexShrink:0}}>▶</div>
          <div><div style={{fontSize:13,fontWeight:600,color:"#1f2937"}}>{v.t}</div><div style={{fontSize:11,color:"#9ca3af"}}>{v.c} · <span style={{color:"#ea580c",fontWeight:600}}>{v.g}</span></div></div>
        </a>))}
    </CardB></Card>
  </div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: VOTE PAGE — with receipt codes, ballot shuffling, mobile-friendly
// The ballot grid now uses a responsive layout that stacks on small screens.
// ═══════════════════════════════════════════════════════════════════════════════
function VotePage({ctx}){
  const {phase,checkedIn,addBallot,addCheckedIn,config}=ctx
  const [step,setStep]=useState("select"),[sel,setSel]=useState(Array(CANDIDATES.length).fill(null))
  const [confirm,setConfirm]=useState(false),[localChecked,setLocalChecked]=useState([...checkedIn])
  const [receiptCode,setReceiptCode]=useState(null)
  const [selectedVoter,setSelectedVoter]=useState(null) // tracks WHO tapped their name
  // Randomize candidate order per voter — prevents ballot position bias
  const [candidateOrder,setCandidateOrder]=useState(()=>{
    const order=Array.from({length:CANDIDATES.length},(_,i)=>i)
    for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
    return order
  })
  const minRank=config.minRank||2
  useEffect(()=>{setLocalChecked([...checkedIn])},[checkedIn])

  if(phase==="setup") return <div className="mta-slide" style={{textAlign:"center",padding:"48px 20px",fontFamily:FF}}><div style={{fontSize:48,marginBottom:16}}>🔒</div><div style={{fontSize:18,fontWeight:700,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>Voting hasn't started yet</div><Sub>The admin needs to unlock voting first.</Sub></div>
  if(phase==="closed"||phase==="revealed") return <div className="mta-slide" style={{textAlign:"center",padding:"48px 20px",fontFamily:FF}}><div style={{fontSize:48,marginBottom:16}}>✅</div><div style={{fontSize:18,fontWeight:700,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>Voting is closed</div><Sub>All votes collected. Awaiting results.</Sub></div>

  if(step==="done") return(<div className="mta-slide" style={{textAlign:"center",padding:"48px 20px",fontFamily:FF}}>
    <div style={{width:72,height:72,borderRadius:"50%",background:"#f0fdf4",border:"2px solid #86efac",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:30}}>✓</div>
    <div style={{fontSize:20,fontWeight:800,color:"#15803d",marginBottom:8,fontFamily:FH}}>Ballot cast!</div>
    <div style={{fontSize:13,color:"#6b7280",maxWidth:320,margin:"0 auto 16px"}}>Your vote is recorded anonymously.</div>
    {receiptCode&&<div className="mta-fade" style={{background:"#eff6ff",border:"2px solid #93c5fd",borderRadius:12,padding:"16px 20px",maxWidth:320,margin:"0 auto 16px"}}>
      <div style={{fontSize:10,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Your ballot receipt code</div>
      <div style={{fontSize:32,fontWeight:900,color:"#1e1b4b",letterSpacing:"0.2em",fontFamily:"monospace"}}>{receiptCode}</div>
      <div style={{fontSize:12,color:"#6b7280",marginTop:8,lineHeight:1.5}}>Write this down! Use it to verify your ballot after results.</div>
    </div>}
    <Chip color="green">{localChecked.length} of {TOTAL} recorded</Chip>
    <div style={{marginTop:20}}><button onClick={()=>{
      setStep("select");setSel(Array(CANDIDATES.length).fill(null));setReceiptCode(null);setSelectedVoter(null)
      // Regenerate random candidate order for next voter
      const order=Array.from({length:CANDIDATES.length},(_,i)=>i)
      for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
      setCandidateOrder(order)
    }} style={{padding:"10px 22px",border:"1px solid #e5e7eb",borderRadius:9,background:"white",cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:FF}}>← Back to voter list</button></div>
  </div>)

  if(step==="ballot"){const rc=sel.filter(Boolean).length,ready=rc>=minRank
    return(<div className="mta-slide" style={{fontFamily:FF}}>
      <div style={{padding:"14px 16px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:12,marginBottom:14,fontSize:13,color:"#92400e",lineHeight:1.6}}>
        🔒 <strong>Secret ballot.</strong> {minRank>=CANDIDATES.length?`Rank all ${CANDIDATES.length}.`:`Rank at least ${minRank}.`} Tap a number to rank, tap again to deselect.
      </div>
      <Card>
        {/* Mobile-friendly: each candidate is a card with inline rank buttons
            IMPORTANT: Rendered in randomized order to prevent ballot position bias,
            but sel[] is still indexed by the REAL candidate position for counting */}
        {candidateOrder.map((ci,displayIdx)=>{const name=CANDIDATES[ci];return(<div key={ci} className={`mta-fade mta-d${displayIdx+1}`} style={{padding:"14px 18px",borderBottom:"1px solid #f3f4f6",background:sel[ci]!==null?RL[sel[ci]-1]:"white",transition:"background 0.15s"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#1f2937",marginBottom:2}}>{name}</div>
          <div style={{fontSize:11,color:"#9ca3af",marginBottom:10}}>Co-President candidate</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[1,2,3,4].map(r=>{const active=sel[ci]===r;return(
              <button key={r} onClick={()=>setSel(prev=>{const n=[...prev];if(n[ci]===r){n[ci]=null;return n}const c=n.indexOf(r);if(c!==-1)n[c]=null;n[ci]=r;return n})} style={{
                width:44,height:44,borderRadius:"50%",border:active?"none":"2px solid #e5e7eb",background:active?RC[r-1]:"transparent",color:active?"white":"#d1d5db",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",transform:active?"scale(1.1)":"scale(1)",transition:"all 0.15s",cursor:"pointer"
              }}>{r}</button>)})}
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}>{ORDINALS.map((o,i)=><span key={i} style={{fontSize:10,color:RC[i],fontWeight:600}}>{i===0?"①":""}  </span>)}</div>
          </div>
        </div>)})}
      </Card>
      <div style={{background:"white",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 18px"}}>
        <div style={{height:5,background:"#f3f4f6",borderRadius:100,marginBottom:10,overflow:"hidden"}}><div style={{height:5,borderRadius:100,transition:"width 0.3s",background:ready?"#16a34a":"#ea580c",width:`${rc/CANDIDATES.length*100}%`}}/></div>
        <div style={{fontSize:12,color:"#9ca3af",marginBottom:14}}>{rc===0?`Rank at least ${minRank}`:rc<minRank?`${minRank-rc} more needed`:`${rc} ranked — ready!`}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>{ORDINALS.map((o,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#6b7280"}}><div style={{width:10,height:10,borderRadius:"50%",background:RC[i]}}/>{o}</div>)}</div>
        <Btn disabled={!ready} onClick={()=>setConfirm(true)}>Review & Cast Ballot</Btn>
        <button onClick={()=>{setStep("select");setSel(Array(CANDIDATES.length).fill(null));setSelectedVoter(null)}} style={{width:"100%",marginTop:8,padding:"10px",border:"1px solid #e5e7eb",borderRadius:8,background:"transparent",fontSize:13,color:"#6b7280",cursor:"pointer",fontFamily:FF}}>← Cancel</button>
      </div>
      {confirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:20}}>
        <div className="mta-slide" style={{background:"white",borderRadius:16,padding:28,maxWidth:380,width:"100%",textAlign:"center",fontFamily:FF}}>
          <div style={{fontSize:40,marginBottom:14}}>🗳️</div>
          <div style={{fontSize:18,fontWeight:800,color:"#1e1b4b",marginBottom:6,fontFamily:FH}}>Confirm your ballot</div>
          <div style={{fontSize:13,color:"#6b7280",marginBottom:18}}>Once cast, it cannot be changed or traced to you.</div>
          <div style={{background:"#fafaf9",borderRadius:10,border:"1px solid #e5e7eb",marginBottom:20,overflow:"hidden"}}>
            {sel.map((r,ci)=>r!==null?<div key={ci} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:"50%",background:RC[r-1],color:"white",fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{r}</div><span style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>{ORDINALS[r-1]}</span></div>
              <span style={{fontSize:14,fontWeight:600,color:"#1f2937"}}>{CANDIDATES[ci]}</span>
            </div>:null)}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setConfirm(false)} style={{flex:1,padding:"12px",border:"1px solid #e5e7eb",borderRadius:9,background:"white",cursor:"pointer",fontSize:13,fontFamily:FF}}>← Edit</button>
            <button onClick={async()=>{const code=generateReceipt();setReceiptCode(code);await addBallot({ballot:[...sel],receipt:code});await addCheckedIn(selectedVoter);setLocalChecked(prev=>[...prev,selectedVoter]);setConfirm(false);setStep("done")}} style={{flex:1,padding:"12px",border:"none",borderRadius:9,background:"#16a34a",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>Cast Ballot ✓</button>
          </div>
        </div>
      </div>}
    </div>)}

  return(<div className="mta-slide" style={{fontFamily:FF}}><Card><CardH><H1>Select your name</H1><Sub>Tap to begin. ✓ = already voted.</Sub></CardH><CardB>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(168px,1fr))",gap:8}}>
      {VOTERS.map((name,i)=>{const voted=localChecked.includes(name);return(<button key={name} disabled={voted} onClick={()=>{setSelectedVoter(name);setStep("ballot")}} className={`mta-fade mta-d${Math.min(i%6+1,6)}`} style={{padding:"12px 14px",borderRadius:10,textAlign:"left",border:`1px solid ${voted?"#86efac":"#e5e7eb"}`,background:voted?"#f0fdf4":"white",color:voted?"#15803d":"#1f2937",fontSize:13,fontWeight:voted?600:500,cursor:voted?"not-allowed":"pointer",opacity:voted?0.75:1,transition:"all 0.15s",fontFamily:FF}}>
        {voted&&<span style={{display:"block",fontSize:11,color:"#16a34a",fontWeight:700,marginBottom:2}}>✓ Voted</span>}{name}
      </button>)})}
    </div>
    <div style={{marginTop:16,padding:"12px 14px",background:"#fffbeb",borderRadius:9,border:"1px solid #fcd34d",fontSize:12,color:"#92400e",lineHeight:1.6}}><strong>Privacy:</strong> Your name is permanently discarded when your ballot is submitted.</div>
  </CardB></Card><div style={{textAlign:"center",fontSize:12,color:"#9ca3af"}}>{localChecked.length} of {TOTAL} voted</div></div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: TRIAL PAGE — with random Indian names for simulated voters
// ═══════════════════════════════════════════════════════════════════════════════
const FIRST_NAMES = ["Aarav","Aditi","Aisha","Akash","Amara","Anil","Anita","Arjun","Arya","Bhavya","Chandra","Deepa","Dev","Diya","Farhan","Gauri","Hari","Isha","Jay","Kavya","Kiran","Lakshmi","Manoj","Meera","Nadia","Nikhil","Nisha","Omkar","Pooja","Priya","Rahul","Ravi","Riya","Rohan","Sahana","Sanjay","Sara","Shreya","Siddharth","Simran","Sunita","Tanvi","Uma","Varun","Vimal","Yash","Zara","Neha","Vikram","Arun","Pallavi","Kunal","Divya","Harsh","Jaya","Manish","Rekha","Suresh","Tara","Vijay"]
const LAST_NAMES = ["Acharya","Bhat","Chakraborty","Desai","Garg","Iyer","Joshi","Kapoor","Kumar","Malhotra","Menon","Nair","Patel","Pillai","Rao","Reddy","Shah","Sharma","Singh","Srinivasan","Thakur","Verma","Yadav","Banerjee","Chopra","Dutta","Ghosh","Gupta","Hegde","Jain","Kulkarni","Mehta","Mishra","Mukherjee","Pandey","Prasad","Rajan","Saxena","Sethi","Trivedi"]

function genRandomNames(n) {
  const names = new Set()
  while (names.size < n) {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    names.add(`${f} ${l}`)
  }
  return [...names]
}

function genRand(nv,nc,minRank=2){const b=[];for(let v=0;v<nv;v++){const bl=Array(nc).fill(null);const nr=minRank+Math.floor(Math.random()*(nc-minRank+1));const idx=Array.from({length:nc},(_,i)=>i);for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}for(let r=0;r<Math.min(nr,nc);r++)bl[idx[r]]=r+1;b.push(bl)}return b}

function DemoPage(){
  const [mode,setMode]=useState(null),[customN,setCustomN]=useState(50),[trials,setTrials]=useState([]),[expanded,setExpanded]=useState(null)
  const [trialMinRank,setTrialMinRank]=useState(4)
  const run=(nv)=>{
    const trialCandidates=genRandomNames(CANDIDATES.length)
    const b=genRand(nv,CANDIDATES.length,trialMinRank)
    const r=runSTV(b)
    const t={id:Date.now(),numVoters:nv,minRank:trialMinRank,ballots:b,results:r,candidateNames:trialCandidates}
    setTrials(p=>[t,...p]);setExpanded(t.id)
  }
  return(<div className="mta-slide" style={{fontFamily:FF}}>
    <div style={{padding:"14px 16px",background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:12,marginBottom:14,fontSize:13,color:"#1d4ed8",lineHeight:1.6}}>🧪 <strong>Trial mode.</strong> Random ballots, full STV count. No real votes affected.</div>
    <Card><CardH><H1>Choose trial type</H1></CardH><CardB>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>setMode("real")} style={{padding:"16px 18px",borderRadius:12,textAlign:"left",border:`2px solid ${mode==="real"?"#ea580c":"#e5e7eb"}`,background:mode==="real"?"#fff7ed":"white",cursor:"pointer",fontFamily:FF}}>
          <div style={{fontWeight:700,fontSize:14,color:"#1f2937",marginBottom:4}}>🧑‍🤝‍🧑 Simulate {TOTAL} voters</div>
          <div style={{fontSize:12,color:"#6b7280"}}>Random rankings for your real election size.</div></button>
        <button onClick={()=>setMode("custom")} style={{padding:"16px 18px",borderRadius:12,textAlign:"left",border:`2px solid ${mode==="custom"?"#7e22ce":"#e5e7eb"}`,background:mode==="custom"?"#faf5ff":"white",cursor:"pointer",fontFamily:FF}}>
          <div style={{fontWeight:700,fontSize:14,color:"#1f2937",marginBottom:4}}>🔢 Custom voters (5–500)</div>
          <div style={{fontSize:12,color:"#6b7280"}}>See STV at different scales.</div></button>
      </div>
      {mode==="custom"&&<div style={{marginTop:14,padding:"14px 16px",background:"#faf5ff",border:"1px solid #c084fc",borderRadius:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {[10,25,50,100,200].map(n=><button key={n} onClick={()=>setCustomN(n)} style={{padding:"8px 16px",borderRadius:8,border:`1.5px solid ${customN===n?"#7e22ce":"#e5e7eb"}`,background:customN===n?"#7e22ce":"white",color:customN===n?"white":"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>{n}</button>)}
          <input type="number" min="5" max="500" value={customN} onChange={e=>setCustomN(Math.max(5,Math.min(500,+e.target.value||5)))} style={{width:80,padding:"8px",borderRadius:8,border:"1.5px solid #c084fc",fontSize:14,fontWeight:600,textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{fontSize:11,color:"#9ca3af",marginTop:6}}>Quota: {Math.floor(customN/(SEATS+1))+1}</div>
      </div>}
      {/* Ranking limit for trial */}
      {mode&&<div style={{marginTop:14,padding:"14px 16px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:600,color:"#1f2937",marginBottom:8}}>Each simulated voter must rank:</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[2,3,4].map(n=><button key={n} onClick={()=>setTrialMinRank(n)} style={{padding:"8px 16px",borderRadius:8,border:`2px solid ${trialMinRank===n?"#ea580c":"#e5e7eb"}`,background:trialMinRank===n?"#fff7ed":"white",color:trialMinRank===n?"#ea580c":"#6b7280",fontSize:13,fontWeight:700,cursor:"pointer"}}>{n===CANDIDATES.length?`All ${n}`:`At least ${n}`}</button>)}
        </div>
      </div>}
      {mode&&<div style={{marginTop:14}}><Btn color={mode==="real"?"orange":"purple"} onClick={()=>run(mode==="real"?TOTAL:customN)}>Run trial →</Btn></div>}
    </CardB></Card>
    {trials.length>0&&<Card><CardH><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><H2>Trial history</H2><Chip color="purple">{trials.length}</Chip></div></CardH><CardB>
      {trials.map((t,idx)=>(<div key={t.id} style={{marginBottom:12}}>
        <button onClick={()=>setExpanded(expanded===t.id?null:t.id)} style={{width:"100%",padding:"12px 16px",borderRadius:10,border:`1px solid ${expanded===t.id?"#ea580c":"#e5e7eb"}`,background:expanded===t.id?"#fff7ed":"#fafaf9",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:FF}}>
          <div><div style={{fontSize:13,fontWeight:700}}>Trial #{trials.length-idx} · {t.numVoters}v</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Winners: {t.results.elected.map(e=>t.candidateNames[e.ci].split(" ")[0]).join(" & ")}</div></div>
          <span style={{color:"#9ca3af"}}>{expanded===t.id?"▼":"▶"}</span>
        </button>
        {expanded===t.id&&<div style={{marginTop:8}}><STVResults results={t.results} ballots={t.ballots} isDemo candidateNames={t.candidateNames}/></div>}
      </div>))}
      {trials.length>1&&<button onClick={()=>{setTrials([]);setExpanded(null)}} style={{marginTop:8,padding:"8px 16px",border:"1px solid #e5e7eb",borderRadius:8,background:"white",fontSize:12,color:"#6b7280",cursor:"pointer",width:"100%",fontFamily:FF}}>Clear all</button>}
    </CardB></Card>}
  </div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: STV RESULTS — shared by Demo + Admin
// ═══════════════════════════════════════════════════════════════════════════════
function STVResults({results,ballots,isDemo=false,level="full",candidateNames=null}){
  // level: "winners" | "summary" | "full"
  const dq=results.quota||QUOTA,maxV=Math.max(...results.rounds.flatMap(r=>r.snapshot.map(s=>s.votes)),dq,1)
  const raw=ballots.map(b=>Array.isArray(b)?b:b.ballot),tot=raw.length
  // Use custom candidate names if provided (for trials), otherwise real names
  const cn=candidateNames||CANDIDATES
  const gn=ci=>ci<cn.length?cn[ci]:`Candidate ${ci+1}`,gs=ci=>ci<cn.length?cn[ci].split(" ")[0]:`C${ci+1}`
  const [showMore,setShowMore]=useState(false),showAll=tot<=30,disp=showAll||showMore?raw:raw.slice(0,30)

  return(<div style={{fontFamily:FF}}>
    {/* Winner banner — always shown */}
    <div className="mta-slide" style={{background:"linear-gradient(135deg,#f0fdf4,#fef9c3)",border:"2px solid #86efac",borderRadius:14,padding:"24px 20px",textAlign:"center",marginBottom:14}}>
      <div style={{fontSize:36,marginBottom:10}}>🏆</div>
      <div style={{fontSize:22,fontWeight:800,color:"#1e1b4b",marginBottom:6,fontFamily:FH}}>{isDemo?"Trial Result":"MTA Co-Presidents Elected!"}</div>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>{results.elected.map(e=><div key={e.ci} style={{background:"#15803d",color:"white",fontWeight:800,fontSize:15,padding:"10px 24px",borderRadius:100}}>{gn(e.ci)}</div>)}</div>
      <div style={{fontSize:12,color:"#6b7280",marginTop:10}}>{tot} voters · Quota: {dq} · {results.rounds.length} rounds</div>
    </div>

    {/* Round-by-round — shown for "summary" and "full" */}
    {level!=="winners"&&<Card><CardH><H2>STV count — round by round</H2><Sub>Vertical bar = quota ({dq})</Sub></CardH>
      <div style={{padding:"4px 20px 16px"}}>{results.rounds.map(round=>{
        const ec=round.actions.filter(a=>a.type==="elected").map(a=>a.ci),el=round.actions.filter(a=>a.type==="eliminated").map(a=>a.ci)
        return(<div key={round.rn} className="mta-fade" style={{marginTop:12,border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"9px 16px",background:"#fafaf9",borderBottom:"1px solid #e5e7eb",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
            <span style={{fontWeight:700,fontSize:13}}>Round {round.rn}</span>
            <span style={{fontSize:12,color:"#6b7280"}}>{ec.map(ci=>`✓ ${gs(ci)}`).join(" · ")}{el.map(ci=>` ✗ ${gs(ci)}`).join("")}</span>
          </div>
          {round.snapshot.sort((a,b)=>b.votes-a.votes).map(row=>{const isW=ec.includes(row.ci),isO=el.includes(row.ci),pct=row.votes/maxV*100,qp=dq/maxV*100
            return(<div key={row.ci} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid #f9fafb"}}>
              <span style={{fontSize:13,fontWeight:700,minWidth:55,color:isW?"#15803d":isO?"#9ca3af":"#1f2937"}}>{gs(row.ci)}</span>
              <div style={{flex:1,position:"relative",height:9,background:"#f3f4f6",borderRadius:100}}>
                <div style={{position:"absolute",height:"100%",borderRadius:100,background:isW?"#16a34a":isO?"#d1d5db":"#ea580c",width:`${pct}%`,transition:"width 0.6s"}}/>
                <div style={{position:"absolute",top:-5,bottom:-5,width:2,background:"#374151",left:`${qp}%`,borderRadius:1}}/>
              </div>
              <span style={{fontSize:13,fontWeight:800,minWidth:36,textAlign:"right",color:isW?"#15803d":isO?"#9ca3af":"#1f2937"}}>{row.votes}</span>
              {isW&&<Chip color="green">✓</Chip>}{isO&&<Chip color="red">✗</Chip>}
            </div>)})}
        </div>)})}</div>
    </Card>}

    {/* Plain English — shown for "summary" and "full" */}
    {level!=="winners"&&<Card><CardH><H2>What happened — plain English</H2></CardH><CardB>
      {results.rounds.map(round=>{const ec=round.actions.filter(a=>a.type==="elected").map(a=>a.ci),el=round.actions.filter(a=>a.type==="eliminated").map(a=>a.ci)
        return(<div key={round.rn} style={{marginBottom:14,paddingBottom:14,borderBottom:"1px solid #f3f4f6"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:5}}>Round {round.rn}</div>
          <div style={{fontSize:13,color:"#6b7280",lineHeight:1.7}}>
            {ec.map(ci=>{const row=round.snapshot.find(r=>r.ci===ci),sur=row?+(row.votes-dq).toFixed(3):0;return <span key={ci}><strong style={{color:"#15803d"}}>{gn(ci)}</strong> reached {row?.votes} (quota {dq}). {sur>0?`Surplus ${sur} transferred. `:"No surplus. "}</span>})}
            {el.map(ci=><span key={ci}>Nobody hit quota. <strong style={{color:"#dc2626"}}>{gn(ci)}</strong> eliminated (fewest votes). Ballots transferred.</span>)}
          </div></div>)})}
    </CardB></Card>}

    {/* Full audit — only for "full" level */}
    {level==="full"&&<Card><CardH><H2>Human verification — all ballots</H2><Sub>Cross-check the STV count manually.</Sub></CardH><CardB>
      <div style={{padding:"12px 14px",background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:9,fontSize:13,color:"#92400e",lineHeight:1.6,marginBottom:14}}><strong>Verify:</strong> Tally all "1" circles → should match Round 1. Trace transfers through rounds.</div>
      {disp.map((ballot,idx)=>{const ranked=ballot.map((r,ci)=>({r,ci})).filter(x=>x.r!==null).sort((a,b)=>a.r-b.r);return(
        <div key={idx} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#fafaf9",borderRadius:8,marginBottom:6,border:"1px solid #e5e7eb",flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:800,color:"#9ca3af",minWidth:68}}>Ballot #{idx+1}</span>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{ranked.map(({r,ci})=>(
            <div key={r} style={{display:"flex",alignItems:"center",gap:4,background:r<=4?RL[r-1]:"#f3f4f6",border:`1px solid ${r<=4?RC[r-1]+"44":"#d1d5db"}`,borderRadius:6,padding:"3px 9px"}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:r<=4?RC[r-1]:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"white",fontWeight:800}}>{r}</div>
              <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{gs(ci)}</span>
            </div>))}</div>
        </div>)})}
      {!showAll&&<button onClick={()=>setShowMore(!showMore)} style={{marginTop:8,padding:"8px 16px",border:"1px solid #e5e7eb",borderRadius:8,background:"white",fontSize:12,color:"#6b7280",cursor:"pointer",width:"100%",fontFamily:FF}}>{showMore?"Show less":`Show all ${tot}`}</button>}
      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",background:"#fafaf9",borderBottom:"1px solid #e5e7eb",fontWeight:700,fontSize:13}}>Verifier checklist</div>
        {[`Total ballots = ${tot}`,`Quota = ${dq}`,`Every ballot ≥ 2 rankings`,`No duplicate ranks`,`Round 1 totals sum to ${tot}`,`Surplus redistributes proportionally`,`Tie-breaking: earlier-round lookback → alphabetical`,`${SEATS} candidates elected`].map((item,i)=>(
          <label key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 14px",borderBottom:"1px solid #f3f4f6",fontSize:13,cursor:"pointer"}}><input type="checkbox" style={{marginTop:2,flexShrink:0}}/><span style={{color:"#6b7280"}}>{item}</span></label>))}
      </div>
    </CardB></Card>}
  </div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: ADMIN PAGE — with release levels, backup, receipt verify, reset
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPage({ctx}){
  const {phase,ballots,checkedIn,updatePhase,resetElection,config,updateConfig}=ctx
  const [unlocked,setUnlocked]=useState(false),[pin,setPin]=useState(""),[pinErr,setPinErr]=useState(false)
  const [results,setResults]=useState(null),[resetConfirm,setResetConfirm]=useState(false)
  const [liveChecked,setLiveChecked]=useState([...checkedIn]),[liveBallots,setLiveBallots]=useState([...ballots])
  const [livePhase,setLivePhase]=useState(phase),[localConfig,setLocalConfig]=useState({...config})
  const [verifyCode,setVerifyCode]=useState(""),[verifyResult,setVerifyResult]=useState(null)
  // NEW: release level — "winners" | "summary" | "full"
  const [releaseLevel,setReleaseLevel]=useState(config.releaseLevel||"full")

  useEffect(()=>{setLiveChecked([...checkedIn]);setLiveBallots([...ballots]);setLivePhase(phase);setLocalConfig({...config});setReleaseLevel(config.releaseLevel||"full")},[checkedIn,ballots,phase,config])
  useEffect(()=>{const iv=setInterval(async()=>{const[p,b,c]=await Promise.all([sGet(SK.phase),sGet(SK.ballots),sGet(SK.checked)]);if(p)setLivePhase(p);if(b)setLiveBallots(b);if(c)setLiveChecked(c)},4000);return()=>clearInterval(iv)},[])

  const tryUnlock=()=>{if(pin===ADMIN_CODE){setUnlocked(true);setPinErr(false)}else setPinErr(true)}
  const openVoting=async()=>{const cfg={...localConfig,releaseLevel};await updateConfig(cfg);await updatePhase("open");setLivePhase("open")}
  const closeVoting=async()=>{await updatePhase("closed");setLivePhase("closed")}
  const revealResults=async()=>{const cfg={...localConfig,releaseLevel};await updateConfig(cfg);await updatePhase("revealed");setLivePhase("revealed");setResults(runSTV(liveBallots))}
  const doReset=async()=>{await resetElection();setResults(null);setResetConfirm(false);setLivePhase("setup");setLiveBallots([]);setLiveChecked([]);setLocalConfig({minRank:4});setVerifyResult(null);setReleaseLevel("full")}
  const exportBallots=()=>{const raw=liveBallots.map(b=>Array.isArray(b)?b:b.ballot);const data={election:"MTA Co-President Election 2026",exportedAt:new Date().toISOString(),totalVoters:TOTAL,totalBallots:raw.length,candidates:CANDIDATES,seats:SEATS,quota:QUOTA,phase:livePhase,ballots:raw,receipts:liveBallots.map(b=>Array.isArray(b)?null:b.receipt).filter(Boolean)};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`mta-election-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
  const lookupReceipt=()=>{const code=verifyCode.trim().toUpperCase();if(code.length!==6){setVerifyResult("not_found");return};const found=liveBallots.find(b=>!Array.isArray(b)&&b.receipt===code);setVerifyResult(found||"not_found")}

  const vc=liveBallots.length,allV=vc===TOTAL

  if(!unlocked) return(<div style={{maxWidth:400,margin:"0 auto",fontFamily:FF}} className="mta-slide"><Card><CardH><H1>🔐 Admin Panel</H1><Sub>Enter the admin code.</Sub></CardH><CardB>
    <div style={{padding:"14px 16px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,marginBottom:16,fontSize:13,color:"#6b7280",lineHeight:1.6}}>Only the organiser has this code. Edit <code style={{background:"#f3f4f6",padding:"1px 6px",borderRadius:4,fontSize:12,fontFamily:"monospace"}}>ADMIN_CODE</code> in the source file to change it.</div>
    <PinInput value={pin} onChange={setPin} placeholder="Enter code..." onEnter={tryUnlock}/>
    {pinErr&&<div style={{fontSize:12,color:"#dc2626",marginTop:6}}>Incorrect code.</div>}
    <div style={{marginTop:12}}><Btn onClick={tryUnlock}>Unlock</Btn></div>
  </CardB></Card></div>)

  return(<div className="mta-slide" style={{fontFamily:FF}}>
    {/* Settings — setup only */}
    {livePhase==="setup"&&<Card><CardH><H2>⚙️ Election settings</H2><Sub>Locks once voting starts.</Sub></CardH><CardB>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,color:"#1f2937",marginBottom:8}}>Minimum rankings per voter:</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[2,3,4].map(n=><button key={n} onClick={()=>setLocalConfig(p=>({...p,minRank:n}))} style={{padding:"10px 20px",borderRadius:10,border:`2px solid ${localConfig.minRank===n?"#ea580c":"#e5e7eb"}`,background:localConfig.minRank===n?"#fff7ed":"white",color:localConfig.minRank===n?"#ea580c":"#6b7280",fontSize:14,fontWeight:700,cursor:"pointer"}}>{n===CANDIDATES.length?`All ${n}`:`At least ${n}`}</button>)}</div>
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:"#1f2937",marginBottom:8}}>Results release level:</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{k:"winners",l:"🏆 Winners only",d:"Just the names of who won. No statistics."},{k:"summary",l:"📊 Summary",d:"Winners + round-by-round chart + plain English explanation."},{k:"full",l:"🔍 Full transparency",d:"Everything: rounds, explanations, all ballots, verifier checklist."}].map(o=>(
            <button key={o.k} onClick={()=>setReleaseLevel(o.k)} style={{padding:"12px 16px",borderRadius:10,textAlign:"left",border:`2px solid ${releaseLevel===o.k?"#ea580c":"#e5e7eb"}`,background:releaseLevel===o.k?"#fff7ed":"white",cursor:"pointer"}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1f2937"}}>{o.l}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{o.d}</div>
            </button>))}
        </div>
        <div style={{fontSize:12,color:"#9ca3af",marginTop:8}}>You can change this again before revealing results.</div>
      </div>
    </CardB></Card>}

    {/* Phase control */}
    <Card><CardH><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><H1>Election control</H1><Chip color={livePhase==="open"?"green":livePhase==="revealed"?"blue":livePhase==="closed"?"orange":"gray"}>{livePhase==="setup"?"Not started":livePhase==="open"?"Voting open":livePhase==="closed"?"Closed":"Results out"}</Chip></div></CardH><CardB>
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:20,overflowX:"auto"}}>
        {[{k:"setup",l:"Setup"},{k:"open",l:"Voting"},{k:"closed",l:"Closed"},{k:"revealed",l:"Results"}].map((s,i,arr)=>{const phases=["setup","open","closed","revealed"],active=phases.indexOf(livePhase)>=phases.indexOf(s.k);return(<div key={s.k} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?1:0}}>
          <div style={{textAlign:"center",flexShrink:0}}><div style={{width:32,height:32,borderRadius:"50%",background:active?"#ea580c":"#e5e7eb",color:active?"white":"#9ca3af",fontWeight:800,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px"}}>{i+1}</div><div style={{fontSize:10,fontWeight:600,color:active?"#ea580c":"#9ca3af"}}>{s.l}</div></div>
          {i<arr.length-1&&<div style={{flex:1,height:2,margin:"0 4px 16px",background:active&&phases.indexOf(livePhase)>phases.indexOf(s.k)?"#ea580c":"#e5e7eb"}}/>}
        </div>)})}
      </div>
      {livePhase==="setup"&&<><div style={{padding:"14px 16px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,marginBottom:14,fontSize:13,color:"#92400e",lineHeight:1.6}}><strong>Ready?</strong> Results will release as: <strong>{releaseLevel==="winners"?"Winners only":releaseLevel==="summary"?"Summary":"Full transparency"}</strong></div><Btn onClick={openVoting} color="orange">Open Voting 🗳️</Btn></>}
      {livePhase==="open"&&<><div style={{height:6,background:"#f3f4f6",borderRadius:100,marginBottom:10,overflow:"hidden"}}><div style={{height:6,borderRadius:100,transition:"width 0.5s",background:allV?"#16a34a":"#ea580c",width:`${vc/TOTAL*100}%`}}/></div><div style={{fontSize:13,color:"#6b7280",marginBottom:14}}>{allV?"All in!":`${vc}/${TOTAL}. Waiting for ${TOTAL-vc}.`}</div><Btn onClick={closeVoting} color="orange" disabled={!allV}>{allV?"Close Voting":`Waiting for ${TOTAL-vc}...`}</Btn></>}
      {livePhase==="closed"&&<>
        <div style={{fontSize:13,fontWeight:600,color:"#1f2937",marginBottom:8}}>Choose release level before revealing:</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {[{k:"winners",l:"🏆 Winners only"},{k:"summary",l:"📊 Summary"},{k:"full",l:"🔍 Full"}].map(o=>(
            <button key={o.k} onClick={()=>setReleaseLevel(o.k)} style={{padding:"8px 16px",borderRadius:8,border:`2px solid ${releaseLevel===o.k?"#ea580c":"#e5e7eb"}`,background:releaseLevel===o.k?"#fff7ed":"white",color:releaseLevel===o.k?"#ea580c":"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>{o.l}</button>))}
        </div>
        <Btn onClick={revealResults} color="green">Reveal Results 🏆</Btn>
      </>}
      {livePhase==="revealed"&&<div style={{padding:"12px 16px",background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:10,fontSize:13,color:"#1d4ed8"}}>Results released ({releaseLevel}). Scroll down. Admin always sees full results below.</div>}
    </CardB></Card>

    {/* Backup */}
    {vc>0&&<Card><CardH><H2>💾 Backup</H2></CardH><CardB>
      <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>{vc} anonymous ballots. No voter names.</div>
      <Btn onClick={exportBallots} color="blue" sm>Download backup ↓</Btn>
    </CardB></Card>}

    {/* Voter check-in */}
    <Card><CardH><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><H2>Voter status</H2><span style={{fontSize:12,color:"#9ca3af"}}>live</span></div></CardH><CardB>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(168px,1fr))",gap:6}}>
        {VOTERS.map((name,i)=>{const voted=liveChecked.includes(name);return(<div key={name} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:9,background:voted?"#f0fdf4":"#fafaf9",border:`1px solid ${voted?"#86efac":"#e5e7eb"}`}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:voted?"#16a34a":"#d1d5db",flexShrink:0}}/><span style={{fontSize:12,color:voted?"#15803d":"#6b7280",fontWeight:voted?700:400}}>{name}</span>
        </div>)})}
      </div>
    </CardB></Card>

    {/* Receipt verify */}
    {livePhase==="revealed"&&<Card><CardH><H2>🧾 Verify a ballot</H2><Sub>Enter 6-char receipt code.</Sub></CardH><CardB>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input type="text" value={verifyCode} onChange={e=>{setVerifyCode(e.target.value.toUpperCase());setVerifyResult(null)}} onKeyDown={e=>e.key==="Enter"&&lookupReceipt()} placeholder="K7X2M9" maxLength={6} style={{flex:1,padding:"10px 14px",borderRadius:9,border:"1.5px solid #d1d5db",fontSize:18,outline:"none",letterSpacing:"0.25em",fontFamily:"monospace",textTransform:"uppercase",boxSizing:"border-box"}}/>
        <Btn onClick={lookupReceipt} full={false} sm color="blue">Look up</Btn>
      </div>
      {verifyResult==="not_found"&&<div style={{padding:"12px 16px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,fontSize:13,color:"#b91c1c"}}>Not found.</div>}
      {verifyResult&&verifyResult!=="not_found"&&<div style={{padding:"14px 16px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"#15803d",marginBottom:8}}>✓ Found & counted!</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{verifyResult.ballot.map((r,ci)=>r!==null?<div key={ci} style={{display:"flex",alignItems:"center",gap:4,background:RL[r-1],border:`1px solid ${RC[r-1]}44`,borderRadius:6,padding:"4px 10px"}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:RC[r-1],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"white",fontWeight:800}}>{r}</div>
          <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{CANDIDATES[ci].split(" ")[0]}</span>
        </div>:null)}</div>
      </div>}
    </CardB></Card>}

    {/* Results — admin ALWAYS sees full, regardless of release level */}
    {livePhase==="revealed"&&(results?<><div style={{padding:"10px 16px",background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:10,marginBottom:14,fontSize:12,color:"#92400e"}}>Admin view: full results shown below regardless of public release level.</div><STVResults results={results} ballots={liveBallots} level="full"/></>:<div style={{textAlign:"center",padding:24}}><Btn onClick={()=>setResults(runSTV(liveBallots))}>Load results</Btn></div>)}

    {/* Reset — prominent after election */}
    <div style={{marginTop:8,marginBottom:24,textAlign:"center"}}>
      {livePhase==="revealed"&&!resetConfirm&&<div style={{padding:"16px 20px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700,color:"#1f2937",marginBottom:8}}>Election complete!</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>Want to run another election? Reset clears all data.</div>
        <Btn onClick={()=>setResetConfirm(true)} color="red">Start New Election / Reset</Btn>
      </div>}
      {livePhase!=="revealed"&&!resetConfirm&&<button onClick={()=>setResetConfirm(true)} style={{padding:"9px 20px",border:"1px solid #fca5a5",borderRadius:9,background:"#fef2f2",color:"#b91c1c",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FF}}>Reset election</button>}
      {resetConfirm&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:12,padding:"16px 20px"}}>
        <div style={{fontSize:13,color:"#b91c1c",fontWeight:700,marginBottom:12}}>⚠️ Delete ALL votes permanently?</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={()=>setResetConfirm(false)} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"white",fontSize:13,cursor:"pointer",fontFamily:FF}}>Cancel</button>
          <button onClick={doReset} style={{padding:"10px 20px",border:"none",borderRadius:8,background:"#dc2626",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>Yes, reset everything</button>
        </div>
      </div>}
    </div>
  </div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: PUBLIC RESULTS PAGE — what non-admin voters see
// This shows results at the level the admin chose.
// ═══════════════════════════════════════════════════════════════════════════════
function PublicResultsPage({ctx}){
  const {phase,ballots,config}=ctx
  const level=config.releaseLevel||"full"
  const [verifyCode,setVerifyCode]=useState("")
  const [verifyResult,setVerifyResult]=useState(null)

  const lookupReceipt=()=>{const code=verifyCode.trim().toUpperCase();if(code.length!==6){setVerifyResult("not_found");return};const found=ballots.find(b=>!Array.isArray(b)&&b.receipt===code);setVerifyResult(found||"not_found")}

  if(phase!=="revealed") return(<div className="mta-slide" style={{textAlign:"center",padding:"48px 20px",fontFamily:FF}}>
    <div style={{fontSize:48,marginBottom:16}}>⏳</div>
    <div style={{fontSize:18,fontWeight:700,color:"#1e1b4b",marginBottom:8,fontFamily:FH}}>Results not yet released</div>
    <Sub>The admin will reveal results after voting closes.</Sub>
  </div>)

  const results=runSTV(ballots)
  return(<div className="mta-slide" style={{fontFamily:FF}}>
    <STVResults results={results} ballots={ballots} level={level}/>

    {/* Receipt verification — any voter can check their ballot here */}
    <Card><CardH><H2>🧾 Verify your ballot</H2><Sub>Enter the 6-character code you received after voting to confirm your ballot was counted.</Sub></CardH><CardB>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input type="text" value={verifyCode} onChange={e=>{setVerifyCode(e.target.value.toUpperCase());setVerifyResult(null)}} onKeyDown={e=>e.key==="Enter"&&lookupReceipt()} placeholder="e.g. K7X2M9" maxLength={6} style={{flex:1,padding:"10px 14px",borderRadius:9,border:"1.5px solid #d1d5db",fontSize:18,outline:"none",letterSpacing:"0.25em",fontFamily:"monospace",textTransform:"uppercase",boxSizing:"border-box"}}/>
        <Btn onClick={lookupReceipt} full={false} sm color="blue">Check</Btn>
      </div>
      {verifyResult==="not_found"&&<div style={{padding:"12px 16px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,fontSize:13,color:"#b91c1c"}}>No ballot found with that code. Double-check and try again.</div>}
      {verifyResult&&verifyResult!=="not_found"&&<div style={{padding:"14px 16px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"#15803d",marginBottom:8}}>✓ Your ballot was found and counted!</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{verifyResult.ballot.map((r,ci)=>r!==null?<div key={ci} style={{display:"flex",alignItems:"center",gap:4,background:RL[r-1],border:`1px solid ${RC[r-1]}44`,borderRadius:6,padding:"4px 10px"}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:RC[r-1],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"white",fontWeight:800}}>{r}</div>
          <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{CANDIDATES[ci].split(" ")[0]}</span>
        </div>:null)}</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:8}}>This is your ballot. It was included in the final count.</div>
      </div>}
    </CardB></Card>
  </div>)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14: ROOT APP — ballot shuffling, hidden trial tab, font loading
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [tab,setTab]=useState("home"),[phase,setPhase]=useState(null),[ballots,setBallots]=useState([])
  const [checkedIn,setCheckedIn]=useState([]),[config,setConfig]=useState({minRank:4}),[loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState(false)

  useEffect(()=>{
    const timeout=setTimeout(()=>{setLoading(false);setLoadError(true)},10000)
    ;(async()=>{const[p,b,c,cfg]=await Promise.all([sGet(SK.phase),sGet(SK.ballots),sGet(SK.checked),sGet(SK.config)]);clearTimeout(timeout);setPhase(p||"setup");setBallots(b||[]);setCheckedIn(c||[]);setConfig(cfg||{minRank:4});setLoading(false)})()
    return()=>clearTimeout(timeout)
  },[])
  useEffect(()=>{const iv=setInterval(async()=>{const[p,b,c,cfg]=await Promise.all([sGet(SK.phase),sGet(SK.ballots),sGet(SK.checked),sGet(SK.config)]);if(p)setPhase(p);if(b)setBallots(b);if(c)setCheckedIn(c);if(cfg)setConfig(cfg)},5000);return()=>clearInterval(iv)},[])

  const updatePhase=async np=>{await sSet(SK.phase,np);setPhase(np)}
  const updateConfig=async cfg=>{await sSet(SK.config,cfg);setConfig(cfg)}
  // BALLOT SHUFFLING: insert at random position
  const addBallot=async b=>{const nb=[...ballots];nb.splice(Math.floor(Math.random()*(nb.length+1)),0,b);await sSet(SK.ballots,nb);setBallots(nb)}
  const addCheckedIn=async n=>{const nc=[...checkedIn,n];await sSet(SK.checked,nc);setCheckedIn(nc)}
  const resetElection=async()=>{await Promise.all([sSet(SK.phase,"setup"),sSet(SK.ballots,[]),sSet(SK.checked,[]),sSet(SK.config,{minRank:4})]);setPhase("setup");setBallots([]);setCheckedIn([]);setConfig({minRank:4})}

  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff7ed",fontFamily:FF}}><div style={{textAlign:"center"}}><MTALogo size={64}/><div style={{marginTop:16,color:"#ea580c",fontWeight:600}}>Loading...</div></div></div>
  if(loadError&&!phase) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff7ed",fontFamily:FF}}><div style={{textAlign:"center",maxWidth:360,padding:20}}><MTALogo size={64}/><div style={{marginTop:16,color:"#dc2626",fontWeight:700,fontSize:16}}>Connection error</div><div style={{marginTop:8,color:"#6b7280",fontSize:13,lineHeight:1.6}}>Could not connect to the database. Check your internet connection and refresh the page.</div><button onClick={()=>window.location.reload()} style={{marginTop:16,padding:"10px 24px",background:"#ea580c",color:"white",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontFamily:FF}}>Refresh</button></div></div>

  const ctx={phase,ballots,checkedIn,config,updatePhase,updateConfig,addBallot,addCheckedIn,resetElection}
  const showTrial=phase==="setup"||phase==="revealed"
  const tabs=[{id:"home",label:"Home"},{id:"how",label:"How it Works"},{id:"vote",label:"Vote"},...(showTrial?[{id:"demo",label:"Trial Run"}]:[]),{id:"results",label:"Results"},{id:"admin",label:"Admin 🔐"}]
  if(tab==="demo"&&!showTrial)setTab("home")

  const phaseColor=phase==="open"?"#16a34a":phase==="revealed"?"#1d4ed8":phase==="closed"?"#d97706":"#9ca3af"
  const phaseLabel=phase==="setup"?"Not started":phase==="open"?"Voting open":phase==="closed"?"Closed":"Results out"

  return(<div style={{minHeight:"100vh",background:"#f9fafb",fontFamily:FF}}>
    <div style={{background:"white",borderBottom:"2px solid #ea580c22",position:"sticky",top:0,zIndex:100}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:"0 14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <MTALogo size={38}/>
            <div><div style={{fontSize:13,fontWeight:800,color:"#1e1b4b",lineHeight:1.2,fontFamily:FH}}><span style={{color:"#ea580c"}}>MTA</span> Election 2026</div><div style={{fontSize:10,color:"#9ca3af"}}>Mana Telugu Association · Purdue</div></div>
          </div>
          <div style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:100,background:`${phaseColor}18`,color:phaseColor,border:`1px solid ${phaseColor}44`}}>{phaseLabel}</div>
        </div>
        <div style={{display:"flex",gap:3,paddingBottom:10,overflowX:"auto"}}>
          {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,padding:"7px 14px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,background:tab===t.id?"#ea580c":"transparent",color:tab===t.id?"white":"#6b7280",cursor:"pointer",transition:"all 0.15s",fontFamily:FF}}>{t.label}</button>)}
        </div>
      </div>
    </div>
    <div style={{maxWidth:680,margin:"0 auto",padding:"20px 14px 48px"}}>
      {tab==="home"&&<HomePage ctx={ctx} setTab={setTab}/>}
      {tab==="how"&&<HowPage/>}
      {tab==="vote"&&<VotePage ctx={ctx}/>}
      {tab==="demo"&&<DemoPage/>}
      {tab==="results"&&<PublicResultsPage ctx={ctx}/>}
      {tab==="admin"&&<AdminPage ctx={ctx}/>}
    </div>
  </div>)
}
