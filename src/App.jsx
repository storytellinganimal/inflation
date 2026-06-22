import React, { useState, useRef, useEffect } from "react";

/**
 * INFLATION APP — STRUCTURE ONLY (v2)
 * ------------------------------------------------------------------
 * Black & white, sans-serif, wireframe 3D objects. No design polish.
 * You add the visual layer.
 *
 * WHAT'S NEW IN v2
 *  - Compare mode: pick a second product, shown on the RIGHT.
 *    One slider drives BOTH objects (same year for both).
 *  - English UI labels. Numbers formatted German-style (1,50 €).
 *  - Estimated euro prices, derived from the index (see PRICE LOGIC).
 *  - Narrative purchasing-power text below the Steckbrief.
 *
 * DATA: German consumer price index, base year 2020 = 100.
 * Source: Statistisches Bundesamt (Destatis), Sonderauswertung
 * Nahrungsmittel, yearly averages (10-Steller), 2020–2024.
 *
 * NOTE ON YEARS: 2019 only exists in the older 2015-base series and
 * cannot be cleanly rebased here, so it is omitted. 2025 exists only
 * in the authenticated GENESIS table (61111-0006); add it later by
 * appending one value per product + one YEARS entry.
 *
 * SIZE LOGIC ("bigger if I get more for less money"):
 *   Size is the INVERSE of price. scale = BASE_INDEX / index[year]
 *   2020 → 1.00×; index up → object shrinks; index down → grows.
 *
 * PRICE LOGIC (estimated):
 *   Each product has ONE real-ish 2020 anchor price (approx. German
 *   retail). Every other year is anchor × index[year] / 100. These
 *   are ESTIMATES for illustration, not surveyed shelf prices.
 * ------------------------------------------------------------------
 */

const BASE_INDEX = 100;
const YEARS = [2020, 2021, 2022, 2023, 2024];

// price2020 = approx. German retail price in 2020 for `unit`.
// index = real Destatis CPI series (2020=100), yearly averages.
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

// ---- helpers -------------------------------------------------------
const scaleFor = (indexValue) => BASE_INDEX / indexValue;
const priceFor = (p, yi) => p.price2020 * p.index[yi] / 100;

const eur = (n) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const num = (n, d = 2) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

// Build the "same money buys X" sentence vs the 2020 baseline.
function narrative(p, yi) {
  const year = YEARS[yi];
  if (year === 2020) {
    return `In 2020, ${p.unit} of ${p.label.toLowerCase()} cost about ${eur(p.price2020)}. Move the slider to see what the same money buys in later years.`;
  }
  const ratio = BASE_INDEX / p.index[yi]; // how much of one 2020-unit you get
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
  return `${p.unit} of ${p.label.toLowerCase()} cost about ${eur(p.price2020)} in 2020 and about ${eur(pNow)} in ${year} (${pct >= 0 ? "+" : ""}${num(pct, 1)}%, i.e. ${dir}). For the 2020 price of ${p.unit}, in ${year} you would get only about ${gotPhrase}.`;
}

// ============ 3D WIREFRAME OBJECT ============
// `scale` = inverse-price size factor (used by the simple primitives).
// `ratio` = 100/index = purchasing power vs 2020 (used by COUNT-based
//           shapes like the egg box, where quantity carries the meaning
//           instead of size). Add new per-item shapes in the switch below.
// Drag or touch to rotate; releases with momentum/damping.
function Wireframe({ shape, scale, ratio = 1, size = 500 }) {
  const ref = useRef(null);
  const angle = useRef(0.5);
  const velocity = useRef(0.012);   // starts auto-spinning
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    // ---- pointer interaction ----
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
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;

      const cx = W / 2, cy = H / 2 + (shape === "cylinder" ? H * 0.06 : 0);
      const baseR = Math.min(W, H) * 0.32 * scale; // scaled radius (primitives)
      const fixedR = Math.min(W, H) * 0.26;        // fixed radius (count-based shapes)
      const a = angle.current;

      // project a 3D point using a given radius R (so each shape picks
      // whether it scales with price or stays a fixed size)
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
        ctx.stroke();
      };

      if (shape === "box") {
        const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
        stroke([[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]], v);
      } else if (shape === "cylinder") {
        // Milk carton: taller than wide, gable roof with ridge running left-right, flat tab on top
        const milkR = baseR * 0.72;
        const wl = (pts, R = milkR) => {
          ctx.beginPath();
          pts.forEach((p, i) => { const q = project(p, R); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
          ctx.strokeStyle = "#000"; ctx.lineWidth = 1.3; ctx.stroke();
        };
        const w = 1.0, d = 1.0, h = 2.0, gH = 0.5, ridgeY = -h/2 - gH;
        const BFL=[-w/2,h/2,-d/2], BFR=[w/2,h/2,-d/2], BBL=[-w/2,h/2,d/2], BBR=[w/2,h/2,d/2];
        const TFL=[-w/2,-h/2,-d/2], TFR=[w/2,-h/2,-d/2], TBL=[-w/2,-h/2,d/2], TBR=[w/2,-h/2,d/2];
        const RL=[-w/2,ridgeY,0], RR=[w/2,ridgeY,0];
        const tabW=w*0.85, tabD=0.12, tabH=0.12;
        const TaFL=[-tabW/2,ridgeY-tabH,-tabD], TaFR=[tabW/2,ridgeY-tabH,-tabD];
        const TaBL=[-tabW/2,ridgeY-tabH,tabD], TaBR=[tabW/2,ridgeY-tabH,tabD];
        // body
        wl([BFL,TFL]); wl([BFR,TFR]); wl([BBL,TBL]); wl([BBR,TBR]);
        wl([BFL,BFR,BBR,BBL,BFL]);
        wl([TFL,TFR,TBR,TBL,TFL]);
        // gable
        wl([TFL,RL]); wl([TBL,RL]); wl([TFR,RR]); wl([TBR,RR]);
        wl([RL,RR]);
        wl([TFL,RL,RR,TFR]); wl([TBL,RL,RR,TBR]);
        // tab
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
        // --- German 10-egg pulp carton BASE (no lid), 2 rows x 5 cols ---
        // Eggs are removed by inflation; the CARTON STAYS A FIXED SIZE
        // (meaning is carried by how many eggs remain, not by size), so
        // every stroke here uses `fixedR`, never `baseR`.
        // Linework kept deliberately light: each egg is a clean outline plus
        // one curved cross-contour (reads as a solid 3D egg, not a flat
        // sticker and not a wireframe mesh), pockets are plain circles, no
        // dividers, no lid.
        const R = fixedR;
        const COLS = 5, ROWS = 2, TOTAL = COLS * ROWS;
        const eggsLeft = Math.max(0, Math.min(TOTAL, Math.round(TOTAL * ratio)));

        const halfX = 1.55, halfZ = 0.78;
        const rimY = 0.18;    // top edge of the shallow tray
        const floorY = 0.42;  // pocket bottoms, just below the rim
        const cellW = (halfX * 2) / COLS;
        const cellZ = (halfZ * 2) / ROWS;
        const pr = Math.min(cellW, cellZ) * 0.46;

        // --- the egg: a clean egg outline that always faces the viewer, with
        // a single curved cross-contour so it reads as a SOLID 3D form (not a
        // flat sticker, not a wireframe mesh). The outline uses one shared
        // parameter u for both height and width, so both ends close to proper
        // rounded points. ---
        const ASPECT = 1.34; // egg height / width
        // profile at u in [-1, 1]: radius 0 at both ends, slight egg asymmetry
        const eggAt = (u) => ({
          radius: Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.07 * (-u)),
          y: u,
        });
        const eggBillboard = (sx, sy, w) => {
          const hh = w * ASPECT, N = 80, pts = [];
          for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N; const e = eggAt(u); pts.push([sx + e.radius * w, sy - e.y * hh]); }
          for (let i = N; i >= 0; i--) { const u = -1 + 2 * i / N; const e = eggAt(u); pts.push([sx - e.radius * w, sy - e.y * hh]); }
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.closePath();
          ctx.fillStyle = "#fff"; ctx.fill();
          ctx.strokeStyle = "#000"; ctx.lineWidth = 1.3; ctx.stroke();
          // three horizontal cross-contours that bow with the egg surface,
          // giving a clear 3D / rounded read without a wireframe mesh
          ctx.lineWidth = 1;
          [-0.45, -0.05, 0.35].forEach((u) => {
            const e = eggAt(u), rw = e.radius * w;
            const minor = rw * 0.30 * Math.sqrt(Math.max(0.05, 1 - u * u)) + rw * 0.04;
            ctx.beginPath();
            ctx.ellipse(sx, sy - e.y * hh, rw, minor, 0, 0, Math.PI * 2);
            ctx.stroke();
          });
          // one pair of vertical seam curves crossing the horizontal bands
          const M = 48;
          for (const side of [-1, 1]) {
            const curve = [];
            for (let i = 0; i <= M; i++) {
              const u = -1 + 2 * i / M, e = eggAt(u);
              curve.push([sx + side * e.radius * w * 0.5, sy - e.y * hh]);
            }
            ctx.beginPath();
            curve.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.stroke();
          }
        };

        // a simple pocket: one smooth circle at the rim
        const pocket = (ox, oz) => {
          const segs = 20, v = [], e = [];
          for (let s = 0; s < segs; s++) {
            const th = (s / segs) * Math.PI * 2;
            v.push([ox + Math.cos(th) * pr, rimY, oz + Math.sin(th) * pr]);
          }
          for (let s = 0; s < segs; s++) e.push([s, (s + 1) % segs]);
          stroke(e, v, R);
        };

        // --- tray outer shell only (no lid) ---
        const rim = [
          [-halfX, rimY, -halfZ], [halfX, rimY, -halfZ],
          [halfX, rimY, halfZ],  [-halfX, rimY, halfZ],
        ];
        const base = rim.map(([x, , z]) => [x, floorY + 0.10, z]);
        stroke(
          [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]],
          [...rim, ...base], R
        );

        // --- pockets first (all of them), then eggs back-to-front ---
        const cells = [];
        let idx = 0;
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            const ox = -halfX + cellW * (col + 0.5);
            const oz = -halfZ + cellZ * (row + 0.5);
            pocket(ox, oz);
            cells.push({ ox, oz, idx });
            idx++;
          }
        }
        // egg billboard size, scaled to the carton
        const eggW = R * 0.195, eggH = eggW * ASPECT;
        // draw filled eggs from far (higher on screen) to near so they overlap
        cells
          .filter((c) => c.idx < eggsLeft)
          .map((c) => ({ c, p: project([c.ox, rimY, c.oz], R) }))
          .sort((a, b) => a.p[1] - b.p[1])
          .forEach(({ p }) => eggBillboard(p[0], p[1] - eggH * 0.6, eggW));
      }
    };
    const tick = () => {
      if (!dragging.current) {
        // dampen toward a gentle auto-spin
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
  }, [shape, scale, ratio]);

  return <canvas ref={ref} width={size} height={size} style={{ display: "block", cursor: "grab" }} />;
}

// ============ ONE PRODUCT PANEL (object + steckbrief + narrative) ============
function ProductPanel({ product, yearIdx, onRemove, removable }) {
  const idx = product.index[yearIdx];
  const scale = scaleFor(idx);
  const pNow = priceFor(product, yearIdx);
  const pct = Math.round((idx - BASE_INDEX) * 10) / 10;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 280 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{product.label}</h2>
        {removable && (
          <button onClick={onRemove} style={{ border: "1px solid #000", background: "#fff", fontFamily: "inherit", fontSize: 12, cursor: "pointer", padding: "2px 8px" }}>
            remove
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Wireframe shape={product.shape} scale={scale} ratio={BASE_INDEX / idx} />
      </div>

      {/* STECKBRIEF — data only */}
      <div style={{ fontSize: 13, lineHeight: 1.6, textAlign: "center" }}>
        <div>Unit: {product.unit}</div>
        <div>Price index (2020=100): {num(idx, 1)}</div>
        <div>Est. price {YEARS[yearIdx]}: {eur(pNow)}</div>
        <div>vs 2020: {pct >= 0 ? "+" : ""}{num(pct, 1)}%</div>
        <div>Object scale: {num(scale, 2)}×</div>
      </div>

      {/* NARRATIVE — below the steckbrief */}
      <p style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 320, textAlign: "center", marginTop: 12 }}>
        {narrative(product, yearIdx)}
      </p>
    </div>
  );
}

// ============ MAIN ============
export default function InflationApp() {
  const [leftId, setLeftId] = useState(null);
  const [rightId, setRightId] = useState(null);
  const [yearIdx, setYearIdx] = useState(0);
  const [picking, setPicking] = useState(false); // choosing the 2nd product

  const left = PRODUCTS.find((p) => p.id === leftId);
  const right = PRODUCTS.find((p) => p.id === rightId);

  const wrap = { fontFamily: "Helvetica, Arial, sans-serif", color: "#000", background: "#fff", minHeight: "100vh", padding: 24 };

  // ---- SCREEN 1: pick first product ----
  if (!left) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Choose a product</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PRODUCTS.map((p) => (
            <button key={p.id} onClick={() => { setLeftId(p.id); setYearIdx(0); }}
              style={{ padding: "10px 16px", border: "1px solid #000", background: "#fff", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- compare picker overlay (choosing 2nd product) ----
  const comparePicker = picking && (
    <div style={{ marginBottom: 16, padding: 12, border: "1px solid #000" }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>Compare with:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {PRODUCTS.filter((p) => p.id !== leftId).map((p) => (
          <button key={p.id} onClick={() => { setRightId(p.id); setPicking(false); }}
            style={{ padding: "8px 14px", border: "1px solid #000", background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setPicking(false)}
          style={{ padding: "8px 14px", border: "1px solid #000", background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
          cancel
        </button>
      </div>
    </div>
  );

  // ---- SCREEN 2: detail / comparison ----
  return (
    <div style={wrap}>
      {/* top controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setLeftId(null); setRightId(null); }}
          style={{ padding: "6px 12px", border: "1px solid #000", background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
          ← Back
        </button>
        {!right && !picking && (
          <button onClick={() => setPicking(true)}
            style={{ padding: "6px 12px", border: "1px solid #000", background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
            + Compare
          </button>
        )}
      </div>

      {comparePicker}

      {/* objects side by side */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        <ProductPanel product={left} yearIdx={yearIdx} removable={false} />
        {right && (
          <ProductPanel product={right} yearIdx={yearIdx} removable
            onRemove={() => setRightId(null)} />
        )}
      </div>

      {/* shared year slider — drives BOTH */}
      <div style={{ width: "100%", maxWidth: 520, margin: "32px auto 0" }}>
        <input type="range" min={0} max={YEARS.length - 1} step={1} value={yearIdx}
          onChange={(e) => setYearIdx(Number(e.target.value))} style={{ width: "100%" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
          {YEARS.map((y) => <span key={y}>{y}</span>)}
        </div>
        <div style={{ textAlign: "center", fontSize: 13, marginTop: 8 }}>Year: {YEARS[yearIdx]}</div>
      </div>

      <p style={{ fontSize: 11, marginTop: 24, maxWidth: 520, textAlign: "center", marginLeft: "auto", marginRight: "auto" }}>
        Index data: Statistisches Bundesamt (Destatis), Verbraucherpreisindex,
        Sonderauswertung Nahrungsmittel, yearly averages 2020–2024. Euro prices
        are estimates derived from the index and a 2020 reference price.
      </p>
    </div>
  );
}
