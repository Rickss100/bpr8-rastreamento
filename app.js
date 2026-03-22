const { useState, useEffect, useRef } = React;

// ══════════════════════════════════════════════════════════════
// MOTOR BIOMECÂNICO v2 — Equações exatas livro BPR-8
// RT-VH · Rastreador Tático de Vestígios Humanos
// ══════════════════════════════════════════════════════════════
const Bio = {
  stature(fl, sex, side = "R") {
    const f = parseFloat(fl); if (!f || f <= 0) return null;
    let est, see, eq;
    if (sex === "M") {
      if (side === "R") { est = 86.89 + 3.49*f; see = 7.2; eq = "86,89+3,49×RFPL"; }
      else              { est = 90.15 + 3.34*f; see = 7.2; eq = "90,15+3,34×LFPL"; }
    } else if (sex === "F") {
      if (side === "R") { est = 58.93 + 4.42*f; see = 8.7; eq = "58,93+4,42×RFPL"; }
      else              { est = 63.20 + 4.28*f; see = 8.7; eq = "63,20+4,28×LFPL"; }
    } else {
      est = ((86.89+3.49*f) + (58.93+4.42*f)) / 2; see = 9.8; eq = "média M+F";
    }
    return { est: +est.toFixed(1), min: +(est-see).toFixed(1), max: +(est+see).toFixed(1), see, eq };
  },
  sex(fl, fw, sl, angle, base) {
    let score = 0, signals = 0, details = [];
    if (fl && fw) {
      const r = parseFloat(fw)/parseFloat(fl);
      if      (r >= 0.44)  { score+=2; details.push(`L/C=${r.toFixed(3)} → ♂ forte`); }
      else if (r >= 0.425) { score+=1; details.push(`L/C=${r.toFixed(3)} → ♂ mod.`); }
      else if (r >= 0.40)  { score+=0; details.push(`L/C=${r.toFixed(3)} → misto`); }
      else if (r >= 0.385) { score-=1; details.push(`L/C=${r.toFixed(3)} → ♀ mod.`); }
      else                 { score-=2; details.push(`L/C=${r.toFixed(3)} → ♀ forte`); }
      signals++;
    }
    if (sl) {
      const s = parseFloat(sl);
      if      (s >= 150) { score+=2; details.push(`Passada ${s}cm → ♂`); }
      else if (s >= 135) { score+=1; details.push(`Passada ${s}cm → ♂ lim.`); }
      else if (s >= 118) { score+=0; details.push(`Passada ${s}cm → misto`); }
      else if (s >= 100) { score-=1; details.push(`Passada ${s}cm → ♀ lim.`); }
      else               { score-=2; details.push(`Passada ${s}cm → ♀`); }
      signals++;
    }
    if (angle !== undefined && angle !== "") {
      const a = parseFloat(angle);
      if (a > 8) { score+=1; details.push(`Ângulo ${a}° toed-out → ♂`); }
      else if (a < 4) { score-=1; details.push(`Ângulo ${a}° toed-in → ♀`); }
      signals++;
    }
    if (base !== undefined && base !== "") {
      const b = parseFloat(base);
      if (b >= 8.5) { score+=1; details.push(`Base ${b}cm larga → ♂`); }
      else if (b < 6) { score-=1; details.push(`Base ${b}cm estreita → ♀`); }
      signals++;
    }
    if (!signals) return null;
    const pct = score / (signals * 2);
    let sex, conf;
    if      (pct >  0.60) { sex="M"; conf=Math.min(95, 70+Math.round(pct*30)); }
    else if (pct >  0.25) { sex="M"; conf=Math.min(78, 52+Math.round(pct*30)); }
    else if (pct > -0.25) { sex="?"; conf=45; }
    else if (pct > -0.60) { sex="F"; conf=Math.min(78, 52+Math.round(-pct*30)); }
    else                  { sex="F"; conf=Math.min(95, 70+Math.round(-pct*30)); }
    return { sex, conf, score, signals, details };
  },
  speed(slCm) {
    const sl = parseFloat(slCm); if (!sl || sl <= 0) return null;
    const ms = (sl/100)*(117/2)/60;
    let gait, gc, morphNote;
    if      (sl < 100) { gait="Caminhada lenta";  gc="#64dd17"; morphNote="Calcanhar claro, rolagem suave"; }
    else if (sl < 140) { gait="Caminhada normal"; gc="#00e676"; morphNote="Apoio pleno, impulso pelos dedos"; }
    else if (sl < 200) { gait="Marcha rápida";    gc="#ffd740"; morphNote="Impulso forte, calcanhar presente"; }
    else               { gait="Corrida / Trote";  gc="#ff6d00"; morphNote="Antepé profundo, calcanhar ausente, fase de voo"; }
    return { ms:+ms.toFixed(2), kmh:+(ms*3.6).toFixed(1), gait, gc, sl, morphNote };
  },
  weight(stat, soilType, trackerW, footDepth, trackerDepth) {
    if (!stat) return null;
    const h = stat/100;
    let est = 24.5*h*h, method="IMC ref. IBGE 2020 (24,5)";
    if (trackerW && footDepth && trackerDepth) {
      const tw=parseFloat(trackerW), fd=parseFloat(footDepth), td=parseFloat(trackerDepth);
      if (fd>0 && td>0) { est=tw*(fd/td); method=`Calibração Cap.4: ${tw}kg×(${fd}/${td})`; }
    }
    return { est:Math.round(est), min:Math.round(est-16), max:Math.round(est+22), method };
  },
  profile(evs, cfg={}) {
    const fps = evs.filter(e => e.type==="pegada" && e.fl);
    if (!fps.length) return null;
    const avg = k => { const v=fps.filter(e=>e[k]!==""&&e[k]!=null); return v.length?v.reduce((s,e)=>s+parseFloat(e[k]),0)/v.length:null; };
    const avgFL=avg("fl"), avgFW=avg("fw"), avgSL=avg("sl");
    const avgAngle=avg("footAngle"), avgBase=avg("strideBase"), avgDepth=avg("depth");
    const sides=fps.map(e=>e.side).filter(Boolean);
    const side=sides.filter(s=>s==="R").length>=sides.length/2?"R":"L";
    const sexEst=Bio.sex(avgFL,avgFW,avgSL,avgAngle,avgBase);
    const s=sexEst?.sex==="?"?null:sexEst?.sex;
    const statEst=Bio.stature(avgFL,s||"?",side);
    const wEst=Bio.weight(statEst?.est,cfg.soilType,cfg.trackerWeight,avgDepth,cfg.trackerDepth);
    const spEst=avgSL?Bio.speed(avgSL):null;
    const base=fps.length*18;
    const bonus=(avgFW?12:0)+(avgSL?10:0)+(avgAngle!=null?5:0)+(avgBase!=null?5:0)+(avgDepth?4:0);
    return { fps:fps.length, total:evs.length,
      avgFL:avgFL?+avgFL.toFixed(1):null, avgFW:avgFW?+avgFW.toFixed(1):null,
      avgSL:avgSL?+avgSL.toFixed(1):null, avgDepth:avgDepth?+avgDepth.toFixed(1):null,
      side, sex:sexEst, stature:statEst, weight:wEst, speed:spEst,
      conf:Math.min(97,base+bonus) };
  }
};

// ══════════════════════════════════════════════════════════════
// MAPA LEAFLET — GPS real + trilha
// ══════════════════════════════════════════════════════════════
function MapaLeaflet({ gpsPoints, evMarkers, currentPos, suspects, visible }) {
  const ref = useRef(null);
  const mapObj = useRef(null);
  const trailLine = useRef(null);
  const posMarker = useRef(null);
  const evGroup = useRef(null);
  const suspectTrails = useRef({});

  const initMap = () => {
    if (mapObj.current || !ref.current || !window.L) return;
    const L = window.L;
    mapObj.current = L.map(ref.current, { center:[-20.315,-40.312], zoom:15, zoomControl:true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:"© OpenStreetMap", maxZoom:19
    }).addTo(mapObj.current);
    trailLine.current = L.polyline([], { color:"#00e676", weight:4, opacity:0.85 }).addTo(mapObj.current);
    evGroup.current   = L.layerGroup().addTo(mapObj.current);
  };

  useEffect(() => {
    if (!document.getElementById("L-css")) {
      const lnk = document.createElement("link");
      lnk.id="L-css"; lnk.rel="stylesheet";
      lnk.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(lnk);
    }
    if (window.L) { initMap(); return; }
    if (!document.getElementById("L-js")) {
      const s = document.createElement("script");
      s.id="L-js"; s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload = initMap;
      document.head.appendChild(s);
    } else {
      const t = setInterval(()=>{ if(window.L){clearInterval(t);initMap();} },200);
    }
    return () => { if(mapObj.current){mapObj.current.remove();mapObj.current=null;} };
  }, []);

  // Invalidate size when tab becomes visible
  useEffect(() => {
    if (visible && mapObj.current) {
      setTimeout(()=> mapObj.current?.invalidateSize(), 100);
    }
  }, [visible]);

  // Trilha principal
  useEffect(() => {
    if (!mapObj.current || !trailLine.current || !gpsPoints?.length) return;
    const lls = gpsPoints.map(p=>[p.lat,p.lng]);
    trailLine.current.setLatLngs(lls);
    if (gpsPoints.length===1) mapObj.current.setView(lls[0],17);
    else mapObj.current.fitBounds(trailLine.current.getBounds(),{padding:[30,30]});
  }, [gpsPoints]);

  // Posição atual
  useEffect(() => {
    if (!mapObj.current || !currentPos || !window.L) return;
    const L=window.L, ll=[currentPos.lat,currentPos.lng];
    if (posMarker.current) { posMarker.current.setLatLng(ll); }
    else {
      const icon=L.divIcon({
        html:`<div style="width:16px;height:16px;background:#00e676;border-radius:50%;border:3px solid #050f08;box-shadow:0 0 10px #00e676aa;"></div>`,
        iconSize:[16,16], className:""
      });
      posMarker.current=L.marker(ll,{icon}).bindTooltip("▲ Você",{permanent:false}).addTo(mapObj.current);
    }
  }, [currentPos]);

  // Marcadores de evidência
  useEffect(() => {
    if (!evGroup.current || !window.L) return;
    const L=window.L;
    evGroup.current.clearLayers();
    (evMarkers||[]).forEach(ev => {
      if (!ev.gpsLat||!ev.gpsLng) return;
      const icMap={pegada:"👣",vestigio:"🔍",dejeto:"⚠️",galho:"🌿",sangue:"🩸"};
      const clMap={pegada:"#00e676",vestigio:"#ffd740",dejeto:"#ff8f00",galho:"#7fff00",sangue:"#ff1744"};
      const icon=L.divIcon({
        html:`<div style="font-size:20px;text-shadow:0 0 4px #000;">${icMap[ev.type]||"·"}</div>`,
        iconSize:[24,24], className:""
      });
      L.marker([ev.gpsLat,ev.gpsLng],{icon})
       .bindPopup(`<b style="color:${clMap[ev.type]||'#fff'};font-family:monospace">${ev.type.toUpperCase()}</b><br>${ev.ts}${ev.fl?`<br>Comp: ${ev.fl}cm`:""}`)
       .addTo(evGroup.current);
    });
  }, [evMarkers]);

  return <div ref={ref} style={{ width:"100%", height:"100%", minHeight:300 }} />;
}

// ══════════════════════════════════════════════════════════════
// BONECO REALISTA — Silhueta anatômica SVG
// ══════════════════════════════════════════════════════════════
function BonecoRealista({ profile, color="#00e676", compact=false }) {
  const W=180, H=compact?260:320, cx=90;
  const conf  = profile?.conf || 0;
  const iM    = profile?.sex?.sex==="M";
  const iF    = profile?.sex?.sex==="F";
  const sw    = profile?.weight ? Math.max(1.8, Math.min(4, profile.weight.est/55)) : 2.2;
  const sc    = profile?.sex?.sex==="M"?"#4fc3f7":profile?.sex?.sex==="F"?"#f48fb1":color;

  // Proporções anatômicas (7,5 alturas de cabeça)
  const headRx=22, headRy=compact?24:27, headCY=compact?32:38;
  const neckT=headCY+headRy, neckB=neckT+12;
  const shY=neckB, shWH=iM?44:iF?32:38, shWL=iM?40:iF?28:34;
  const waistY=shY+compact?44:52, waistW=iM?26:iF?30:28;
  const hipY=waistY+compact?14:18, hipW=iM?30:iF?38:34;
  const kneeY=hipY+compact?55:70, footY=kneeY+compact?48:62;
  const elbowY=shY+compact?36:46, handY=elbowY+compact?34:44;

  const show = th => conf >= th;

  if (!profile) return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",margin:"0 auto"}}>
      <text x={cx} y={H/2-10} textAnchor="middle" fill="#1a3a28" fontSize="42" fontFamily="monospace">?</text>
      <text x={cx} y={H/2+20} textAnchor="middle" fill="#1a3a28" fontSize="9" fontFamily="monospace" letterSpacing="2">AGUARDANDO</text>
    </svg>
  );

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",margin:"0 auto"}}>
      {/* Grid tático */}
      {[...Array(Math.floor(H/30))].map((_,i)=>(
        <line key={i} x1={0} y1={i*30} x2={W} y2={i*30} stroke="#0c2018" strokeWidth="0.3"/>
      ))}
      {[45,90,135].map(x=>(
        <line key={x} x1={x} y1={0} x2={x} y2={H} stroke="#0c2018" strokeWidth="0.3"/>
      ))}

      {/* Aura de confiança */}
      {show(5) && <ellipse cx={cx} cy={headCY} rx={headRx+12} ry={headRy+12} fill="none" stroke={sc} strokeWidth="0.5" opacity={conf/220} strokeDasharray="4 6"/>}

      {/* CABEÇA — elipse anatômica */}
      {show(5) && (
        <ellipse cx={cx} cy={headCY} rx={headRx} ry={headRy} fill="none" stroke={sc} strokeWidth={sw}/>
      )}
      {/* Traços faciais (alta confiança) */}
      {show(60) && (
        <>
          <line x1={cx-10} y1={headCY-4} x2={cx-5} y2={headCY-4} stroke={sc} strokeWidth={sw*0.8} strokeLinecap="round"/>
          <line x1={cx+5} y1={headCY-4} x2={cx+10} y2={headCY-4} stroke={sc} strokeWidth={sw*0.8} strokeLinecap="round"/>
          <path d={`M${cx-7},${headCY+7} Q${cx},${headCY+13} ${cx+7},${headCY+7}`} fill="none" stroke={sc} strokeWidth={sw*0.7} strokeLinecap="round"/>
        </>
      )}

      {/* PESCOÇO */}
      {show(20) && (
        <path d={`M${cx-6},${neckT} L${cx-5},${neckB} L${cx+5},${neckB} L${cx+6},${neckT}`} fill="none" stroke={sc} strokeWidth={sw}/>
      )}

      {/* TRONCO — trapézio ombros→cintura */}
      {show(20) && (
        <>
          <path d={`M${cx-shWH},${shY} L${cx+shWH},${shY} L${cx+waistW},${waistY} L${cx-waistW},${waistY} Z`}
                fill="none" stroke={sc} strokeWidth={sw}/>
          {/* Linha peitoral / tórax */}
          {show(40) && (
            <line x1={cx-shWH*0.7} y1={shY+14} x2={cx+shWH*0.7} y2={shY+14} stroke={sc} strokeWidth={sw*0.5} opacity="0.5"/>
          )}
        </>
      )}

      {/* QUADRIS */}
      {show(20) && (
        <path d={`M${cx-waistW},${waistY} Q${cx-hipW},${hipY} ${cx-hipW+4},${hipY+8} M${cx+waistW},${waistY} Q${cx+hipW},${hipY} ${cx+hipW-4},${hipY+8}`}
              fill="none" stroke={sc} strokeWidth={sw}/>
      )}
      {show(20) && (
        <line x1={cx-hipW+4} y1={hipY+8} x2={cx+hipW-4} y2={hipY+8} stroke={sc} strokeWidth={sw}/>
      )}

      {/* BRAÇOS — articulados com cotovelo */}
      {show(35) && (
        <>
          {/* Braço esquerdo */}
          <line x1={cx-shWH} y1={shY} x2={cx-shWL-12} y2={elbowY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          <line x1={cx-shWL-12} y1={elbowY} x2={cx-shWL-6} y2={handY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          {/* Mão E */}
          <circle cx={cx-shWL-6} cy={handY} r={3} fill="none" stroke={sc} strokeWidth={sw*0.8}/>
          {/* Braço direito */}
          <line x1={cx+shWH} y1={shY} x2={cx+shWL+12} y2={elbowY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          <line x1={cx+shWL+12} y1={elbowY} x2={cx+shWL+6} y2={handY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          {/* Mão D */}
          <circle cx={cx+shWL+6} cy={handY} r={3} fill="none" stroke={sc} strokeWidth={sw*0.8}/>
        </>
      )}

      {/* PERNAS — articuladas com joelho */}
      {show(20) && (
        <>
          {/* Coxa E */}
          <line x1={cx-hipW+4} y1={hipY+8} x2={cx-hipW+10} y2={kneeY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          {/* Joelho E */}
          <circle cx={cx-hipW+10} cy={kneeY} r={4} fill="none" stroke={sc} strokeWidth={sw*0.8}/>
          {/* Perna E */}
          <line x1={cx-hipW+10} y1={kneeY+4} x2={cx-hipW+4} y2={footY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          {/* Pé E */}
          <path d={`M${cx-hipW+4},${footY} L${cx-hipW-12},${footY} L${cx-hipW-14},${footY+4} L${cx-hipW+6},${footY+4}`}
                fill="none" stroke={sc} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>

          {/* Coxa D */}
          <line x1={cx+hipW-4} y1={hipY+8} x2={cx+hipW-10} y2={kneeY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          {/* Joelho D */}
          <circle cx={cx+hipW-10} cy={kneeY} r={4} fill="none" stroke={sc} strokeWidth={sw*0.8}/>
          {/* Perna D */}
          <line x1={cx+hipW-10} y1={kneeY+4} x2={cx+hipW-4} y2={footY} stroke={sc} strokeWidth={sw} strokeLinecap="round"/>
          {/* Pé D */}
          <path d={`M${cx+hipW-4},${footY} L${cx+hipW+12},${footY} L${cx+hipW+14},${footY+4} L${cx+hipW-6},${footY+4}`}
                fill="none" stroke={sc} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}

      {/* Indicador de estatura */}
      {show(40) && profile?.stature && (
        <>
          <line x1={5} y1={headCY-headRy} x2={5} y2={footY+4} stroke="#1a3a28" strokeWidth="1"/>
          <line x1={2} y1={headCY-headRy} x2={8} y2={headCY-headRy} stroke="#1a3a28" strokeWidth="1"/>
          <line x1={2} y1={footY+4} x2={8} y2={footY+4} stroke="#1a3a28" strokeWidth="1"/>
          <text x={12} y={(headCY+footY)/2+4} fill="#2a6a40" fontSize="9" fontFamily="monospace">{profile.stature.est}cm</text>
        </>
      )}

      {/* Indicador de peso */}
      {show(50) && profile?.weight && (
        <text x={W-4} y={(shY+hipY)/2+4} fill="#2a6a40" fontSize="9" fontFamily="monospace" textAnchor="end">~{profile.weight.est}kg</text>
      )}

      {/* Velocidade */}
      {show(30) && profile?.speed && (
        <text x={cx} y={H-22} textAnchor="middle" fill={profile.speed.gc} fontSize="8" fontFamily="monospace">{profile.speed.kmh} km/h · {profile.speed.gait.toUpperCase()}</text>
      )}

      {/* Sexo */}
      {show(55) && profile?.sex && (
        <text x={cx} y={H-10} textAnchor="middle" fill={sc} fontSize="9" fontFamily="monospace" letterSpacing="2">
          {profile.sex.sex==="M"?"♂ MASCULINO":profile.sex.sex==="F"?"♀ FEMININO":"? INDEFINIDO"}
        </text>
      )}

      {/* Barra de confiança */}
      {show(5) && (
        <>
          <rect x={10} y={H-5} width={W-20} height={3} fill="#0c2018" rx="1"/>
          <rect x={10} y={H-5} width={Math.round((W-20)*conf/100)} height={3}
                fill={conf>70?"#00e676":conf>40?"#ffd740":"#ff6d00"} rx="1"/>
          <text x={cx} y={H-8} textAnchor="middle" fill="#2a4a38" fontSize="7" fontFamily="monospace">{conf}% CONF.</text>
        </>
      )}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════
const SUSPECT_COLORS = ["#00e676","#4fc3f7","#ffd740","#f48fb1","#ff8f00"];
const SUSPECT_LABELS = ["SUSPEITO 1","SUSPEITO 2","SUSPEITO 3","SUSPEITO 4","SUSPEITO 5"];
const EV_COLORS = {pegada:"#00e676",vestigio:"#ffd740",dejeto:"#ff8f00",galho:"#7fff00",sangue:"#ff1744"};
const EV_ICONS  = {pegada:"👣",vestigio:"🔍",dejeto:"⚠️",galho:"🌿",sangue:"🩸"};
const EV_LABELS = {pegada:"PEGADA",vestigio:"VESTÍGIO",dejeto:"DEJETO",galho:"GALHO",sangue:"SANGUE"};
const SOLOS = [
  {id:"baixo",label:"Areia / Neve",     note:"Profundas mesmo leves — confiança baixa"},
  {id:"medio",label:"Solo Úmido / Lama",note:"Proporcional à massa — confiança moderada"},
  {id:"alto", label:"Cascalho / Argila",note:"Superficiais — analisar pressões de liberação"},
];
const FP0 = {fl:"",fw:"",sl:"",depth:"",side:"R",footAngle:"",strideBase:"",notes:"",soilLocal:"medio"};

// ══════════════════════════════════════════════════════════════
// BANCO DE DADOS LOCAL (IndexedDB)
// ══════════════════════════════════════════════════════════════
const DB_NAME = "rtvh_db";
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => { e.target.result.createObjectStore("mission_state", { keyPath: "id" }); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const saveState = async (stateObj) => {
  try {
    const db = await openDB();
    const tx = db.transaction("mission_state", "readwrite");
    tx.objectStore("mission_state").put({ id: "current", ...stateObj });
  } catch(e) { console.error("Erro DB save", e); }
};
const loadState = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction("mission_state", "readonly");
    const req = tx.objectStore("mission_state").get("current");
    return new Promise(r => { req.onsuccess = () => r(req.result); req.onerror = () => r(null); });
  } catch(e) { console.error("Erro DB load", e); return null; }
};
const clearState = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction("mission_state", "readwrite");
    tx.objectStore("mission_state").delete("current");
  } catch(e) {}
};

// ══════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════
window.RTVHApp = function App() {
  const [view, setView]         = useState("home");
  const [mission, setMission]   = useState({ on:false, t0:null });
  const [elapsed, setElapsed]   = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle|searching|active|error
  const [gpsWatchId, setGpsWatchId] = useState(null);
  const [suspects, setSuspects] = useState([
    { id:1, label:"SUSPEITO 1", color:SUSPECT_COLORS[0], evs:[] }
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fp, setFp]               = useState(FP0);
  const [cfg, setCfg]             = useState({soilType:"medio",trackerWeight:"",trackerDepth:""});
  const [dbLoaded, setDbLoaded]   = useState(false);
  const ticker = useRef(null);

  // Banco de Dados: Inicialização
  useEffect(() => {
    loadState().then(data => {
      if (data) {
        if (data.mission) setMission(data.mission);
        if (data.elapsed) setElapsed(data.elapsed);
        if (data.gpsPoints) setGpsPoints(data.gpsPoints);
        if (data.suspects) setSuspects(data.suspects);
        if (data.activeIdx !== undefined) setActiveIdx(data.activeIdx);
        if (data.cfg) setCfg(data.cfg);
      }
      setDbLoaded(true);
    });
  }, []);

  // Banco de Dados: Auto-Save
  useEffect(() => {
    if (!dbLoaded) return;
    saveState({ mission, elapsed, gpsPoints, suspects, activeIdx, cfg });
  }, [mission, elapsed, gpsPoints, suspects, activeIdx, cfg, dbLoaded]);

  // Timer
  useEffect(() => {
    if (mission.on) {
      ticker.current = setInterval(()=>setElapsed(t=>t+1), 1000);
    } else { clearInterval(ticker.current); }
    return ()=>clearInterval(ticker.current);
  }, [mission.on]);

  const fmt = s => [Math.floor(s/3600),Math.floor((s%3600)/60),s%60]
    .map(n=>n.toString().padStart(2,"0")).join(":");

  // GPS real
  const startGPS = () => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    setGpsStatus("searching");
    const id = navigator.geolocation.watchPosition(
      pos => {
        const pt = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          el:  pos.coords.altitude || 0,
          acc: Math.round(pos.coords.accuracy),
          t:   Date.now()
        };
        setCurrentPos(pt);
        setGpsPoints(prev => [...prev, pt]);
        setGpsStatus("active");
      },
      err => setGpsStatus("error"),
      { enableHighAccuracy:true, maximumAge:5000, timeout:12000 }
    );
    setGpsWatchId(id);
  };

  const stopGPS = () => {
    if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
    setGpsWatchId(null);
    setGpsStatus("idle");
  };

  const startMission = () => {
    setMission({ on:true, t0:Date.now() });
    setElapsed(0);
    setGpsPoints([]);
    startGPS();
  };

  const stopMission = () => {
    setMission(m=>({...m,on:false}));
    stopGPS();
  };

  const resetMissionDB = () => {
    if(!window.confirm("ATENÇÃO: A missão atual será APAGADA do banco de dados (inclusive todas as fotos anexadas). Tem certeza?")) return;
    clearState();
    stopGPS();
    setMission({ on:false, t0:null });
    setElapsed(0);
    setGpsPoints([]);
    setSuspects([{ id:1, label:SUSPECT_LABELS[0], color:SUSPECT_COLORS[0], evs:[] }]);
    setActiveIdx(0);
    setFp(FP0);
  };

  // Suspeito ativo
  const activeSuspect = suspects[activeIdx];
  const updateSuspectEvs = (idx, evs) => {
    setSuspects(ss => ss.map((s,i) => i===idx ? {...s,evs} : s));
  };
  const addSuspect = () => {
    if (suspects.length >= 5) return;
    const idx = suspects.length;
    setSuspects(ss => [...ss, { id:idx+1, label:SUSPECT_LABELS[idx], color:SUSPECT_COLORS[idx], evs:[] }]);
    setActiveIdx(idx);
  };

  const removeSuspect = (idx) => {
    if(suspects.length <= 1) { alert("A missão exige pelo menos 1 suspeito."); return; }
    if(!window.confirm("Excluir definitivamente este Suspeito (" + suspects[idx].label + ") e todos os seus vestígios?")) return;
    setSuspects(ss => ss.filter((_, i) => i !== idx));
    if(activeIdx === idx) setActiveIdx(Math.max(0, idx - 1));
    else if(activeIdx > idx) setActiveIdx(activeIdx - 1);
  };

  const removeEv = (sIdx, evId) => {
    if(!window.confirm("Excluir este vestígio permanentemente?")) return;
    setSuspects(ss => ss.map((s, i) => i === sIdx ? { ...s, evs: s.evs.filter(e => e.id !== evId) } : s));
  };

  // Adicionar evidência
  const addEv = type => {
    if (type==="pegada") { setView("fp-form"); return; }
    const ev = { id:Date.now(), type, ts:new Date().toLocaleTimeString("pt-BR"),
                 gpsLat:currentPos?.lat, gpsLng:currentPos?.lng, notes:"" };
    updateSuspectEvs(activeIdx, [...activeSuspect.evs, ev]);
    setView("evs");
  };

  const handlePhotoUpload = (e, sIdx, evId) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result;
      setSuspects(ss => ss.map((s, i) => i === sIdx ? { ...s, evs: s.evs.map( ev => ev.id === evId ? { ...ev, photo: base64 } : ev ) } : s));
    };
    reader.readAsDataURL(file);
  };

  const submitFp = () => {
    if (!fp.fl) return;
    if (fp.id) {
      updateSuspectEvs(activeIdx, activeSuspect.evs.map(e => e.id === fp.id ? { ...e, ...fp } : e));
    } else {
      const ev = { id:Date.now(), type:"pegada", ts:new Date().toLocaleTimeString("pt-BR"),
                   gpsLat:currentPos?.lat, gpsLng:currentPos?.lng, ...fp };
      updateSuspectEvs(activeIdx, [...activeSuspect.evs, ev]);
    }
    setFp(FP0); setView("evs");
  };

  // Perfis calculados
  const profiles = suspects.map(s => Bio.profile(s.evs, cfg));
  const activeProfile = profiles[activeIdx];

  // Pré-análise
  const preS = fp.fl&&fp.fw ? Bio.sex(fp.fl,fp.fw,fp.sl,fp.footAngle,fp.strideBase) : null;
  const preT = fp.fl ? Bio.stature(fp.fl,preS?.sex==="?"?null:preS?.sex,fp.side) : null;
  const preV = fp.sl ? Bio.speed(fp.sl) : null;

  // Todos os marcadores de evidência no mapa
  const allEvMarkers = suspects.flatMap(s => s.evs);

  // ── ESTILOS ──────────────────────────────────────────────────
  const C = { bg:"#040c08", panel:"#0b1812", border:"#183228", green:"#00e676",
              dim:"#2d5a3d", muted:"#7ab88a", red:"#ff1744", amber:"#ff8f00" };
  const S = {
    app:   {minHeight:"100vh",background:C.bg,color:C.muted,fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column"},
    hdr:   {background:"#07100d",borderBottom:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0},
    cont:  {flex:1,overflowY:"auto",padding:"12px 12px 6px"},
    nav:   {display:"flex",borderTop:`1px solid ${C.border}`,background:"#060e0a",flexShrink:0},
    navB:  a=>({flex:1,padding:"8px 2px 6px",background:"none",border:"none",color:a?C.green:"#1a3828",fontSize:9,letterSpacing:1,cursor:"pointer",borderTop:`2px solid ${a?C.green:"transparent"}`,display:"flex",flexDirection:"column",alignItems:"center",gap:3}),
    panel: {background:C.panel,border:`1px solid ${C.border}`,borderRadius:3,padding:12,marginBottom:8},
    lbl:   {fontSize:10,letterSpacing:2,color:C.dim,marginBottom:3,display:"block"},
    big:   {fontSize:26,color:C.green,fontWeight:"bold"},
    btn:   (c="primary",mb=6)=>({padding:"10px 14px",border:`1px solid ${c==="primary"?C.green:c==="danger"?C.red:c==="amber"?C.amber:C.dim}`,background:"none",color:c==="primary"?C.green:c==="danger"?C.red:c==="amber"?C.amber:C.muted,fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:2,cursor:"pointer",borderRadius:2,width:"100%",marginBottom:mb}),
    inp:   {background:"#07100d",border:`1px solid ${C.border}`,color:C.green,fontFamily:"'Courier New',monospace",fontSize:13,padding:"9px 10px",width:"100%",borderRadius:2,marginBottom:8,boxSizing:"border-box"},
    badge: t=>({display:"inline-block",padding:"1px 6px",border:`1px solid ${EV_COLORS[t]||C.dim}`,color:EV_COLORS[t]||C.dim,fontSize:9,letterSpacing:1,borderRadius:2}),
    r2:    {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},
    r3:    {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6},
    seg:   a=>({flex:1,padding:"6px 4px",background:a?"#0f2a1a":"none",border:`1px solid ${a?C.green:C.border}`,color:a?C.green:C.dim,fontFamily:"'Courier New',monospace",fontSize:10,cursor:"pointer",borderRadius:2}),
  };

  // ── VIEWS ──────────────────────────────────────────────────

  const Home = () => (
    <div style={S.cont}>
      {/* Status grid */}
      <div style={S.panel}>
        <div style={S.r2}>
          {[
            ["STATUS",   mission.on?"● ATIVO":"○ PARADO",   mission.on?C.green:C.dim],
            ["TEMPO",    fmt(elapsed),                        C.green],
            ["GPS",      gpsStatus==="active"?"● FIXADO":gpsStatus==="searching"?"… BUSCANDO":gpsStatus==="error"?"✕ ERRO":"○ INATIVO",
                         gpsStatus==="active"?C.green:gpsStatus==="searching"?C.amber:gpsStatus==="error"?C.red:C.dim],
            ["EVIDÊNCIAS", activeSuspect.evs.length, C.green],
          ].map(([l,v,c])=>(
            <div key={l}><span style={S.lbl}>{l}</span>
              <span style={{fontSize:14,color:c,fontWeight:"bold"}}>{v}</span></div>
          ))}
        </div>
        {currentPos && (
          <div style={{fontSize:9,color:C.dim,marginTop:8,borderTop:`1px solid ${C.border}`,paddingTop:6}}>
            LAT: {currentPos.lat.toFixed(5)} · LNG: {currentPos.lng.toFixed(5)}
            {currentPos.el ? ` · EL: ${currentPos.el.toFixed(0)}m` : ""}
            {currentPos.acc ? ` · ACC: ±${currentPos.acc}m` : ""}
          </div>
        )}
      </div>

      {/* Suspeito ativo */}
      <div style={{...S.panel, borderLeft:`3px solid ${activeSuspect.color}`}}>
        <span style={S.lbl}>SUSPEITO ATIVO</span>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {suspects.map((s,i)=>(
            <div key={s.id} style={{ display:"flex" }}>
              <button onClick={()=>setActiveIdx(i)}
                style={{...S.seg(i===activeIdx),borderColor:i===activeIdx?s.color:C.border,
                        color:i===activeIdx?s.color:C.dim,flex:"none",padding:"5px 10px",fontSize:10,borderRight:"none",borderTopRightRadius:0,borderBottomRightRadius:0}}>
                {s.label}
              </button>
              {suspects.length > 1 && (
                <button onClick={()=>removeSuspect(i)} 
                  style={{...S.seg(false),borderColor:i===activeIdx?s.color:C.border,color:C.red,padding:"5px",fontSize:12,borderLeftColor:C.border,borderTopLeftRadius:0,borderBottomLeftRadius:0}} title="Excluir Suspeito">
                  ✕
                </button>
              )}
            </div>
          ))}
          {suspects.length<5 && mission.on && (
            <button onClick={addSuspect}
              style={{...S.seg(false),flex:"none",padding:"5px 10px",fontSize:10,color:C.amber,borderColor:C.amber}}>
              + NOVO
            </button>
          )}
        </div>
      </div>

      {/* Config solo + calibração */}
      <div style={S.panel}>
        <span style={{...S.lbl,color:"#2a6a40"}}>CALIBRAÇÃO CAP.4 · RASTREADOR</span>
        <div style={S.r3}>
          <div><label style={S.lbl}>PESO (kg)</label>
            <input style={{...S.inp,marginBottom:0}} type="number" placeholder="82"
              value={cfg.trackerWeight} onChange={e=>setCfg(c=>({...c,trackerWeight:e.target.value}))}/></div>
          <div><label style={S.lbl}>PROF. (mm)</label>
            <input style={{...S.inp,marginBottom:0}} type="number" placeholder="18"
              value={cfg.trackerDepth} onChange={e=>setCfg(c=>({...c,trackerDepth:e.target.value}))}/></div>
          <div><label style={S.lbl}>SOLO</label>
            <select style={{...S.inp,marginBottom:0}} value={cfg.soilType}
              onChange={e=>setCfg(c=>({...c,soilType:e.target.value}))}>
              <option value="baixo">Areia</option>
              <option value="medio">Úmido</option>
              <option value="alto">Cascalho</option>
            </select>
          </div>
        </div>
      </div>

      {!mission.on
        ? <>
            <button style={S.btn("primary")} onClick={startMission}>▶ INICIAR MISSÃO + GPS</button>
            {(suspects[0].evs.length > 0 || mission.t0) && (
              <button style={S.btn("danger")} onClick={resetMissionDB}>✕ LIMPAR BANCO (NOVA MISSÃO)</button>
            )}
          </>
        : <>
            <button style={S.btn("amber")} onClick={()=>setView("ev-form")}>+ NOVA EVIDÊNCIA</button>
            <button style={S.btn("danger")} onClick={stopMission}>■ ENCERRAR MISSÃO</button>
          </>
      }
    </div>
  );

  const EvForm = () => (
    <div style={S.cont}>
      <div style={{color:C.dim,fontSize:10,letterSpacing:3,marginBottom:12}}>
        COLETANDO PARA: <span style={{color:activeSuspect.color}}>{activeSuspect.label}</span>
      </div>
      {[
        ["pegada",  "Análise biomecânica completa (estatura, peso, sexo, v)"],
        ["vestigio","Marca, rastro ou sinal físico no terreno"],
        ["dejeto",  "Material biológico descartado"],
        ["galho",   "Vegetação perturbada, quebrada ou dobrada"],
        ["sangue",  "Mancha hemática"],
      ].map(([t,desc])=>(
        <button key={t} onClick={()=>addEv(t)}
          style={{...S.btn(t==="sangue"?"danger":t==="pegada"?"primary":"default"),display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
          <span style={{fontSize:18}}>{EV_ICONS[t]}</span>
          <div><div style={{letterSpacing:2}}>{EV_LABELS[t]}</div>
            <div style={{fontSize:9,opacity:.5,letterSpacing:1,marginTop:2}}>{desc}</div></div>
        </button>
      ))}
      <button style={S.btn("default")} onClick={()=>setView("evs")}>← VOLTAR</button>
    </div>
  );

  const FpForm = () => (
    <div style={S.cont}>
      <div style={{color:C.green,fontSize:11,letterSpacing:3,marginBottom:12}}>
        👣 PEGADA · <span style={{color:activeSuspect.color}}>{activeSuspect.label}</span>
      </div>
      <label style={S.lbl}>PÉ (define equação — Cap.3)</label>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        {[["R","PÉ DIREITO (RFPL)"],["L","PÉ ESQUERDO (LFPL)"]].map(([v,l])=>(
          <button key={v} style={S.seg(fp.side===v)} onClick={()=>setFp(f=>({...f,side:v}))}>{l}</button>
        ))}
      </div>
      <div style={S.r2}>
        {[["fl","COMPRIMENTO (cm)","ex: 26,5"],["fw","LARGURA (cm)","ex: 9,8"],
          ["sl","PASSADA CTR-CTR (cm)","♂:158 ♀:132"],["strideBase","BASE MARCHA (cm)","♂:8,1 ♀:7,1"],
          ["footAngle","ÂNGULO PÉ (°)","♂:>7° ♀:<6°"],["depth","PROFUNDIDADE (mm)","ex: 14"]
        ].map(([k,l,ph])=>(
          <div key={k}>
            <label style={S.lbl}>{l}</label>
            <input style={S.inp} type="number" step="0.5" placeholder={ph}
              value={fp[k]} onChange={e=>setFp(f=>({...f,[k]:e.target.value}))}/>
          </div>
        ))}
      </div>
      <label style={S.lbl}>SOLO LOCAL (Cap.4)</label>
      <select style={S.inp} value={fp.soilLocal} onChange={e=>setFp(f=>({...f,soilLocal:e.target.value}))}>
        {SOLOS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <label style={S.lbl}>OBSERVAÇÕES</label>
      <input style={S.inp} type="text" placeholder="morfologia, condições..."
        value={fp.notes} onChange={e=>setFp(f=>({...f,notes:e.target.value}))}/>

      {/* Pré-análise */}
      {fp.fl && (
        <div style={{...S.panel,borderColor:C.green+"44",marginBottom:10}}>
          <span style={{...S.lbl,color:C.green}}>PRÉ-ANÁLISE EM TEMPO REAL</span>
          <div style={S.r2}>
            {preS && <div><span style={S.lbl}>SEXO ({preS.signals} ind.)</span>
              <span style={{fontSize:14,color:preS.sex==="M"?"#4fc3f7":preS.sex==="F"?"#f48fb1":C.muted}}>
                {preS.sex==="M"?"♂":preS.sex==="F"?"♀":"?"} {preS.conf}%</span></div>}
            {preT && <div><span style={S.lbl}>ESTATURA (±{preT.see}cm)</span>
              <span style={{fontSize:12,color:C.green}}>{preT.min}–{preT.max}cm</span></div>}
            {preV && <div><span style={S.lbl}>MARCHA</span>
              <span style={{fontSize:10,color:preV.gc}}>{preV.gait}</span></div>}
            {preV && <div><span style={S.lbl}>VELOCIDADE</span>
              <span style={{fontSize:14,color:C.green}}>{preV.kmh} km/h</span></div>}
          </div>
          {preT && <div style={{fontSize:9,color:C.dim,marginTop:4}}>Ht = {preT.eq}</div>}
          {preV && <div style={{fontSize:9,color:"#1a3a28",marginTop:2}}>{preV.morphNote}</div>}
        </div>
      )}
      <button style={S.btn("primary")} onClick={submitFp} disabled={!fp.fl}>✓ REGISTRAR PEGADA</button>
      <button style={S.btn("default")} onClick={()=>setView("ev-form")}>← VOLTAR</button>
    </div>
  );

  const Evs = () => (
    <div style={S.cont}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{display:"flex",gap:6}}>
          {suspects.map((s,i)=>(
            <button key={s.id} onClick={()=>setActiveIdx(i)}
              style={{...S.seg(i===activeIdx),flex:"none",padding:"4px 8px",fontSize:9,borderColor:i===activeIdx?s.color:C.border,color:i===activeIdx?s.color:C.dim}}>
              {s.label.replace("SUSPEITO ","S")} ({s.evs.length})
            </button>
          ))}
        </div>
        {mission.on && <button onClick={()=>setView("ev-form")}
          style={{...S.btn("amber",0),width:"auto",padding:"4px 10px",fontSize:9}}>+ NOVA</button>}
      </div>
      {!activeSuspect.evs.length &&
        <div style={{textAlign:"center",color:"#112010",fontSize:11,marginTop:48,letterSpacing:2}}>NENHUMA EVIDÊNCIA</div>}
      {[...activeSuspect.evs].reverse().map(ev=>(
        <div key={ev.id} style={{...S.panel,borderLeft:`3px solid ${EV_COLORS[ev.type]||C.dim}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>{EV_ICONS[ev.type]}</span>
              <span style={S.badge(ev.type)}>{EV_LABELS[ev.type]}</span>
              {ev.side && <span style={{fontSize:9,color:C.dim}}>{ev.side==="R"?"DIR.":"ESQ."}</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:9,color:"#1a3828"}}>{ev.ts}</span>
              <label style={{cursor:"pointer",color:ev.photo?C.green:C.dim,fontSize:14,padding:"0 4px"}} title="Adicionar Foto (Câmera)">
                📷<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e => handlePhotoUpload(e, activeIdx, ev.id)} />
              </label>
              {ev.type === "pegada" && (
                <button onClick={()=>{setFp({...FP0, ...ev}); setView("fp-form");}} style={{background:"none",border:"none",color:C.amber,fontSize:14,cursor:"pointer",padding:"0 4px"}} title="Editar">✎</button>
              )}
              <button onClick={()=>removeEv(activeIdx, ev.id)} style={{background:"none",border:"none",color:C.red,fontSize:14,cursor:"pointer",padding:"0 4px"}} title="Excluir">✕</button>
            </div>
          </div>
          {ev.photo && (
            <div style={{marginTop:8}}>
              <img src={ev.photo} style={{width:"100%", borderRadius:4, border:`1px solid ${C.border}`}} onClick={()=>window.open(ev.photo)} alt="Foto do vestígio"/>
            </div>
          )}
          {ev.type==="pegada" && (
            <div style={{...S.r3,marginTop:6}}>
              {[["fl","COMP.","cm"],["fw","LARG.","cm"],["sl","PASSADA","cm"],
                ["depth","PROF.","mm"],["footAngle","ÂNGULO","°"],["strideBase","BASE","cm"]].map(([k,l,u])=>
                ev[k]?<div key={k}><span style={S.lbl}>{l}</span>
                  <span style={{fontSize:12,color:C.green}}>{ev[k]}{u}</span></div>:null
              )}
            </div>
          )}
          {ev.gpsLat && <div style={{fontSize:9,color:C.dim,marginTop:4}}>📍 {ev.gpsLat.toFixed(5)}, {ev.gpsLng.toFixed(5)}</div>}
          {ev.notes && <div style={{fontSize:10,color:C.dim,marginTop:4}}>{ev.notes}</div>}
        </div>
      ))}
    </div>
  );

  const Analise = () => {
    if (!activeProfile) return (
      <div style={S.cont}>
        <div style={{textAlign:"center",color:"#112010",fontSize:11,marginTop:64,letterSpacing:2,lineHeight:2}}>
          REGISTRE PEGADAS PARA<br/>ANÁLISE BIOMECÂNICA
        </div>
      </div>
    );
    const { sex, stature, weight, speed, conf, avgFL, avgSL, avgDepth, fps } = activeProfile;
    return (
      <div style={S.cont}>
        {/* Suspeito seletor */}
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {suspects.map((s,i)=>(
            <button key={s.id} onClick={()=>setActiveIdx(i)}
              style={{...S.seg(i===activeIdx),flex:"none",padding:"5px 10px",fontSize:9,borderColor:i===activeIdx?s.color:C.border,color:i===activeIdx?s.color:C.dim}}>
              {s.label} ({s.evs.filter(e=>e.type==="pegada").length} peg.)
            </button>
          ))}
        </div>

        {/* Boneco + dados */}
        <div style={{...S.panel,borderLeft:`3px solid ${activeSuspect.color}`}}>
          <div style={S.r2}>
            <div>
              <BonecoRealista profile={activeProfile} color={activeSuspect.color} compact={true}/>
            </div>
            <div style={{paddingLeft:8}}>
              <span style={S.lbl}>CONFIANÇA</span>
              <div style={{height:5,background:"#0a1a10",borderRadius:3,marginBottom:8}}>
                <div style={{width:`${conf}%`,height:"100%",background:conf>70?C.green:conf>40?"#ffd740":"#ff6d00",borderRadius:3}}/>
              </div>
              {sex && <><span style={S.lbl}>SEXO</span>
                <div style={{fontSize:18,color:sex.sex==="M"?"#4fc3f7":sex.sex==="F"?"#f48fb1":C.muted,marginBottom:6}}>
                  {sex.sex==="M"?"♂":sex.sex==="F"?"♀":"?"} {sex.conf}%</div></>}
              {stature && <><span style={S.lbl}>ESTATURA</span>
                <div style={{fontSize:20,color:C.green,marginBottom:6}}>{stature.est}<span style={{fontSize:12}}> cm</span></div></>}
              {weight && <><span style={S.lbl}>PESO</span>
                <div style={{fontSize:18,color:C.green,marginBottom:6}}>~{weight.est}<span style={{fontSize:12}}> kg</span></div></>}
              {speed && <><span style={S.lbl}>VELOCIDADE</span>
                <div style={{fontSize:14,color:speed.gc}}>{speed.kmh} km/h</div>
                <div style={{fontSize:9,color:speed.gc}}>{speed.gait}</div></>}
            </div>
          </div>
        </div>

        {/* Equações */}
        {stature && (
          <div style={S.panel}>
            <span style={S.lbl}>EQUAÇÃO APLICADA (Cap.3)</span>
            <div style={{fontSize:9,color:"#1a3828",fontFamily:"monospace",background:"#07100d",padding:"6px 8px",borderRadius:2}}>
              Ht = {stature.eq}<br/>SEE: ±{stature.see}cm · RFPL/LFPL méd: {avgFL}cm<br/>
              Intervalo: {stature.min}–{stature.max}cm
            </div>
          </div>
        )}

        {/* Indicadores de sexo */}
        {sex?.details?.length > 0 && (
          <div style={S.panel}>
            <span style={S.lbl}>INDICADORES DE SEXO (Cap.5)</span>
            {sex.details.map((d,i)=>(
              <div key={i} style={{fontSize:9,color:"#2a5a38",marginTop:3,paddingLeft:8,borderLeft:`1px solid ${C.dim}`}}>· {d}</div>
            ))}
          </div>
        )}

        {speed && (
          <div style={S.panel}>
            <span style={S.lbl}>MORFOLOGIA DA MARCHA (Cap.2)</span>
            <div style={{fontSize:9,color:C.dim,lineHeight:1.7}}>
              {speed.morphNote}<br/>
              Passada média: {avgSL}cm · V = SL×58,5/60<br/>
              {avgDepth && `Prof. média: ${avgDepth}mm`}
            </div>
          </div>
        )}
      </div>
    );
  };

  const Suspeitos = () => (
    <div style={S.cont}>
      <div style={{fontSize:10,color:C.dim,letterSpacing:2,marginBottom:12}}>COMPARAÇÃO DE PERFIS</div>
      {suspects.length < 2 && (
        <div style={{...S.panel,textAlign:"center"}}>
          <div style={{color:"#1a3828",fontSize:11,letterSpacing:2,lineHeight:2}}>
            INICIE UMA MISSÃO E ADICIONE<br/>PELO MENOS 2 SUSPEITOS<br/>PARA COMPARAR
          </div>
          {mission.on && suspects.length < 5 && (
            <button style={{...S.btn("amber",0),width:"auto",margin:"12px auto 0",padding:"8px 20px"}}
              onClick={addSuspect}>+ ADICIONAR SUSPEITO</button>
          )}
        </div>
      )}

      {/* Grid de bonecos */}
      <div style={{display:"grid", gridTemplateColumns:`repeat(${Math.min(suspects.length,3)}, 1fr)`, gap:8, marginBottom:10}}>
        {suspects.map((s,i) => {
          const p = profiles[i];
          return (
            <div key={s.id} style={{...S.panel,borderTop:`3px solid ${s.color}`,padding:8}}>
              <div style={{textAlign:"center",color:s.color,fontSize:9,letterSpacing:1,marginBottom:6}}>{s.label}</div>
              <BonecoRealista profile={p} color={s.color} compact={true}/>
              <div style={{fontSize:9,color:C.dim,marginTop:4,textAlign:"center"}}>
                {p ? `${p.conf}% conf. · ${p.fps} peg.` : "Sem dados"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela comparativa */}
      {suspects.length >= 2 && (
        <div style={S.panel}>
          <span style={S.lbl}>TABELA COMPARATIVA</span>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:"monospace"}}>
              <thead>
                <tr>
                  <td style={{color:C.dim,padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>ATRIBUTO</td>
                  {suspects.map(s=>(
                    <td key={s.id} style={{color:s.color,padding:"4px 6px",borderBottom:`1px solid ${C.border}`,textAlign:"center"}}>{s.label.replace("SUSPEITO ","S")}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["SEXO",      p=>p?.sex? (p.sex.sex==="M"?"♂ M":p.sex.sex==="F"?"♀ F":"?")+" "+p.sex.conf+"%":"—"],
                  ["ESTATURA",  p=>p?.stature?`${p.stature.est}cm`:"—"],
                  ["PESO",      p=>p?.weight?`~${p.weight.est}kg`:"—"],
                  ["VELOCIDADE",p=>p?.speed?`${p.speed.kmh}km/h`:"—"],
                  ["MARCHA",    p=>p?.speed?p.speed.gait.split("/")[0].trim():"—"],
                  ["PASSADA",   p=>p?.avgSL?`${p.avgSL}cm`:"—"],
                  ["PÉ (comp)", p=>p?.avgFL?`${p.avgFL}cm`:"—"],
                  ["CONFIANÇA", p=>p?`${p.conf}%`:"—"],
                  ["PEGADAS",   p=>p?`${p.fps}`:"—"],
                ].map(([attr, fn])=>(
                  <tr key={attr}>
                    <td style={{color:C.dim,padding:"4px 6px",borderBottom:`1px solid ${C.border}33`}}>{attr}</td>
                    {suspects.map((s,i)=>(
                      <td key={s.id} style={{color:C.muted,padding:"4px 6px",borderBottom:`1px solid ${C.border}33`,textAlign:"center"}}>{fn(profiles[i])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mission.on && suspects.length < 5 && (
        <button style={S.btn("amber")} onClick={addSuspect}>+ ADICIONAR SUSPEITO ({suspects.length}/5)</button>
      )}
    </div>
  );

  // ── NAV ──────────────────────────────────────────────────────
  const NAV = [
    {id:"home",    icon:"⌖", label:"MISSÃO"},
    {id:"mapa",    icon:"◎", label:"MAPA"},
    {id:"ev-form", icon:"+", label:"COLETAR", disabled:!mission.on},
    {id:"analise", icon:"◈", label:"ANÁLISE"},
    {id:"suspeitos",icon:"⊞",label:"SUSPEITOS"},
  ];
  const isActive = id => view===id||(id==="ev-form"&&(view==="ev-form"||view==="fp-form"||view==="evs"));

  return (
    <div style={S.app}>
      {/* Scanline */}
      <div style={{position:"fixed",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,230,118,0.007) 2px,rgba(0,230,118,0.007) 4px)",pointerEvents:"none",zIndex:0}}/>

      {/* Header */}
      <div style={{...S.hdr,position:"relative",zIndex:2}}>
        <div>
          <div style={{color:C.green,fontSize:12,fontWeight:"bold"}}>RT-VH · RASTREAMENTO TÁTICO</div>
          <div style={{fontSize:9,color:"#1a3828"}}>VESTÍGIOS HUMANOS · PMES / BAC · Batalhão de Ações com Cães</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:gpsStatus==="active"?C.green:gpsStatus==="searching"?C.amber:C.dim}}>
            {gpsStatus==="active"?"● GPS FIXADO":gpsStatus==="searching"?"… BUSCANDO":"○ GPS INATIVO"}
          </div>
          <div style={{fontSize:9,color:activeSuspect.color}}>{activeSuspect.label}</div>
        </div>
      </div>

      {/* Mapa — sempre montado, oculto quando não ativo */}
      <div style={{position:"relative",zIndex:1,
                   display:view==="mapa"?"flex":"none",
                   flex:1,flexDirection:"column",overflow:"hidden"}}>
        <div style={{flex:1}}>
          <MapaLeaflet
            gpsPoints={gpsPoints}
            evMarkers={allEvMarkers}
            currentPos={currentPos}
            suspects={suspects}
            visible={view==="mapa"}
          />
        </div>
        {/* Overlay info no mapa */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#040c08dd",
                     padding:"6px 12px",borderTop:`1px solid ${C.border}`,fontSize:9,color:C.dim,
                     display:"flex",justifyContent:"space-between",zIndex:1000}}>
          <span>{gpsPoints.length} pontos GPS gravados</span>
          <span>{allEvMarkers.filter(e=>e.gpsLat).length} evidências georreferenciadas</span>
          {currentPos && <span>±{currentPos.acc}m precisão</span>}
        </div>
      </div>

      {/* Conteúdo demais views */}
      <div style={{position:"relative",zIndex:1,flex:view==="mapa"?0:1,
                   display:view==="mapa"?"none":"flex",flexDirection:"column",overflow:"hidden"}}>
        {view==="home"      && Home()}
        {view==="ev-form"   && EvForm()}
        {view==="fp-form"   && FpForm()}
        {view==="evs"       && Evs()}
        {view==="analise"   && Analise()}
        {view==="suspeitos" && Suspeitos()}
      </div>

      {/* Navbar */}
      <nav style={{...S.nav,position:"relative",zIndex:2}}>
        {NAV.map(({id,icon,label,disabled})=>(
          <button key={id} style={{...S.navB(isActive(id)),opacity:disabled?.2:1}}
            onClick={()=>{if(!disabled){if(id==="ev-form")setView("ev-form");else setView(id);}}}
            disabled={disabled}>
            <span style={{fontSize:15}}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
