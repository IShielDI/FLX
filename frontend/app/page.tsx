"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG — only thing you ever change ─────────────────────────────────────
const API = "http://localhost:8000";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg:"#0A0A0A", bgS:"#111", bgCard:"#161616", bgEl:"#1C1C1C",
  border:"#2A2A2A", borderL:"#1E1E1E",
  accent:"#C8FF00", accentDim:"#9ABF00", accentGlow:"rgba(200,255,0,0.10)",
  text:"#F0F0F0", muted:"#777", dim:"#444",
  green:"#00D67A", greenDim:"rgba(0,214,122,0.13)",
  red:"#FF4D4D", redDim:"rgba(255,77,77,0.13)",
  blue:"#4DA6FF", gold:"#FFB800",
};
const F = {
  display:"'Bebas Neue','Impact',sans-serif",
  mono:"'DM Mono','Courier New',monospace",
  ui:"'Inter',system-ui,sans-serif",
};

// ─── API HELPERS ─────────────────────────────────────────────────────────────
function authHeaders(token: string|null) {
  return token ? { "Content-Type":"application/json", "Authorization":`Bearer ${token}` }
               : { "Content-Type":"application/json" };
}
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const fmt      = n => n >= 100000 ? `₹${(n/100000).toFixed(2)}L` : `₹${n?.toLocaleString("en-IN")}`;
const fmtShort = n => n >= 100000 ? `₹${(n/100000).toFixed(1)}L`  : `₹${n?.toLocaleString("en-IN")}`;

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:${F.ui}}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${C.bg}}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
`;

// ─── ATOMS ───────────────────────────────────────────────────────────────────
const EMOJI = { Sneakers:"👟", Streetwear:"🧥", Watches:"⌚", Fragrances:"🧴", Accessories:"👜", Collectibles:"🎭" };

function LiveDot() {
  return <span style={{width:7,height:7,borderRadius:"50%",background:C.green,
    boxShadow:`0 0 0 3px ${C.greenDim}`,display:"inline-block",animation:"pulse 2s infinite"}} />;
}

function Badge({ children, variant="default" }) {
  const s = {
    default:{ bg:C.bgEl,      color:C.muted,  border:C.border       },
    accent: { bg:C.accentGlow,color:C.accent, border:"transparent"  },
    green:  { bg:C.greenDim,  color:C.green,  border:"transparent"  },
    red:    { bg:C.redDim,    color:C.red,    border:"transparent"  },
    blue:   { bg:"rgba(77,166,255,0.12)",color:C.blue,border:"transparent"},
    gold:   { bg:"rgba(255,184,0,0.12)", color:C.gold,border:"transparent"},
  }[variant] || {};
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,background:s.bg,
    color:s.color,border:`1px solid ${s.border}`,fontSize:11,fontWeight:600,
    textTransform:"uppercase",letterSpacing:.5,fontFamily:F.mono}}>{children}</span>;
}

function ChangeTag({ value, size="sm" }) {
  const up = value >= 0;
  const fs = size==="lg"?16:size==="md"?13:11;
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,
    background:up?C.greenDim:C.redDim,color:up?C.green:C.red,
    padding:"2px 7px",borderRadius:4,fontSize:fs,fontWeight:600,fontFamily:F.mono,whiteSpace:"nowrap"}}>
    {up?"▲":"▼"} {Math.abs(value).toFixed(2)}%
  </span>;
}

function Spinner({ size=18 }) {
  return <span style={{width:size,height:size,border:`2px solid ${C.border}`,borderTopColor:C.accent,
    borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}} />;
}

function Skeleton({ w="100%", h=20, r=6 }) {
  return <div style={{width:w,height:h,borderRadius:r,
    background:`linear-gradient(90deg,${C.bgCard} 25%,${C.bgEl} 50%,${C.bgCard} 75%)`,
    backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}} />;
}

function Toast({ message, type="success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:999,
    background:type==="error"?C.redDim:C.greenDim,border:`1px solid ${type==="error"?C.red:C.green}`,
    borderRadius:10,padding:"14px 20px",fontSize:14,fontWeight:600,color:type==="error"?C.red:C.green,
    animation:"fadeIn .25s ease",display:"flex",alignItems:"center",gap:10,maxWidth:340}}>
    <span>{type==="error"?"✗":"✓"}</span> {message}
    <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:16}}>×</button>
  </div>;
}

function ProductImage({ src, ticker, category, style={} }) {
  const [err, setErr] = useState(false);
  const { width, height, borderRadius, objectFit, ...rest } = style;
  if (err || !src) {
    return <div style={{width,height,borderRadius,background:`linear-gradient(135deg,${C.bgEl},${C.bgCard})`,
      border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",gap:6,overflow:"hidden",flexShrink:0,...rest}}>
      <span style={{fontSize:typeof height==="number"&&height<80?18:36}}>{EMOJI[category]||"📦"}</span>
      {typeof height==="number"&&height>=80&&
        <span style={{fontSize:10,fontFamily:F.mono,color:C.accentDim,fontWeight:700,
          letterSpacing:1,textTransform:"uppercase",maxWidth:"90%",overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ticker}</span>}
    </div>;
  }
  return <img src={src} alt={ticker} onError={()=>setErr(true)}
    style={{width,height,borderRadius,objectFit:objectFit||"cover",flexShrink:0,...rest}} />;
}

// ─── SCROLLING TICKER ────────────────────────────────────────────────────────
function Ticker({ sales }) {
  const [offset, setOffset] = useState(0);
  const items = [...sales, ...sales];
  useEffect(() => {
    if (!sales.length) return;
    const id = setInterval(() => setOffset(o => (o + 1) % (sales.length * 220)), 30);
    return () => clearInterval(id);
  }, [sales.length]);
  if (!sales.length) return <div style={{height:36,background:C.bgS,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}} />;
  return <div style={{background:C.bgS,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,overflow:"hidden",height:36,display:"flex",alignItems:"center"}}>
    <div style={{display:"flex",alignItems:"center",transform:`translateX(-${offset}px)`,transition:"transform .03s linear",whiteSpace:"nowrap"}}>
      {items.map((s,i) => <span key={i} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"0 20px",fontSize:12,fontFamily:F.mono}}>
        <span style={{color:C.accent,fontWeight:700}}>{s.ticker}</span>
        <span style={{color:C.muted}}>{s.size}</span>
        <span style={{color:C.green,fontWeight:600}}>{fmt(s.price)}</span>
        <span style={{color:C.border}}>·</span>
      </span>)}
    </div>
  </div>;
}

// ─── SPARKLINE ───────────────────────────────────────────────────────────────
function Sparkline({ data, up, width=80, height=32 }) {
  if (!data||data.length<2) return null;
  const min=Math.min(...data), max=Math.max(...data), range=max-min||1;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-min)/range)*height}`).join(" ");
  return <svg width={width} height={height}><polyline points={pts} fill="none" stroke={up?C.green:C.red} strokeWidth={1.5} strokeLinejoin="round"/></svg>;
}

// ─── PRICE CHART ─────────────────────────────────────────────────────────────
function PriceChart({ data, up }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas||!data?.length) return;
    const ctx = canvas.getContext("2d");
    const W=canvas.offsetWidth, H=canvas.offsetHeight;
    canvas.width=W; canvas.height=H;
    const prices = data.map(d=>d.price);
    const min=Math.min(...prices)*.99, max=Math.max(...prices)*1.01;
    const toX=i=>(i/(prices.length-1))*W;
    const toY=v=>H-((v-min)/(max-min))*H*.9-H*.05;
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle=C.border; ctx.lineWidth=.5;
    for(let i=0;i<=4;i++){const y=H*.05+(H*.9/4)*i;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,up?"rgba(0,214,122,0.2)":"rgba(255,77,77,0.2)");
    grad.addColorStop(1,"rgba(0,0,0,0)");
    ctx.beginPath();ctx.moveTo(toX(0),H);prices.forEach((p,i)=>ctx.lineTo(toX(i),toY(p)));ctx.lineTo(toX(prices.length-1),H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();prices.forEach((p,i)=>i===0?ctx.moveTo(toX(i),toY(p)):ctx.lineTo(toX(i),toY(p)));
    ctx.strokeStyle=up?C.green:C.red;ctx.lineWidth=2;ctx.lineJoin="round";ctx.stroke();
    ctx.fillStyle=C.muted;ctx.font=`10px ${F.mono}`;ctx.fillText(fmtShort(max),6,16);ctx.fillText(fmtShort(min),6,H-4);
  },[data,up]);
  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block"}} />;
}

// ─── LOGIN MODAL ─────────────────────────────────────────────────────────────
function AuthModal({ onClose, onAuth }) {
  const [mode, setMode]       = useState("login");
  const [username, setU]      = useState("");
  const [email, setE]         = useState("");
  const [password, setP]      = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    if (!username || !password) { setError("Fill all fields"); return; }
    setLoading(true); setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { username, password } : { username, email, password };
      const data = await apiFetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      localStorage.setItem("flx_token", data.access_token);
      localStorage.setItem("flx_user",  JSON.stringify({ id:data.user_id, username:data.username, avatar:data.avatar, is_verified:data.is_verified }));
      onAuth({ id:data.user_id, username:data.username, avatar:data.avatar, is_verified:data.is_verified });
      onClose();
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,backdropFilter:"blur(6px)"}}>
    <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:36,width:400,animation:"fadeIn .2s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
        <div style={{fontFamily:F.display,fontSize:28,letterSpacing:2,color:C.accent}}>FLX</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>×</button>
      </div>
      <div style={{display:"flex",gap:0,marginBottom:24,background:C.bgEl,borderRadius:8,padding:4}}>
        {["login","register"].map(m=><button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,background:mode===m?C.bgCard:"transparent",border:mode===m?`1px solid ${C.border}`:"none",borderRadius:6,padding:"8px",color:mode===m?C.text:C.muted,cursor:"pointer",fontSize:13,fontWeight:mode===m?600:400,transition:"all .15s",textTransform:"capitalize"}}>{m}</button>)}
      </div>
      {[
        ...(mode==="register"?[{label:"Email",val:email,set:setE,type:"email"}]:[]),
        {label:"Username",val:username,set:setU,type:"text"},
        {label:"Password",val:password,set:setP,type:"password"},
      ].map(({label,val,set,type})=><div key={label} style={{marginBottom:14}}>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{label}</div>
        <input type={type} value={val} onChange={e=>set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{width:"100%",background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",fontFamily:F.ui}} />
      </div>)}
      {error && <div style={{color:C.red,fontSize:13,marginBottom:14,padding:"8px 12px",background:C.redDim,borderRadius:6}}>{error}</div>}
      <button onClick={submit} style={{width:"100%",background:C.accent,border:"none",borderRadius:10,padding:14,color:C.bg,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}>
        {loading&&<Spinner size={16}/>} {mode==="login"?"Sign In":"Create Account"}
      </button>
      {mode==="login"&&<div style={{marginTop:16,fontSize:12,color:C.dim,textAlign:"center",fontFamily:F.mono}}>
        Demo: <span style={{color:C.accent}}>soleking_96</span> / <span style={{color:C.accent}}>sole1234</span>
      </div>}
    </div>
  </div>;
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────────
function Navbar({ page, setPage, cartCount, user, wsStatus, onLoginClick, onLogout }) {
  const nav = [
    {id:"home",label:"Home"},{id:"marketplace",label:"Marketplace"},
    {id:"trending",label:"Trending"},{id:"community",label:"Community"},{id:"sell",label:"Sell"},
  ];
  return <nav style={{background:"rgba(10,10,10,.96)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,padding:"0 24px"}}>
    <div style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",height:60,gap:24}}>
      <div onClick={()=>setPage("home")} style={{cursor:"pointer",display:"flex",alignItems:"baseline",gap:2}}>
        <span style={{fontFamily:F.display,fontSize:32,color:C.accent,letterSpacing:2,lineHeight:1}}>FLX</span>
        <span style={{width:6,height:6,background:C.accent,borderRadius:"50%",marginBottom:8}}/>
      </div>
      <div style={{display:"flex",flex:1}}>
        {nav.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{background:"none",border:"none",
          color:page===n.id?C.accent:C.muted,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:600,
          letterSpacing:.5,borderBottom:page===n.id?`2px solid ${C.accent}`:"2px solid transparent",transition:"all .15s"}}>{n.label}</button>)}
      </div>
      {/* WS status */}
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontFamily:F.mono,color:C.dim}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:wsStatus==="live"?C.green:wsStatus==="connecting"?C.gold:C.dim}}/>
        {wsStatus==="live"?"LIVE":wsStatus==="connecting"?"...":"OFF"}
      </div>
      <button onClick={()=>setPage("cart")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",color:C.text,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
        🛒{cartCount>0&&<span style={{background:C.accent,color:C.bg,borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{cartCount}</span>}
      </button>
      {user
        ? <button onClick={()=>setPage("profile")} style={{background:C.accentGlow,border:`1px solid ${C.accent}30`,borderRadius:8,padding:"6px 14px",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
            {user.is_verified&&<span style={{color:C.green,fontSize:10}}>✓</span>}
            {user.username}
          </button>
        : <button onClick={onLoginClick} style={{background:C.accent,border:"none",borderRadius:8,padding:"6px 16px",color:C.bg,cursor:"pointer",fontSize:13,fontWeight:700}}>Sign In</button>}
    </div>
  </nav>;
}

// ─── PRODUCT CARD ────────────────────────────────────────────────────────────
function ProductCard({ product, onClick, history }) {
  const up = (product.change24h||0) >= 0;
  const spark = history ? history.slice(-20).map(p=>p.price) : [];
  return <div onClick={()=>onClick(product)} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",cursor:"pointer",transition:"all .2s",position:"relative"}}
    onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${C.accent}40`;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;e.currentTarget.style.transform="translateY(0)";}}>
    {product.trending&&<div style={{position:"absolute",top:10,left:10,zIndex:2}}><Badge variant="accent">🔥 Hot</Badge></div>}
    {product.verified&&<div style={{position:"absolute",top:10,right:10,zIndex:2}}><Badge variant="green">✓</Badge></div>}
    {!product.verified&&<div style={{position:"absolute",top:10,right:10,zIndex:2}}><Badge>{product.ticker}</Badge></div>}
    <div style={{height:200,background:C.bgS,overflow:"hidden"}}>
      <ProductImage src={product.image} ticker={product.ticker} category={product.category} style={{width:"100%",height:200,objectFit:"cover",opacity:.9}}/>
    </div>
    <div style={{padding:"14px 14px 16px"}}>
      <div style={{fontSize:10,color:C.dim,letterSpacing:1,textTransform:"uppercase",marginBottom:3,fontFamily:F.mono}}>{product.brand} · {product.category}</div>
      <div style={{fontSize:14,fontWeight:600,marginBottom:2,lineHeight:1.3,height:38,overflow:"hidden"}}>{product.name}</div>
      {product.sku&&<div style={{fontSize:10,color:C.dim,fontFamily:F.mono,marginBottom:8}}>SKU: {product.sku}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:10,color:C.dim,marginBottom:2,fontFamily:F.mono}}>LOWEST ASK</div>
          <div style={{fontSize:20,fontWeight:700,fontFamily:F.mono}}>{fmtShort(product.ask)}</div>
          <ChangeTag value={product.change24h||0}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          <Sparkline data={spark} up={up}/>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>{product.volume} trades/24h</div>
        </div>
      </div>
    </div>
  </div>;
}

function ProductCardSkeleton() {
  return <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
    <Skeleton h={200} r={0}/>
    <div style={{padding:14,display:"flex",flexDirection:"column",gap:8}}>
      <Skeleton h={10} w="60%"/><Skeleton h={16}/><Skeleton h={10} w="40%"/><Skeleton h={24} w="50%"/>
    </div>
  </div>;
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ products, histories, stats, posts, loading, setPage, setProd }) {
  const trending = products.filter(p=>p.trending);
  const gainers  = [...products].sort((a,b)=>b.change24h-a.change24h).slice(0,5);
  const losers   = [...products].sort((a,b)=>a.change24h-b.change24h).slice(0,3);
  const hotPosts = posts.filter(p=>p.hot).slice(0,3);

  return <div style={{animation:"fadeIn .3s ease"}}>
    {/* Hero */}
    <div style={{background:`linear-gradient(135deg,${C.bgS} 0%,${C.bg} 60%)`,borderBottom:`1px solid ${C.border}`,padding:"60px 24px"}}>
      <div style={{maxWidth:1280,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <LiveDot/><span style={{fontSize:12,color:C.green,fontFamily:F.mono,fontWeight:600}}>LIVE MARKET</span>
          </div>
          <h1 style={{fontFamily:F.display,fontSize:80,lineHeight:.95,marginBottom:16,letterSpacing:2}}>
            BUY.<br/><span style={{color:C.accent}}>SELL.</span><br/>CULTURE.
          </h1>
          <p style={{fontSize:16,color:C.muted,lineHeight:1.6,marginBottom:32,maxWidth:420}}>India's premium resale marketplace. Live bid/ask pricing, real-time market data, community-driven culture.</p>
          <div style={{display:"flex",gap:12}}>
            <button onClick={()=>setPage("marketplace")} style={{background:C.accent,border:"none",borderRadius:8,padding:"14px 32px",color:C.bg,fontSize:15,fontWeight:700,cursor:"pointer"}}>Shop Now</button>
            <button onClick={()=>setPage("sell")} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 32px",color:C.text,fontSize:15,cursor:"pointer"}}>Start Selling</button>
          </div>
        </div>
        {loading ? <Skeleton h={380} r={16}/> : trending[0] && (
          <div onClick={()=>{setProd(trending[0]);setPage("product");}} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer",position:"relative"}}
            onMouseEnter={e=>e.currentTarget.style.border=`1px solid ${C.accent}60`}
            onMouseLeave={e=>e.currentTarget.style.border=`1px solid ${C.border}`}>
            <div style={{position:"absolute",top:16,left:16,zIndex:2,display:"flex",gap:8}}>
              <Badge variant="accent">FEATURED</Badge>
              {trending[0].verified&&<Badge variant="green">✓ AUTH</Badge>}
            </div>
            <ProductImage src={trending[0].image} ticker={trending[0].ticker} category={trending[0].category} style={{width:"100%",height:280,objectFit:"cover",opacity:.85}}/>
            <div style={{padding:20}}>
              <div style={{fontFamily:F.mono,fontSize:10,color:C.dim,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{trending[0].brand} · {trending[0].sku}</div>
              <div style={{fontSize:18,fontWeight:700,marginBottom:12}}>{trending[0].name}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:10,color:C.dim,fontFamily:F.mono}}>LOWEST ASK</div>
                  <div style={{fontSize:24,fontWeight:700,fontFamily:F.mono}}>{fmtShort(trending[0].ask)}</div>
                </div>
                <ChangeTag value={trending[0].change24h||0} size="md"/>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    <div style={{maxWidth:1280,margin:"0 auto",padding:"40px 24px"}}>
      {/* Movers + Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:40}}>
        <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <span>📈</span><span style={{fontWeight:700,fontSize:14,letterSpacing:.5}}>TOP GAINERS</span>
          </div>
          {loading ? [1,2,3,4,5].map(i=><Skeleton key={i} h={40} r={6} style={{marginBottom:8}}/>) :
            gainers.map(p=><div key={p.id} onClick={()=>{setProd(p);setPage("product");}}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.borderL}`,cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <ProductImage src={p.image} ticker={p.ticker} category={p.category} style={{width:36,height:36,borderRadius:6,objectFit:"cover"}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{p.ticker}</div>
                  <div style={{fontSize:11,color:C.muted}}>{p.name.slice(0,28)}…</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,fontFamily:F.mono}}>{fmtShort(p.ask)}</span>
                <ChangeTag value={p.change24h||0}/>
              </div>
            </div>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20,flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <span>📉</span><span style={{fontWeight:700,fontSize:14,letterSpacing:.5}}>BIGGEST DROPS</span>
            </div>
            {loading ? [1,2,3].map(i=><Skeleton key={i} h={40} r={6} style={{marginBottom:8}}/>) :
              losers.map(p=><div key={p.id} onClick={()=>{setProd(p);setPage("product");}}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.borderL}`,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <ProductImage src={p.image} ticker={p.ticker} category={p.category} style={{width:36,height:36,borderRadius:6,objectFit:"cover"}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{p.ticker}</div>
                    <div style={{fontSize:11,color:C.muted}}>{p.name.slice(0,28)}…</div>
                  </div>
                </div>
                <ChangeTag value={p.change24h||0}/>
              </div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              {label:"24h Volume",      value:stats.volume_24h||"—"},
              {label:"Active Listings", value:loading?"…":(stats.active_listings||0).toLocaleString()},
              {label:"Live Bids",       value:loading?"…":(stats.live_bids||0).toLocaleString()},
              {label:"Verified Trades", value:loading?"…":(stats.verified_trades||0).toLocaleString()},
            ].map(s=><div key={s.label} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:C.dim,letterSpacing:1,textTransform:"uppercase",fontFamily:F.mono,marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:C.accent,fontFamily:F.mono}}>{s.value}</div>
            </div>)}
          </div>
        </div>
      </div>

      {/* Trending Grid */}
      <div style={{marginBottom:40}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <h2 style={{fontFamily:F.display,fontSize:28,letterSpacing:2}}>TRENDING NOW</h2>
          <button onClick={()=>setPage("marketplace")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",color:C.muted,cursor:"pointer",fontSize:13}}>View All →</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {loading ? [1,2,3,4].map(i=><ProductCardSkeleton key={i}/>) :
            trending.slice(0,4).map(p=><ProductCard key={p.id} product={p} history={histories[p.id]} onClick={prod=>{setProd(prod);setPage("product");}}/>)}
        </div>
      </div>

      {/* Community Buzz */}
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <h2 style={{fontFamily:F.display,fontSize:28,letterSpacing:2}}>COMMUNITY BUZZ</h2>
          <button onClick={()=>setPage("community")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",color:C.muted,cursor:"pointer",fontSize:13}}>Join →</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {loading ? [1,2,3].map(i=><Skeleton key={i} h={120} r={12}/>) :
            hotPosts.map(p=><div key={p.id} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:18,cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.border=`1px solid ${C.accent}30`}
              onMouseLeave={e=>e.currentTarget.style.border=`1px solid ${C.border}`}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:C.accentGlow,border:`1px solid ${C.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent,fontFamily:F.mono}}>{p.avatar}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                    {p.user} {p.is_verified&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                  </div>
                  <div style={{fontSize:10,color:C.dim,fontFamily:F.mono}}>Rep {p.rep}</div>
                </div>
                <Badge variant="accent">{p.type}</Badge>
              </div>
              <p style={{fontSize:13,fontWeight:600,lineHeight:1.4,marginBottom:10}}>{p.title}</p>
              <div style={{display:"flex",gap:12,fontSize:11,color:C.muted,fontFamily:F.mono}}>
                <span>▲ {p.upvotes}</span><span>💬 {p.comments}</span><span style={{marginLeft:"auto"}}>{p.time}</span>
              </div>
            </div>)}
        </div>
      </div>
    </div>
  </div>;
}

// ─── MARKETPLACE ─────────────────────────────────────────────────────────────
function MarketplacePage({ products, histories, loading, setPage, setProd }) {
  const [cat,    setCat]    = useState("All");
  const [sort,   setSort]   = useState("trending");
  const [search, setSearch] = useState("");
  const cats = ["All","Sneakers","Streetwear","Watches","Fragrances","Accessories","Collectibles"];
  const filtered = [...products]
    .filter(p=>cat==="All"||p.category===cat)
    .filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.ticker.toLowerCase().includes(search.toLowerCase())||p.brand.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>sort==="price-asc"?a.ask-b.ask:sort==="price-desc"?b.ask-a.ask:sort==="gainers"?b.change24h-a.change24h:sort==="volume"?b.volume-a.volume:b.trending-a.trending);
  return <div style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px",animation:"fadeIn .3s ease"}}>
    <div style={{marginBottom:28}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><LiveDot/><span style={{fontSize:12,color:C.green,fontFamily:F.mono}}>LIVE PRICES · Updates every 5s</span></div>
      <h1 style={{fontFamily:F.display,fontSize:42,letterSpacing:2,marginBottom:20}}>MARKETPLACE</h1>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{background:cat===c?C.accent:C.bgCard,border:`1px solid ${cat===c?C.accent:C.border}`,borderRadius:8,padding:"7px 15px",color:cat===c?C.bg:C.muted,cursor:"pointer",fontSize:13,fontWeight:cat===c?700:400,transition:"all .15s"}}>{c}</button>)}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, brand, SKU…"
            style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,fontSize:13,width:220,outline:"none"}}/>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,fontSize:13,outline:"none",cursor:"pointer"}}>
            <option value="trending">🔥 Trending</option>
            <option value="gainers">📈 Top Gainers</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="volume">Most Traded</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
      <div style={{fontSize:13,color:C.muted}}>{filtered.length} products</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
      {loading ? [1,2,3,4,5,6,7,8].map(i=><ProductCardSkeleton key={i}/>) :
        filtered.map(p=><ProductCard key={p.id} product={p} history={histories[p.id]} onClick={prod=>{setProd(prod);setPage("product");}}/>)}
    </div>
  </div>;
}

// ─── PRODUCT DETAIL ───────────────────────────────────────────────────────────
function ProductDetailPage({ product, token, user, onAuth, cart, setCart, wishlistIds, setWishlistIds, showToast }) {
  const [tab,       setTab]       = useState("market");
  const [size,      setSize]      = useState(null);
  const [bidAmt,    setBidAmt]    = useState("");
  const [askPrice,  setAskPrice]  = useState("");
  const [showBid,   setShowBid]   = useState(false);
  const [showAsk,   setShowAsk]   = useState(false);
  const [orderbook, setOrderbook] = useState(null);
  const [history,   setHistory]   = useState(null);
  const [sizes,     setSizes]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const inWL = wishlistIds.includes(product.id);
  const up   = (product.change24h||0) >= 0;

  useEffect(() => {
    if (!product) return;
    setTab("market"); setSize(null); setOrderbook(null); setHistory(null); setSizes(null);
    // Load all three in parallel
    Promise.all([
      apiFetch(`/api/products/${product.id}/orderbook`),
      apiFetch(`/api/products/${product.id}/history`),
      apiFetch(`/api/products/${product.id}/sizes`),
    ]).then(([ob, h, sz]) => { setOrderbook(ob); setHistory(h); setSizes(sz); }).catch(() => {});
  }, [product?.id]);

  const requireAuth = (fn) => {
    if (!token) { showToast("Sign in to continue","error"); onAuth(); return; }
    fn();
  };

  const handleBuy = () => requireAuth(async () => {
    if (!size) { showToast("Select a size first","error"); return; }
    setLoading(true);
    try {
      await apiFetch("/api/products/buy", { method:"POST", headers:authHeaders(token), body:JSON.stringify({ product_id:product.id, size }) });
      setCart(c=>[...c,{...product,selectedSize:size}]);
      showToast(`${product.ticker} (${size}) added to cart ✓`);
    } catch(e) { showToast(e.message,"error"); }
    setLoading(false);
  });

  const handleBid = () => requireAuth(async () => {
    if (!bidAmt) return;
    setLoading(true);
    try {
      await apiFetch("/api/products/bids", { method:"POST", headers:authHeaders(token), body:JSON.stringify({ product_id:product.id, size:size||product.sizes[0], amount:parseInt(bidAmt) }) });
      showToast(`Bid of ₹${parseInt(bidAmt).toLocaleString("en-IN")} placed`);
      // Refresh orderbook
      const ob = await apiFetch(`/api/products/${product.id}/orderbook`);
      setOrderbook(ob);
      setShowBid(false); setBidAmt("");
    } catch(e) { showToast(e.message,"error"); }
    setLoading(false);
  });

  const handleAsk = () => requireAuth(async () => {
    if (!askPrice) return;
    setLoading(true);
    try {
      await apiFetch("/api/products/asks", { method:"POST", headers:authHeaders(token), body:JSON.stringify({ product_id:product.id, size:size||product.sizes[0], price:parseInt(askPrice) }) });
      showToast(`Ask of ₹${parseInt(askPrice).toLocaleString("en-IN")} listed`);
      const ob = await apiFetch(`/api/products/${product.id}/orderbook`);
      setOrderbook(ob);
      setShowAsk(false); setAskPrice("");
    } catch(e) { showToast(e.message,"error"); }
    setLoading(false);
  });

  const toggleWL = () => requireAuth(async () => {
    try {
      if (inWL) {
        await apiFetch(`/api/users/me/wishlist/${product.id}`, { method:"DELETE", headers:authHeaders(token) });
        setWishlistIds(w=>w.filter(id=>id!==product.id));
        showToast("Removed from wishlist");
      } else {
        await apiFetch(`/api/users/me/wishlist/${product.id}`, { method:"POST", headers:authHeaders(token) });
        setWishlistIds(w=>[...w,product.id]);
        showToast("Added to wishlist ♥");
      }
    } catch(e) { showToast(e.message,"error"); }
  });

  const tabs = ["market","overview","reviews","verification"];
  return <div style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px",animation:"fadeIn .3s ease"}}>
    {/* Top: image + buy panel */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,marginBottom:40}}>
      <div>
        <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",position:"relative"}}>
          {product.verified&&<div style={{position:"absolute",top:16,right:16,zIndex:2}}><Badge variant="green">✓ AUTHENTICATED</Badge></div>}
          <ProductImage src={product.image} ticker={product.ticker} category={product.category} style={{width:"100%",height:400,objectFit:"cover"}}/>
        </div>
        {product.release_date&&<div style={{marginTop:12,fontSize:12,color:C.dim,fontFamily:F.mono,textAlign:"center"}}>Release Date: {product.release_date}</div>}
      </div>
      <div>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <Badge>{product.ticker}</Badge>
          <Badge>{product.category}</Badge>
          {product.trending&&<Badge variant="accent">🔥 Trending</Badge>}
          {product.verified&&<Badge variant="green">✓ Verified</Badge>}
          {product.colorway&&<Badge variant="blue">{product.colorway}</Badge>}
        </div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{product.brand}</div>
        <h1 style={{fontSize:26,fontWeight:700,lineHeight:1.2,marginBottom:4}}>{product.name}</h1>
        {product.sku&&<div style={{fontSize:11,color:C.dim,fontFamily:F.mono,marginBottom:20}}>SKU: {product.sku} · {product.condition}</div>}

        {/* Price trio */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16}}>
          {[{label:"Lowest Ask",value:product.ask,hi:true},{label:"Highest Bid",value:product.bid},{label:"Last Sold",value:product.lastSold}].map(({label,value,hi})=><div key={label}>
            <div style={{fontSize:10,color:C.dim,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
            <div style={{fontSize:18,fontWeight:700,fontFamily:F.mono,color:hi?C.accent:C.text}}>{fmtShort(value)}</div>
          </div>)}
        </div>

        {/* Spread */}
        {orderbook&&<div style={{fontSize:12,color:C.muted,fontFamily:F.mono,marginBottom:16}}>Spread: {fmt(orderbook.spread)} · {product.volume} trades today</div>}

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <ChangeTag value={product.change24h||0} size="md"/>
          <LiveDot/>
          <span style={{fontSize:11,color:C.muted,fontFamily:F.mono}}>24h change</span>
        </div>

        {/* Sizes */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:8,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase"}}>Select Size</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {product.sizes.map(s=><button key={s} onClick={()=>setSize(s===size?null:s)} style={{background:size===s?C.accent:C.bgCard,border:`1px solid ${size===s?C.accent:C.border}`,borderRadius:8,padding:"8px 14px",color:size===s?C.bg:C.text,cursor:"pointer",fontSize:13,fontWeight:size===s?700:400,transition:"all .15s",fontFamily:F.mono}}>{s}</button>)}
          </div>
        </div>

        {/* Actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <button onClick={handleBuy} disabled={loading} style={{background:size?C.accent:"transparent",border:size?`none`:`2px solid ${C.accent}`,borderRadius:10,padding:"14px",color:size?C.bg:C.accent,fontSize:15,fontWeight:700,cursor:"pointer",opacity:loading?.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading&&<Spinner size={16}/>}{size?`Buy Now · ${fmtShort(product.ask)}`:"Select Size"}
          </button>
          <button onClick={()=>requireAuth(()=>setShowBid(true))} style={{background:"transparent",border:`2px solid ${C.green}`,borderRadius:10,padding:"14px",color:C.green,fontSize:15,fontWeight:700,cursor:"pointer"}}>Place Bid</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <button onClick={()=>requireAuth(()=>setShowAsk(true))} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px",color:C.text,fontSize:13,cursor:"pointer"}}>Make an Ask</button>
          <button onClick={toggleWL} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px",color:inWL?C.red:C.text,fontSize:13,cursor:"pointer"}}>{inWL?"♥ Wishlisted":"♡ Wishlist"}</button>
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div style={{borderBottom:`1px solid ${C.border}`,marginBottom:32,display:"flex"}}>
      {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",color:tab===t?C.accent:C.muted,padding:"12px 20px",cursor:"pointer",fontSize:13,fontWeight:tab===t?700:400,borderBottom:tab===t?`2px solid ${C.accent}`:"2px solid transparent",textTransform:"capitalize",letterSpacing:.5,transition:"all .15s"}}>{t==="market"?"Market Data":t}</button>)}
    </div>

    {tab==="market"&&<div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:32}}>
      <div>
        {/* Chart */}
        <div style={{marginBottom:32}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700}}>Price History · 90 Days</h3>
            <ChangeTag value={product.change24h||0} size="md"/>
          </div>
          <div style={{height:220,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:12}}>
            {history ? <PriceChart data={history} up={up}/> : <Skeleton h="100%" r={8}/>}
          </div>
        </div>

        {/* Size table */}
        <div>
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:16}}>Size Market</h3>
          <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {!sizes ? <div style={{padding:20}}><Skeleton h={200} r={4}/></div> :
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Size","Lowest Ask","Highest Bid","Last Sold",""].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:10,color:C.dim,letterSpacing:1,textTransform:"uppercase",fontFamily:F.mono,fontWeight:400}}>{h}</th>)}
                </tr></thead>
                <tbody>{sizes.map((row,i)=><tr key={i} onClick={()=>setSize(row.size)} style={{borderBottom:`1px solid ${C.borderL}`,cursor:"pointer",background:size===row.size?C.accentGlow:"transparent"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.bgEl}
                  onMouseLeave={e=>e.currentTarget.style.background=size===row.size?C.accentGlow:"transparent"}>
                  <td style={{padding:"11px 16px",fontSize:13,fontFamily:F.mono,fontWeight:600,color:size===row.size?C.accent:C.text}}>{row.size}</td>
                  <td style={{padding:"11px 16px",fontSize:13,fontFamily:F.mono,color:C.accent}}>{fmtShort(row.ask)}</td>
                  <td style={{padding:"11px 16px",fontSize:13,fontFamily:F.mono}}>{fmtShort(row.bid)}</td>
                  <td style={{padding:"11px 16px",fontSize:13,fontFamily:F.mono}}>{fmtShort(row.lastSold)}</td>
                  <td style={{padding:"11px 16px",fontSize:14}}>{row.trend?<span style={{color:C.green}}>▲</span>:<span style={{color:C.red}}>▼</span>}</td>
                </tr>)}</tbody>
              </table>}
          </div>
        </div>
      </div>

      {/* Order book */}
      <div>
        <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <LiveDot/><span style={{fontSize:13,fontWeight:700}}>Live Order Book</span>
            {orderbook&&<span style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginLeft:"auto"}}>Spread: {fmt(orderbook.spread)}</span>}
          </div>
          {!orderbook ? <Skeleton h={200} r={4}/> : <>
            {/* Asks */}
            <div style={{fontSize:10,color:C.dim,fontFamily:F.mono,letterSpacing:1,marginBottom:6}}>ASKS (SELLERS)</div>
            {orderbook.asks.slice(0,6).map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.borderL}`,fontSize:12}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontFamily:F.mono,color:C.red,fontWeight:600}}>{fmtShort(a.price)}</span>
                <span style={{color:C.dim,fontFamily:F.mono}}>{a.size}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4,color:C.muted}}>
                {a.is_verified&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                <span style={{fontSize:11}}>{a.username}</span>
              </div>
            </div>)}
            {/* Spread bar */}
            <div style={{background:C.bgEl,borderRadius:4,padding:"6px 10px",margin:"8px 0",display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:F.mono}}>
              <span style={{color:C.muted}}>SPREAD</span>
              <span style={{color:C.gold,fontWeight:600}}>{fmt(orderbook.spread)}</span>
            </div>
            {/* Bids */}
            <div style={{fontSize:10,color:C.dim,fontFamily:F.mono,letterSpacing:1,marginBottom:6}}>BIDS (BUYERS)</div>
            {orderbook.bids.slice(0,6).map((b,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.borderL}`,fontSize:12}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontFamily:F.mono,color:C.green,fontWeight:600}}>{fmtShort(b.price)}</span>
                <span style={{color:C.dim,fontFamily:F.mono}}>{b.size}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4,color:C.muted}}>
                {b.is_verified&&<span style={{color:C.green,fontSize:10}}>✓</span>}
                <span style={{fontSize:11}}>{b.username}</span>
              </div>
            </div>)}
          </>}
        </div>

        {/* Recent sales */}
        {orderbook?.recent_sales?.length > 0 && <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>Recent Sales</div>
          {orderbook.recent_sales.map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.borderL}`,fontSize:12,fontFamily:F.mono}}>
            <span style={{color:C.muted}}>{s.size}</span>
            <span style={{color:C.text,fontWeight:600}}>{fmtShort(s.price)}</span>
            <span style={{color:C.dim,fontSize:10}}>{s.created_at?.slice(0,10)}</span>
          </div>)}
        </div>}
      </div>
    </div>}

    {tab==="overview"&&<div style={{maxWidth:700}}>
      <h3 style={{fontSize:18,fontWeight:700,marginBottom:12}}>About This Item</h3>
      <p style={{color:C.muted,lineHeight:1.7,marginBottom:24}}>{product.description||`The ${product.name} is a premium ${product.category.toLowerCase()} piece from ${product.brand}. All items on FLX are verified authentic.`}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {label:"Brand",        value:product.brand},
          {label:"SKU",          value:product.sku||"—"},
          {label:"Colorway",     value:product.colorway||"—"},
          {label:"Condition",    value:product.condition},
          {label:"Release Date", value:product.release_date||"—"},
          {label:"Category",     value:product.category},
          {label:"Market Cap",   value:fmt((product.ask||0)*(product.volume||0))},
          {label:"Auth Status",  value:product.verified?"✓ Authenticated":"Pending"},
        ].map(({label,value})=><div key={label} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:C.dim,fontFamily:F.mono,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
          <div style={{fontSize:14,fontWeight:600,color:label==="Auth Status"&&product.verified?C.green:C.text}}>{value}</div>
        </div>)}
      </div>
    </div>}

    {tab==="verification"&&<div style={{maxWidth:680}}>
      <div style={{background:product.verified?C.greenDim:C.bgCard,border:`1px solid ${product.verified?C.green:C.border}`,borderRadius:16,padding:28,marginBottom:20,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>{product.verified?"✓":"⏳"}</div>
        <h3 style={{fontSize:20,fontWeight:700,marginBottom:8,color:product.verified?C.green:C.text}}>{product.verified?"FLX Verified Authentic":"Verification Pending"}</h3>
        <p style={{color:C.muted,fontSize:14,lineHeight:1.6}}>Every item on FLX undergoes a {product.category==="Watches"?"horological":"multi-point"} authentication process before it can be listed or delivered.</p>
      </div>
      {[
        {step:"1",title:"Listing Review",desc:"Our team reviews the listing, photos, and seller documentation."},
        {step:"2",title:"Physical Inspection",desc:"Item is shipped to our authentication centre in Mumbai."},
        {step:"3",title:`${product.category} Expert Review`,desc:`Verified by category specialists with 10+ years of ${product.category.toLowerCase()} authentication experience.`},
        {step:"4",title:"FLX Authentication Tag",desc:"Authenticated items receive a tamper-evident FLX tag before shipping to buyer."},
      ].map(({step,title,desc})=><div key={step} style={{display:"flex",gap:16,marginBottom:16}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:C.accentGlow,border:`1px solid ${C.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.accent,flexShrink:0}}>{step}</div>
        <div><div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{title}</div><div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>{desc}</div></div>
      </div>)}
    </div>}

    {tab==="reviews"&&<div style={{maxWidth:680}}>
      {[{user:"soleking_96",av:"SK",rating:5,text:"Came in perfect condition, verified super fast. FLX is elite.",time:"3d ago",v:true},
        {user:"streetcurator",av:"SC",rating:4,text:"Great service. Packaging could be better but item is legit.",time:"1w ago",v:true},
        {user:"watchdogg",av:"WD",rating:5,text:"Exactly as described. Will buy again on FLX.",time:"2w ago",v:false}].map((r,i)=><div key={i} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:C.accentGlow,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.accent,fontWeight:700}}>{r.av}</div>
            <span style={{fontSize:13,fontWeight:600}}>{r.user}</span>
            {r.v&&<span style={{color:C.green,fontSize:10}}>✓ Verified Buyer</span>}
          </div>
          <span style={{color:C.gold}}>{"★".repeat(r.rating)}</span>
        </div>
        <p style={{fontSize:14,color:C.muted,lineHeight:1.5}}>{r.text}</p>
      </div>)}
    </div>}

    {/* Modals */}
    {showBid&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:32,width:400,animation:"fadeIn .2s ease"}}>
        <h3 style={{fontSize:18,fontWeight:700,marginBottom:20}}>Place a Bid</h3>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:6,fontFamily:F.mono}}>CURRENT HIGHEST BID</div>
          <div style={{fontSize:20,fontWeight:700,color:C.green,fontFamily:F.mono,marginBottom:16}}>{fmt(product.bid)}</div>
          {size&&<div style={{fontSize:12,color:C.muted,marginBottom:8,fontFamily:F.mono}}>Size: {size}</div>}
          <input type="number" value={bidAmt} onChange={e=>setBidAmt(e.target.value)} placeholder={`Min. ₹${Math.round((product.bid||0)*.9).toLocaleString("en-IN")}`}
            style={{width:"100%",background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",color:C.text,fontSize:15,outline:"none",fontFamily:F.mono}}/>
        </div>
        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>{setShowBid(false);setBidAmt("");}} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"12px",color:C.muted,cursor:"pointer",fontSize:14}}>Cancel</button>
          <button onClick={handleBid} style={{flex:1,background:C.green,border:"none",borderRadius:8,padding:"12px",color:C.bg,cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {loading&&<Spinner size={14}/>}Confirm Bid
          </button>
        </div>
      </div>
    </div>}

    {showAsk&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:32,width:400,animation:"fadeIn .2s ease"}}>
        <h3 style={{fontSize:18,fontWeight:700,marginBottom:20}}>Create an Ask</h3>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:6,fontFamily:F.mono}}>CURRENT LOWEST ASK</div>
          <div style={{fontSize:20,fontWeight:700,color:C.accent,fontFamily:F.mono,marginBottom:16}}>{fmt(product.ask)}</div>
          {size&&<div style={{fontSize:12,color:C.muted,marginBottom:8,fontFamily:F.mono}}>Size: {size}</div>}
          <input type="number" value={askPrice} onChange={e=>setAskPrice(e.target.value)} placeholder="Your ask price"
            style={{width:"100%",background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",color:C.text,fontSize:15,outline:"none",fontFamily:F.mono}}/>
        </div>
        {askPrice&&<div style={{background:C.bgEl,borderRadius:8,padding:12,marginBottom:16,fontSize:13,fontFamily:F.mono}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>Ask</span><span>₹{parseInt(askPrice||0).toLocaleString("en-IN")}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>FLX Fee (9.5%)</span><span style={{color:C.red}}>-₹{Math.round(parseInt(askPrice||0)*.095).toLocaleString("en-IN")}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid ${C.border}`,paddingTop:6,fontWeight:700}}><span>You Receive</span><span style={{color:C.green}}>₹{Math.round(parseInt(askPrice||0)*.875).toLocaleString("en-IN")}</span></div>
        </div>}
        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>{setShowAsk(false);setAskPrice("");}} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"12px",color:C.muted,cursor:"pointer",fontSize:14}}>Cancel</button>
          <button onClick={handleAsk} style={{flex:1,background:C.accent,border:"none",borderRadius:8,padding:"12px",color:C.bg,cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {loading&&<Spinner size={14}/>}List Item
          </button>
        </div>
      </div>
    </div>}
  </div>;
}

// ─── COMMUNITY ────────────────────────────────────────────────────────────────
function CommunityPage({ posts, setPosts, stats, token, showToast, onAuth }) {
  const [board, setBoard] = useState("All");
  const [sort,  setSort]  = useState("hot");
  const [showNew,setShowNew]=useState(false);
  const [title, setTitle] = useState("");
  const [brd,   setBrd]   = useState("Sneakers");
  const [type,  setType]  = useState("Discussion");
  const [loading,setL]    = useState(false);
  const boards = ["All","Sneakers","Streetwear","Watches","Fragrances","Accessories","Collectibles","Market Discussion","Legit Checks","General"];
  const sorted = [...posts]
    .filter(p=>board==="All"||p.board===board)
    .sort((a,b)=>sort==="new"?b.id-a.id:sort==="top"?b.upvotes-a.upvotes:b.hot-a.hot||b.upvotes-a.upvotes);

  const submit = async () => {
    if (!token) { showToast("Sign in to post","error"); onAuth(); return; }
    if (!title.trim()) return;
    setL(true);
    try {
      const data = await apiFetch("/api/community/posts", { method:"POST", headers:authHeaders(token), body:JSON.stringify({ board:brd, type, title }) });
      setPosts(prev=>[data,...prev]);
      setTitle(""); setShowNew(false);
      showToast("Post created ✓");
    } catch(e) { showToast(e.message,"error"); }
    setL(false);
  };

  const upvote = async (postId) => {
    if (!token) { showToast("Sign in to vote","error"); onAuth(); return; }
    try {
      const d = await apiFetch(`/api/community/posts/${postId}/upvote`, { method:"POST", headers:authHeaders(token) });
      setPosts(prev=>prev.map(p=>p.id===postId?{...p,upvotes:d.upvotes}:p));
    } catch(e) {}
  };

  return <div style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px",display:"grid",gridTemplateColumns:"220px 1fr",gap:32,animation:"fadeIn .3s ease"}}>
    <div>
      <h3 style={{fontSize:11,color:C.muted,letterSpacing:1,textTransform:"uppercase",fontFamily:F.mono,marginBottom:12}}>Boards</h3>
      {boards.map(b=><button key={b} onClick={()=>setBoard(b)} style={{display:"block",width:"100%",textAlign:"left",background:board===b?C.accentGlow:"none",border:board===b?`1px solid ${C.accent}30`:"1px solid transparent",borderRadius:8,padding:"9px 12px",color:board===b?C.accent:C.muted,cursor:"pointer",fontSize:13,marginBottom:3,fontWeight:board===b?600:400}}>{b}</button>)}
      <div style={{marginTop:20,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:14}}>
        <h4 style={{fontSize:12,fontWeight:700,marginBottom:10}}>Community Stats</h4>
        {[{label:"Members",value:(stats.members||0).toLocaleString()},{label:"Online Now",value:(stats.online_now||0).toLocaleString()},{label:"Posts Today",value:(stats.posts_today||0).toLocaleString()}].map(s=><div key={s.label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.borderL}`,fontSize:12}}>
          <span style={{color:C.muted}}>{s.label}</span>
          <span style={{fontWeight:700,color:C.accent,fontFamily:F.mono}}>{s.value}</span>
        </div>)}
      </div>
    </div>
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h1 style={{fontFamily:F.display,fontSize:36,letterSpacing:2}}>COMMUNITY</h1>
        <div style={{display:"flex",gap:8}}>
          {["hot","new","top"].map(s=><button key={s} onClick={()=>setSort(s)} style={{background:sort===s?C.accent:C.bgCard,border:`1px solid ${sort===s?C.accent:C.border}`,borderRadius:8,padding:"7px 15px",color:sort===s?C.bg:C.muted,cursor:"pointer",fontSize:13,fontWeight:sort===s?700:400,textTransform:"capitalize"}}>{s}</button>)}
        </div>
      </div>

      {showNew ? <div style={{background:C.bgCard,border:`1px solid ${C.accent}30`,borderRadius:12,padding:20,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <select value={brd} onChange={e=>setBrd(e.target.value)} style={{background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none"}}>
            {boards.filter(b=>b!=="All").map(b=><option key={b}>{b}</option>)}
          </select>
          <select value={type} onChange={e=>setType(e.target.value)} style={{background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none"}}>
            {["Discussion","Pickup","Flex","Review","Legit Check","Fit Check"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title…" style={{width:"100%",background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:14,outline:"none",marginBottom:10}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowNew(false);setTitle("");}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 18px",color:C.muted,cursor:"pointer",fontSize:13}}>Cancel</button>
          <button onClick={submit} style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 22px",color:C.bg,cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
            {loading&&<Spinner size={14}/>}Post
          </button>
        </div>
      </div> : <button onClick={()=>setShowNew(true)} style={{width:"100%",background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:14,color:C.muted,fontSize:13,cursor:"pointer",textAlign:"left",marginBottom:16}}>✏️ Share a pickup, fit check, or market take…</button>}

      {sorted.map(post=><div key={post.id} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:18,marginBottom:10}}>
        <div style={{display:"flex",gap:14}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <button onClick={()=>upvote(post.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.accent}}>▲</button>
            <span style={{fontSize:13,fontWeight:700,fontFamily:F.mono}}>{post.upvotes}</span>
            <button style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.muted}}>▼</button>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:C.accentGlow,border:`1px solid ${C.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.accent,fontWeight:700,fontFamily:F.mono}}>{post.avatar}</div>
              <span style={{fontSize:13,fontWeight:600}}>{post.user}</span>
              {post.is_verified&&<span style={{color:C.green,fontSize:10}}>✓</span>}
              <span style={{fontSize:11,color:C.dim,fontFamily:F.mono}}>Rep {post.rep}</span>
              <Badge variant="accent">{post.type}</Badge>
              <span style={{fontSize:11,color:C.dim}}>{post.board}</span>
              <span style={{fontSize:11,color:C.dim,marginLeft:"auto"}}>{post.time}</span>
            </div>
            <h3 style={{fontSize:15,fontWeight:600,marginBottom:8,lineHeight:1.3}}>{post.title}</h3>
            {post.body&&<p style={{fontSize:13,color:C.muted,lineHeight:1.5,marginBottom:8}}>{post.body}</p>}
            <div style={{display:"flex",gap:14,fontSize:12,color:C.muted,fontFamily:F.mono}}>
              <span>💬 {post.comments}</span><span>🔗 Share</span><span>🚩 Report</span>
            </div>
          </div>
        </div>
      </div>)}
    </div>
  </div>;
}

// ─── TRENDING ─────────────────────────────────────────────────────────────────
function TrendingPage({ products, stats, loading, setPage, setProd }) {
  const gainers  = [...products].sort((a,b)=>b.change24h-a.change24h);
  const losers   = [...products].sort((a,b)=>a.change24h-b.change24h);
  const byVolume = [...products].sort((a,b)=>b.volume-a.volume);
  const avg = products.length ? (products.reduce((s,p)=>s+(p.change24h||0),0)/products.length).toFixed(1) : "0.0";
  return <div style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px",animation:"fadeIn .3s ease"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
      <h1 style={{fontFamily:F.display,fontSize:42,letterSpacing:2}}>MARKET OVERVIEW</h1><LiveDot/>
    </div>
    <p style={{color:C.muted,marginBottom:36,fontSize:14}}>Live market data · Prices update every 5 seconds via WebSocket</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:40}}>
      {[
        {label:"Volume 24h",   value:stats.volume_24h||"—",           up:true},
        {label:"Gainers",      value:gainers.filter(p=>p.change24h>0).length, up:true},
        {label:"Losers",       value:losers.filter(p=>p.change24h<0).length,  up:false},
        {label:"Avg Change",   value:`${parseFloat(avg)>=0?"+":""}${avg}%`,   up:parseFloat(avg)>=0},
        {label:"Live Bids",    value:(stats.live_bids||0).toLocaleString(),    up:true},
      ].map(s=><div key={s.label} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.dim,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{s.label}</div>
        {loading?<Skeleton h={26} w="70%" r={4}/>:<div style={{fontSize:22,fontWeight:700,fontFamily:F.mono,color:s.up?C.green:C.red}}>{s.value}</div>}
      </div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:24}}>
      {[
        {title:"TOP GAINERS",  items:gainers.slice(0,8),   col:C.green,  tag:p=><ChangeTag value={p.change24h}/>},
        {title:"TOP LOSERS",   items:losers.slice(0,8),    col:C.red,    tag:p=><ChangeTag value={p.change24h}/>},
        {title:"MOST TRADED",  items:byVolume.slice(0,8),  col:C.blue,   tag:p=><span style={{fontSize:12,fontFamily:F.mono,color:C.blue}}>{p.volume} trades</span>},
      ].map(({title,items,col,tag})=><div key={title} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontWeight:700,fontSize:12,letterSpacing:1,color:col}}>{title}</span>
        </div>
        {loading?<div style={{padding:16}}><Skeleton h={200} r={4}/></div>:
          items.map((p,i)=><div key={p.id} onClick={()=>{setProd(p);setPage("product");}}
            style={{display:"flex",alignItems:"center",gap:10,padding:"12px 18px",borderBottom:`1px solid ${C.borderL}`,cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.bgEl}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:11,color:C.dim,fontFamily:F.mono,width:18,textAlign:"center"}}>{i+1}</span>
            <ProductImage src={p.image} ticker={p.ticker} category={p.category} style={{width:34,height:34,borderRadius:6,objectFit:"cover"}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,fontFamily:F.mono,color:col}}>{p.ticker}</div>
              <div style={{fontSize:11,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
            </div>
            {tag(p)}
          </div>)}
      </div>)}
    </div>
  </div>;
}

// ─── SELL PAGE ────────────────────────────────────────────────────────────────
function SellPage({ products, token, user, showToast, onAuth, setPage }) {
  const [step,   setStep]   = useState(1);
  const [sel,    setSel]    = useState(null);
  const [price,  setPrice]  = useState("");
  const [size,   setSize]   = useState("");
  const [lid,    setLid]    = useState("");
  const [loading,setLoading]= useState(false);
  const [search, setSearch] = useState("");
  const filtered = products.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.ticker.toLowerCase().includes(search.toLowerCase()));

  const handleList = async () => {
    if (!token) { showToast("Sign in to sell","error"); onAuth(); return; }
    if (!size||!price) { showToast("Select size and enter price","error"); return; }
    setLoading(true);
    try {
      const data = await apiFetch("/api/products/sell", { method:"POST", headers:authHeaders(token), body:JSON.stringify({ product_id:sel.id, size, price:parseInt(price) }) });
      setLid(data.listing_id); setStep(3);
      showToast("Listing live on FLX ✓");
    } catch(e) { showToast(e.message,"error"); }
    setLoading(false);
  };

  return <div style={{maxWidth:800,margin:"0 auto",padding:"40px 24px",animation:"fadeIn .3s ease"}}>
    <h1 style={{fontFamily:F.display,fontSize:42,letterSpacing:2,marginBottom:6}}>SELL ON FLX</h1>
    <p style={{color:C.muted,marginBottom:36,fontSize:14}}>List in minutes. Get paid when it sells. 9.5% FLX fee.</p>

    {/* Stepper */}
    <div style={{display:"flex",gap:0,marginBottom:40}}>
      {["Find Item","Set Price","Ship & Get Paid"].map((s,i)=><div key={s} style={{display:"flex",alignItems:"center",flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:step>i+1?C.green:step===i+1?C.accent:C.bgCard,border:`2px solid ${step>=i+1?(step>i+1?C.green:C.accent):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:step>=i+1?C.bg:C.muted}}>
            {step>i+1?"✓":i+1}
          </div>
          <span style={{fontSize:13,color:step===i+1?C.text:C.muted,fontWeight:step===i+1?600:400}}>{s}</span>
        </div>
        {i<2&&<div style={{flex:1,height:1,background:step>i+1?C.green:C.border,margin:"0 10px"}}/>}
      </div>)}
    </div>

    {step===1&&<div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, brand, or SKU…"
        style={{width:"100%",background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",color:C.text,fontSize:14,outline:"none",marginBottom:20}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {filtered.slice(0,9).map(p=><div key={p.id} onClick={()=>{setSel(p);setStep(2);}}
          style={{background:C.bgCard,border:`2px solid ${sel?.id===p.id?C.accent:C.border}`,borderRadius:12,padding:14,cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.border=`2px solid ${C.accent}50`}
          onMouseLeave={e=>e.currentTarget.style.border=`2px solid ${sel?.id===p.id?C.accent:C.border}`}>
          <ProductImage src={p.image} ticker={p.ticker} category={p.category} style={{width:"100%",height:90,objectFit:"cover",borderRadius:8,marginBottom:8}}/>
          <div style={{fontSize:10,fontWeight:700,fontFamily:F.mono,color:C.accent,marginBottom:2}}>{p.ticker}</div>
          <div style={{fontSize:12,lineHeight:1.3}}>{p.name}</div>
          {p.sku&&<div style={{fontSize:10,color:C.dim,fontFamily:F.mono,marginTop:2}}>SKU: {p.sku}</div>}
        </div>)}
      </div>
    </div>}

    {step===2&&sel&&<div>
      <div style={{display:"flex",gap:20,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:18,marginBottom:20}}>
        <ProductImage src={sel.image} ticker={sel.ticker} category={sel.category} style={{width:72,height:72,borderRadius:8,objectFit:"cover"}}/>
        <div>
          <div style={{fontSize:10,color:C.accent,fontFamily:F.mono,fontWeight:700}}>{sel.ticker} · {sel.sku}</div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{sel.name}</div>
          <div style={{display:"flex",gap:14,fontSize:12,color:C.muted,fontFamily:F.mono}}>
            <span>Ask: {fmtShort(sel.ask)}</span><span>Bid: {fmtShort(sel.bid)}</span><span>Last: {fmtShort(sel.lastSold)}</span>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:20}}>
        <div>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase"}}>Size</label>
          <select value={size} onChange={e=>setSize(e.target.value)} style={{width:"100%",background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:14,outline:"none"}}>
            <option value="">Select size</option>
            {sel.sizes.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6,fontFamily:F.mono,letterSpacing:1,textTransform:"uppercase"}}>Your Ask Price (₹)</label>
          <input type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder={sel.ask?.toString()}
            style={{width:"100%",background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:14,outline:"none"}}/>
        </div>
      </div>
      {price&&<div style={{background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:20,fontFamily:F.mono,fontSize:13}}>
        <h4 style={{fontWeight:700,marginBottom:10}}>Payout Estimate</h4>
        {[
          {label:"Your Ask",               value:`₹${parseInt(price).toLocaleString("en-IN")}`,                               col:C.text},
          {label:"FLX Fee (9.5%)",          value:`-₹${Math.round(parseInt(price)*.095).toLocaleString("en-IN")}`,             col:C.red},
          {label:"Payment Processing (3%)", value:`-₹${Math.round(parseInt(price)*.03).toLocaleString("en-IN")}`,              col:C.red},
          {label:"You Receive",             value:`₹${Math.round(parseInt(price)*.875).toLocaleString("en-IN")}`,              col:C.green, bold:true},
        ].map(r=><div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:r.bold?"none":`1px solid ${C.borderL}`,fontWeight:r.bold?700:400}}>
          <span style={{color:C.muted}}>{r.label}</span><span style={{color:r.col}}>{r.value}</span>
        </div>)}
      </div>}
      <div style={{display:"flex",gap:12}}>
        <button onClick={()=>setStep(1)} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:13,color:C.muted,cursor:"pointer",fontSize:14}}>← Back</button>
        <button onClick={handleList} style={{flex:2,background:C.accent,border:"none",borderRadius:10,padding:13,color:C.bg,fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading&&<Spinner size={16}/>}List Item →
        </button>
      </div>
    </div>}

    {step===3&&<div style={{textAlign:"center",padding:"60px 20px"}}>
      <div style={{fontSize:64,marginBottom:20}}>🎉</div>
      <h2 style={{fontFamily:F.display,fontSize:36,letterSpacing:2,marginBottom:12,color:C.accent}}>LISTING LIVE!</h2>
      <p style={{color:C.muted,marginBottom:32,fontSize:15,lineHeight:1.6}}>Your item is now live on FLX. You'll be notified when it sells.</p>
      <div style={{background:C.bgCard,border:`1px solid ${C.accent}30`,borderRadius:12,padding:24,maxWidth:300,margin:"0 auto 24px"}}>
        <div style={{fontSize:11,color:C.dim,fontFamily:F.mono,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Listing ID</div>
        <div style={{fontSize:18,fontFamily:F.mono,fontWeight:700,color:C.accent}}>#{lid}</div>
      </div>
      <button onClick={()=>{setStep(1);setSel(null);setPrice("");setSize("");}} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 24px",color:C.text,cursor:"pointer",fontSize:14}}>List Another Item</button>
    </div>}
  </div>;
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
function ProfilePage({ user, token, wishlistIds, products, showToast, onLogout }) {
  const [tab,  setTab]  = useState("wishlist");
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);
  const [orders,setOrders]=useState([]);
  const [loading,setL]  = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch("/api/users/me/bids",    { headers:authHeaders(token) }),
      apiFetch("/api/users/me/asks",    { headers:authHeaders(token) }),
      apiFetch("/api/users/me/orders",  { headers:authHeaders(token) }),
      apiFetch("/api/users/me/wishlist",{ headers:authHeaders(token) }),
    ]).then(([b,a,o]) => { setBids(b); setAsks(a); setOrders(o); }).catch(()=>{}).finally(()=>setL(false));
  }, [token]);

  const wishlisted = products.filter(p=>wishlistIds.includes(p.id));

  const cancelBid = async (id) => {
    try {
      await apiFetch(`/api/users/me/bids/${id}`, { method:"DELETE", headers:authHeaders(token) });
      setBids(b=>b.filter(x=>x.id!==id)); showToast("Bid cancelled");
    } catch(e) { showToast(e.message,"error"); }
  };

  const cancelAsk = async (id) => {
    try {
      await apiFetch(`/api/users/me/asks/${id}`, { method:"DELETE", headers:authHeaders(token) });
      setAsks(a=>a.filter(x=>x.id!==id)); showToast("Listing removed");
    } catch(e) { showToast(e.message,"error"); }
  };

  if (!user) return <div style={{textAlign:"center",padding:"100px 20px",color:C.muted}}>
    <div style={{fontSize:48,marginBottom:16}}>🔒</div>
    <div style={{fontSize:18,marginBottom:8}}>Sign in to view your profile</div>
  </div>;

  return <div style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px",animation:"fadeIn .3s ease"}}>
    {/* Header */}
    <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:28,marginBottom:28,display:"flex",alignItems:"center",gap:28}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:C.accentGlow,border:`2px solid ${C.accent}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,fontFamily:F.mono,color:C.accent}}>{user.avatar||user.username?.slice(0,2).toUpperCase()}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <h2 style={{fontSize:22,fontWeight:700}}>{user.username}</h2>
          {user.is_verified&&<Badge variant="green">✓ Verified</Badge>}
        </div>
        <p style={{color:C.muted,fontSize:13,marginBottom:10}}>Member of FLX marketplace</p>
        <div style={{display:"flex",gap:8}}>
          <Badge variant="accent">⭐ Collector</Badge>
          <Badge variant="blue">FLX Member</Badge>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[{label:"Bids",value:bids.length},{label:"Listings",value:asks.length},{label:"Orders",value:orders.length},{label:"Wishlist",value:wishlistIds.length}].map(s=><div key={s.label} style={{background:C.bgEl,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:700,fontFamily:F.mono,color:C.accent}}>{s.value}</div>
          <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",letterSpacing:.5,fontFamily:F.mono}}>{s.label}</div>
        </div>)}
      </div>
      <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",color:C.muted,cursor:"pointer",fontSize:13}}>Sign Out</button>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:24}}>
      {["wishlist","bids","listings","orders"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",color:tab===t?C.accent:C.muted,padding:"11px 18px",cursor:"pointer",fontSize:13,fontWeight:tab===t?700:400,borderBottom:tab===t?`2px solid ${C.accent}`:"2px solid transparent",textTransform:"capitalize",letterSpacing:.5}}>{t}</button>)}
    </div>

    {tab==="wishlist"&&(wishlisted.length===0
      ? <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>♡</div><div>No items in wishlist yet</div></div>
      : <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {wishlisted.map(p=><div key={p.id} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <ProductImage src={p.image} ticker={p.ticker} category={p.category} style={{width:"100%",height:150,objectFit:"cover"}}/>
            <div style={{padding:12}}>
              <div style={{fontSize:10,color:C.accent,fontFamily:F.mono,fontWeight:700,marginBottom:2}}>{p.ticker}</div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{p.name}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:15,fontWeight:700,fontFamily:F.mono}}>{fmtShort(p.ask)}</span>
                <ChangeTag value={p.change24h||0}/>
              </div>
            </div>
          </div>)}
        </div>)}

    {tab==="bids"&&(loading?<Skeleton h={200} r={8}/>:bids.length===0
      ? <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>No active bids</div></div>
      : <div>{bids.map(b=><div key={b.id} style={{display:"flex",alignItems:"center",gap:16,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:C.accent,fontFamily:F.mono,fontWeight:700}}>{b.ticker}</div>
            <div style={{fontSize:14,fontWeight:600}}>{b.name}</div>
            <div style={{fontSize:12,color:C.muted,fontFamily:F.mono}}>Size: {b.size}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:700,fontFamily:F.mono,color:C.green}}>{fmt(b.amount)}</div>
            <div style={{fontSize:11,color:C.muted,fontFamily:F.mono}}>{b.status}</div>
          </div>
          <button onClick={()=>cancelBid(b.id)} style={{background:"transparent",border:`1px solid ${C.red}`,borderRadius:8,padding:"6px 12px",color:C.red,cursor:"pointer",fontSize:12}}>Cancel</button>
        </div>)}</div>)}

    {tab==="listings"&&(loading?<Skeleton h={200} r={8}/>:asks.length===0
      ? <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>🏷️</div><div>No active listings</div></div>
      : <div>{asks.map(a=><div key={a.id} style={{display:"flex",alignItems:"center",gap:16,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:C.accent,fontFamily:F.mono,fontWeight:700}}>{a.ticker}</div>
            <div style={{fontSize:14,fontWeight:600}}>{a.name}</div>
            <div style={{fontSize:12,color:C.muted,fontFamily:F.mono}}>Size: {a.size}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:700,fontFamily:F.mono,color:C.accent}}>{fmt(a.price)}</div>
            <div style={{fontSize:11,color:C.muted,fontFamily:F.mono}}>{a.status}</div>
          </div>
          <button onClick={()=>cancelAsk(a.id)} style={{background:"transparent",border:`1px solid ${C.red}`,borderRadius:8,padding:"6px 12px",color:C.red,cursor:"pointer",fontSize:12}}>Delist</button>
        </div>)}</div>)}

    {tab==="orders"&&(loading?<Skeleton h={200} r={8}/>:orders.length===0
      ? <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>📦</div><div>No orders yet</div></div>
      : <div>{orders.map(o=><div key={o.id} style={{display:"flex",alignItems:"center",gap:16,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:C.accent,fontFamily:F.mono,fontWeight:700}}>{o.ticker} · {o.size}</div>
            <div style={{fontSize:14,fontWeight:600}}>{o.name}</div>
            <div style={{fontSize:12,color:C.muted,fontFamily:F.mono}}>#{o.listing_id}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:700,fontFamily:F.mono}}>{fmt(o.price)}</div>
            <Badge variant={o.status==="delivered"?"green":o.status==="shipped"?"blue":"default"}>{o.status}</Badge>
          </div>
        </div>)}</div>)}
  </div>;
}

// ─── CART ─────────────────────────────────────────────────────────────────────
function CartPage({ cart, setCart, setPage, token, showToast }) {
  const subtotal = cart.reduce((s,i)=>s+(i.ask||0),0);
  const fee      = Math.round(subtotal*.095);
  const shipping = cart.length>0?299:0;
  const total    = subtotal+fee+shipping;
  return <div style={{maxWidth:900,margin:"0 auto",padding:"40px 24px",animation:"fadeIn .3s ease"}}>
    <h1 style={{fontFamily:F.display,fontSize:42,letterSpacing:2,marginBottom:28}}>YOUR CART</h1>
    {cart.length===0
      ? <div style={{textAlign:"center",padding:"80px 20px",color:C.muted}}>
          <div style={{fontSize:48,marginBottom:12}}>🛒</div>
          <div style={{fontSize:18,marginBottom:20}}>Your cart is empty</div>
          <button onClick={()=>setPage("marketplace")} style={{background:C.accent,border:"none",borderRadius:8,padding:"11px 26px",color:C.bg,fontSize:14,fontWeight:700,cursor:"pointer"}}>Shop Marketplace</button>
        </div>
      : <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:28}}>
          <div>
            {cart.map((item,i)=><div key={i} style={{display:"flex",gap:18,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:18,marginBottom:10}}>
              <ProductImage src={item.image} ticker={item.ticker} category={item.category} style={{width:80,height:80,borderRadius:8,objectFit:"cover"}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.accent,fontFamily:F.mono,fontWeight:700,marginBottom:2}}>{item.ticker}</div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{item.name}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Size: {item.selectedSize} · {item.condition||"New"}</div>
                <Badge variant="green">✓ Verified Authentic</Badge>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"space-between"}}>
                <div style={{fontSize:20,fontWeight:700,fontFamily:F.mono}}>{fmtShort(item.ask)}</div>
                <button onClick={()=>setCart(c=>c.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>Remove</button>
              </div>
            </div>)}
          </div>
          <div>
            <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:22,position:"sticky",top:80}}>
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:18}}>Order Summary</h3>
              {[{label:"Subtotal",value:fmt(subtotal)},{label:"Buyer Protection (9.5%)",value:fmt(fee)},{label:"Shipping & Verification",value:`₹${shipping}`}].map(r=><div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.borderL}`,fontSize:13}}>
                <span style={{color:C.muted}}>{r.label}</span><span style={{fontFamily:F.mono}}>{r.value}</span>
              </div>)}
              <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",fontSize:16,fontWeight:700}}>
                <span>Total</span><span style={{fontFamily:F.mono,color:C.accent}}>{fmt(total)}</span>
              </div>
              <button onClick={()=>{if(!token){showToast("Sign in to checkout","error");return;}showToast("Checkout coming soon");}} style={{width:"100%",background:C.accent,border:"none",borderRadius:10,padding:14,color:C.bg,fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:10}}>Proceed to Checkout</button>
              <div style={{fontSize:11,color:C.dim,textAlign:"center",lineHeight:1.5}}>🔒 Secure checkout · All items verified before shipping</div>
            </div>
          </div>
        </div>}
  </div>;
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function FLX() {
  const [page,    setPage]    = useState("home");
  const [prod,    setProd]    = useState(null);
  const [cart,    setCart]    = useState([]);
  const [toast,   setToast]   = useState(null);
  const [showAuth,setShowAuth]= useState(false);

  // ── Auth state (from localStorage) ─────────────────────────────────────────
  const [token, setToken] = useState("");
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("flx_user") || "null"); } catch { return null; }
  });

  // ── Data state — starts empty, backend fills ────────────────────────────────
  const [products,     setProducts]     = useState([]);
  const [histories,    setHistories]    = useState({});
  const [ticker,       setTicker]       = useState([]);
  const [marketStats,  setMarketStats]  = useState({});
  const [communityPosts,setCommunityPosts]= useState([]);
  const [communityStats,setCommunityStats]= useState({});
  const [wishlistIds,  setWishlistIds]  = useState([]);
  const [loadingProds, setLoadingProds] = useState(true);
  const [wsStatus,     setWsStatus]     = useState("connecting");

  const showToast = useCallback((msg, type="success") => setToast({msg,type}), []);

  const handleAuth = useCallback((u) => { setUser(u); setToken(localStorage.getItem("flx_token")||""); }, []);
  const handleLogout = useCallback(() => {
    localStorage.removeItem("flx_token"); localStorage.removeItem("flx_user");
    setUser(null); setToken(""); setWishlistIds([]); showToast("Signed out");
  }, []);

  // ── 1. Load products on mount ───────────────────────────────────────────────
  useEffect(() => {
    setLoadingProds(true);
    apiFetch("/api/products/")
      .then(data => setProducts(data))
      .catch(() => showToast("Could not reach backend","error"))
      .finally(() => setLoadingProds(false));
    // Load ticker + stats + community in parallel
    apiFetch("/api/products/ticker/recent").then(setTicker).catch(()=>{});
    apiFetch("/api/products/stats/market").then(setMarketStats).catch(()=>{});
    apiFetch("/api/community/posts?sort=hot&limit=30").then(setCommunityPosts).catch(()=>{});
    apiFetch("/api/community/stats").then(setCommunityStats).catch(()=>{});
  }, []);

  // ── 2. Load wishlist when user logs in ─────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    apiFetch("/api/users/me/wishlist", { headers:authHeaders(token) })
      .then(data => setWishlistIds(data.map(p=>p.id)))
      .catch(()=>{});
  }, [token]);

  // ── 3. Load price history for each product ──────────────────────────────────
  useEffect(() => {
    if (!products.length) return;
    products.forEach(p => {
      if (histories[p.id]) return;
      apiFetch(`/api/products/${p.id}/history`).then(h => setHistories(prev=>({...prev,[p.id]:h}))).catch(()=>{});
    });
  }, [products]);

  // ── 4. WebSocket for live prices ────────────────────────────────────────────
  useEffect(() => {
    const wsUrl = API.replace(/^http/, "ws") + "/ws/live";
    let ws;
    const connect = () => {
      setWsStatus("connecting");
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsStatus("live");
      ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if (msg.type === "ping") return;
        if (msg.type === "price_tick" || msg.type === "snapshot") {
          const data = msg.data;
          setProducts(prev => prev.map(p => {
            const tick = data[String(p.id)];
            if (!tick) return p;
            return { ...p, ask:tick.ask, bid:tick.bid, lastSold:tick.lastSold, change24h:tick.change24h, volume:tick.volume };
          }));
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => { setWsStatus("off"); setTimeout(connect, 4000); };
    };
    connect();
    return () => ws?.close();
  }, []);

  // Find current product with live-updated prices
  const currentProd = prod ? (products.find(p=>p.id===prod.id) || prod) : null;

  return <>
    <style>{GS}</style>
    {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onAuth={handleAuth}/>}
    {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F.ui}}>
      <Navbar page={page} setPage={setPage} cartCount={cart.length} user={user} wsStatus={wsStatus}
        onLoginClick={()=>setShowAuth(true)} onLogout={handleLogout}/>
      <Ticker sales={ticker}/>
      <main>
        {page==="home"        && <HomePage products={products} histories={histories} stats={marketStats} posts={communityPosts} loading={loadingProds} setPage={setPage} setProd={setProd}/>}
        {page==="marketplace" && <MarketplacePage products={products} histories={histories} loading={loadingProds} setPage={setPage} setProd={setProd}/>}
        {page==="product"     && currentProd && <ProductDetailPage product={currentProd} token={token} user={user} onAuth={()=>setShowAuth(true)} cart={cart} setCart={setCart} wishlistIds={wishlistIds} setWishlistIds={setWishlistIds} showToast={showToast}/>}
        {page==="trending"    && <TrendingPage products={products} stats={marketStats} loading={loadingProds} setPage={setPage} setProd={setProd}/>}
        {page==="community"   && <CommunityPage posts={communityPosts} setPosts={setCommunityPosts} stats={communityStats} token={token} showToast={showToast} onAuth={()=>setShowAuth(true)}/>}
        {page==="sell"        && <SellPage products={products} token={token} user={user} showToast={showToast} onAuth={()=>setShowAuth(true)} setPage={setPage}/>}
        {page==="profile"     && <ProfilePage user={user} token={token} wishlistIds={wishlistIds} products={products} showToast={showToast} onLogout={handleLogout}/>}
        {page==="cart"        && <CartPage cart={cart} setCart={setCart} setPage={setPage} token={token} showToast={showToast}/>}
      </main>
      <footer style={{background:C.bgS,borderTop:`1px solid ${C.border}`,padding:"36px 24px",marginTop:80}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:40}}>
          <div>
            <div style={{fontFamily:F.display,fontSize:28,color:C.accent,letterSpacing:2,marginBottom:10}}>FLX</div>
            <p style={{color:C.muted,fontSize:13,lineHeight:1.6,maxWidth:260}}>India's premium resale marketplace. Buy and sell with live market pricing and full authentication guarantee.</p>
          </div>
          {[{title:"Marketplace",links:["Sneakers","Streetwear","Watches","Fragrances","Collectibles"]},
            {title:"Selling",    links:["Start Selling","Seller Guide","Pricing Tools","Payouts"]},
            {title:"Company",   links:["About FLX","Community","Blog","Support"]}].map(col=><div key={col.title}>
            <h4 style={{fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:C.muted,marginBottom:14,fontFamily:F.mono}}>{col.title}</h4>
            {col.links.map(l=><div key={l} style={{fontSize:13,color:C.dim,marginBottom:8,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.color=C.text} onMouseLeave={e=>e.currentTarget.style.color=C.dim}>{l}</div>)}
          </div>)}
        </div>
        <div style={{maxWidth:1280,margin:"28px auto 0",paddingTop:18,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:C.dim}}>
          <span>© 2026 FLX Marketplace. All rights reserved.</span>
          <span style={{fontFamily:F.mono}}>Backend: {API} · {wsStatus==="live"?"🟢 Live":"🔴 Offline"}</span>
        </div>
      </footer>
    </div>
  </>;
}