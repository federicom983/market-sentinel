import { useState, useEffect, useCallback, useRef } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap";
document.head.appendChild(fontLink);

const REFRESH_INTERVAL = 60 * 60;
const BACKEND_URL      = "https://market-sentinel-backend-production.up.railway.app";
const LS_POLY_KEY      = "ms_polygon_key";
const LS_FRED_KEY      = "ms_fred_key";
const LS_TG_TOKEN      = "ms_tg_token";
const LS_TG_CHAT       = "ms_tg_chat";
const LS_NEWS_KEY      = "ms_news_key";
const LS_DOT_PLOT      = "ms_dot_plot";
const SIGNAL_THRESHOLD = 56; // score >= 56 → buona opportunità → alert

const EU_EM_TICKERS = ["VGK","EWG","EWU","EEM","VEA"];

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080b0f; }
  .sentinel { min-height: 100vh; background: #080b0f; color: #c8d0d8; font-family: 'Space Mono', monospace; font-size: 13px; line-height: 1.6; padding: 24px; }

  .header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid #1e2830; padding-bottom: 16px; margin-bottom: 20px; }
  .header-left { display: flex; align-items: baseline; gap: 16px; }
  .logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
  .logo span { color: #00e5a0; }
  .tagline { color: #3d5060; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }
  .clock { color: #3d5060; font-size: 11px; }

  /* OPPORTUNITY BANNER */
  .opp-banner { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid; transition: all 0.5s ease; font-size: 13px; font-family: 'Syne', sans-serif; font-weight: 600; }
  .opp-banner.great  { background: rgba(0,229,160,0.08);  border-color: #00e5a0; color: #00e5a0; }
  .opp-banner.good   { background: rgba(100,200,100,0.06); border-color: #7acc7a; color: #7acc7a; }
  .opp-banner.neutral{ background: rgba(180,180,180,0.05); border-color: #5a7080; color: #5a7080; }
  .opp-banner.avoid  { background: rgba(255,60,60,0.07);  border-color: #ff6060; color: #ff6060; }
  .opp-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; animation: pulse 2s infinite; }
  .opp-banner.great .opp-dot  { background: #00e5a0; box-shadow: 0 0 10px #00e5a0; }
  .opp-banner.good .opp-dot   { background: #7acc7a; box-shadow: 0 0 8px #7acc7a; }
  .opp-banner.neutral .opp-dot{ background: #5a7080; box-shadow: none; animation: none; }
  .opp-banner.avoid .opp-dot  { background: #ff6060; box-shadow: 0 0 8px #ff6060; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.5;transform:scale(0.8);} }

  /* ASSET CLASS SIGNALS */
  .asset-strip { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .asset-pill { display: flex; flex-direction: column; align-items: center; padding: 8px 14px; border-radius: 6px; border: 1px solid; min-width: 100px; transition: all 0.4s; }
  .asset-pill.great  { background: rgba(0,229,160,0.07);  border-color: rgba(0,229,160,0.3);  }
  .asset-pill.good   { background: rgba(122,204,122,0.07); border-color: rgba(122,204,122,0.3); }
  .asset-pill.neutral{ background: rgba(90,112,128,0.07);  border-color: rgba(90,112,128,0.3);  }
  .asset-pill.avoid  { background: rgba(255,96,96,0.07);   border-color: rgba(255,96,96,0.3);   }
  .asset-pill-name { font-size: 10px; color: #5a7080; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .asset-pill-score { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; }
  .asset-pill-label { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }

  .scheduler-bar { display: flex; align-items: center; gap: 14px; background: #080b0f; border: 1px solid #1a2330; border-radius: 6px; padding: 10px 16px; margin-bottom: 10px; font-size: 11px; }
  .scheduler-dot { width: 6px; height: 6px; border-radius: 50%; background: #00e5a0; box-shadow: 0 0 6px #00e5a0; flex-shrink: 0; animation: pulse 2s infinite; }
  .scheduler-dot.off { background: #3d5060; box-shadow: none; animation: none; }
  .scheduler-label { color: #3d5060; }
  .scheduler-countdown { color: #00e5a0; font-weight: 700; min-width: 50px; }
  .scheduler-countdown.off { color: #3d5060; }
  .btn-sm { background: transparent; border: 1px solid #1a3550; color: #5a7080; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .btn-sm:hover { border-color: #00e5a0; color: #00e5a0; }
  .btn-sm.active { border-color: #ff6060; color: #ff6060; }
  .btn-sm.yellow:hover { border-color: #ffbe00; color: #ffbe00; }
  .btn-sm:disabled { opacity: 0.3; cursor: not-allowed; }
  .keys-status { font-size: 10px; margin-left: auto; }

  .apikey-bar { display: flex; gap: 10px; align-items: center; background: #0d1219; border: 1px solid #1a2330; border-radius: 6px; padding: 11px 16px; margin-bottom: 8px; }
  .apikey-label { font-size: 10px; color: #3d5060; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; min-width: 110px; }
  .apikey-input { flex: 1; background: #080b0f; border: 1px solid #1a2330; color: #c8d0d8; font-family: 'Space Mono', monospace; font-size: 12px; padding: 6px 10px; border-radius: 4px; outline: none; transition: border-color 0.2s; }
  .apikey-input:focus { border-color: #2a3f55; }
  .btn-fetch { background: #0d1e2e; border: 1px solid #1a3550; color: #00e5a0; font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 6px 14px; border-radius: 4px; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
  .btn-fetch:hover { background: #112234; border-color: #00e5a0; }
  .btn-fetch:disabled { opacity: 0.4; cursor: not-allowed; }
  .fetch-status { font-size: 11px; white-space: nowrap; min-width: 160px; }
  .btn-clear { background: transparent; border: none; color: #3d5060; font-size: 10px; cursor: pointer; padding: 4px; transition: color 0.2s; }
  .btn-clear:hover { color: #ff6060; }

  .dot-plot-bar { display: flex; gap: 10px; align-items: center; background: #0a1a10; border: 1px solid #1a3520; border-radius: 6px; padding: 11px 16px; margin-bottom: 8px; }
  .dot-plot-label { font-size: 10px; color: #2a5030; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; min-width: 110px; }
  .dot-plot-status { font-size: 11px; white-space: nowrap; }

  .tg-bar { display: flex; gap: 10px; align-items: center; background: #0a1520; border: 1px solid #1a2d40; border-radius: 6px; padding: 11px 16px; margin-bottom: 10px; }
  .tg-label { font-size: 10px; color: #2a5070; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; min-width: 110px; }
  .tg-status { font-size: 10px; white-space: nowrap; }
  .btn-test { background: transparent; border: 1px solid #1a3550; color: #3d8fb5; font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 3px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .btn-test:hover { border-color: #3d8fb5; }
  .btn-test:disabled { opacity: 0.3; cursor: not-allowed; }

  .market-section-label { font-size: 10px; color: #3d5060; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; margin-top: 8px; }
  .market-strip { display: flex; gap: 0; flex-wrap: wrap; margin-bottom: 8px; background: #0d1219; border: 1px solid #1a2330; border-radius: 6px; overflow: hidden; }
  .mk-item { display: flex; flex-direction: column; padding: 10px 16px; border-right: 1px solid #1a2330; flex: 1; min-width: 90px; }
  .mk-item:last-child { border-right: none; }
  .mk-name { font-size: 9px; color: #3d5060; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .mk-val { font-size: 13px; font-weight: 700; font-family: 'Syne', sans-serif; color: #c8d0d8; }
  .mk-chg { font-size: 10px; }
  .mk-src { font-size: 9px; color: #2a3f55; margin-top: 1px; }
  .pos { color: #00e5a0; } .neg { color: #ff6060; } .neu { color: #5a7080; }

  .grid-main   { display: grid; grid-template-columns: 240px 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .grid-bottom { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; }
  .card { background: #0d1219; border: 1px solid #1a2330; border-radius: 6px; padding: 18px; }
  .card-title { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #3d5060; margin-bottom: 14px; }

  .gauge-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .gauge-score { font-family: 'Syne', sans-serif; font-size: 46px; font-weight: 800; line-height: 1; text-align: center; letter-spacing: -2px; }
  .gauge-sublabel { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; text-align: center; color: #3d5060; }
  .gauge-breakdown { width: 100%; margin-top: 8px; }
  .gb-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid #111; font-size: 11px; }
  .gb-row:last-child { border: none; }
  .gb-label { color: #3d5060; }
  .gb-bar-wrap { flex: 1; margin: 0 8px; height: 3px; background: #1a2330; border-radius: 2px; }
  .gb-bar { height: 100%; border-radius: 2px; transition: width 0.8s ease; }

  .sig-table { width: 100%; border-collapse: collapse; }
  .sig-table tr { border-bottom: 1px solid #111; }
  .sig-table tr:last-child { border: none; }
  .sig-table td { padding: 7px 0; vertical-align: middle; }
  .sig-name { color: #8fa0b0; font-size: 11px; width: 52%; }
  .sig-val { font-size: 11px; font-weight: 700; width: 20%; text-align: right; padding-right: 8px !important; }
  .sig-badge { display: inline-block; padding: 2px 6px; border-radius: 2px; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; float: right; }
  .badge-green  { background: rgba(0,229,160,0.12); color: #00e5a0; }
  .badge-yellow { background: rgba(255,190,0,0.12);  color: #ffbe00; }
  .badge-red    { background: rgba(255,96,96,0.12);   color: #ff6060; }
  .badge-gray   { background: rgba(100,120,140,0.12); color: #5a7080; }

  .subscore-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .subscore-pill { flex: 1; text-align: center; padding: 6px 4px; background: #080b0f; border-radius: 4px; border: 1px solid #1a2330; }
  .subscore-pill-label { font-size: 9px; color: #3d5060; letter-spacing: 1px; text-transform: uppercase; }
  .subscore-pill-val { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; }

  .data-tag { display: inline-block; padding: 1px 6px; border-radius: 2px; font-size: 9px; letter-spacing: 1px; margin-left: 6px; vertical-align: middle; }
  .data-tag.live { background: rgba(0,229,160,0.1); color: #00e5a0; }
  .data-tag.wait { background: rgba(90,112,128,0.15); color: #5a7080; }

  .news-input { width: 100%; background: #080b0f; border: 1px solid #1a2330; color: #c8d0d8; font-family: 'Space Mono', monospace; font-size: 12px; padding: 10px 12px; border-radius: 4px; resize: vertical; min-height: 70px; outline: none; line-height: 1.5; transition: border-color 0.2s; }
  .news-input:focus { border-color: #2a3f55; }
  .news-input::placeholder { color: #2a3f55; }
  .news-actions { display: flex; gap: 8px; margin-top: 8px; }
  .btn-analyze { flex: 1; background: #0d1e2e; border: 1px solid #1a3550; color: #00e5a0; font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 9px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
  .btn-analyze:hover { background: #112234; border-color: #00e5a0; }
  .btn-analyze:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-fetch-news { background: #0d1a2e; border: 1px solid #1a3040; color: #3d8fb5; font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 9px 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .btn-fetch-news:hover { background: #0f2035; border-color: #3d8fb5; }
  .btn-fetch-news:disabled { opacity: 0.4; cursor: not-allowed; }

  .ai-result { margin-top: 12px; padding: 12px; background: #080b0f; border: 1px solid #1a2330; border-radius: 4px; font-size: 11px; line-height: 1.8; color: #8fa0b0; animation: fadeIn 0.4s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(4px);} to{opacity:1;transform:none;} }
  .ai-score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .ai-score-num { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; }
  .ai-score-label { font-size: 10px; letter-spacing: 2px; color: #3d5060; text-transform: uppercase; }

  .alert-history { display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; }
  .ah-item { display: flex; gap: 10px; padding: 7px 10px; background: #080b0f; border-radius: 3px; border-left: 2px solid; font-size: 11px; line-height: 1.5; }
  .ah-time { color: #3d5060; white-space: nowrap; min-width: 50px; }
  .ah-text { color: #8fa0b0; }
  .section-note { font-size: 10px; color: #2a3f55; margin-top: 8px; border-top: 1px solid #111; padding-top: 8px; font-style: italic; }
  .skeleton { background: linear-gradient(90deg,#1a2330 25%,#1e2a3a 50%,#1a2330 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:3px; display:inline-block; height:12px; }
  @keyframes shimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
  .loading-dots::after { content:'...'; display:inline-block; animation:dots 1.2s steps(4,end) infinite; }
  @keyframes dots { 0%,20%{content:'.';} 40%{content:'..';} 60%,100%{content:'...';} }
  .legend-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px; font-size: 11px; color: #8fa0b0; line-height: 1.7; }
  .legend-title { color: #c8d0d8; font-weight: 700; margin-bottom: 6px; }
`;

// ─── INDICATORS ───────────────────────────────────────────────────────────────
function calcRSI(closes, period=14) {
  if (closes.length<period+1) return null;
  let gains=0,losses=0;
  for(let i=closes.length-period;i<closes.length;i++){
    const d=closes[i]-closes[i-1];if(d>0)gains+=d;else losses-=d;
  }
  const ag=gains/period,al=losses/period;
  if(al===0)return 100;
  return parseFloat((100-100/(1+ag/al)).toFixed(1));
}
function calcSMA(arr,n){if(arr.length<n)return null;return arr.slice(-n).reduce((a,b)=>a+b,0)/n;}
function calcEMA(arr,n){
  if(arr.length<n)return null;
  const k=2/(n+1);let ema=arr.slice(0,n).reduce((a,b)=>a+b,0)/n;
  for(let i=n;i<arr.length;i++)ema=arr[i]*k+ema*(1-k);return ema;
}
function calcMACD(arr){const e12=calcEMA(arr,12),e26=calcEMA(arr,26);if(!e12||!e26)return null;return parseFloat((e12-e26).toFixed(2));}

// ─── SCORING DCA ──────────────────────────────────────────────────────────────
// Alto score = alta opportunità di ingresso (mercato depresso)
const oppColor=(s)=>s>=76?"#00e5a0":s>=56?"#7acc7a":s>=31?"#5a7080":"#ff6060";
const oppClass=(s)=>s>=76?"great":s>=56?"good":s>=31?"neutral":"avoid";

const oppLabel=(s)=>{
  if(s>=76)return{text:"🟢 OTTIMA OPPORTUNITÀ — Considera di massimizzare il PAC",cls:"great"};
  if(s>=56)return{text:"🟡 BUONA OPPORTUNITÀ — Considera di incrementare il PAC",cls:"good"};
  if(s>=31)return{text:"⚪ MERCATO NEUTRO — PAC ordinario come da piano",cls:"neutral"};
  return{text:"🔴 MERCATO CARO — Riduci o sospendi nuovi ingressi",cls:"avoid"};
};

// RSI per DCA: basso RSI = alta opportunità
const scoreRSI_DCA=(r)=>!r?50:r<20?90:r<30?80:r<40?65:r<50?55:r<60?40:r<70?30:20;
// VIXY per DCA: alta volatilità = paura = opportunità
const scoreVIXY_DCA=(v)=>!v?50:v>35?85:v>25?75:v>20?60:v>15?45:30;
// MA Cross per DCA: death cross = mercato in caduta = opportunità futura
const scoreMACross_DCA=(a,b)=>!a||!b?50:a/b<0.95?80:a/b<0.98?70:a/b<1.0?55:a/b<1.05?40:25;
// MACD per DCA: molto negativo = oversold = opportunità
const scoreMACDFn_DCA=(m)=>!m?50:m<-8?85:m<-5?75:m<-2?60:m<0?50:m<3?40:30;

const badgeFn=(sc)=>sc>=70?"green":sc>=45?"yellow":"red";

// ─── ASSET CLASS SCORING ──────────────────────────────────────────────────────
function calcAssetScores({techScoreUS, techScoreEU, macroScoreUS, macroScoreEU, sentScore, techSignalsUS, marketDataUS}){
  const gld = marketDataUS?.find(m=>m.name.includes("GLD"));
  const gldScore = gld ? (gld.dir==="pos" ? 40 : 65) : 50; // oro in salita = paura = azionario depresso

  return [
    { name:"🇺🇸 ETF USA",    score: Math.round(techScoreUS*0.6+macroScoreUS*0.4),    asset:"us"  },
    { name:"🇪🇺 ETF Europa",  score: Math.round(techScoreEU*0.6+macroScoreEU*0.4),    asset:"eu"  },
    { name:"🌍 ETF EM",       score: Math.round(techScoreEU*0.7+macroScoreEU*0.3),    asset:"em"  },
    { name:"📊 Bond",         score: Math.round((100-macroScoreUS)*0.5+(100-macroScoreEU)*0.5), asset:"bond"},
    { name:"🥇 Materie prime",score: gldScore,                                         asset:"gold"},
  ];
}

// ─── POLYGON ─────────────────────────────────────────────────────────────────
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const DELAY=13500;
async function polyGet(path,key){
  const sep=path.includes("?")?"&":"?";
  const r=await fetch(`https://api.polygon.io${path}${sep}apiKey=${key}`);
  if(!r.ok)throw new Error(`Polygon ${r.status}`);
  return r.json();
}
function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().split("T")[0];}
async function getBars(ticker,key,days=280){
  const data=await polyGet(`/v2/aggs/ticker/${ticker}/range/1/day/${daysAgo(days+30)}/${daysAgo(1)}?adjusted=true&sort=asc&limit=300`,key);
  if(!data.results?.length)throw new Error(`No data ${ticker}`);
  return data.results;
}
async function getPrev(ticker,key){
  const data=await polyGet(`/v2/aggs/ticker/${ticker}/prev`,key);
  if(!data.results?.length)throw new Error(`No prev ${ticker}`);
  return data.results[0];
}

// ─── BACKEND CALLS ────────────────────────────────────────────────────────────
async function fetchFredData(k, dotPlot){
  const params = dotPlot ? `&dot_plot_median=${dotPlot}` : "";
  const r=await fetch(`${BACKEND_URL}/api/fred-data?api_key=${k}${params}`);
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);}
  return r.json();
}
async function fetchNews(k){
  const r=await fetch(`${BACKEND_URL}/api/news?api_key=${k}`);
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);}
  return r.json();
}
async function fetchConsultingNews(k){
  const r=await fetch(`${BACKEND_URL}/api/consulting-news?api_key=${k}`);
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);}
  return r.json();
}
async function backendSentiment(text){
  const r=await fetch(`${BACKEND_URL}/api/sentiment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);}
  return r.json();
}
async function backendConsulting(text){
  const r=await fetch(`${BACKEND_URL}/api/consulting-sentiment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);}
  return r.json();
}
async function sendTelegramAlert(payload){
  const r=await fetch(`${BACKEND_URL}/api/send-alert`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);}
  return r.json();
}

function formatCountdown(secs){
  return `${Math.floor(secs/60).toString().padStart(2,"0")}:${(secs%60).toString().padStart(2,"0")}`;
}

// ─── GAUGE ───────────────────────────────────────────────────────────────────
function OppGauge({score}){
  const color=oppColor(score);
  const toRad=d=>d*Math.PI/180;
  const arc=(s,e,r)=>{
    const x1=100+r*Math.cos(toRad(s)),y1=100+r*Math.sin(toRad(s));
    const x2=100+r*Math.cos(toRad(e)),y2=100+r*Math.sin(toRad(e));
    return `M ${x1} ${y1} A ${r} ${r} 0 ${e-s>180?1:0} 1 ${x2} ${y2}`;
  };
  return(
    <svg viewBox="0 0 200 140" width="180" height="126" style={{filter:`drop-shadow(0 0 10px ${color}30)`}}>
      <path d={arc(200,540,80)} fill="none" stroke="#1a2330" strokeWidth="12" strokeLinecap="round"/>
      <path d={arc(200,200+(score/100)*340,80)} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        style={{filter:`drop-shadow(0 0 6px ${color})`,transition:"all 1s ease"}}/>
      <text x="100" y="104" textAnchor="middle" fill={color}
        style={{fontFamily:"'Syne',sans-serif",fontSize:36,fontWeight:800}}>{score}</text>
      <text x="100" y="120" textAnchor="middle" fill="#3d5060"
        style={{fontFamily:"'Space Mono',monospace",fontSize:8,letterSpacing:2}}>OPPORTUNITY SCORE</text>
    </svg>
  );
}

function SigRow({name,val,badge,label,shimmer}){
  const valColor=badge==="green"?"#00e5a0":badge==="yellow"?"#ffbe00":badge==="red"?"#ff6060":"#5a7080";
  return(
    <tr>
      <td className="sig-name">{name}</td>
      <td className="sig-val" style={{color:valColor}}>{shimmer?<span className="skeleton" style={{width:40}}/>:val}</td>
      <td><span className={`sig-badge badge-${badge||"gray"}`}>{shimmer?"—":label}</span></td>
    </tr>
  );
}

const EMPTY_MKT_US = ["S&P500 (SPY)","Nasdaq (QQQ)","VIXY","Gold (GLD)","Dollar (UUP)"].map(n=>({name:n,val:"—",chg:"—",dir:"neu"}));
const EMPTY_MKT_EU = ["Europa (VGK)","DAX (EWG)","FTSE (EWU)","Emergenti (EEM)","Dev ex-US (VEA)"].map(n=>({name:n,val:"—",chg:"—",dir:"neu"}));
const EMPTY_TECH_US = ["VIXY","RSI SPY 14d","RSI QQQ 14d","SPY MA50/MA200","MACD SPY"].map(n=>({name:n,val:"—",badge:"gray",label:"—"}));
const EMPTY_TECH_EU = ["RSI VGK 14d","RSI EWG 14d","RSI EWU 14d","RSI EEM 14d","RSI VEA 14d"].map(n=>({name:n,val:"—",badge:"gray",label:"—"}));
const EMPTY_MACRO_US = ["CPI YoY (US)","Fed Funds Rate","Consumer Sent.","Yield 10Y−2Y","Disoccupaz. US"].map(n=>({name:n,val:"—",badge:"gray",label:"—"}));
const EMPTY_MACRO_EU = ["BCE Deposit Rate","HICP YoY (EU)","EUR/USD"].map(n=>({name:n,val:"—",badge:"gray",label:"—"}));

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function MarketSentinel(){
  const [polyKey,setPolyKeyRaw] = useState(()=>localStorage.getItem(LS_POLY_KEY)||"");
  const [fredKey,setFredKeyRaw] = useState(()=>localStorage.getItem(LS_FRED_KEY)||"");
  const [tgToken,setTgTokenRaw] = useState(()=>localStorage.getItem(LS_TG_TOKEN)||"");
  const [tgChat,setTgChatRaw]   = useState(()=>localStorage.getItem(LS_TG_CHAT)||"");
  const [newsKey,setNewsKeyRaw] = useState(()=>localStorage.getItem(LS_NEWS_KEY)||"");
  const [dotPlot,setDotPlotRaw] = useState(()=>localStorage.getItem(LS_DOT_PLOT)||"");

  const setPolyKey=v=>{setPolyKeyRaw(v);v?localStorage.setItem(LS_POLY_KEY,v):localStorage.removeItem(LS_POLY_KEY);};
  const setFredKey=v=>{setFredKeyRaw(v);v?localStorage.setItem(LS_FRED_KEY,v):localStorage.removeItem(LS_FRED_KEY);};
  const setTgToken=v=>{setTgTokenRaw(v);v?localStorage.setItem(LS_TG_TOKEN,v):localStorage.removeItem(LS_TG_TOKEN);};
  const setTgChat=v=>{setTgChatRaw(v);v?localStorage.setItem(LS_TG_CHAT,v):localStorage.removeItem(LS_TG_CHAT);};
  const setNewsKey=v=>{setNewsKeyRaw(v);v?localStorage.setItem(LS_NEWS_KEY,v):localStorage.removeItem(LS_NEWS_KEY);};
  const setDotPlot=v=>{setDotPlotRaw(v);v?localStorage.setItem(LS_DOT_PLOT,v):localStorage.removeItem(LS_DOT_PLOT);};

  const [clock,setClock]                 = useState("");
  const [polyStatus,setPolyStatus]       = useState(null);
  const [polyMsg,setPolyMsg]             = useState("");
  const [polyUpdate,setPolyUpdate]       = useState(null);
  const [marketDataUS,setMarketDataUS]   = useState(null);
  const [marketDataEU,setMarketDataEU]   = useState(null);
  const [techSignalsUS,setTechSignalsUS] = useState(null);
  const [techSignalsEU,setTechSignalsEU] = useState(null);
  const [techScoreUS,setTechScoreUS]     = useState(null);
  const [techScoreEU,setTechScoreEU]     = useState(null);
  const [fredStatus,setFredStatus]       = useState(null);
  const [fredMsg,setFredMsg]             = useState("");
  const [fredUpdate,setFredUpdate]       = useState(null);
  const [macroSignalsUS,setMacroSignalsUS] = useState(null);
  const [macroSignalsEU,setMacroSignalsEU] = useState(null);
  const [macroScoreUS,setMacroScoreUS]   = useState(null);
  const [macroScoreEU,setMacroScoreEU]   = useState(null);
  const [macroScore,setMacroScore]       = useState(null);
  const [dotPlotScore,setDotPlotScore]   = useState(null);
  const [newsText,setNewsText]           = useState("");
  const [newsLoading,setNewsLoading]     = useState(false);
  const [newsCount,setNewsCount]         = useState(null);
  const [aiLoading,setAiLoading]         = useState(false);
  const [sentiment,setSentiment]         = useState(null);
  const [sentScore,setSentScore]         = useState(null);
  const [consultingScore,setConsultingScore] = useState(null);
  const [consultingResult,setConsultingResult] = useState(null);
  const [tgStatus,setTgStatus]           = useState(null);
  const [alerts,setAlerts] = useState([
    {time:"—",color:"#3d5060",text:"Carica i dati per attivare il monitoraggio DCA."},
  ]);

  const [schedulerOn,setSchedulerOn]   = useState(false);
  const [countdown,setCountdown]       = useState(REFRESH_INTERVAL);
  const countdownRef                   = useRef(REFRESH_INTERVAL);
  const schedulerIntervalRef           = useRef(null);
  const lastAlertScoreRef              = useRef(null);

  useEffect(()=>{
    const id=setInterval(()=>setClock(
      new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",second:"2-digit"})+" CET"
    ),1000);
    return()=>clearInterval(id);
  },[]);

  // ── TELEGRAM ─────────────────────────────────────────────────────────────────
  const sendAlert=useCallback(async(overall,tScore,mScore,sScore,trigger,topSignals=[])=>{
    if(!tgToken.trim()||!tgChat.trim())return;
    setTgStatus("sending");
    try{
      await sendTelegramAlert({bot_token:tgToken.trim(),chat_id:tgChat.trim(),overall_score:overall,tech_score:tScore,macro_score:mScore,sent_score:sScore,trigger,top_signals:topSignals});
      setTgStatus("ok");
      const t=new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
      setAlerts(p=>[{time:t,color:"#3d8fb5",text:`📱 Alert DCA inviato (opportunity score ${overall})`},...p]);
    }catch{setTgStatus("error");}
  },[tgToken,tgChat]);

  // ── POLYGON ──────────────────────────────────────────────────────────────────
  const fetchPolygon=useCallback(async(key)=>{
    const k=key||polyKey;if(!k.trim())return null;
    setPolyStatus("loading");setPolyMsg("SPY, QQQ…");
    try{
      const spyBars=await getBars("SPY",k,280);await sleep(DELAY);
      setPolyMsg("QQQ…");
      const qqqBars=await getBars("QQQ",k,280);await sleep(DELAY);
      setPolyMsg("VIXY, GLD…");
      let vixyBars=null;try{vixyBars=await getBars("VIXY",k,30);}catch(_){}
      await sleep(DELAY);
      const gldPrev=await getPrev("GLD",k);await sleep(DELAY);
      setPolyMsg("UUP…");
      const uupPrev=await getPrev("UUP",k);await sleep(DELAY);

      const euEmBars={};
      const euEmNames={VGK:"Europa",EWG:"DAX",EWU:"FTSE",EEM:"Emergenti",VEA:"Dev ex-US"};
      for(const ticker of EU_EM_TICKERS){
        setPolyMsg(`${ticker}…`);
        try{euEmBars[ticker]=await getBars(ticker,k,60);}catch(_){euEmBars[ticker]=null;}
        await sleep(DELAY);
      }

      const spyC=spyBars.map(b=>b.c),qqqC=qqqBars.map(b=>b.c);
      const spyLast=spyC.at(-1),spyPrev2=spyC.at(-2);
      const qqqLast=qqqC.at(-1),qqqPrev2=qqqC.at(-2);
      const spyChg=(spyLast-spyPrev2)/spyPrev2*100;
      const qqqChg=(qqqLast-qqqPrev2)/qqqPrev2*100;
      const spyRSI=calcRSI(spyC),qqqRSI=calcRSI(qqqC);
      const ma50=calcSMA(spyC,50),ma200=calcSMA(spyC,200);
      const macd=calcMACD(spyC);
      const vixyLast=vixyBars?.at(-1)?.c??null;
      const vixyPrev=vixyBars?.at(-2)?.c??null;
      const vixyChg=vixyLast&&vixyPrev?(vixyLast-vixyPrev)/vixyPrev*100:null;
      const maRatio=ma50&&ma200?ma50/ma200:null;
      const gldChg=(gldPrev.c-gldPrev.o)/gldPrev.o*100;
      const uupChg=(uupPrev.c-uupPrev.o)/uupPrev.o*100;

      const s1=scoreRSI_DCA(spyRSI),s2=scoreRSI_DCA(qqqRSI),s3=scoreVIXY_DCA(vixyLast),s4=scoreMACross_DCA(ma50,ma200),s5=scoreMACDFn_DCA(macd);
      const usScore=Math.round((s1+s2+s3+s4+s5)/5);

      const sigs=[
        {name:"VIXY",val:vixyLast?vixyLast.toFixed(2):"N/A",score:s3,badge:badgeFn(s3),label:s3>=70?"✓ PAURA":s3>=45?"MODERATO":"BASSO"},
        {name:"RSI SPY 14d",val:spyRSI?.toString()??"N/A",score:s1,badge:badgeFn(s1),label:s1>=70?"✓ OVERSOLD":s1>=45?"MODERATO":"OVERBOUGHT"},
        {name:"RSI QQQ 14d",val:qqqRSI?.toString()??"N/A",score:s2,badge:badgeFn(s2),label:s2>=70?"✓ OVERSOLD":s2>=45?"MODERATO":"OVERBOUGHT"},
        {name:"SPY MA50/MA200",val:maRatio?maRatio.toFixed(3):"N/A",score:s4,badge:badgeFn(s4),label:!maRatio?"N/A":s4>=70?"✓ BASSO":s4>=45?"NEUTRO":"GOLDEN X"},
        {name:"MACD SPY",val:macd?.toString()??"N/A",score:s5,badge:badgeFn(s5),label:s5>=70?"✓ OVERSOLD":s5>=45?"MODERATO":"RIALZISTA"},
      ];
      setTechSignalsUS(sigs);
      setMarketDataUS([
        {name:"S&P500 (SPY)",val:`$${spyLast.toFixed(2)}`,chg:`${spyChg>=0?"+":""}${spyChg.toFixed(2)}%`,dir:spyChg>=0?"pos":"neg"},
        {name:"Nasdaq (QQQ)",val:`$${qqqLast.toFixed(2)}`,chg:`${qqqChg>=0?"+":""}${qqqChg.toFixed(2)}%`,dir:qqqChg>=0?"pos":"neg"},
        {name:"VIXY",val:vixyLast?vixyLast.toFixed(2):"N/A",chg:vixyChg!=null?`${vixyChg>=0?"+":""}${vixyChg.toFixed(2)}%`:"—",dir:(vixyChg??0)>=0?"pos":"neg"},
        {name:"Gold (GLD)",val:`$${gldPrev.c.toFixed(2)}`,chg:`${gldChg>=0?"+":""}${gldChg.toFixed(2)}%`,dir:gldChg>=0?"pos":"neg"},
        {name:"Dollar (UUP)",val:`$${uupPrev.c.toFixed(2)}`,chg:`${uupChg>=0?"+":""}${uupChg.toFixed(2)}%`,dir:uupChg>=0?"pos":"neg"},
      ]);
      setTechScoreUS(usScore);

      const euSigs=[],euMktData=[];let euSum=0,euCount=0;
      for(const ticker of EU_EM_TICKERS){
        const bars=euEmBars[ticker];
        const name=euEmNames[ticker];
        if(bars&&bars.length>15){
          const closes=bars.map(b=>b.c);
          const rsi=calcRSI(closes);
          const last=closes.at(-1),prev=closes.at(-2);
          const chgPct=prev?(last-prev)/prev*100:null;
          const s=scoreRSI_DCA(rsi);
          euSum+=s;euCount++;
          euSigs.push({name:`RSI ${ticker} 14d`,val:rsi?.toString()??"N/A",score:s,badge:badgeFn(s),label:s>=70?"✓ OVERSOLD":s>=45?"MODERATO":"OVERBOUGHT"});
          euMktData.push({name:`${name} (${ticker})`,val:`$${last.toFixed(2)}`,chg:chgPct!=null?`${chgPct>=0?"+":""}${chgPct.toFixed(2)}%`:"—",dir:chgPct>=0?"pos":"neg"});
        } else {
          euSigs.push({name:`RSI ${ticker} 14d`,val:"N/A",score:50,badge:"gray",label:"N/D"});
          euMktData.push({name:`${name} (${ticker})`,val:"—",chg:"—",dir:"neu"});
        }
      }
      const euScore=euCount>0?Math.round(euSum/euCount):50;
      setTechSignalsEU(euSigs);
      setMarketDataEU(euMktData);
      setTechScoreEU(euScore);
      setPolyUpdate(new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}));
      setPolyStatus("ok");setPolyMsg("");

      const topSigs=sigs.filter(s=>s.score>=70).map(s=>`${s.name}: ${s.label}`);
      return{techScoreUS:usScore,techScoreEU:euScore,topSignals:topSigs,marketDataUS:[
        {name:"S&P500 (SPY)",val:`$${spyLast.toFixed(2)}`,chg:`${spyChg>=0?"+":""}${spyChg.toFixed(2)}%`,dir:spyChg>=0?"pos":"neg"},
        {name:"Gold (GLD)",val:`$${gldPrev.c.toFixed(2)}`,chg:`${gldChg>=0?"+":""}${gldChg.toFixed(2)}%`,dir:gldChg>=0?"pos":"neg"},
      ]};
    }catch(e){setPolyStatus("error");setPolyMsg(e.message||"Errore");return null;}
  },[polyKey]);

  // ── FRED ─────────────────────────────────────────────────────────────────────
  const fetchFred=useCallback(async(key)=>{
    const k=key||fredKey;if(!k.trim())return null;
    setFredStatus("loading");setFredMsg("Connessione FRED…");
    try{
      const dotVal=dotPlot?parseFloat(dotPlot):undefined;
      const data=await fetchFredData(k,dotVal);
      setMacroSignalsUS(data.signals);
      setMacroSignalsEU(data.eu_signals);
      setMacroScoreUS(data.us_macro_score);
      setMacroScoreEU(data.eu_macro_score);
      setMacroScore(data.macro_score);
      if(data.dot_plot_score!==null&&data.dot_plot_score!==undefined)setDotPlotScore(data.dot_plot_score);
      setFredUpdate(new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}));
      setFredStatus("ok");setFredMsg("");
      const topSigs=data.signals.filter(s=>s.score>=70).map(s=>`${s.name}: ${s.label}`);
      return{mScore:data.macro_score,topSignals:topSigs};
    }catch(e){setFredStatus("error");setFredMsg(e.message||"Errore");return null;}
  },[fredKey,dotPlot]);

  // ── NEWS ──────────────────────────────────────────────────────────────────────
  const fetchNewsAuto=useCallback(async()=>{
    if(!newsKey.trim())return;
    setNewsLoading(true);
    try{
      const[newsData,consultingData]=await Promise.allSettled([
        fetchNews(newsKey.trim()),
        fetchConsultingNews(newsKey.trim()),
      ]);
      if(newsData.status==="fulfilled"){setNewsText(newsData.value.text);setNewsCount(newsData.value.count);}
      if(consultingData.status==="fulfilled"&&consultingData.value.text){
        try{
          const result=await backendConsulting(consultingData.value.text);
          setConsultingScore(result.opportunity_score);setConsultingResult(result);
        }catch(_){}
      }
    }catch(e){
      const t=new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
      setAlerts(p=>[{time:t,color:"#ff6060",text:`NewsAPI: ${e.message}`},...p]);
    }
    setNewsLoading(false);
  },[newsKey]);

  // ── FETCH ALL ─────────────────────────────────────────────────────────────────
  const fetchAll=useCallback(async()=>{
    const[polyResult,fredResult]=await Promise.allSettled([fetchPolygon(polyKey),fetchFred(fredKey)]);
    const usTS=polyResult.value?.techScoreUS??50;
    const euTS=polyResult.value?.techScoreEU??50;
    const tScore=Math.round((usTS+euTS)/2);
    const mScore=fredResult.value?.mScore??50;
    const sScore=sentScore??50;
    const cScore=consultingScore??50;
    const overall=Math.round(tScore*0.40+mScore*0.25+sScore*0.25+cScore*0.10);
    const topSigs=[...(polyResult.value?.topSignals||[]),...(fredResult.value?.topSignals||[])];
    if(overall>=SIGNAL_THRESHOLD){
      sendAlert(overall,tScore,mScore,sScore,"threshold",topSigs);
    } else {
      sendAlert(overall,tScore,mScore,sScore,"refresh",topSigs);
    }
    lastAlertScoreRef.current=overall;
    if(newsKey.trim())fetchNewsAuto();
    const t=new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
    setAlerts(p=>[{time:t,color:overall>=76?"#00e5a0":overall>=56?"#7acc7a":overall>=31?"#3d5060":"#ff6060",text:`Aggiornato. Opportunity Score: ${overall}/100`},...p]);
  },[fetchPolygon,fetchFred,sentScore,consultingScore,sendAlert,polyKey,fredKey,newsKey,fetchNewsAuto]);

  // ── SCHEDULER ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!schedulerOn){
      if(schedulerIntervalRef.current)clearInterval(schedulerIntervalRef.current);
      setCountdown(REFRESH_INTERVAL);countdownRef.current=REFRESH_INTERVAL;return;
    }
    fetchAll();
    countdownRef.current=REFRESH_INTERVAL;setCountdown(REFRESH_INTERVAL);
    schedulerIntervalRef.current=setInterval(()=>{
      countdownRef.current-=1;setCountdown(countdownRef.current);
      if(countdownRef.current<=0){fetchAll();countdownRef.current=REFRESH_INTERVAL;setCountdown(REFRESH_INTERVAL);}
    },1000);
    return()=>{if(schedulerIntervalRef.current)clearInterval(schedulerIntervalRef.current);};
  },[schedulerOn]); // eslint-disable-line

  useEffect(()=>{
    const pk=localStorage.getItem(LS_POLY_KEY);
    const fk=localStorage.getItem(LS_FRED_KEY);
    if(pk)fetchPolygon(pk);
    if(fk)fetchFred(fk);
  },[]); // eslint-disable-line

  // ── AI SENTIMENT ─────────────────────────────────────────────────────────────
  const handleAnalyze=useCallback(async()=>{
    if(!newsText.trim())return;
    setAiLoading(true);setSentiment(null);
    try{
      const r=await backendSentiment(newsText);
      setSentiment(r);setSentScore(r.opportunity_score);
      if(r.opportunity_score>=56){
        const t=new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
        setAlerts(p=>[{time:t,color:r.opportunity_score>=76?"#00e5a0":"#7acc7a",text:`AI: ${r.market_mood} (${r.opportunity_score}). ${r.dca_recommendation}`},...p]);
      }
    }catch{setSentiment({error:"Errore analisi AI."});}
    setAiLoading(false);
  },[newsText]);

  const testTelegram=useCallback(async()=>{await sendAlert(72,68,65,75,"threshold",["RSI SPY: ✓ OVERSOLD","Consumer Sentiment: ✓ PESSIMISMO"]);},[sendAlert]);

  // ── SCORES AGGREGATI ──────────────────────────────────────────────────────────
  const usTS=techScoreUS??50;
  const euTS=techScoreEU??50;
  const techScore=Math.round((usTS+euTS)/2);
  const mScore=macroScore??50;
  const sentW=sentScore??50;
  const consW=consultingScore??50;
  const overall=Math.round(techScore*0.40+mScore*0.25+sentW*0.25+consW*0.10);
  const oppInfo=oppLabel(overall);
  const color=oppColor(overall);
  const isPolyLoading=polyStatus==="loading";
  const isFredLoading=fredStatus==="loading";
  const hasBothKeys=!!polyKey.trim()&&!!fredKey.trim();
  const hasTgConfig=!!tgToken.trim()&&!!tgChat.trim();

  // Asset class signals
  const assetScores=calcAssetScores({
    techScoreUS:usTS,techScoreEU:euTS,
    macroScoreUS:macroScoreUS??50,macroScoreEU:macroScoreEU??50,
    sentScore:sentW,techSignalsUS,marketDataUS,
  });

  return(
    <>
      <style>{styles}</style>
      <div className="sentinel">

        <div className="header">
          <div className="header-left">
            <div className="logo">MARKET<span>SENTINEL</span></div>
            <div className="tagline">DCA · PAC · Market Timing</div>
          </div>
          <div className="clock">◉ {clock}</div>
        </div>

        {/* SCHEDULER */}
        <div className="scheduler-bar">
          <div className={`scheduler-dot ${schedulerOn?"":"off"}`}/>
          <span className="scheduler-label">Auto-refresh:</span>
          <span className={`scheduler-countdown ${schedulerOn?"":"off"}`}>{schedulerOn?formatCountdown(countdown):"—"}</span>
          <button className={`btn-sm ${schedulerOn?"active":""}`} onClick={()=>setSchedulerOn(v=>!v)} disabled={!hasBothKeys}>
            {schedulerOn?"■ Stop":"▶ Avvia"}
          </button>
          <button className="btn-sm yellow" onClick={fetchAll} disabled={!hasBothKeys||isPolyLoading||isFredLoading}>↺ Refresh</button>
          <span className="keys-status" style={{color:hasBothKeys?"#00e5a0":"#3d5060"}}>{hasBothKeys?"● Key salvate":"○ Inserisci key"}</span>
        </div>

        {/* API KEYS */}
        <div className="apikey-bar">
          <span className="apikey-label">Polygon.io Key</span>
          <input className="apikey-input" type="password" placeholder="API key Polygon.io…" value={polyKey} onChange={e=>setPolyKey(e.target.value)}/>
          <button className="btn-fetch" onClick={()=>fetchPolygon()} disabled={!polyKey.trim()||isPolyLoading}>
            {isPolyLoading?<span className="loading-dots">Fetch</span>:"▶ Carica"}
          </button>
          <span className="fetch-status" style={{color:polyStatus==="ok"?"#00e5a0":polyStatus==="error"?"#ff6060":polyStatus==="loading"?"#ffbe00":"#3d5060"}}>
            {polyStatus==="ok"&&`✓ ${polyUpdate}`}{polyStatus==="error"&&`✗ ${polyMsg}`}
            {polyStatus==="loading"&&`⏳ ${polyMsg} (~130s)`}{polyStatus===null&&"— In attesa"}
          </span>
          {polyKey&&<button className="btn-clear" onClick={()=>setPolyKey("")}>✕</button>}
        </div>

        <div className="apikey-bar">
          <span className="apikey-label">FRED API Key</span>
          <input className="apikey-input" type="password" placeholder="API key St. Louis Fed…" value={fredKey} onChange={e=>setFredKey(e.target.value)}/>
          <button className="btn-fetch" onClick={()=>fetchFred()} disabled={!fredKey.trim()||isFredLoading}>
            {isFredLoading?<span className="loading-dots">Fetch</span>:"▶ Carica"}
          </button>
          <span className="fetch-status" style={{color:fredStatus==="ok"?"#00e5a0":fredStatus==="error"?"#ff6060":fredStatus==="loading"?"#ffbe00":"#3d5060"}}>
            {fredStatus==="ok"&&`✓ ${fredUpdate}`}{fredStatus==="error"&&`✗ ${fredMsg}`}
            {fredStatus==="loading"&&`⏳ ${fredMsg}`}{fredStatus===null&&"— In attesa"}
          </span>
          {fredKey&&<button className="btn-clear" onClick={()=>setFredKey("")}>✕</button>}
        </div>

        <div className="apikey-bar">
          <span className="apikey-label">NewsAPI Key</span>
          <input className="apikey-input" type="password" placeholder="API key NewsAPI.org…" value={newsKey} onChange={e=>setNewsKey(e.target.value)}/>
          <button className="btn-fetch" onClick={fetchNewsAuto} disabled={!newsKey.trim()||newsLoading}>
            {newsLoading?<span className="loading-dots">Fetch</span>:"▶ Carica News"}
          </button>
          <span className="fetch-status" style={{color:newsCount?"#00e5a0":"#3d5060"}}>
            {newsCount?`✓ ${newsCount} notizie`:"— In attesa"}
          </span>
          {newsKey&&<button className="btn-clear" onClick={()=>setNewsKey("")}>✕</button>}
        </div>

        {/* DOT PLOT */}
        <div className="dot-plot-bar">
          <span className="dot-plot-label">Dot Plot Fed</span>
          <input className="apikey-input" type="text" placeholder="Mediana attuale (es. 3.875)…"
            value={dotPlot} onChange={e=>setDotPlot(e.target.value)} style={{maxWidth:220}}/>
          <button className="btn-fetch" style={{background:"#0a1a10",borderColor:"#1a3520",color:"#00c070"}}
            onClick={()=>fetchFred()} disabled={!fredKey.trim()||!dotPlot.trim()||isFredLoading}>
            ▶ Aggiorna
          </button>
          <span className="dot-plot-status" style={{color:dotPlotScore!==null?"#00c070":"#2a5030"}}>
            {dotPlotScore!==null?`✓ Score ${dotPlotScore} (${parseFloat(dotPlot)}% → ${parseFloat(fredStatus==="ok"?"":"")})`
              :dotPlot?"○ Premi Aggiorna":"○ Inserisci mediana dopo riunione Fed"}
          </span>
        </div>

        {/* TELEGRAM */}
        <div className="tg-bar">
          <span className="tg-label">Telegram</span>
          <input className="apikey-input" type="password" placeholder="Bot token…" value={tgToken} onChange={e=>setTgToken(e.target.value)} style={{maxWidth:260}}/>
          <input className="apikey-input" type="text" placeholder="Chat ID…" value={tgChat} onChange={e=>setTgChat(e.target.value)} style={{maxWidth:150}}/>
          <button className="btn-test" onClick={testTelegram} disabled={!hasTgConfig||tgStatus==="sending"}>
            {tgStatus==="sending"?"⏳":"📱 Test"}
          </button>
          <span className="tg-status" style={{color:tgStatus==="ok"?"#00e5a0":tgStatus==="error"?"#ff6060":"#3d5060"}}>
            {tgStatus==="ok"&&"✓"}{tgStatus==="error"&&"✗"}{!tgStatus&&(hasTgConfig?"●":"○")}
          </span>
          {tgToken&&<button className="btn-clear" onClick={()=>{setTgToken("");setTgChat("");}}>✕</button>}
        </div>

        {/* MARKET STRIPS */}
        <div className="market-section-label">🇺🇸 Mercati USA</div>
        <div className="market-strip">
          {(marketDataUS||EMPTY_MKT_US).map(m=>(
            <div className="mk-item" key={m.name}>
              <span className="mk-name">{m.name}</span>
              <span className="mk-val">{isPolyLoading?<span className="skeleton" style={{width:55}}/>:m.val}</span>
              <span className={`mk-chg ${m.dir}`}>{m.chg}</span>
              <span className="mk-src">{marketDataUS?"▲ Polygon EOD":"—"}</span>
            </div>
          ))}
        </div>

        <div className="market-section-label" style={{marginTop:10}}>🌍 Mercati Europa & Emergenti</div>
        <div className="market-strip" style={{marginBottom:16}}>
          {(marketDataEU||EMPTY_MKT_EU).map(m=>(
            <div className="mk-item" key={m.name}>
              <span className="mk-name">{m.name}</span>
              <span className="mk-val">{isPolyLoading?<span className="skeleton" style={{width:55}}/>:m.val}</span>
              <span className={`mk-chg ${m.dir}`}>{m.chg}</span>
              <span className="mk-src">{marketDataEU?"▲ Polygon EOD":"—"}</span>
            </div>
          ))}
        </div>

        {/* OPPORTUNITY BANNER */}
        <div className={`opp-banner ${oppInfo.cls}`}>
          <div className="opp-dot"/>
          <span>{oppInfo.text}</span>
          <span style={{marginLeft:"auto",opacity:0.7,fontSize:12}}>Score: {overall}/100</span>
        </div>

        {/* ASSET CLASS SIGNALS */}
        <div className="asset-strip">
          {assetScores.map(a=>(
            <div key={a.name} className={`asset-pill ${oppClass(a.score)}`}>
              <span className="asset-pill-name">{a.name}</span>
              <span className="asset-pill-score" style={{color:oppColor(a.score)}}>{a.score}</span>
              <span className="asset-pill-label" style={{color:oppColor(a.score)}}>
                {a.score>=76?"OTTIMO":a.score>=56?"BUONO":a.score>=31?"NEUTRO":"CARO"}
              </span>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid-main">

          {/* GAUGE */}
          <div className="card">
            <div className="card-title">Opportunity Score</div>
            <div className="gauge-wrap">
              <OppGauge score={overall}/>
              <div className="gauge-score" style={{color}}>{overall}</div>
              <div className="gauge-sublabel">
                {overall>=76?"OTTIMA OPP.":overall>=56?"BUONA OPP.":overall>=31?"NEUTRO":"MERCATO CARO"}
              </div>
              <div className="gauge-breakdown">
                {[
                  {label:"Tecnico US",  score:usTS},
                  {label:"Tecnico EU/EM",score:euTS},
                  {label:"Macro US",    score:macroScoreUS??50},
                  {label:"Macro EU",    score:macroScoreEU??50},
                  {label:"Sentiment",   score:sentW},
                  {label:"Consulting",  score:consW},
                ].map(b=>(
                  <div className="gb-row" key={b.label}>
                    <span className="gb-label">{b.label}</span>
                    <div className="gb-bar-wrap"><div className="gb-bar" style={{width:`${b.score}%`,background:oppColor(b.score)}}/></div>
                    <span style={{color:oppColor(b.score),minWidth:24,textAlign:"right"}}>{b.score}</span>
                  </div>
                ))}
              </div>
              <p className="section-note">40% tec · 25% macro · 25% sent · 10% cons</p>
            </div>
          </div>

          {/* TECH US */}
          <div className="card">
            <div className="card-title">
              Tecnico USA
              <span className={`data-tag ${techSignalsUS?"live":"wait"}`}>{techSignalsUS?`score ${usTS}`:"in attesa"}</span>
            </div>
            <table className="sig-table"><tbody>
              {(techSignalsUS||EMPTY_TECH_US).map(s=><SigRow key={s.name} {...s} shimmer={isPolyLoading}/>)}
            </tbody></table>
            <p className="section-note">✓ = segnale positivo per DCA</p>
          </div>

          {/* TECH EU/EM */}
          <div className="card">
            <div className="card-title">
              Tecnico Europa & EM
              <span className={`data-tag ${techSignalsEU?"live":"wait"}`}>{techSignalsEU?`score ${euTS}`:"in attesa"}</span>
            </div>
            <table className="sig-table"><tbody>
              {(techSignalsEU||EMPTY_TECH_EU).map(s=><SigRow key={s.name} {...s} shimmer={isPolyLoading}/>)}
            </tbody></table>
          </div>

          {/* MACRO */}
          <div className="card">
            <div className="card-title">
              Macro
              <span className={`data-tag ${macroSignalsUS?"live":"wait"}`}>{macroSignalsUS?`score ${mScore}`:"in attesa"}</span>
            </div>
            {macroSignalsUS&&(
              <div className="subscore-row">
                <div className="subscore-pill">
                  <div className="subscore-pill-label">🇺🇸 US</div>
                  <div className="subscore-pill-val" style={{color:oppColor(macroScoreUS??50)}}>{macroScoreUS??50}</div>
                </div>
                <div className="subscore-pill">
                  <div className="subscore-pill-label">🇪🇺 EU</div>
                  <div className="subscore-pill-val" style={{color:oppColor(macroScoreEU??50)}}>{macroScoreEU??50}</div>
                </div>
                {dotPlotScore!==null&&(
                  <div className="subscore-pill">
                    <div className="subscore-pill-label">Dot Plot</div>
                    <div className="subscore-pill-val" style={{color:oppColor(dotPlotScore)}}>{dotPlotScore}</div>
                  </div>
                )}
              </div>
            )}
            <div style={{fontSize:10,color:"#3d5060",marginBottom:4}}>🇺🇸 USA</div>
            <table className="sig-table"><tbody>
              {(macroSignalsUS||EMPTY_MACRO_US).map(s=><SigRow key={s.name} {...s} shimmer={isFredLoading}/>)}
            </tbody></table>
            <div style={{fontSize:10,color:"#3d5060",marginTop:8,marginBottom:4}}>🇪🇺 Europa</div>
            <table className="sig-table"><tbody>
              {(macroSignalsEU||EMPTY_MACRO_EU).map(s=><SigRow key={s.name} {...s} shimmer={isFredLoading}/>)}
            </tbody></table>
          </div>

        </div>

        {/* BOTTOM GRID */}
        <div className="grid-bottom">

          {/* SENTIMENT */}
          <div className="card" style={{gridColumn:"span 2"}}>
            <div className="card-title">
              Sentiment Notizie — AI DCA
              {newsCount&&<span className="data-tag live">▲ NewsAPI · {newsCount}</span>}
            </div>
            <textarea className="news-input"
              placeholder={"Notizie caricate automaticamente da NewsAPI.\nOppure incolla testo manualmente."}
              value={newsText} onChange={e=>setNewsText(e.target.value)}/>
            <div className="news-actions">
              <button className="btn-fetch-news" onClick={fetchNewsAuto} disabled={!newsKey.trim()||newsLoading}>
                {newsLoading?<span className="loading-dots">Caricamento</span>:"🔄 Aggiorna notizie"}
              </button>
              <button className="btn-analyze" onClick={handleAnalyze} disabled={aiLoading||!newsText.trim()}>
                {aiLoading?<span className="loading-dots">Analisi</span>:"▶ Analizza"}
              </button>
            </div>
            {sentiment&&!sentiment.error&&(
              <div className="ai-result">
                <div className="ai-score-row">
                  <div className="ai-score-num" style={{color:oppColor(sentiment.opportunity_score)}}>{sentiment.opportunity_score}</div>
                  <div>
                    <div className="ai-score-label">Opportunity Score</div>
                    <div style={{color:oppColor(sentiment.opportunity_score),fontSize:12,fontWeight:700}}>{sentiment.market_mood}</div>
                  </div>
                </div>
                <p style={{marginBottom:8}}>{sentiment.summary}</p>
                <div style={{marginBottom:6}}>
                  {sentiment.key_opportunities?.map((r,i)=><span key={i} style={{display:"inline-block",margin:"0 6px 4px 0",padding:"2px 8px",background:"#111",borderRadius:2,fontSize:10,color:"#8fa0b0"}}>{r}</span>)}
                </div>
                <div style={{color:oppColor(sentiment.opportunity_score),fontSize:11,fontWeight:700}}>→ {sentiment.dca_recommendation}</div>
              </div>
            )}
            {sentiment?.error&&<div className="ai-result" style={{color:"#ff6060"}}>{sentiment.error}</div>}
          </div>

          {/* CONSULTING */}
          <div className="card">
            <div className="card-title">
              Consulting
              <span className={`data-tag ${consultingResult?"live":"wait"}`}>{consultingResult?`score ${consW}`:"in attesa"}</span>
            </div>
            {consultingResult?(
              <div>
                <div className="ai-score-row" style={{marginBottom:10}}>
                  <div className="ai-score-num" style={{color:oppColor(consW)}}>{consW}</div>
                  <div>
                    <div className="ai-score-label">Consulting Score</div>
                    <div style={{color:oppColor(consW),fontSize:12,fontWeight:700}}>{consultingResult.consensus}</div>
                  </div>
                </div>
                <p style={{fontSize:11,color:"#8fa0b0",marginBottom:8,lineHeight:1.6}}>{consultingResult.summary}</p>
                <div>{consultingResult.key_views?.map((v,i)=><span key={i} style={{display:"inline-block",margin:"0 6px 4px 0",padding:"2px 8px",background:"#111",borderRadius:2,fontSize:10,color:"#8fa0b0"}}>{v}</span>)}</div>
                {consultingResult.dca_signal&&<div style={{color:oppColor(consW),fontSize:11,fontWeight:700,marginTop:8}}>→ {consultingResult.dca_signal}</div>}
              </div>
            ):(
              <p className="section-note">Carica le notizie con NewsAPI per l'analisi consulting automatica.</p>
            )}
          </div>

          {/* STORICO ALERT */}
          <div className="card">
            <div className="card-title">Storico Segnali</div>
            <div className="alert-history">
              {alerts.map((a,i)=>(
                <div className="ah-item" key={i} style={{borderColor:a.color}}>
                  <span className="ah-time">{a.time}</span>
                  <span className="ah-text">{a.text}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* LEGENDA */}
        <div style={{marginTop:20,padding:"18px 20px",background:"#0d1219",border:"1px solid #1a2330",borderRadius:6}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:10,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:"#3d5060",marginBottom:14}}>
            Legenda — Logica DCA/PAC
          </div>
          <div className="legend-grid">
            <div>
              <div className="legend-title">🎯 Opportunity Score</div>
              <div><span style={{color:"#00e5a0"}}>76–100</span> — Ottima opportunità → max PAC</div>
              <div><span style={{color:"#7acc7a"}}>56–75</span> — Buona opportunità → incrementa</div>
              <div><span style={{color:"#5a7080"}}>31–55</span> — Neutro → PAC ordinario</div>
              <div><span style={{color:"#ff6060"}}>0–30</span> — Mercato caro → riduci ingressi</div>
              <div style={{marginTop:6,color:"#5a7080",fontSize:10}}>40% tec · 25% macro · 25% sent · 10% cons</div>
            </div>
            <div>
              <div className="legend-title">📈 Segnali Tecnici (DCA)</div>
              <div><span style={{color:"#c8d0d8"}}>RSI &lt;30</span> — ✓ Oversold → opportunità</div>
              <div><span style={{color:"#c8d0d8"}}>RSI &gt;70</span> — Overbought → mercato caro</div>
              <div><span style={{color:"#c8d0d8"}}>VIXY alto</span> — ✓ Paura = opportunità</div>
              <div><span style={{color:"#c8d0d8"}}>MA50/200 &lt;1</span> — ✓ Death Cross → ingresso</div>
              <div><span style={{color:"#c8d0d8"}}>MACD molto neg.</span> — ✓ Oversold</div>
              <div style={{marginTop:4,color:"#5a7080",fontSize:10}}>EU/EM: VGK, EWG, EWU, EEM, VEA</div>
            </div>
            <div>
              <div className="legend-title">🏦 Segnali Macro (DCA)</div>
              <div><span style={{color:"#c8d0d8"}}>CPI bassa</span> — ✓ Fed può tagliare</div>
              <div><span style={{color:"#c8d0d8"}}>Tassi alti</span> — Restrittivo, ma upside futuro</div>
              <div><span style={{color:"#c8d0d8"}}>Consumer Sent. basso</span> — ✓ Pessimismo = acquisto</div>
              <div><span style={{color:"#c8d0d8"}}>Curva invertita</span> — ✓ Recessione attesa → ingresso anticipato</div>
              <div><span style={{color:"#c8d0d8"}}>Dot Plot</span> — Tagli attesi = opportunità</div>
            </div>
            <div>
              <div className="legend-title">🤖 Sentiment & Consulting</div>
              <div><span style={{color:"#c8d0d8"}}>Panico/Pessimismo</span> — ✓ Alta opportunità</div>
              <div><span style={{color:"#c8d0d8"}}>Banche ribassiste</span> — ✓ Segnale contrarian</div>
              <div><span style={{color:"#c8d0d8"}}>Euforia/Ottimismo</span> — Mercato caro</div>
              <div style={{marginTop:6,color:"#5a7080",fontSize:10}}>Fonte: GS, MS, JPM, BLK, DB, BNP</div>
              <div style={{color:"#5a7080",fontSize:10}}>Modello AI: Groq Llama 3.3 70B</div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
