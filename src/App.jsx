import React, { useState, useRef, useEffect } from "react";

const BASE_INDEX = 100;
const YEARS = [2020, 2021, 2022, 2023, 2024];

const PRODUCTS = [
  { id: "butter",   label: "Butter",     shape: "box",      unit: "250 g", price2020: 1.50, index: [100, 105.1, 146.4, 120.3, 140.7] },
  { id: "milk",     label: "Whole milk", shape: "cylinder", unit: "1 l",   price2020: 0.70, index: [100, 104,   124.8, 136.3, 130.7] },
  { id: "eggs",     label: "Eggs",       shape: "eggbox",   unit: "10",    price2020: 1.50, index: [100, 107.2, 128,   136.4, 138.5] },
  { id: "bread",    label: "Rye bread",  shape: "box",      unit: "500 g", price2020: 2.00, index: [100, 103.3, 116.7, 132.1, 133.9] },
  { id: "potato",   label: "Potatoes",   shape: "sphere",   unit: "1 kg",  price2020: 1.00, index: [100, 100.2, 115,   131.3, 139.5] },
  { id: "sugar",    label: "Sugar",      shape: "box",      unit: "1 kg",  price2020: 0.75, index: [100, 104,   118.5, 180.6, 171.3] },
  { id: "oliveoil", label: "Olive oil",  shape: "cone",     unit: "1 l",   price2020: 5.00, index: [100, 101,   113.7, 145,   198.6] },
  { id: "apples",   label: "Apples",     shape: "sphere",   unit: "1 kg",  price2020: 2.00, index: [100, 105,   105.5, 105.6, 112.6] },
];

const scaleFor = (v) => BASE_INDEX / v;
const priceFor = (p, yi) => p.price2020 * p.index[yi] / 100;

const eur = (n) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const num = (n, d = 2) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

function narrative(p, yi) {
  const year = YEARS[yi];
  if (year === 2020) {
    return `In 2020, ${p.unit} of ${p.label.toLowerCase()} cost about ${eur(p.price2020)}. Move the slider to see what the same money buys in later years.`;
  }
  const ratio = BASE_INDEX / p.index[yi];
  const pNow = priceFor(p, yi);
  const pct = Math.round((p.index[yi] - BASE_INDEX) * 10) / 10;
  let gotPhrase;
  const u = p.unit.trim();
  const m = u.match(/^([\d.,]+)\s*(g|kg|l|ml)?$/i);
  if (m && m[2]) {
    const qty = parseFloat(m[1].replace(",", ".")) * ratio;
    gotPhrase = `${num(qty, qty < 10 ? 2 : 0)} ${m[2]}`;
  } else if (m && !m[2]) {
    const qty = parseFloat(m[1].replace(",", ".")) * ratio;
    gotPhrase = `${num(qty, qty < 10 ? 1 : 0)} of them`;
  } else {
    gotPhrase = `${num(ratio * 100, 0)}%`;
  }
  const dir = pct >= 0 ? "more expensive" : "cheaper";
  return `${p.unit} of ${p.label.toLowerCase()} cost about ${eur(p.price2020)} in 2020 and about ${eur(pNow)} in ${year} (${pct >= 0 ? "+" : ""}${num(pct, 1)}%, ${dir}). For the same 2020 price, in ${year} you'd get only about ${gotPhrase}.`;
}

// ============ WIREFRAME — DO NOT MODIFY ============
function Wireframe({ shape, scale, ratio = 1, size = 400, strokeColor = "#1A1000", fillColor = "#F5E6A3" }) {
  const ref = useRef(null);
  const angle = useRef(0.5);
  const velocity = useRef(0.012);
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const onDown = (x) => { dragging.current = true; lastX.current = x; velocity.current = 0; };
    const onMove = (x) => {
      if (!dragging.current) return;
      const dx = x - lastX.current;
      angle.current += dx * 0.012;
      velocity.current = dx * 0.012;
      lastX.current = x;
    };
    const onUp = () => { dragging.current = false; };

    const md = (e) => onDown(e.clientX);
    const mm = (e) => onMove(e.clientX);
    const mu = () => onUp();
    const td = (e) => { e.preventDefault(); onDown(e.touches[0].clientX); };
    const tm = (e) => { e.preventDefault(); onMove(e.touches[0].clientX); };
    const tu = () => onUp();

    cv.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    cv.addEventListener("touchstart", td, { passive: false });
    cv.addEventListener("touchmove", tm, { passive: false });
    cv.addEventListener("touchend", tu);

    let raf;
    const draw = () => {
      const ctx = cv.getContext("2d");
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;

      const cx = W / 2, cy = H / 2 + (shape === "cylinder" ? H * 0.06 : 0);
      const baseR = Math.min(W, H) * 0.32 * scale;
      const fixedR = Math.min(W, H) * 0.26;
      const a = angle.current;

      const project = ([x, y, z], R) => {
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const X = x * cosA - z * sinA;
        const Z = x * sinA + z * cosA;
        const tilt = 0.5;
        const Y = y * Math.cos(tilt) - Z * Math.sin(tilt);
        return [cx + X * R, cy + Y * R];
      };
      const stroke = (edges, verts, R = baseR) => {
        ctx.beginPath();
        edges.forEach(([i, j]) => {
          const p = project(verts[i], R), q = project(verts[j], R);
          ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
        });
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
      };

      if (shape === "box") {
        const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
        stroke([[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]], v);
      } else if (shape === "cylinder") {
        const milkR = baseR * 0.72;
        const wl = (pts, R = milkR) => {
          ctx.beginPath();
          pts.forEach((p, i) => { const q = project(p, R); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.stroke();
        };
        const w = 1.0, d = 1.0, h = 2.0, gH = 0.5, ridgeY = -h/2 - gH;
        const BFL=[-w/2,h/2,-d/2], BFR=[w/2,h/2,-d/2], BBL=[-w/2,h/2,d/2], BBR=[w/2,h/2,d/2];
        const TFL=[-w/2,-h/2,-d/2], TFR=[w/2,-h/2,-d/2], TBL=[-w/2,-h/2,d/2], TBR=[w/2,-h/2,d/2];
        const RL=[-w/2,ridgeY,0], RR=[w/2,ridgeY,0];
        const tabW=w*0.85, tabD=0.12, tabH=0.12;
        const TaFL=[-tabW/2,ridgeY-tabH,-tabD], TaFR=[tabW/2,ridgeY-tabH,-tabD];
        const TaBL=[-tabW/2,ridgeY-tabH,tabD], TaBR=[tabW/2,ridgeY-tabH,tabD];
        wl([BFL,TFL]); wl([BFR,TFR]); wl([BBL,TBL]); wl([BBR,TBR]);
        wl([BFL,BFR,BBR,BBL,BFL]);
        wl([TFL,TFR,TBR,TBL,TFL]);
        wl([TFL,RL]); wl([TBL,RL]); wl([TFR,RR]); wl([TBR,RR]);
        wl([RL,RR]);
        wl([TFL,RL,RR,TFR]); wl([TBL,RL,RR,TBR]);
        wl([TaFL,TaFR,TaBR,TaBL,TaFL]);
        wl([RL,TaFL]); wl([RL,TaBL]); wl([RR,TaFR]); wl([RR,TaBR]);
      } else if (shape === "cone") {
        const seg = 16, v = [[0,-1,0]], e = [];
        for (let i = 0; i < seg; i++) {
          const t = (i / seg) * Math.PI * 2;
          v.push([Math.cos(t), 1, Math.sin(t)]);
        }
        for (let i = 0; i < seg; i++) { const cur=i+1, nxt=((i+1)%seg)+1; e.push([0,cur],[cur,nxt]); }
        stroke(e, v);
      } else if (shape === "sphere") {
        const rings = 6, segs = 12, v = [], e = [];
        for (let r = 0; r <= rings; r++) {
          const phi = (r/rings)*Math.PI - Math.PI/2;
          for (let s = 0; s < segs; s++) {
            const th = (s/segs)*Math.PI*2;
            v.push([Math.cos(phi)*Math.cos(th), Math.sin(phi), Math.cos(phi)*Math.sin(th)]);
          }
        }
        for (let r = 0; r <= rings; r++) {
          for (let s = 0; s < segs; s++) {
            const cur = r*segs+s, nxt = r*segs+((s+1)%segs);
            e.push([cur, nxt]); if (r < rings) e.push([cur, cur+segs]);
          }
        }
        stroke(e, v);
      } else if (shape === "eggbox") {
        const R = fixedR;
        const COLS = 5, ROWS = 2, TOTAL = COLS * ROWS;
        const eggsLeft = Math.max(0, Math.min(TOTAL, Math.round(TOTAL * ratio)));
        const halfX = 1.55, halfZ = 0.78;
        const rimY = 0.18, floorY = 0.42;
        const cellW = (halfX * 2) / COLS;
        const cellZ = (halfZ * 2) / ROWS;
        const pr = Math.min(cellW, cellZ) * 0.46;
        const ASPECT = 1.34;
        const eggAt = (u) => ({ radius: Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.07 * (-u)), y: u });
        const eggBillboard = (sx, sy, w) => {
          const hh = w * ASPECT, N = 80, pts = [];
          for (let i = 0; i <= N; i++) { const u = -1 + 2*i/N; const e = eggAt(u); pts.push([sx + e.radius*w, sy - e.y*hh]); }
          for (let i = N; i >= 0; i--) { const u = -1 + 2*i/N; const e = eggAt(u); pts.push([sx - e.radius*w, sy - e.y*hh]); }
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.fillStyle = fillColor; ctx.fill();
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.lineWidth = 1;
          [-0.45, -0.05, 0.35].forEach((u) => {
            const e = eggAt(u), rw = e.radius * w;
            const minor = rw * 0.30 * Math.sqrt(Math.max(0.05, 1 - u*u)) + rw * 0.04;
            ctx.beginPath();
            ctx.ellipse(sx, sy - e.y*hh, rw, minor, 0, 0, Math.PI*2);
            ctx.stroke();
          });
          const M = 48;
          for (const side of [-1, 1]) {
            const curve = [];
            for (let i = 0; i <= M; i++) {
              const u = -1 + 2*i/M, e = eggAt(u);
              curve.push([sx + side * e.radius*w*0.5, sy - e.y*hh]);
            }
            ctx.beginPath();
            curve.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.stroke();
          }
        };
        const pocket = (ox, oz) => {
          const segs = 20, v = [], e = [];
          for (let s = 0; s < segs; s++) {
            const th = (s/segs) * Math.PI * 2;
            v.push([ox + Math.cos(th)*pr, rimY, oz + Math.sin(th)*pr]);
          }
          for (let s = 0; s < segs; s++) e.push([s, (s+1)%segs]);
          stroke(e, v, R);
        };
        const rim = [[-halfX,rimY,-halfZ],[halfX,rimY,-halfZ],[halfX,rimY,halfZ],[-halfX,rimY,halfZ]];
        const base = rim.map(([x,,z]) => [x, floorY+0.10, z]);
        stroke([[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]], [...rim,...base], R);
        const cells = [];
        let idx = 0;
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            const ox = -halfX + cellW*(col+0.5);
            const oz = -halfZ + cellZ*(row+0.5);
            pocket(ox, oz);
            cells.push({ ox, oz, idx });
            idx++;
          }
        }
        const eggW = R*0.195, eggH = eggW*ASPECT;
        cells
          .filter((c) => c.idx < eggsLeft)
          .map((c) => ({ c, p: project([c.ox, rimY, c.oz], R) }))
          .sort((a, b) => a.p[1] - b.p[1])
          .forEach(({ p }) => eggBillboard(p[0], p[1] - eggH*0.6, eggW));
      }
    };

    const tick = () => {
      if (!dragging.current) {
        velocity.current = velocity.current * 0.92 + 0.012 * 0.08;
        angle.current += velocity.current;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("mousedown", md);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      cv.removeEventListener("touchstart", td);
      cv.removeEventListener("touchmove", tm);
      cv.removeEventListener("touchend", tu);
    };
  }, [shape, scale, ratio, strokeColor, fillColor]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ display: "block", cursor: "grab", maxWidth: "100%" }}
    />
  );
}

// ============ YEAR SLIDER ============
function YearSlider({ yearIdx, onChange }) {
  return (
    <div className="slider-region">
      <input
        type="range"
        min={0}
        max={YEARS.length - 1}
        step={1}
        value={yearIdx}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="year-ticks-row">
        {YEARS.map((y, i) => (
          <span key={y} data-active={String(i === yearIdx)}>{y}</span>
        ))}
      </div>
    </div>
  );
}

// ============ LANDING VIEW ============
function LandingView({ yearIdx }) {
  // lightest weight at 2020, heaviest at 2024 — maps 0→200, 4→900
  const weight = Math.round(200 + (yearIdx / (YEARS.length - 1)) * 700);
  return (
    <div className="landing-content">
      <h1 className="site-title" style={{ fontVariationSettings: `'wght' ${weight}` }}>inflation.</h1>
      <div className="landing-text">
        <p className="landing-subtitle">What did inflation do to your shopping basket?</p>
        <p className="landing-description">
          German food prices rose by 32% between 2020 and 2024, outpacing both wages and overall inflation.
        </p>
      </div>
    </div>
  );
}

// ============ PRODUCT VIEW ============
function ProductView({ product, yearIdx }) {
  const idx = product.index[yearIdx];
  const scale = scaleFor(idx);
  const pNow = priceFor(product, yearIdx);
  const pct = Math.round((idx - BASE_INDEX) * 10) / 10;

  return (
    <div className="product-view">
      <h2 className="product-name">{product.label}</h2>
      <span className="product-unit">{product.unit}</span>

      <div className="wireframe-wrap">
        <Wireframe shape={product.shape} scale={scale} ratio={BASE_INDEX / idx} size={400} />
      </div>

      <div className="indicators-row">
        <div className="indicator">
          <span className="indicator-value">{num(idx, 1)}</span>
          <span className="indicator-label">Index</span>
        </div>
        <div className="indicator">
          <span className="indicator-value">{eur(pNow)}</span>
          <span className="indicator-label">Price {YEARS[yearIdx]}</span>
        </div>
        <div className={`indicator${pct >= 30 ? " indicator--high" : ""}`}>
          <span className="indicator-value">{pct >= 0 ? "+" : ""}{num(pct, 1)}%</span>
          <span className="indicator-label">vs. 2020</span>
        </div>
      </div>

      <p className="narrative">{narrative(product, yearIdx)}</p>
    </div>
  );
}

// ============ MAIN ============
export default function InflationApp() {
  const [activeId, setActiveId] = useState(null);
  const [yearIdx, setYearIdx] = useState(0);

  const active = PRODUCTS.find((p) => p.id === activeId);

  const handleSelect = (id) => {
    if (id !== activeId) setYearIdx(0);
    setActiveId(id);
  };

  return (
    <div className="app">
      <div className="page-frame">

        {/* Content zone: fills remaining height, content vertically centered */}
        <div className="content-zone">
          {active
            ? <ProductView key={activeId} product={active} yearIdx={yearIdx} />
            : <LandingView yearIdx={yearIdx} />
          }
        </div>

        {/* Bottom zone: always fixed at same position — slider never moves */}
        <div className="bottom-zone">
          <YearSlider yearIdx={yearIdx} onChange={setYearIdx} />
          <p className="cta-text">Select a product to see how much less your money now buys</p>
          <div className="nav-outer">
            <nav className="product-nav">
              {PRODUCTS.map((p) => (
                <button
                  key={p.id}
                  className={`product-btn${activeId === p.id ? " product-btn--active" : ""}`}
                  onClick={() => handleSelect(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="disclaimer">
            <p>
              This experiment explores data storytelling through vibe coding and was not produced under full journalistic
              standards of accuracy, verification, or editorial review. Inflation data comes from official German
              statistics: Statistisches Bundesamt (Destatis), Verbraucherpreisindex, Sonderauswertung Nahrungsmittel,
              annual averages 2020–2024. Euro prices are estimates based on the index and a 2020 reference price.
            </p>
          </div>
          <footer className="site-footer">
            <p>Designed by Lina Moreno. Developed with Claude.</p>
          </footer>
        </div>

      </div>
    </div>
  );
}
