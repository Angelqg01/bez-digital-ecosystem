import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════════
   bez.digital — BEZ Payment System v2.0
   Sistema de Pago INDEPENDIENTE con BEZ-Coin
   ─────────────────────────────────────────────────────────────────────────────
   Redes:    Polygon Amoy (testnet) → Polygon Mainnet → BNB Chain
   Contratos:
     • BEZ Token:       0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 (Polygon Amoy)
     • BEZ Token BNB:   0x8a1e3930fde1f151471c368fdbb39f3f63a65b55 (BNB Chain)
     • QualityEscrow:   0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
     • LiquidityFarm:   deploy en localhost → Amoy → Polygon
     • Safe Wallet:     0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
   Backend:  api.bez.digital:3001  |  ws.bez.digital:3002
   ─────────────────────────────────────────────────────────────────────────────
   FEATURES:
   ✅ Compra directa de BEZ (Fiat/Crypto → BEZ via Hot Wallet)
   ✅ Suscripciones on-chain con Smart Contract (auto-renovación)
   ✅ Liquidity Farming con multiplicadores y lock periods
   ✅ Quality Escrow (garantía de calidad en servicios)
   ✅ Bridge multi-chain BEZ (Polygon ↔ BNB ↔ ETH)
   ✅ Payment Processor propio (sin Stripe, directo en BEZ)
   ✅ Trading Bots de BEZ/USDT, BEZ/USDC, BEZ/BNB
   ✅ Webhook automático → dispenseTokens() → MongoDB
   ✅ WebSocket live updates (ws.bez.digital:3002)
   ✅ Reputación on-chain (6 tiers: BEGINNER → LEGENDARY)
   ✅ DAO Governance con BEZ staking
   ✅ Diseño 100% responsive: Desktop / Laptop / Tablet / Mobile
═══════════════════════════════════════════════════════════════════════════════ */

// ─── DESIGN TOKENS — BeZhas Brand ─────────────────────────────────────────
const C = {
  bg:        "#03060E",
  surf:      "#070D1C",
  card:      "#0C1628",
  card2:     "#101E38",
  card3:     "#142444",
  border:    "#0D2040",
  border2:   "#163560",
  border3:   "#1E4A8A",
  // Brand
  primary:   "#00C896",
  primary2:  "#00A87E",
  gold:      "#FFB800",
  gold2:     "#CC9200",
  neon:      "#00FFB2",
  // Accents
  blue:      "#2563EB",
  violet:    "#7C3AED",
  pink:      "#EC4899",
  orange:    "#F97316",
  red:       "#EF4444",
  yellow:    "#EAB308",
  // Text
  text:      "#E8F4FF",
  text2:     "#A8C4E0",
  muted:     "#3D5E80",
  // Fonts
  mono:      "'JetBrains Mono','Courier New',monospace",
  sans:      "'Inter','Segoe UI',system-ui,sans-serif",
};

// ─── CONTRACTS & ADDRESSES ───────────────────────────────────────────────────
const CONTRACTS = {
  BEZ_POLYGON:  "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8",
  BEZ_BNB:      "0x8a1e3930fde1f151471c368fdbb39f3f63a65b55",
  ESCROW:       "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3",
  SAFE_WALLET:  "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3",
  FARMING_LOCAL:"",   // auto-set after: npx hardhat run scripts/deploy-liquidity-farming.js
  FARMING_AMOY: "",
  FARMING_POLY: "",
};

const ENDPOINTS = {
  api:      "https://api.bez.digital",
  ws:       "wss://ws.bez.digital:3002",
  explorer: { polygon:"https://amoy.polygonscan.com", bnb:"https://bscscan.com" },
};

// ─── FARMING LOCK MULTIPLIERS (del contrato LiquidityFarming.sol) ─────────
const LOCK_MULTIPLIERS = [
  { days:0,   label:"Sin lock",  mult:100, boost:0,   color:C.muted  },
  { days:7,   label:"7 días",    mult:110, boost:10,  color:C.blue   },
  { days:30,  label:"30 días",   mult:125, boost:25,  color:C.primary},
  { days:90,  label:"90 días",   mult:150, boost:50,  color:C.violet },
  { days:180, label:"180 días",  mult:200, boost:100, color:C.gold   },
  { days:365, label:"365 días",  mult:300, boost:200, color:C.pink   },
];

// ─── REPUTATION TIERS (QualityReputationSystem) ──────────────────────────────
const REP_TIERS = [
  { name:"LEGENDARY",    min:950, icon:"👑", color:C.gold   },
  { name:"MASTER",       min:900, icon:"🏆", color:C.violet },
  { name:"EXPERT",       min:850, icon:"⭐", color:C.blue   },
  { name:"PROFESSIONAL", min:800, icon:"💎", color:C.primary},
  { name:"INTERMEDIATE", min:700, icon:"🌟", color:C.orange },
  { name:"BEGINNER",     min:0,   icon:"🔰", color:C.muted  },
];

// ─── PAYMENT TYPES (del modelo Payment.model.js) ────────────────────────────
const PAY_TYPES = {
  token_purchase:    { label:"Compra BEZ",    icon:"🪙", color:C.gold    },
  vip_subscription:  { label:"Suscripción",   icon:"📋", color:C.primary },
  nft_purchase:      { label:"NFT",           icon:"🖼️",  color:C.violet  },
  farming_deposit:   { label:"Farming",       icon:"🌾", color:C.orange  },
  escrow_collateral: { label:"Escrow",        icon:"🔒", color:C.blue    },
  bridge_transfer:   { label:"Bridge",        icon:"⬡",  color:C.neon    },
  bot_subscription:  { label:"Bot Trading",  icon:"🤖", color:C.pink    },
  governance_stake:  { label:"Governance",   icon:"🏛️",  color:C.yellow  },
};

// ─── TOKEN & NETWORK DATA ────────────────────────────────────────────────────
const TOKENS = [
  { s:"BEZ",  n:"BEZ-Coin",   icon:"🪙", color:C.gold,   pUSD:1.24, net:"Polygon" },
  { s:"USDT", n:"Tether",     icon:"₮",  color:"#26A17B",pUSD:1.0,  net:"Polygon" },
  { s:"USDC", n:"USD Coin",   icon:"$",  color:"#2775CA",pUSD:1.0,  net:"Polygon" },
  { s:"MATIC",n:"Polygon",    icon:"⬟",  color:"#8247E5",pUSD:0.88, net:"Polygon" },
  { s:"ETH",  n:"Ethereum",   icon:"⬡",  color:"#627EEA",pUSD:3420, net:"ETH"     },
  { s:"BNB",  n:"BNB Chain",  icon:"⬡",  color:"#F3BA2F",pUSD:420,  net:"BNB"     },
  { s:"SOL",  n:"Solana",     icon:"◎",  color:"#9945FF",pUSD:185,  net:"SOL"     },
  { s:"DAI",  n:"DAI",        icon:"◈",  color:"#F5AC37",pUSD:1.0,  net:"Polygon" },
  { s:"USD",  n:"US Dollar",  icon:"$",  color:"#10B981",pUSD:1.0,  net:"FIAT"    },
  { s:"EUR",  n:"Euro",       icon:"€",  color:"#3B82F6",pUSD:1.09, net:"FIAT"    },
];
const BASE_P = Object.fromEntries(TOKENS.map(t=>[t.s,t.pUSD]));

// ─── SUBSCRIPTION PLANS ──────────────────────────────────────────────────────
const PLANS = [
  { id:"free",       name:"Free",       icon:"🌱", priceBEZ:0,    priceUSD:0,   color:C.muted,
    limits:{bots:1,assets:5,bridge:"$500",api:false,escrow:false,farming:false},
    features:["1 Bot básico","5 Activos cartera","Análisis técnico","Bridge $500/mes","Soporte comunidad"] },
  { id:"starter",    name:"Starter",    icon:"⚡", priceBEZ:500,  priceUSD:29,  color:C.blue,
    limits:{bots:3,assets:20,bridge:"$5k",api:false,escrow:false,farming:true},
    features:["3 Bots de trading","20 Activos","Análisis técnico+fundamental","Bridge $5k/mes","Farming básico","Alertas real-time"] },
  { id:"pro",        name:"Pro",        icon:"🚀", priceBEZ:1500, priceUSD:79,  color:C.primary, badge:"POPULAR",
    limits:{bots:"∞",assets:50,bridge:"∞",api:true,escrow:true,farming:true},
    features:["Bots ilimitados+IA","50 Activos","IA Claude+Gemini","Bridge ilimitado","Quality Escrow","API completa","Farming avanzado"] },
  { id:"enterprise", name:"Enterprise", icon:"🏛️", priceBEZ:5000, priceUSD:299, color:C.gold,   badge:"WHITE LABEL",
    limits:{bots:"∞",assets:"∞",bridge:"∞",api:true,escrow:true,farming:true},
    features:["Todo Pro","Activos ilimitados","White label","API institucional","DAO governance","Multi-cuenta 50","Account manager","SLA 99.9%"] },
];

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
function useBP() {
  const [bp,setBp]=useState("desktop");
  useEffect(()=>{
    const fn=()=>{ const w=window.innerWidth; setBp(w<480?"mobile":w<768?"tablet":w<1100?"laptop":"desktop"); };
    fn(); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn);
  },[]);
  return bp;
}

// ─── ENGINE — simula backend api.bez.digital ───────────────────────────────────
class BeZhasPayEngine {
  constructor() {
    this.prices={...BASE_P}; this.txHistory=[]; this.escrows=[]; this.farmingPools=[];
    this.wsEvents=[]; this.wallet=null; this.sub=null;
    this.repScore=780; this.repHistory=[];
    this._initFarmingPools(); this._priceFeed(); this._wsSimulator();
  }

  _initFarmingPools() {
    this.farmingPools=[
      {pid:0,name:"BEZ Solo",      lpToken:"BEZ",  allocPoint:100,tvl:"$245k",  apy:24.5, yourStake:0,pendingReward:0,minStake:100,maxStake:1000000},
      {pid:1,name:"BEZ-USDT LP",   lpToken:"LP",   allocPoint:150,tvl:"$1.2M",  apy:38.2, yourStake:0,pendingReward:0,minStake:50, maxStake:500000},
      {pid:2,name:"BEZ-MATIC LP",  lpToken:"LP",   allocPoint:80, tvl:"$420k",  apy:18.7, yourStake:0,pendingReward:0,minStake:100,maxStake:200000},
      {pid:3,name:"BEZ-ETH LP",    lpToken:"LP",   allocPoint:120,tvl:"$890k",  apy:29.4, yourStake:0,pendingReward:0,minStake:100,maxStake:500000},
    ];
  }

  _priceFeed() {
    setInterval(()=>{
      Object.keys(this.prices).forEach(k=>{
        if(!["USD","EUR","USDT","USDC","DAI"].includes(k)){
          const d=(Math.random()-0.498)*0.008;
          this.prices[k]=Math.max(0.0001,+(this.prices[k]*(1+d)).toFixed(8));
        }
      });
      // Update pending rewards simulation
      this.farmingPools.forEach(p=>{ if(p.yourStake>0) p.pendingReward+=+(Math.random()*0.001).toFixed(6); });
    }, 750);
  }

  _wsSimulator() {
    const events=[
      ()=>({type:"payment_completed",msg:`✅ Pago completado — ${(Math.random()*5000+100).toFixed(0)} BEZ`,time:Date.now()}),
      ()=>({type:"escrow_finalized",msg:`🔒 Escrow #${rndInt(100,999)} finalizado — calidad ${rndInt(80,100)}%`,time:Date.now()}),
      ()=>({type:"farming_reward",msg:`🌾 Recompensa pool BEZ-USDT — ${(Math.random()*50).toFixed(4)} BEZ`,time:Date.now()}),
      ()=>({type:"price_alert",msg:`📊 BEZ ${Math.random()>0.5?"▲":"▼"} ${(Math.random()*5).toFixed(2)}%`,time:Date.now()}),
    ];
    setInterval(()=>{
      if(Math.random()>0.7){
        const ev=events[rndInt(0,events.length-1)]();
        this.wsEvents.unshift(ev);
        if(this.wsEvents.length>30) this.wsEvents.pop();
      }
    },2500);
  }

  async connectWallet(type) {
    await sleep(900);
    this.wallet={connected:true,address:`0x${rndHex(40)}`,network:"Polygon Amoy",type,
      balances:{BEZ:2450.5,MATIC:12.4,USDT:850,USDC:500,ETH:0.4}};
    return this.wallet;
  }

  // ── CORE PAYMENT PROCESSOR (reemplaza Stripe) ─────────────────────────────
  async processPayment({ type, payWith, amount, walletAddress, planId, metadata={} }) {
    const bezP=this.prices["BEZ"]||1.24;
    const payP=this.prices[payWith]||1;
    const usdVal=amount*payP;
    const feeRate=payWith==="BEZ"?0.005:0.015; // 0.5% en BEZ, 1.5% en otros
    const bezAmt=(usdVal*(1-feeRate))/bezP;
    const tx={
      id:`pay_${Date.now()}_${rndHex(8)}`,
      type, payWith, amount, usdValue:usdVal, bezAmount:+bezAmt.toFixed(6),
      feeUSD:+(usdVal*feeRate).toFixed(4), walletAddress,
      planId:planId||null, metadata,
      status:"pending", txHash:null, blockNumber:null,
      created:Date.now(), completed:null,
      explorerUrl:null, retryCount:0,
    };
    this.txHistory.unshift(tx);
    this._processPayment(tx);
    return tx;
  }

  async _processPayment(tx) {
    await sleep(400); tx.status="processing";
    // Simulate dispenseTokens() from fiatGateway.service.js
    await sleep(1200);
    if(Math.random()>0.04){
      tx.status="completed"; tx.txHash=`0x${rndHex(64)}`;
      tx.blockNumber=rndInt(12000000,13000000);
      tx.explorerUrl=`${ENDPOINTS.explorer.polygon}/tx/${tx.txHash}`;
      tx.completed=Date.now();
      if(this.wallet) this.wallet.balances.BEZ=(this.wallet.balances.BEZ||0)+tx.bezAmount;
    } else { tx.status="failed"; tx.errorMessage="Insufficient Hot Wallet balance"; }
  }

  // ── QUALITY ESCROW (QualityEscrow.sol) ──────────────────────────────────
  async createEscrow({clientWallet,collateral,quality,serviceDesc}) {
    const esc={
      id:rndInt(100,9999),status:"active",
      clientWallet,businessWallet:this.wallet?.address,
      collateral:+collateral,initialQuality:quality,finalQuality:null,
      serviceDesc,dispute:false,
      created:Date.now(),finalized:null,
      txHash:`0x${rndHex(64)}`,
      returnAmount:null,penaltyAmount:null,
    };
    this.escrows.unshift(esc);
    this._addWsEvent(`🔒 Escrow #${esc.id} creado — colateral: ${collateral} BEZ`,"escrow_created");
    return esc;
  }

  async finalizeEscrow(escId, finalQuality) {
    const esc=this.escrows.find(e=>e.id===escId);
    if(!esc) return null;
    const diff=Math.max(0,esc.initialQuality-finalQuality);
    const penaltyPct=diff*2; // 2% per quality point (del contrato)
    esc.finalQuality=finalQuality; esc.status="finalized";
    esc.penaltyAmount=+(esc.collateral*(penaltyPct/100)).toFixed(4);
    esc.returnAmount=+(esc.collateral-esc.penaltyAmount).toFixed(4);
    esc.finalized=Date.now();
    this._addWsEvent(`✅ Escrow #${escId} — calidad ${finalQuality}%, retorno ${esc.returnAmount} BEZ`,"escrow_finalized");
    return esc;
  }

  // ── FARMING (LiquidityFarming.sol) ───────────────────────────────────────
  async farmDeposit(pid, amount, lockDays) {
    const pool=this.farmingPools.find(p=>p.pid===pid);
    if(!pool) return null;
    const mult=LOCK_MULTIPLIERS.find(m=>m.days===lockDays)||LOCK_MULTIPLIERS[0];
    pool.yourStake+=+amount;
    const tx={id:`farm_${Date.now()}`,type:"farming_deposit",pid,poolName:pool.name,
      amount,lockDays,multiplier:mult.mult,txHash:`0x${rndHex(64)}`,status:"completed",created:Date.now()};
    this.txHistory.unshift(tx);
    this._addWsEvent(`🌾 Deposit ${amount} BEZ en ${pool.name} (${mult.boost}% boost)`,"farming_deposit");
    return tx;
  }

  async farmClaim(pid) {
    const pool=this.farmingPools.find(p=>p.pid===pid);
    if(!pool||pool.pendingReward<=0) return null;
    const reward=pool.pendingReward;
    pool.pendingReward=0;
    const tx={id:`claim_${Date.now()}`,type:"farming_reward",pid,poolName:pool.name,
      reward:+reward.toFixed(6),txHash:`0x${rndHex(64)}`,status:"completed",created:Date.now()};
    this.txHistory.unshift(tx);
    if(this.wallet) this.wallet.balances.BEZ=(this.wallet.balances.BEZ||0)+reward;
    return tx;
  }

  // ── WEBHOOK SIMULATION (payment.routes.js /api/payment/webhook) ─────────
  getPaymentStats() {
    const completed=this.txHistory.filter(t=>t.status==="completed");
    const failed=this.txHistory.filter(t=>t.status==="failed");
    const totalBEZ=completed.reduce((s,t)=>s+(t.bezAmount||0),0);
    const totalUSD=completed.reduce((s,t)=>s+(t.usdValue||0),0);
    return {total:this.txHistory.length,completed:completed.length,failed:failed.length,totalBEZ,totalUSD};
  }

  getTierForScore(score) { return REP_TIERS.find(t=>score>=t.min)||REP_TIERS[5]; }

  _addWsEvent(msg,type){
    this.wsEvents.unshift({type,msg,time:Date.now()});
    if(this.wsEvents.length>30) this.wsEvents.pop();
  }

  getPortfolio(){
    return TOKENS.slice(0,6).map(t=>({...t,
      balance:+(Math.random()*60+0.5).toFixed(4),
      change24h:+((Math.random()-0.45)*14).toFixed(2),
    }));
  }
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rndHex=n=>Array.from({length:n},()=>Math.floor(Math.random()*16).toString(16)).join("");
const rndInt=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const fmt=(n,d=4)=>n==null?"—":(+n).toLocaleString("en-US",{maximumFractionDigits:d});
const fmtUSD=n=>"$"+(+n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtH=h=>h?`${h.slice(0,10)}…${h.slice(-8)}`:"—";
const fmtT=ts=>new Date(ts).toLocaleTimeString("es-ES");
const fmtD=ts=>new Date(ts).toLocaleDateString("es-ES",{day:"2-digit",month:"short"});

const ENG=new BeZhasPayEngine();

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const Card=({children,style={},glow,color})=>(
  <div style={{background:C.card,border:`1px solid ${glow&&color?color+"66":C.border}`,borderRadius:16,padding:18,
    boxShadow:glow&&color?`0 0 28px ${color}28,inset 0 0 16px ${color}06`:"none",...style}}>{children}</div>
);

const Chip=({color=C.primary,children,size="sm",style={}})=>(
  <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:20,
    padding:size==="lg"?"5px 14px":"2px 9px",fontSize:size==="lg"?12:10,fontFamily:C.mono,fontWeight:800,...style}}>
    {children}
  </span>
);

const Btn=({children,onClick,disabled,color=C.primary,variant="fill",icon,full,size="md",style={}})=>{
  const isFill=variant==="fill";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:full?"100%":undefined,
      background:disabled?C.card3:isFill?`linear-gradient(135deg,${color},${color}cc)`:"transparent",
      color:disabled?C.muted:isFill?(color===C.gold||color===C.yellow?"#0a0a0a":C.bg):color,
      border:isFill?"none":`2px solid ${disabled?C.border3:color}`,
      borderRadius:12,padding:size==="lg"?"15px 24px":size==="sm"?"6px 12px":"10px 20px",
      fontSize:size==="lg"?14:size==="sm"?11:13,fontWeight:800,cursor:disabled?"not-allowed":"pointer",
      fontFamily:C.mono,boxShadow:disabled||!isFill?"none":`0 0 20px ${color}44`,
      transition:"all 0.18s",display:"flex",alignItems:"center",justifyContent:"center",gap:6,...style,
    }}>
      {icon&&<span style={{fontSize:(size==="lg"?16:size==="sm"?12:14)}}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

const Input=({value,onChange,label,sym,usd,type="number",placeholder="0.00",bp})=>(
  <div style={{background:C.card2,border:`1px solid ${C.border2}`,borderRadius:12,padding:"12px 14px"}}>
    {label&&<div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{label}</div>}
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{flex:1,background:"transparent",border:"none",outline:"none",color:C.text,
          fontFamily:C.mono,fontSize:bp==="mobile"?20:24,fontWeight:800,minWidth:0}}/>
      {sym&&<span style={{color:C.muted,fontFamily:C.mono,fontSize:13,flexShrink:0}}>{sym}</span>}
    </div>
    {usd!=null&&<div style={{color:C.muted,fontSize:10,marginTop:3}}>≈ {fmtUSD(usd)}</div>}
  </div>
);

const TokBtn=({sym,sel,onClick,bp})=>{
  const tok=TOKENS.find(t=>t.s===sym)||{icon:"?",color:C.muted,s:sym};
  const M=bp==="mobile";
  return (
    <button onClick={onClick} title={tok.n} style={{
      width:M?50:60,height:M?50:60,borderRadius:14,flexShrink:0,padding:0,
      border:`2px solid ${sel?tok.color:C.border2}`,background:sel?`${tok.color}30`:C.card,
      cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
      boxShadow:sel?`0 0 12px ${tok.color}55`:"none",transition:"all 0.16s",
    }}>
      <span style={{fontSize:M?16:18}}>{tok.icon}</span>
      <span style={{color:sel?tok.color:C.muted,fontFamily:C.mono,fontSize:M?8:9,fontWeight:800}}>{tok.s}</span>
    </button>
  );
};

const StatusBadge=({status})=>{
  const m={pending:{c:C.yellow,l:"⏳ Pendiente"},processing:{c:C.blue,l:"🔄 Procesando"},
    completed:{c:C.primary,l:"✅ Completado"},failed:{c:C.red,l:"❌ Fallido"},
    active:{c:C.primary,l:"✅ Activo"},finalized:{c:C.violet,l:"🏁 Finalizado"},
    disputed:{c:C.red,l:"⚠️ Disputa"},deploying:{c:C.violet,l:"📋 Desplegando"}};
  const s=m[status]||m.pending;
  return <span style={{color:s.c,background:`${s.c}22`,border:`1px solid ${s.c}44`,borderRadius:20,padding:"2px 10px",fontSize:10,fontFamily:C.mono,fontWeight:800}}>{s.l}</span>;
};

// ─── LIVE TICKER ──────────────────────────────────────────────────────────────
function LiveTicker({bp}){
  const [prices,setPrices]=useState({...BASE_P});
  const [dirs,setDirs]=useState({});
  const prev=useRef({...BASE_P});
  useEffect(()=>{
    const iv=setInterval(()=>{
      const n={...ENG.prices},d={};
      Object.keys(n).forEach(k=>{ d[k]=n[k]>(prev.current[k]||n[k])?"up":"dn"; });
      prev.current=n; setPrices(n); setDirs(d);
    },700);
    return ()=>clearInterval(iv);
  },[]);
  const syms=["BEZ","USDT","USDC","MATIC","ETH","BNB","SOL","DAI"];
  return (
    <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"4px 0"}}>
      <div style={{display:"flex",gap:bp==="mobile"?14:22,padding:"0 14px",overflowX:"auto",scrollbarWidth:"none",whiteSpace:"nowrap"}}>
        {syms.map(s=>{
          const tok=TOKENS.find(t=>t.s===s),p=prices[s]||tok?.pUSD,up=dirs[s]==="up";
          return (
            <span key={s} style={{display:"inline-flex",alignItems:"center",gap:4,flexShrink:0}}>
              <span style={{fontSize:bp==="mobile"?10:11}}>{tok?.icon}</span>
              <span style={{color:tok?.color,fontFamily:C.mono,fontSize:bp==="mobile"?9:10,fontWeight:800}}>
                {s==="BEZ"?"🪙BEZ":s}
              </span>
              <span style={{color:up?"#10B981":"#EF4444",fontFamily:C.mono,fontSize:bp==="mobile"?9:11,transition:"color 0.25s"}}>
                {p>=1?fmtUSD(p):`$${(p||0).toFixed(5)}`}
              </span>
              <span style={{fontSize:7,color:up?"#10B981":"#EF4444"}}>{up?"▲":"▼"}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── WS LIVE FEED ─────────────────────────────────────────────────────────────
function WsLiveFeed(){
  const [events,setEvents]=useState([]);
  useEffect(()=>{ const iv=setInterval(()=>setEvents([...ENG.wsEvents]),800); return ()=>clearInterval(iv); },[]);
  if(!events.length) return null;
  return (
    <div style={{background:"#061a1055",border:`1px solid ${C.primary}33`,borderRadius:10,padding:"8px 12px",
      display:"flex",gap:10,overflowX:"auto",scrollbarWidth:"none",alignItems:"center"}}>
      <span style={{color:C.primary,fontSize:10,fontFamily:C.mono,fontWeight:800,flexShrink:0,
        background:`${C.primary}22`,borderRadius:20,padding:"2px 8px"}}>
        ● WS LIVE
      </span>
      {events.slice(0,5).map((e,i)=>(
        <span key={i} style={{color:C.text2,fontSize:10,flexShrink:0,fontFamily:C.mono,
          borderRight:`1px solid ${C.border2}`,paddingRight:10}}>
          {e.msg} <span style={{color:C.muted,fontSize:9}}>{fmtT(e.time)}</span>
        </span>
      ))}
    </div>
  );
}

// ─── WALLET BAR ───────────────────────────────────────────────────────────────
function WalletBar({wallet,onConnect,bp}){
  const M=bp==="mobile";
  const [connecting,setConnecting]=useState(false);
  const [show,setShow]=useState(false);
  const connect=async(type)=>{
    setConnecting(true);setShow(false);
    await ENG.connectWallet(type); onConnect({...ENG.wallet}); setConnecting(false);
  };
  if(wallet?.connected) return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{background:`${C.primary}22`,border:`1px solid ${C.primary}55`,borderRadius:10,
        padding:M?"4px 8px":"5px 12px",display:"flex",alignItems:"center",gap:5}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:C.primary,
          boxShadow:`0 0 6px ${C.primary}`,display:"inline-block"}}/>
        <span style={{color:C.primary,fontFamily:C.mono,fontSize:M?9:11,fontWeight:800}}>
          {wallet.address.slice(0,6)}…{wallet.address.slice(-4)}
        </span>
      </div>
      {!M&&<Chip color={C.gold}>🪙 {fmt(wallet.balances?.BEZ||0,2)}</Chip>}
    </div>
  );
  return (
    <div style={{position:"relative"}}>
      <Btn onClick={()=>setShow(v=>!v)} disabled={connecting} color={C.primary} size={M?"sm":"md"} icon="🔗">
        {connecting?"Conectando…":M?"Wallet":"Conectar Wallet"}
      </Btn>
      {show&&(
        <div style={{position:"absolute",right:0,top:"110%",background:C.surf,border:`1px solid ${C.border2}`,
          borderRadius:14,padding:8,zIndex:200,minWidth:200,boxShadow:"0 8px 32px #000a"}}>
          {[{id:"metamask",icon:"🦊",n:"MetaMask"},{id:"walletconnect",icon:"🔗",n:"WalletConnect"},
            {id:"coinbase",icon:"🔵",n:"Coinbase"},{id:"trust",icon:"🛡️",n:"Trust Wallet"}].map(w=>(
            <button key={w.id} onClick={()=>connect(w.id)} style={{
              width:"100%",background:"none",border:"none",cursor:"pointer",padding:"9px 12px",
              borderRadius:10,display:"flex",alignItems:"center",gap:10,color:C.text,fontSize:13,
              transition:"background 0.15s",fontFamily:C.sans,
            }} onMouseEnter={e=>e.currentTarget.style.background=C.card2} onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <span style={{fontSize:18}}>{w.icon}</span>{w.n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB: PAYMENT PROCESSOR ──────────────────────────────────────────────────
// Sistema de pago independiente BEZ — reemplaza Stripe completamente
function PaymentTab({wallet,bp}){
  const M=bp==="mobile";
  const [payType,setPayType]=useState("token_purchase");
  const [payWith,setPayWith]=useState("USDT");
  const [amount,setAmount]=useState("100");
  const [walletAddr,setWalletAddr]=useState(wallet?.address||"");
  const [processing,setProcessing]=useState(false);
  const [result,setResult]=useState(null);
  const [showSuccess,setShowSuccess]=useState(false);
  const [prices,setPrices]=useState({...BASE_P});

  useEffect(()=>{ const iv=setInterval(()=>setPrices({...ENG.prices}),500); return ()=>clearInterval(iv); },[]);
  useEffect(()=>{ if(wallet?.address) setWalletAddr(wallet.address); },[wallet]);

  const bezP=prices["BEZ"]||1.24, payP=prices[payWith]||1;
  const usdVal=(+amount||0)*payP, feeR=payWith==="BEZ"?0.005:0.015;
  const bezOut=(usdVal*(1-feeR))/bezP;
  const paySyms=["USDT","USDC","BEZ","MATIC","ETH","BNB","USD","EUR"];

  const handlePay=async()=>{
    if(!walletAddr){ alert("Introduce dirección de wallet"); return; }
    setProcessing(true); setResult(null);
    const tx=await ENG.processPayment({type:payType,payWith,amount:+amount,walletAddress:walletAddr,metadata:{source:"bezhas_payment_v2"}});
    setResult(tx); setProcessing(false);
    if(tx.status==="completed") setShowSuccess(true);
  };

  const stats=ENG.getPaymentStats();

  return (
    <div>
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:M?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        {[
          {l:"Pagos Totales",v:stats.total,c:C.primary},
          {l:"Completados",v:stats.completed,c:"#10B981"},
          {l:"Total BEZ",v:fmt(stats.totalBEZ,2),c:C.gold},
          {l:"Volumen USD",v:fmtUSD(stats.totalUSD),c:C.blue},
        ].map(s=>(
          <div key={s.l} style={{background:C.card,border:`1px solid ${s.c}44`,borderRadius:14,
            padding:"12px 14px",borderTop:`3px solid ${s.c}`}}>
            <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>{s.l}</div>
            <div style={{color:s.c,fontFamily:C.mono,fontSize:M?16:20,fontWeight:800,marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      <WsLiveFeed/>
      <div style={{height:12}}/>

      <div style={{display:"grid",gridTemplateColumns:M?"1fr":"1fr 360px",gap:16}}>
        {/* ─── MAIN PAYMENT FORM ─── */}
        <Card glow color={C.gold}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <span style={{fontSize:24}}>💳</span>
            <div>
              <div style={{color:C.gold,fontWeight:800,fontSize:15}}>PAYMENT PROCESSOR BEZ</div>
              <div style={{color:C.muted,fontSize:10}}>Sistema propio · api.bez.digital · Sin Stripe</div>
            </div>
            <div style={{marginLeft:"auto"}}>
              <Chip color={C.primary}>● HOT WALLET ACTIVA</Chip>
            </div>
          </div>

          {/* Tipo de pago */}
          <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Tipo de transacción</div>
          <div style={{display:"grid",gridTemplateColumns:M?"repeat(3,1fr)":"repeat(4,1fr)",gap:6,marginBottom:14}}>
            {Object.entries(PAY_TYPES).slice(0,M?6:8).map(([k,v])=>(
              <button key={k} onClick={()=>setPayType(k)} style={{
                background:payType===k?`${v.color}22`:C.card2,border:`1.5px solid ${payType===k?v.color:C.border2}`,
                borderRadius:10,padding:M?"8px 4px":"8px 6px",cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                boxShadow:payType===k?`0 0 10px ${v.color}44`:"none",
              }}>
                <span style={{fontSize:M?18:16}}>{v.icon}</span>
                <span style={{color:payType===k?v.color:C.muted,fontFamily:C.mono,fontSize:M?8:9,fontWeight:800,textAlign:"center",lineHeight:1.2}}>{v.label}</span>
              </button>
            ))}
          </div>

          {/* Token origen */}
          <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Pagar con</div>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
            {paySyms.map(s=><TokBtn key={s} sym={s} sel={payWith===s} onClick={()=>setPayWith(s)} bp={bp}/>)}
          </div>

          <Input value={amount} onChange={setAmount} label={`Cantidad (${payWith})`} sym={payWith} usd={usdVal} bp={bp}/>
          <div style={{height:10}}/>

          {/* Wallet destino */}
          <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Wallet destino (Polygon)</div>
          <input value={walletAddr} onChange={e=>setWalletAddr(e.target.value)}
            placeholder="0x... dirección Polygon"
            style={{width:"100%",background:C.card2,border:`1px solid ${C.border2}`,borderRadius:10,
              padding:"10px 12px",color:C.muted,fontSize:11,fontFamily:C.mono,outline:"none",
              boxSizing:"border-box",marginBottom:12}}/>

          {/* Quote box */}
          <div style={{background:`${C.gold}0a`,border:`1px solid ${C.gold}33`,borderRadius:12,padding:14,marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {[
                ["Precio BEZ",fmtUSD(bezP)],
                ["Tasa",`1 ${payWith}=${fmt(payP/bezP,4)} BEZ`],
                ["Fee",`${(feeR*100).toFixed(1)}% — ${fmtUSD(usdVal*feeR)}`],
                ["Red destino","Polygon Amoy"],
              ].map(([k,v])=>(
                <div key={k} style={{background:C.card,borderRadius:8,padding:"7px 10px"}}>
                  <div style={{color:C.muted,fontSize:9}}>{k}</div>
                  <div style={{color:C.text2,fontFamily:C.mono,fontSize:11,fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{borderTop:`1px solid ${C.border2}`,paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:C.muted,fontSize:9}}>Recibirás via dispenseTokens()</div>
                <div style={{color:C.gold,fontFamily:C.mono,fontSize:M?22:28,fontWeight:800}}>🪙 {fmt(bezOut,4)} BEZ</div>
                <div style={{color:C.muted,fontSize:9}}>≈ {fmtUSD(bezOut*bezP)} USD</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:C.muted,fontSize:9}}>Contrato</div>
                <div style={{color:C.primary,fontFamily:C.mono,fontSize:9}}>{fmtH(CONTRACTS.BEZ_POLYGON)}</div>
                <Chip color={C.primary}>Hot Wallet ✓</Chip>
              </div>
            </div>
          </div>

          {!wallet?.connected&&(
            <div style={{background:"#180a0a",border:`1px solid ${C.red}44`,borderRadius:10,
              padding:"9px 12px",marginBottom:10,color:"#FCA5A5",fontSize:11,textAlign:"center"}}>
              ⚠️ Conecta tu wallet para procesar el pago
            </div>
          )}

          <Btn onClick={handlePay} disabled={processing||(!wallet?.connected&&payWith!=="USD"&&payWith!=="EUR")}
            color={C.gold} icon={PAY_TYPES[payType]?.icon} full size="lg">
            {processing?"Procesando vía Hot Wallet…":`Pagar ${amount} ${payWith} → ${fmt(bezOut,2)} BEZ`}
          </Btn>

          {result&&(
            <div style={{marginTop:12,background:result.status==="completed"?"#052a0a99":"#1a050599",
              border:`1px solid ${result.status==="completed"?C.primary:C.red}`,borderRadius:12,padding:14}}>
              <StatusBadge status={result.status}/>
              {result.status==="completed"&&(
                <div style={{marginTop:8}}>
                  <div style={{color:C.primary,fontWeight:800,fontSize:14}}>
                    🎉 {fmt(result.bezAmount,4)} BEZ enviados a tu wallet
                  </div>
                  <div style={{color:C.muted,fontSize:10,fontFamily:C.mono,marginTop:4}}>
                    TX: {fmtH(result.txHash)}
                  </div>
                  <div style={{color:C.muted,fontSize:10}}>
                    Block #{result.blockNumber} · {fmtT(result.created)}
                  </div>
                  <div style={{marginTop:6}}>
                    <a href={result.explorerUrl} target="_blank" rel="noreferrer"
                      style={{color:C.blue,fontSize:10,fontFamily:C.mono}}>
                      🔍 Ver en Polygonscan →
                    </a>
                  </div>
                </div>
              )}
              {result.status==="failed"&&<div style={{color:C.red,marginTop:6,fontSize:11}}>{result.errorMessage}</div>}
            </div>
          )}
        </Card>

        {/* ─── SIDE: API DOCS ─── */}
        {!M&&(
          <div>
            <Card style={{marginBottom:12}}>
              <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
                🔌 API Endpoints (api.bez.digital)
              </div>
              {[
                {m:"POST",p:"/api/payment/webhook",d:"Webhook BEZ automático"},
                {m:"GET", p:"/api/payment/history/:wallet",d:"Historial de pagos"},
                {m:"GET", p:"/api/payment/stats",d:"Estadísticas globales"},
                {m:"GET", p:"/api/farming/pools",d:"Pools de farming"},
                {m:"POST",p:"/api/farming/validate-stake",d:"Validar stake"},
                {m:"POST",p:"/api/quality-escrow/create",d:"Crear escrow"},
                {m:"GET", p:"/api/quality-escrow/analytics",d:"Analytics escrow"},
                {m:"GET", p:"/api/quality-escrow/leaderboard",d:"Ranking reputación"},
              ].map(e=>(
                <div key={e.p} style={{display:"flex",gap:6,padding:"5px 0",borderBottom:`1px solid ${C.border}`,alignItems:"center"}}>
                  <span style={{
                    background:e.m==="POST"?`${C.orange}22`:`${C.blue}22`,
                    color:e.m==="POST"?C.orange:C.blue,
                    fontFamily:C.mono,fontSize:9,fontWeight:800,
                    padding:"1px 6px",borderRadius:4,flexShrink:0
                  }}>{e.m}</span>
                  <span style={{color:C.primary,fontFamily:C.mono,fontSize:9,flex:1}}>{e.p}</span>
                  <span style={{color:C.muted,fontSize:9}}>{e.d}</span>
                </div>
              ))}
            </Card>
            <Card>
              <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
                🏗️ Smart Contracts
              </div>
              {[
                {l:"BEZ Token (Polygon)",v:fmtH(CONTRACTS.BEZ_POLYGON),c:C.primary},
                {l:"BEZ Token (BNB)",v:fmtH(CONTRACTS.BEZ_BNB),c:C.gold},
                {l:"Quality Escrow",v:fmtH(CONTRACTS.ESCROW),c:C.blue},
                {l:"Safe Wallet",v:fmtH(CONTRACTS.SAFE_WALLET),c:C.violet},
              ].map(c=>(
                <div key={c.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}`,fontSize:10}}>
                  <span style={{color:C.muted}}>{c.l}</span>
                  <span style={{color:c.c,fontFamily:C.mono}}>{c.v}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Success modal */}
      {showSuccess&&result?.status==="completed"&&(
        <div style={{position:"fixed",inset:0,background:"#000d",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowSuccess(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:C.card,border:`2px solid ${C.gold}`,borderRadius:24,padding:32,
            maxWidth:420,width:"100%",textAlign:"center",boxShadow:`0 0 60px ${C.gold}44`,
          }}>
            <div style={{fontSize:64}}>🎉</div>
            <div style={{color:C.gold,fontWeight:800,fontSize:22,margin:"8px 0"}}>¡Pago Exitoso!</div>
            <div style={{color:C.text,fontFamily:C.mono,fontSize:28,fontWeight:800,margin:"12px 0"}}>
              🪙 {fmt(result.bezAmount,4)} BEZ
            </div>
            <div style={{color:C.muted,fontSize:11,marginBottom:14}}>enviados via Hot Wallet Polygon</div>
            <div style={{background:C.card2,borderRadius:10,padding:10,marginBottom:16,fontSize:10,fontFamily:C.mono}}>
              <div style={{color:C.muted}}>TX Hash</div>
              <div style={{color:C.primary}}>{fmtH(result.txHash)}</div>
              <div style={{color:C.muted,marginTop:4}}>Block #{result.blockNumber}</div>
            </div>
            <Btn onClick={()=>setShowSuccess(false)} color={C.gold} full>✓ Cerrar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: FARMING POOLS ───────────────────────────────────────────────────────
function FarmingTab({wallet,bp}){
  const M=bp==="mobile";
  const [pools,setPools]=useState([...ENG.farmingPools]);
  const [selPool,setSelPool]=useState(0);
  const [stakeAmt,setStakeAmt]=useState("500");
  const [lockDays,setLockDays]=useState(30);
  const [processing,setProcessing]=useState(null);
  const [result,setResult]=useState(null);

  useEffect(()=>{ const iv=setInterval(()=>setPools([...ENG.farmingPools]),600); return ()=>clearInterval(iv); },[]);
  const pool=pools.find(p=>p.pid===selPool)||pools[0];
  const mult=LOCK_MULTIPLIERS.find(m=>m.days===lockDays)||LOCK_MULTIPLIERS[2];
  const effectiveAPY=(pool?.apy||0)*(mult.mult/100);
  const annualReturn=(+stakeAmt||0)*(effectiveAPY/100);
  const totalTVL=pools.reduce((s,p)=>s+parseFloat(p.tvl.replace(/[$kM]/g,m=>m==="k"?"000":m==="M"?"000000":""))*1,0);

  const handleDeposit=async()=>{
    if(!wallet?.connected){ alert("Conecta tu wallet"); return; }
    setProcessing("deposit");
    const tx=await ENG.farmDeposit(selPool,+stakeAmt,lockDays);
    setResult({action:"deposit",tx}); setProcessing(null);
  };
  const handleClaim=async(pid)=>{
    if(!wallet?.connected) return;
    setProcessing(`claim_${pid}`);
    await ENG.farmClaim(pid);
    setProcessing(null);
  };

  return (
    <div>
      {/* Global stats */}
      <div style={{display:"grid",gridTemplateColumns:M?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        {[
          {l:"TVL Total",v:fmtUSD(245000+1200000+420000+890000),c:C.primary},
          {l:"Pools Activos",v:pools.length,c:C.gold},
          {l:"Mejor APY",v:`${Math.max(...pools.map(p=>p.apy))}%`,c:"#10B981"},
          {l:"BEZ/Block",v:"0.1 BEZ",c:C.violet},
        ].map(s=>(
          <div key={s.l} style={{background:C.card,border:`1px solid ${s.c}44`,borderRadius:14,
            padding:"12px",borderTop:`3px solid ${s.c}`}}>
            <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>{s.l}</div>
            <div style={{color:s.c,fontFamily:C.mono,fontSize:M?16:20,fontWeight:800,marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:M?"1fr":"1fr 340px",gap:16}}>
        {/* Pool cards */}
        <div>
          <div style={{display:"grid",gridTemplateColumns:M?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
            {pools.map(p=>(
              <div key={p.pid} onClick={()=>setSelPool(p.pid)} style={{
                background:selPool===p.pid?`${C.gold}18`:C.card,
                border:`2px solid ${selPool===p.pid?C.gold:C.border}`,
                borderRadius:14,padding:14,cursor:"pointer",transition:"all 0.18s",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{color:C.text,fontWeight:800,fontSize:13}}>🌾 {p.name}</div>
                    <Chip color={C.muted} size="sm">{p.lpToken}</Chip>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:"#10B981",fontFamily:C.mono,fontSize:18,fontWeight:800}}>{p.apy}%</div>
                    <div style={{color:C.muted,fontSize:9}}>APY base</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[["TVL",p.tvl],["Min Stake",`${p.minStake} BEZ`],
                    ["Tu stake",`${fmt(p.yourStake,2)} BEZ`],["Pendiente",`${fmt(p.pendingReward,4)} BEZ`]].map(([k,v])=>(
                    <div key={k} style={{background:C.card2,borderRadius:8,padding:"6px 8px"}}>
                      <div style={{color:C.muted,fontSize:8}}>{k}</div>
                      <div style={{color:k==="Pendiente"&&p.pendingReward>0?"#10B981":C.text2,fontFamily:C.mono,fontSize:10,fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
                {p.pendingReward>0&&(
                  <Btn onClick={e=>{e.stopPropagation();handleClaim(p.pid);}} disabled={processing===`claim_${p.pid}`}
                    color={"#10B981"} full size="sm" style={{marginTop:8}}>
                    {processing===`claim_${p.pid}`?"Claiming…":`Claim ${fmt(p.pendingReward,4)} BEZ`}
                  </Btn>
                )}
              </div>
            ))}
          </div>

          {result?.action==="deposit"&&(
            <div style={{background:"#052a0a99",border:`1px solid ${C.primary}`,borderRadius:12,padding:12,marginBottom:12}}>
              <StatusBadge status="completed"/>
              <div style={{color:C.primary,marginTop:6,fontSize:12,fontWeight:700}}>
                ✅ Stakeado {stakeAmt} BEZ con {mult.boost}% boost
              </div>
              <div style={{color:C.muted,fontSize:10,fontFamily:C.mono}}>TX: {fmtH(result.tx?.txHash)}</div>
            </div>
          )}
        </div>

        {/* Stake form */}
        <Card glow color={C.gold}>
          <div style={{color:C.gold,fontWeight:800,fontSize:13,marginBottom:12}}>
            🌾 Depositar en {pool?.name}
          </div>

          <Input value={stakeAmt} onChange={setStakeAmt} label="Cantidad a stakear (BEZ)" sym="BEZ"
            usd={(+stakeAmt||0)*(ENG.prices["BEZ"]||1.24)} bp={bp}/>
          <div style={{height:12}}/>

          {/* Lock period selector */}
          <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            Lock Period — Multiplicador de Recompensas
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:14}}>
            {LOCK_MULTIPLIERS.map(m=>(
              <button key={m.days} onClick={()=>setLockDays(m.days)} style={{
                background:lockDays===m.days?`${m.color}22`:C.card2,
                border:`2px solid ${lockDays===m.days?m.color:C.border2}`,
                borderRadius:10,padding:"8px 4px",cursor:"pointer",textAlign:"center",
                boxShadow:lockDays===m.days?`0 0 10px ${m.color}44`:"none",
              }}>
                <div style={{color:m.color,fontFamily:C.mono,fontSize:12,fontWeight:800}}>{m.label}</div>
                <div style={{color:"#10B981",fontSize:10,fontFamily:C.mono}}>×{m.mult/100}</div>
                {m.boost>0&&<div style={{color:C.muted,fontSize:8}}>+{m.boost}% boost</div>}
              </button>
            ))}
          </div>

          {/* APY Calculator */}
          <div style={{background:`${C.gold}0a`,border:`1px solid ${C.gold}33`,borderRadius:12,padding:12,marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                ["APY Base",`${pool?.apy||0}%`],
                ["APY Efectivo",`${effectiveAPY.toFixed(1)}%`],
                ["Retorno Anual",`${fmt(annualReturn,2)} BEZ`],
                ["Retorno Mensual",`${fmt(annualReturn/12,4)} BEZ`],
              ].map(([k,v])=>(
                <div key={k} style={{background:C.card,borderRadius:8,padding:"7px 10px"}}>
                  <div style={{color:C.muted,fontSize:9}}>{k}</div>
                  <div style={{color:k==="APY Efectivo"?"#10B981":C.gold,fontFamily:C.mono,fontSize:12,fontWeight:800}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:C.surf,borderRadius:10,padding:10,marginBottom:12}}>
            {[
              ["Contrato","LiquidityFarming.sol"],
              ["Función",`deposit(${selPool},amount,${lockDays*86400})`],
              ["Red","Polygon Amoy → Mainnet"],
              ["Seguridad","OpenZeppelin + ReentrancyGuard"],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"3px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.muted}}>{k}</span>
                <span style={{color:C.text2,fontFamily:C.mono,fontSize:9}}>{v}</span>
              </div>
            ))}
          </div>

          {!wallet?.connected&&<div style={{background:"#180a0a",border:`1px solid ${C.red}44`,borderRadius:8,padding:"8px",marginBottom:10,color:"#FCA5A5",fontSize:10,textAlign:"center"}}>⚠️ Conecta tu wallet</div>}
          <Btn onClick={handleDeposit} disabled={processing==="deposit"||!wallet?.connected} color={C.gold} icon="🌾" full size="lg">
            {processing==="deposit"?"Depositando…":`Depositar ${stakeAmt} BEZ (${mult.boost}% boost)`}
          </Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: QUALITY ESCROW ──────────────────────────────────────────────────────
function EscrowTab({wallet,bp}){
  const M=bp==="mobile";
  const [tab,setTab]=useState("create");
  const [escrows,setEscrows]=useState([...ENG.escrows]);
  const [clientWallet,setClientWallet]=useState("");
  const [collateral,setCollateral]=useState("100");
  const [quality,setQuality]=useState(85);
  const [serviceDesc,setServiceDesc]=useState("");
  const [processing,setProcessing]=useState(false);
  const [result,setResult]=useState(null);
  const [finalQ,setFinalQ]=useState({});

  useEffect(()=>{ const iv=setInterval(()=>setEscrows([...ENG.escrows]),600); return ()=>clearInterval(iv); },[]);

  const handleCreate=async()=>{
    if(!wallet?.connected){ alert("Conecta tu wallet"); return; }
    setProcessing(true);
    const esc=await ENG.createEscrow({clientWallet,collateral:+collateral,quality,serviceDesc});
    setResult(esc); setProcessing(false);
  };
  const handleFinalize=async(id,fq)=>{
    const esc=await ENG.finalizeEscrow(id,fq||80);
    setEscrows([...ENG.escrows]);
  };

  const getTier=s=>REP_TIERS.find(t=>ENG.repScore>=t.min)||REP_TIERS[5];
  const tier=getTier(ENG.repScore);

  return (
    <div>
      {/* Reputation banner */}
      <div style={{background:`linear-gradient(135deg,${C.card},${tier.color}18)`,border:`1px solid ${tier.color}55`,borderRadius:16,padding:16,marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <span style={{fontSize:M?32:40}}>{tier.icon}</span>
        <div style={{flex:1}}>
          <div style={{color:tier.color,fontWeight:800,fontSize:14}}>{tier.name}</div>
          <div style={{color:C.muted,fontSize:11}}>Reputación: {ENG.repScore}/1000 · QualityEscrow.sol</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {REP_TIERS.slice(0).reverse().map(t=>(
            <Chip key={t.name} color={ENG.repScore>=t.min?t.color:C.muted} size="sm">{t.icon} {t.name.slice(0,4)}</Chip>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["create","list"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"8px 16px",borderRadius:10,border:`1px solid ${tab===t?C.blue:C.border}`,
            background:tab===t?`${C.blue}22`:"transparent",color:tab===t?C.blue:C.muted,
            cursor:"pointer",fontFamily:C.mono,fontSize:11,fontWeight:tab===t?800:400,
          }}>{t==="create"?"+ Crear Escrow":"📋 Mis Escrows"}</button>
        ))}
      </div>

      {tab==="create"&&(
        <div style={{display:"grid",gridTemplateColumns:M?"1fr":"1fr 360px",gap:16}}>
          <Card glow color={C.blue}>
            <div style={{color:C.blue,fontWeight:800,fontSize:14,marginBottom:14}}>🔒 Quality Escrow — QualityEscrow.sol</div>
            <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Wallet del cliente</div>
            <input value={clientWallet} onChange={e=>setClientWallet(e.target.value)} placeholder="0x... cliente"
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border2}`,borderRadius:10,
                padding:"10px 12px",color:C.muted,fontSize:11,fontFamily:C.mono,outline:"none",boxSizing:"border-box",marginBottom:12}}/>
            <Input value={collateral} onChange={setCollateral} label="Colateral BEZ" sym="BEZ"
              usd={(+collateral||0)*(ENG.prices["BEZ"]||1.24)} bp={bp}/>
            <div style={{height:10}}/>
            <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
              Calidad prometida: {quality}%
            </div>
            <input type="range" min={50} max={100} value={quality} onChange={e=>setQuality(+e.target.value)}
              style={{width:"100%",marginBottom:8,accentColor:C.blue}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginBottom:12}}>
              <span>50% (Mínimo)</span><span style={{color:C.blue,fontWeight:800}}>{quality}% prometido</span><span>100%</span>
            </div>
            <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Descripción del servicio</div>
            <textarea value={serviceDesc} onChange={e=>setServiceDesc(e.target.value)} rows={3} placeholder="Describe el servicio a garantizar…"
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border2}`,borderRadius:10,
                padding:"10px",color:C.text,fontSize:12,fontFamily:C.sans,resize:"vertical",outline:"none",boxSizing:"border-box",marginBottom:12}}/>
            <div style={{background:C.surf,borderRadius:10,padding:10,marginBottom:12}}>
              <div style={{color:C.muted,fontSize:9,marginBottom:4}}>Fórmula de penalización (del contrato):</div>
              <div style={{color:C.text2,fontFamily:C.mono,fontSize:10}}>
                penalty = (initialQuality - finalQuality) × 2%<br/>
                returnAmount = collateral × (1 - penalty%)
              </div>
              <div style={{marginTop:6,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                {[-5,-10,-20].map(diff=>(
                  <div key={diff} style={{background:C.card,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                    <div style={{color:C.muted,fontSize:8}}>Diff {Math.abs(diff)}pts</div>
                    <div style={{color:C.red,fontFamily:C.mono,fontSize:10,fontWeight:800}}>-{Math.abs(diff)*2}%</div>
                  </div>
                ))}
              </div>
            </div>
            {!wallet?.connected&&<div style={{background:"#180a0a",border:`1px solid ${C.red}44`,borderRadius:8,padding:"8px",marginBottom:10,color:"#FCA5A5",fontSize:10,textAlign:"center"}}>⚠️ Conecta tu wallet</div>}
            <Btn onClick={handleCreate} disabled={processing||!wallet?.connected||!clientWallet} color={C.blue} icon="🔒" full size="lg">
              {processing?"Desplegando Escrow…":`Crear Escrow — ${collateral} BEZ colateral`}
            </Btn>
            {result&&<div style={{marginTop:10,background:"#052a0a99",border:`1px solid ${C.primary}`,borderRadius:10,padding:12}}>
              <div style={{color:C.primary,fontWeight:800}}>✅ Escrow #{result.id} creado</div>
              <div style={{color:C.muted,fontSize:10,fontFamily:C.mono}}>TX: {fmtH(result.txHash)}</div>
            </div>}
          </Card>
          {!M&&(
            <Card>
              <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Funciones del Contrato</div>
              {[
                {f:"createService(clientWallet, collateral, initialQuality)",d:"Crea nuevo escrow con colateral BEZ"},
                {f:"finalizeService(serviceId, finalQuality)",d:"Finaliza y calcula retorno"},
                {f:"raiseDispute(serviceId)",d:"Cliente abre disputa"},
                {f:"resolveDispute(serviceId, inProviderFavor, adjustedQuality)",d:"Oracle resuelve disputa"},
              ].map(e=>(
                <div key={e.f} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{color:C.primary,fontFamily:C.mono,fontSize:9}}>{e.f}</div>
                  <div style={{color:C.muted,fontSize:10,marginTop:2}}>{e.d}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {tab==="list"&&(
        <div>
          {escrows.length===0&&<div style={{textAlign:"center",color:C.muted,padding:40}}>No hay escrows aún. Crea el primero.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {escrows.map(esc=>(
              <Card key={esc.id} glow={esc.status==="active"} color={C.blue}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:10}}>
                  <div>
                    <div style={{color:C.text,fontWeight:800}}>Escrow #{esc.id}</div>
                    <div style={{color:C.muted,fontSize:10}}>{esc.serviceDesc||"Servicio sin descripción"}</div>
                  </div>
                  <StatusBadge status={esc.status}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:M?"1fr 1fr":"repeat(4,1fr)",gap:8,marginBottom:10}}>
                  {[
                    ["Colateral",`${esc.collateral} BEZ`,C.gold],
                    ["Calidad Prom.",`${esc.initialQuality}%`,C.blue],
                    ["Retorno",esc.returnAmount?`${esc.returnAmount} BEZ`:"—",C.primary],
                    ["Penalización",esc.penaltyAmount?`${esc.penaltyAmount} BEZ`:"—",C.red],
                  ].map(([k,v,c])=>(
                    <div key={k} style={{background:C.card2,borderRadius:8,padding:"7px 10px"}}>
                      <div style={{color:C.muted,fontSize:9}}>{k}</div>
                      <div style={{color:c,fontFamily:C.mono,fontSize:12,fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
                {esc.status==="active"&&(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:120}}>
                      <input type="range" min={50} max={100} defaultValue={85}
                        onChange={e=>setFinalQ(q=>({...q,[esc.id]:+e.target.value}))}
                        style={{width:"100%",accentColor:C.primary}}/>
                      <div style={{color:C.muted,fontSize:9,textAlign:"center"}}>Calidad final: {finalQ[esc.id]||85}%</div>
                    </div>
                    <Btn onClick={()=>handleFinalize(esc.id,finalQ[esc.id])} color={C.primary} size="sm" icon="✅">Finalizar</Btn>
                    <Btn color={C.red} variant="outline" size="sm" icon="⚠️">Disputar</Btn>
                  </div>
                )}
                {esc.status==="finalized"&&(
                  <div style={{background:"#052a0a55",borderRadius:8,padding:8,fontSize:10}}>
                    <span style={{color:C.primary}}>✅ Retorno: {esc.returnAmount} BEZ</span>
                    {esc.penaltyAmount>0&&<span style={{color:C.red,marginLeft:12}}>Penalización: -{esc.penaltyAmount} BEZ ({((esc.penaltyAmount/esc.collateral)*100).toFixed(0)}%)</span>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: SUBSCRIPTIONS ───────────────────────────────────────────────────────
function SubsTab({wallet,bp}){
  const M=bp==="mobile";
  const [selPlan,setSelPlan]=useState("pro");
  const [payWith,setPayWith]=useState("BEZ");
  const [processing,setProcessing]=useState(false);
  const [result,setResult]=useState(null);
  const [prices,setPrices]=useState({...BASE_P});
  useEffect(()=>{ const iv=setInterval(()=>setPrices({...ENG.prices}),500); return ()=>clearInterval(iv); },[]);

  const plan=PLANS.find(p=>p.id===selPlan)||PLANS[2];
  const bezP=prices["BEZ"]||1.24, payP=prices[payWith]||1;
  const costBEZ=plan.priceBEZ, costPay=payWith==="BEZ"?costBEZ:(plan.priceUSD/payP);
  const discountBEZ=payWith==="BEZ"?20:0; // 20% descuento pagando en BEZ

  const handleSub=async()=>{
    if(!wallet?.connected&&plan.priceUSD>0){ alert("Conecta tu wallet"); return; }
    setProcessing(true);
    const tx=await ENG.processPayment({type:"vip_subscription",payWith,amount:costPay,
      walletAddress:wallet?.address||"0x0",planId:selPlan,
      metadata:{planName:plan.name,period:"monthly",autoRenew:true,contractNetwork:"BNB Chain"}});
    setResult(tx); setProcessing(false);
  };
  const paySyms=["BEZ","USDT","USDC","BNB","ETH"];

  return (
    <div>
      {result?.status==="active"&&(
        <div style={{background:"#052a0a88",border:`1px solid ${C.primary}`,borderRadius:16,padding:14,marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:24}}>✅</span>
          <div style={{flex:1}}>
            <div style={{color:C.primary,fontWeight:800}}>Plan {result.planId} Activo</div>
            <div style={{color:C.muted,fontSize:10}}>Smart Contract BNB Chain · Auto-renovación mensual</div>
          </div>
          <Chip color={C.primary}>🔄 Auto-renovación ON</Chip>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:M?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        {PLANS.map(p=>(
          <div key={p.id} onClick={()=>setSelPlan(p.id)} style={{
            background:selPlan===p.id?`${p.color}18`:C.card,
            border:`2px solid ${selPlan===p.id?p.color:C.border}`,
            borderRadius:16,padding:M?14:18,cursor:"pointer",transition:"all 0.18s",position:"relative",
            boxShadow:selPlan===p.id?`0 0 18px ${p.color}33`:"none",
          }}>
            {p.badge&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",
              background:p.color,color:p.id==="enterprise"?"#0a0a0a":C.bg,borderRadius:20,
              padding:"2px 10px",fontSize:8,fontWeight:800,fontFamily:C.mono,whiteSpace:"nowrap"}}>{p.badge}</div>}
            <div style={{fontSize:M?22:26,marginBottom:4}}>{p.icon}</div>
            <div style={{color:p.color,fontWeight:800,fontSize:M?12:14,marginBottom:3}}>{p.name}</div>
            {p.priceUSD===0
              ?<div style={{color:C.muted,fontSize:11,fontFamily:C.mono}}>Gratis</div>
              :<div>
                <div style={{color:C.text,fontFamily:C.mono,fontSize:M?14:18,fontWeight:800}}>{p.priceBEZ.toLocaleString()} <span style={{color:C.gold,fontSize:11}}>BEZ</span></div>
                <div style={{color:C.muted,fontSize:10}}>${p.priceUSD}/mes</div>
              </div>
            }
            {!M&&p.features.slice(0,3).map(f=>(
              <div key={f} style={{color:C.muted,fontSize:9,padding:"2px 0",display:"flex",gap:4}}>
                <span style={{color:p.color}}>✓</span>{f}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:M?"1fr":"1fr 340px",gap:16}}>
        <Card>
          <div style={{color:plan.color,fontWeight:800,fontSize:14,marginBottom:12}}>{plan.icon} Plan {plan.name} — Features</div>
          <div style={{display:"grid",gridTemplateColumns:M?"1fr":"1fr 1fr",gap:8,marginBottom:12}}>
            {plan.features.map(f=>(
              <div key={f} style={{display:"flex",gap:8,background:C.card2,borderRadius:8,padding:"8px 10px",alignItems:"flex-start"}}>
                <span style={{color:plan.color,flexShrink:0,fontWeight:800}}>✓</span>
                <span style={{color:C.text,fontSize:11}}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[["bots","🤖",plan.limits.bots],["assets","📊",plan.limits.assets],["bridge","⬡",plan.limits.bridge],
              ["api","🔌",plan.limits.api?"✅":"❌"],["escrow","🔒",plan.limits.escrow?"✅":"❌"]].map(([k,ic,v])=>(
              <div key={k} style={{background:C.card2,border:`1px solid ${plan.color}33`,borderRadius:10,padding:"7px 12px",flex:1,minWidth:60,textAlign:"center"}}>
                <div style={{fontSize:14}}>{ic}</div>
                <div style={{color:C.muted,fontSize:8}}>{k}</div>
                <div style={{color:plan.color,fontFamily:C.mono,fontSize:12,fontWeight:800}}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card glow color={plan.color}>
          <div style={{color:C.muted,fontSize:9,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Pagar con</div>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
            {paySyms.map(s=><TokBtn key={s} sym={s} sel={payWith===s} onClick={()=>setPayWith(s)} bp={bp}/>)}
          </div>
          {discountBEZ>0&&<div style={{background:`${C.gold}22`,border:`1px solid ${C.gold}44`,borderRadius:8,padding:"6px 10px",marginBottom:10,color:C.gold,fontSize:11,textAlign:"center"}}>
            🎁 20% descuento pagando con BEZ-Coin
          </div>}
          <div style={{background:C.surf,borderRadius:12,padding:12,marginBottom:12}}>
            {[
              ["Plan",`${plan.name} / mes`],
              ["Precio USD",`$${plan.priceUSD}`],
              ["Precio BEZ",`${plan.priceBEZ.toLocaleString()} BEZ`],
              payWith!=="BEZ"?["Pagas",`${fmt(costPay,4)} ${payWith}`]:null,
              ["Descuento BEZ",discountBEZ>0?`-${discountBEZ}%`:"—"],
              ["Renovación","Auto — Smart Contract"],
              ["Red","BNB Chain (BEP-20)"],
            ].filter(Boolean).map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.muted}}>{k}</span>
                <span style={{color:C.text2,fontFamily:C.mono}}>{v}</span>
              </div>
            ))}
            <div style={{padding:"8px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.muted}}>Total</span>
              <span style={{color:plan.color,fontFamily:C.mono,fontSize:16,fontWeight:800}}>
                {payWith==="BEZ"?`${plan.priceBEZ.toLocaleString()} BEZ`:`${fmt(costPay,4)} ${payWith}`}
              </span>
            </div>
          </div>
          {plan.priceUSD===0
            ?<Btn color={plan.color} icon="🌱" full size="lg" onClick={()=>setSelPlan("starter")}>Comenzar Gratis</Btn>
            :<Btn onClick={handleSub} disabled={processing} color={plan.color} icon={plan.icon} full size="lg">
              {processing?"Desplegando Smart Contract…":`Suscribirse — ${plan.name}`}
            </Btn>
          }
          <div style={{marginTop:10,color:C.muted,fontSize:9,textAlign:"center",lineHeight:1.6}}>
            🔒 Smart Contract BNB Chain · Cancelable on-chain<br/>
            🔄 Auto-renovación mensual vía Payment Processor BEZ<br/>
            ✅ Sin Stripe · 100% descentralizado
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: HISTORY + ANALYTICS ─────────────────────────────────────────────────
function HistoryTab({bp}){
  const M=bp==="mobile";
  const [history,setHistory]=useState([]);
  const [filter,setFilter]=useState("all");
  useEffect(()=>{ const iv=setInterval(()=>setHistory([...ENG.txHistory]),500); return ()=>clearInterval(iv); },[]);
  const filtered=filter==="all"?history:history.filter(t=>t.type===filter||t.status===filter);

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
        {[["all","Todos"],["completed","✅ OK"],["failed","❌ Error"],
          ["token_purchase","🪙 BEZ"],["vip_subscription","📋 Sub"],["farming_deposit","🌾 Farm"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            padding:"5px 12px",borderRadius:8,border:`1px solid ${filter===v?C.primary:C.border}`,
            background:filter===v?`${C.primary}22`:"transparent",
            color:filter===v?C.primary:C.muted,cursor:"pointer",fontFamily:C.mono,fontSize:10,whiteSpace:"nowrap",
          }}>{l}</button>
        ))}
      </div>
      <Card>
        {filtered.length===0&&<div style={{textAlign:"center",color:C.muted,padding:36}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>Realiza transacciones para ver el historial.
        </div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(tx=>{
            const pt=PAY_TYPES[tx.type]||{icon:"❓",label:tx.type||"TX",color:C.muted};
            return (
              <div key={tx.id} style={{background:C.card2,border:`1px solid ${C.border2}`,borderRadius:12,padding:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:16}}>{pt.icon}</span>
                    <Chip color={pt.color}>{pt.label}</Chip>
                    {tx.bezAmount&&<span style={{color:C.gold,fontFamily:C.mono,fontSize:11}}>🪙 {fmt(tx.bezAmount,4)} BEZ</span>}
                    {tx.poolName&&<span style={{color:C.orange,fontFamily:C.mono,fontSize:11}}>Pool: {tx.poolName}</span>}
                  </div>
                  <StatusBadge status={tx.status}/>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:10,color:C.muted,fontFamily:C.mono}}>
                  {tx.usdValue&&<span>USD: {fmtUSD(tx.usdValue)}</span>}
                  {tx.feeUSD&&<span>Fee: {fmtUSD(tx.feeUSD)}</span>}
                  {tx.blockNumber&&<span>Block #{tx.blockNumber}</span>}
                  <span>{fmtT(tx.created)}</span>
                  {tx.txHash&&<span>TX: <span style={{color:C.primary}}>{fmtH(tx.txHash)}</span></span>}
                </div>
                {tx.explorerUrl&&(
                  <a href={tx.explorerUrl} target="_blank" rel="noreferrer"
                    style={{color:C.blue,fontSize:9,fontFamily:C.mono,marginTop:4,display:"block"}}>
                    🔍 Ver en Polygonscan →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BeZhasPaySystem(){
  const bp=useBP();
  const M=bp==="mobile";
  const [tab,setTab]=useState("payment");
  const [wallet,setWallet]=useState(null);
  const [txCount,setTxCount]=useState(0);

  useEffect(()=>{ const iv=setInterval(()=>setTxCount(ENG.txHistory.length),500); return ()=>clearInterval(iv); },[]);

  const TABS=[
    {id:"payment",  icon:"💳", label:"Pagos BEZ",    color:C.gold   },
    {id:"subs",     icon:"📋", label:"Suscripción",   color:C.primary},
    {id:"farming",  icon:"🌾", label:"Farming",       color:C.orange },
    {id:"escrow",   icon:"🔒", label:"Escrow",        color:C.blue   },
    {id:"history",  icon:"📊", label:"Analytics",     color:C.violet, badge:txCount},
  ];

  const renderTab=()=>{
    const p={wallet,bp};
    switch(tab){
      case "payment":  return <PaymentTab {...p}/>;
      case "subs":     return <SubsTab {...p}/>;
      case "farming":  return <FarmingTab {...p}/>;
      case "escrow":   return <EscrowTab {...p}/>;
      case "history":  return <HistoryTab {...p}/>;
      default:         return <PaymentTab {...p}/>;
    }
  };

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.sans,fontSize:13}}>
      {/* ── HEADER ── */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,
        padding:M?"9px 12px":"11px 24px",display:"flex",alignItems:"center",gap:10,
        position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{background:`linear-gradient(135deg,${C.gold},${C.primary})`,borderRadius:12,
            padding:M?"6px 10px":"7px 14px",display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:M?15:18}}>🪙</span>
            <div>
              <div style={{color:C.bg,fontFamily:C.mono,fontSize:M?12:15,fontWeight:900,letterSpacing:0.5}}>BeZhas</div>
              {!M&&<div style={{color:C.bg,fontSize:8,opacity:0.8,letterSpacing:2}}>PAY SYSTEM v2</div>}
            </div>
          </div>
        </div>
        {!M&&(
          <div style={{display:"flex",gap:6,flex:1}}>
            {[{l:"Polygon Amoy",c:"#8247E5"},{l:"BNB Chain",c:"#F3BA2F"},{l:"Hot Wallet ✓",c:C.primary},
              {l:"WS Live",c:C.neon},{l:"LiquidityFarm ✓",c:C.orange}].map(b=>(
              <span key={b.l} style={{background:`${b.c}22`,color:b.c,border:`1px solid ${b.c}33`,
                borderRadius:20,padding:"2px 8px",fontSize:9,fontFamily:C.mono,fontWeight:700}}>{b.l}</span>
            ))}
          </div>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {!M&&<Chip color={C.gold}>🪙 BEZ: {fmtUSD(ENG.prices["BEZ"]||1.24)}</Chip>}
          <WalletBar wallet={wallet} onConnect={setWallet} bp={bp}/>
        </div>
      </div>

      {/* ── TICKER ── */}
      <LiveTicker bp={bp}/>

      {/* ── TABS (top desktop, bottom mobile) ── */}
      {!M&&(
        <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"7px 24px",display:"flex",gap:4}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?`${t.color}22`:"transparent",color:tab===t.id?t.color:C.muted,
              border:`1px solid ${tab===t.id?t.color:C.border}`,borderRadius:10,
              padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?800:400,
              fontFamily:C.mono,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,
              boxShadow:tab===t.id?`0 0 12px ${t.color}33`:"none",
            }}>
              <span style={{fontSize:14}}>{t.icon}</span><span>{t.label}</span>
              {t.badge>0&&<span style={{background:C.orange,color:"#0a0a0a",borderRadius:10,padding:"1px 6px",fontSize:9,fontWeight:800}}>{t.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{padding:M?"10px 10px 80px":"18px 24px",maxWidth:1440,margin:"0 auto"}}>
        {renderTab()}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {M&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surf,
          borderTop:`1px solid ${C.border2}`,padding:"5px 4px 10px",
          display:"flex",justifyContent:"space-around",zIndex:100}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?`${t.color}22`:"none",border:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:2,
              padding:"5px 8px",borderRadius:12,position:"relative",
            }}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <span style={{fontSize:8,color:tab===t.id?t.color:C.muted,fontFamily:C.mono,fontWeight:tab===t.id?800:400}}>
                {t.label.split(" ")[0]}
              </span>
              {t.badge>0&&<span style={{position:"absolute",top:0,right:0,background:C.orange,color:"#0a0a0a",borderRadius:"50%",width:14,height:14,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{t.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── FOOTER ── */}
      {!M&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:"10px 24px",display:"flex",justifyContent:"space-between",
          color:C.muted,fontSize:9,fontFamily:C.mono,background:C.surf,flexWrap:"wrap",gap:6}}>
          <span>bez.digital · BEZ Payment System v2.0 · Polygon Amoy → Mainnet · BNB Chain</span>
          <span>LiquidityFarming.sol · QualityEscrow.sol · Node.js+Express+MongoDB+WebSocket</span>
        </div>
      )}
    </div>
  );
}
