// Figure: what the camera sees. Left is a synthetic 640 × 480 frame with the Gaussian spot of
// tests/test_verticality_vision.py, its magnified core, and the row profile with a Gaussian fitted
// to the unsaturated halo. Right is a replica of the operator panel's "target view" card
// (web/src/components/VerticalityPanel.tsx), fed by the ported detector in spotcore.mjs.
import { spotCoreScript } from "./spotcore.mjs";

export const spotCss = `
.cam{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:stretch}
.cam>div{min-width:0}
.cam .side{top:22px}
.cam .lbl{display:flex;justify-content:space-between;gap:8px;font:10.5px/1.5 var(--mono);color:var(--muted);margin:0 0 6px}
.cam .lbl b{font-weight:400;color:var(--text-2)}
.cam canvas{display:block;width:100%;height:auto;border-radius:6px}
.cam #lab-paper{cursor:crosshair;touch-action:none;outline:none;box-shadow:0 0 0 1px var(--rule)}
.cam #lab-paper:focus-visible{box-shadow:0 0 0 2px var(--accent)}
.cam #lab-profile{margin-top:10px}
.cam .side label{display:grid;grid-template-columns:44px minmax(0,1fr) 30px;align-items:center;gap:6px}
.cam .sliders{display:grid;gap:4px}
.cam .side input[type=range]{width:100%;accent-color:var(--accent);margin:0}
.cam .side output{font:10.5px var(--mono);text-align:right;color:var(--text-2)}

/* Replica of the operator panel; tokens copied from web/src/styles.css */
.app [hidden]{display:none!important}
.app{--a-surface:#fff;--a-line:rgba(0,0,0,.08);--a-line-strong:rgba(0,0,0,.16);--a-text:#1d1d1f;--a-text-2:#6e6e73;--a-text-3:#86868b;
  --a-accent:#0071e3;--a-accent-soft:rgba(0,113,227,.1);--a-ok:#248a3d;--a-ok-soft:rgba(52,199,89,.14);--a-warn:#c93400;--a-warn-soft:rgba(255,149,0,.14);
  --a-bad:#e0241b;--a-bad-soft:rgba(255,59,48,.11);--hud-bg:#fbfbfd;--hud-grid:rgba(0,0,0,.05);--hud-ring:rgba(0,0,0,.18);--hud-label:rgba(0,0,0,.45);
  --hud-ref:#c93400;--hud-spot:#248a3d;--a-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.04);
  font:12px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:var(--a-text);display:flex;flex-direction:column;gap:8px}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .app{--a-surface:#1c1c1e;--a-line:rgba(255,255,255,.1);--a-line-strong:rgba(255,255,255,.18);--a-text:#f5f5f7;--a-text-2:#a1a1a6;--a-text-3:#6e6e73;
  --a-accent:#0a84ff;--a-accent-soft:rgba(10,132,255,.16);--a-ok:#30d158;--a-ok-soft:rgba(48,209,88,.15);--a-warn:#ff9f0a;--a-warn-soft:rgba(255,159,10,.16);--a-bad:#ff453a;--a-bad-soft:rgba(255,69,58,.16);
  --hud-bg:#0a0a0c;--hud-grid:rgba(255,255,255,.045);--hud-ring:rgba(255,255,255,.16);--hud-label:rgba(255,255,255,.42);--hud-ref:#ff9f0a;--hud-spot:#30d158;--a-shadow:none}}
:root[data-theme="dark"] .app{--a-surface:#1c1c1e;--a-line:rgba(255,255,255,.1);--a-line-strong:rgba(255,255,255,.18);--a-text:#f5f5f7;--a-text-2:#a1a1a6;--a-text-3:#6e6e73;
  --a-accent:#0a84ff;--a-accent-soft:rgba(10,132,255,.16);--a-ok:#30d158;--a-ok-soft:rgba(48,209,88,.15);--a-warn:#ff9f0a;--a-warn-soft:rgba(255,159,10,.16);--a-bad:#ff453a;--a-bad-soft:rgba(255,69,58,.16);
  --hud-bg:#0a0a0c;--hud-grid:rgba(255,255,255,.045);--hud-ring:rgba(255,255,255,.16);--hud-label:rgba(255,255,255,.42);--hud-ref:#ff9f0a;--hud-spot:#30d158;--a-shadow:none}
.app .app-card{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--a-surface);border-radius:12px;box-shadow:var(--a-shadow),0 0 0 1px var(--a-line);overflow:hidden}
.app .head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 8px;padding:8px 10px;border-bottom:1px solid var(--a-line)}
.app .head h5{margin:0;font-size:12.5px;font-weight:600;letter-spacing:-.01em}
.app .head h5 span{margin-left:6px;font-weight:400;color:var(--a-text-3);font-size:10.5px}
.app .badges{display:flex;flex-wrap:wrap;gap:4px}
.app .badge{display:inline-flex;align-items:center;min-height:18px;padding:0 6px;border-radius:999px;font-size:10px;font-weight:550;color:var(--a-text-3);white-space:nowrap}
.app .badge.ok{background:var(--a-ok-soft);color:var(--a-ok)}
.app .badge.warn{background:var(--a-warn-soft);color:var(--a-warn)}
.app .badge.bad{background:var(--a-bad-soft);color:var(--a-bad)}
.app .badge.info{background:var(--a-accent-soft);color:var(--a-accent)}
.app .app-hud{position:relative;flex:1;min-height:170px;background:var(--hud-bg)}
.app .app-hud canvas{position:absolute;inset:0;width:100%;height:100%;border-radius:0}
.app .hud-empty,.app .hud-dist{position:absolute;font-size:10.5px;pointer-events:none}
.app .hud-empty{left:50%;top:calc(50% + 30px);transform:translateX(-50%);padding:3px 10px;border-radius:999px;background:var(--a-surface);border:1px solid var(--a-line);color:var(--a-text-2);white-space:nowrap}
.app .hud-dist{right:8px;bottom:8px;padding:3px 8px;border-radius:7px;background:var(--a-surface);border:1px solid var(--a-line-strong);font-family:var(--mono);font-variant-numeric:tabular-nums}
.app .hud-dist.alert{border-color:var(--a-bad);background:var(--a-bad-soft);color:var(--a-bad)}
.app .tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.app .tile{display:grid;gap:1px;padding:7px 9px;border-radius:12px;background:var(--a-surface);box-shadow:var(--a-shadow),0 0 0 1px var(--a-line);min-width:0}
.app .tile span{font-size:10px;font-weight:550;color:var(--a-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.app .tile b{font:600 15px/1.2 var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.app .tile b small{margin-left:3px;font-size:10px;font-weight:500;color:var(--a-text-3)}
.app .tile i{font-style:normal;font-size:9.5px;color:var(--a-text-3)}
.app .tile.ok i{color:var(--a-ok)}
.app .tile.alert{background:color-mix(in srgb,var(--a-bad) 10%,var(--a-surface))}
.app .tile.alert b,.app .tile.alert i{color:var(--a-bad)}
@media (max-width:760px){
  .cam{grid-template-columns:minmax(0,1fr);gap:14px}
  .cam .side{order:1;margin:0 0 6px}
  .cam .app{order:2}
  .cam .side .s-keys,.cam .side .s-hint{display:none}
  .cam .side .s-group:first-of-type{margin-top:0;padding-top:0;border-top:0}
  .cam .sliders{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .cam .side label{grid-template-columns:minmax(0,1fr) auto;gap:2px 4px}
  .cam .side label input{grid-column:1/3;grid-row:2}
  .cam .side dl.s-read{grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr);gap:0 8px;font-size:10.5px}
  .app .app-hud{flex:none;aspect-ratio:3/2;min-height:0}
}
`;

export const spotMarkup = `
<div class="cam" id="cam">
  <div>
    <p class="lbl"><b>Camera frame</b><span>synthetic · 640 × 480</span></p>
    <canvas id="lab-paper" width="640" height="480" tabindex="0" role="application"
            aria-label="Synthetic camera frame with a Gaussian laser spot. Drag the spot, or focus and use the arrow keys."></canvas>
    <canvas id="lab-profile" width="640" height="260" role="img" aria-label="Green channel along the row through the centroid, with the fitted Gaussian"></canvas>
    <p class="lbl" style="margin-top:4px"><b>Row profile</b><span>dots: pixels · line: Gaussian fit</span></p>
  </div>
  <div class="app" aria-label="Replica of the operator panel's target view">
    <p class="lbl"><b>Operator panel</b><span>replica · labels translated</span></p>
    <section class="app-card">
      <header class="head"><h5>Target view<span>10 Hz · 640×480</span></h5><div class="badges" id="lab-badges"></div></header>
      <div class="app-hud"><canvas id="lab-panel" role="img" aria-label="Target view: spot and reference in millimetres"></canvas>
        <div class="hud-empty" id="lab-empty" hidden>Waiting for the laser spot</div>
        <div class="hud-dist" id="lab-dist" hidden></div></div>
    </section>
    <div class="tiles">
      <div class="tile"><span>Laser height H</span><b>12.40<small>m</small></b><i>live</i></div>
      <div class="tile" id="lab-tx"><span>X deviation dX</span><b id="lab-dx">—</b><i>limit ±3.0 mm</i></div>
      <div class="tile" id="lab-ty"><span>Y deviation dY</span><b id="lab-dy">—</b><i>limit ±3.0 mm</i></div>
    </div>
  </div>
  <div class="side">
    <p class="s-hint">Drag the spot on the camera frame</p>
    <p class="s-keys"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 1 px</p><p class="s-keys"><kbd>Shift</kbd> 10 px</p>
    <div class="s-group"><span>Reference</span><div class="s-seg"><button type="button" id="lab-set">Set here<kbd>S</kbd></button><button type="button" id="lab-clear">Clear<kbd>R</kbd></button></div></div>
    <div class="s-group"><span>Beam</span><div class="sliders">
    <label>σ <input id="lab-sigma" type="range" min="3" max="12" step="0.5" value="6"><output id="lab-sigma-v">6.0</output></label>
    <label>Peak G <input id="lab-amp" type="range" min="40" max="600" step="10" value="400"><output id="lab-amp-v">400</output></label>
    <label>Noise <input id="lab-noise" type="range" min="0" max="8" step="0.5" value="2"><output id="lab-noise-v">2.0</output></label>
    </div></div>
    <div class="s-group"><span>Detector</span><dl class="s-read" id="lab-read" aria-live="off"></dl></div>
  </div>
</div>
`;

const labScript = `
{
const paper = document.querySelector("#lab-paper");
if (paper) {
  const W = 640, H = 480, SCALE = 0.256557, TOL = 3;
  const BG = [170, 178, 172];
  const $ = (s) => document.querySelector(s);
  const panel = $("#lab-panel"), prof = $("#lab-profile");
  const pctx = paper.getContext("2d"), fctx = prof.getContext("2d"), hctx = panel.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const st = { x: 331.4, y: 233.2, sigma: 6, amp: 400, noise: 2, ref: [320, 240], prev: null, det: null };
  let base = null, baseNoise = -1;
  const css = (el, n) => getComputedStyle(el).getPropertyValue(n).trim();

  const frame = () => {
    if (baseNoise !== st.noise) { base = RS.paperFrame(W, H, 3, BG, st.noise); baseNoise = st.noise; }
    const f = { w: W, h: H, ch: base.ch.map((a) => Float32Array.from(a)) };
    RS.addSpot(f, st.x, st.y, st.sigma, [st.amp * 0.15, st.amp, st.amp * 0.225]);
    return RS.toU8(f);
  };

  const drawFrame = (img, det) => {
    const id = pctx.createImageData(W, H);
    for (let i = 0, j = 0; i < W * H; i++, j += 4) { id.data[j] = img.r[i]; id.data[j + 1] = img.g[i]; id.data[j + 2] = img.b[i]; id.data[j + 3] = 255; }
    pctx.putImageData(id, 0, 0);
    if (!det || det.none) return;
    // magnified core: 48 × 48 px around the centroid, ×3, in the corner away from the spot
    const R = 24, Z = 3, S = R * 2 * Z;
    const ix = det.x < W / 2 ? W - S - 14 : 14, iy = det.y < H / 2 ? H - S - 14 : 14;
    const sx = Math.round(det.x) - R, sy = Math.round(det.y) - R;
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(paper, sx, sy, R * 2, R * 2, ix, iy, S, S);
    pctx.strokeStyle = "rgba(255,255,255,.9)"; pctx.lineWidth = 2;
    pctx.strokeRect(ix, iy, S, S);
    pctx.strokeRect(sx, sy, R * 2, R * 2);
    const cx = ix + (det.x - sx + 0.5) * Z, cy = iy + (det.y - sy + 0.5) * Z;
    pctx.strokeStyle = det.usable ? "#111" : "#c0392b"; pctx.lineWidth = 1.5;
    pctx.beginPath(); pctx.moveTo(cx - 12, cy); pctx.lineTo(cx + 12, cy); pctx.moveTo(cx, cy - 12); pctx.lineTo(cx, cy + 12); pctx.stroke();
    pctx.fillStyle = "rgba(0,0,0,.6)"; pctx.fillRect(ix, iy + S - 30, S, 30);
    pctx.fillStyle = "#fff"; pctx.font = "20px ui-monospace,monospace";
    pctx.fillText("×3", ix + 8, iy + S - 9);
  };

  const drawProfile = (img, det) => {
    const w = prof.width, h = prof.height, L = 10, Rm = 10, T = 14, B = 40;
    fctx.clearRect(0, 0, w, h);
    const ink = css(document.body, "--muted") || "#8f8f8f", rule = css(document.body, "--rule") || "#ebebeb";
    const acc = css(document.body, "--accent") || "#2f8a57", text = css(document.body, "--text-2") || "#525252";
    fctx.font = "25px ui-monospace,monospace";
    if (!det || det.none) { fctx.fillStyle = ink; fctx.fillText("no candidate", L, h / 2); return null; }
    const row = Math.round(det.y), half = 34, x0 = Math.round(det.x) - half;
    const xs = [], vs = [];
    for (let x = x0; x <= x0 + half * 2; x++) if (x >= 0 && x < W) { xs.push(x); vs.push(img.g[row * W + x]); }
    const fit = RS.fitGaussian(xs, vs, det.background, det.threshold, 250);
    const top = Math.max(270, fit ? Math.min(det.background + fit.peak, 900) + 15 : 0);
    const lo = det.background - 20;
    const X = (x) => L + ((x - x0) / (half * 2)) * (w - L - Rm);
    const Y = (v) => T + (1 - (v - lo) / (top - lo)) * (h - T - B);
    fctx.lineWidth = 1.5;
    fctx.strokeStyle = rule;
    fctx.beginPath(); fctx.moveTo(L, Y(det.background)); fctx.lineTo(w - Rm, Y(det.background)); fctx.stroke();
    fctx.setLineDash([6, 6]);
    fctx.beginPath(); fctx.moveTo(L, Y(250)); fctx.lineTo(w - Rm, Y(250)); fctx.stroke();
    fctx.setLineDash([]);
    fctx.fillStyle = ink;
    fctx.textAlign = "right"; fctx.fillText("paper " + det.background.toFixed(0), w - Rm, Y(det.background) - 16); fctx.textAlign = "left";
    fctx.fillText("saturation 250", L, Y(250) - 8);
    if (fit) {
      fctx.strokeStyle = acc; fctx.lineWidth = 3;
      fctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = x0 + (i / 200) * half * 2;
        const v = det.background + fit.peak * Math.exp(-((x - fit.mu) ** 2) / (2 * fit.sigma * fit.sigma));
        i ? fctx.lineTo(X(x), Y(Math.min(v, top))) : fctx.moveTo(X(x), Y(v));
      }
      fctx.stroke();
    }
    for (let i = 0; i < xs.length; i++) {
      const sat = vs[i] >= 250;
      fctx.beginPath(); fctx.arc(X(xs[i]), Y(vs[i]), 4.5, 0, Math.PI * 2);
      if (sat) { fctx.strokeStyle = text; fctx.lineWidth = 1.5; fctx.stroke(); }
      else { fctx.fillStyle = text; fctx.fill(); }
    }
    fctx.strokeStyle = acc; fctx.lineWidth = 1.5; fctx.setLineDash([3, 5]);
    fctx.beginPath(); fctx.moveTo(X(det.x), T); fctx.lineTo(X(det.x), h - B); fctx.stroke(); fctx.setLineDash([]);
    fctx.fillStyle = ink;
    fctx.fillText("x " + x0, L, h - 8);
    fctx.textAlign = "right"; fctx.fillText("x " + (x0 + half * 2), w - Rm, h - 8);
    fctx.textAlign = "center"; fctx.fillStyle = acc; fctx.fillText("centroid " + det.x.toFixed(2), X(det.x), h - 8);
    fctx.textAlign = "left";
    return fit;
  };

  // ---- target view: same drawing as VerticalityPanel.tsx, labels translated ----
  let cssW = 1, cssH = 1, viewMm = 10, hudFrame = 0, anim = 0, visible = true;
  const resize = () => {
    const r = panel.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (panel.width !== pw || panel.height !== ph) { panel.width = pw; panel.height = ph; }
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const colors = () => ({
    bg: css(panel, "--hud-bg"), grid: css(panel, "--hud-grid"), ring: css(panel, "--hud-ring"), label: css(panel, "--hud-label"),
    ref: css(panel, "--hud-ref"), spot: css(panel, "--hud-spot"), line: css(panel, "--a-accent"), alert: css(panel, "--a-bad"),
  });
  let col = null;
  const hud = () => {
    const w = cssW, h = cssH, ctx = hctx;
    hudFrame++;
    if (!col || hudFrame % 30 === 0) col = colors();
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = col.bg; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = cx % 24; x < w; x += 24) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (let y = cy % 24; y < h; y += 24) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
    const d = st.det, spot = d && !d.none ? [d.x, d.y] : null, ref = st.ref;
    const center = ref ?? spot ?? [W / 2, H / 2];
    let target = TOL * 2.2;
    if (ref && spot) target = Math.max(target, Math.hypot(spot[0] - ref[0], spot[1] - ref[1]) * SCALE * 1.4);
    else if (!ref) target = Math.max(target, 30);
    viewMm += (target - viewMm) * (hudFrame === 1 || reduce ? 1 : 0.15);
    const k = ((Math.min(w, h) / 2) * 0.92) / viewMm;
    const mx = (px) => cx + (px - center[0]) * SCALE * k, my = (py) => cy + (py - center[1]) * SCALE * k;
    ctx.font = '10px ui-monospace, "Cascadia Mono", Consolas, monospace';
    ctx.lineJoin = "round";
    const text = (s, x, y, c) => { ctx.lineWidth = 3; ctx.strokeStyle = col.bg; ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y); };
    const marks = [spot && [mx(spot[0]), my(spot[1])], ref && [mx(ref[0]), my(ref[1])]].filter(Boolean);
    const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => viewMm / s <= 4) ?? 50;
    const rings = [];
    for (let rmm = step; rmm <= viewMm * 1.25; rmm += step) {
      const rp = rmm * k;
      ctx.beginPath(); ctx.arc(cx, cy, rp, 0, Math.PI * 2);
      ctx.strokeStyle = col.ring; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
      // label on the ring's free side: top-left when the spot sits top-right, and so on
      const sx = marks[0] && marks[0][0] > cx ? -1 : 1, sy = marks[0] && marks[0][1] < cy ? 1 : -1;
      const lx = cx + sx * rp * 0.707 + (sx > 0 ? 4 : -4), ly = cy + sy * rp * 0.707 + (sy > 0 ? 12 : -4);
      if (!marks.some(([px, py]) => Math.abs(px - lx) < 34 && Math.abs(py - ly) < 16)) rings.push([rmm + " mm", lx, ly, sx]);
    }
    ctx.strokeStyle = col.ring;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
    const over = ref && spot && (Math.abs(spot[0] - ref[0]) * SCALE > TOL || Math.abs(spot[1] - ref[1]) * SCALE > TOL);
    if (ref) {
      const rx = mx(ref[0]), ry = my(ref[1]), t = TOL * k;
      ctx.globalAlpha = 0.12; ctx.fillStyle = col.ref; ctx.fillRect(rx - t, ry - t, t * 2, t * 2); ctx.globalAlpha = 1;
      ctx.strokeStyle = col.ref; ctx.setLineDash([4, 4]); ctx.strokeRect(rx - t, ry - t, t * 2, t * 2); ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI * 2); ctx.moveTo(rx - 10, ry); ctx.lineTo(rx + 10, ry); ctx.moveTo(rx, ry - 10); ctx.lineTo(rx, ry + 10); ctx.stroke();
      ctx.textAlign = "left"; text("Ref", rx + 10, ry + 14, col.ref);
    }
    if (spot) {
      const sx = mx(spot[0]), sy = my(spot[1]);
      if (ref) { ctx.strokeStyle = over ? col.alert : col.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx(ref[0]), my(ref[1])); ctx.lineTo(sx, sy); ctx.stroke(); }
      const pulse = reduce ? 0.35 : (Date.now() % 1600) / 1600;
      ctx.globalAlpha = 0.7 * (1 - pulse); ctx.strokeStyle = col.spot; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, 6 + pulse * 12, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, Math.PI * 2); ctx.fillStyle = col.spot; ctx.fill();
      text("Spot", sx + 10, sy - 7, col.spot);
    }
    for (const [s, x, y, side] of rings) { ctx.textAlign = side > 0 ? "left" : "right"; text(s, x, y, col.label); }
    ctx.textAlign = "left";
    if (visible && !reduce) anim = requestAnimationFrame(hud);
  };
  const kick = () => { cancelAnimationFrame(anim); hud(); };

  const signed = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
  const REJECT = { clipped: "Spot clipped by the edge", ambiguous: "Several candidate spots" };
  const ui = () => {
    const fit = st.fit;
    const d = st.det, spot = d && !d.none ? d : null, ref = st.ref;
    const badges = [[spot ? "ok" : "warn", spot ? "Spot locked" : "No spot"], [ref ? "info" : "", ref ? "Reference set" : "No reference"]];
    if (spot && spot.saturated) badges.push(["bad", "Over-exposed"]);
    if (spot && !spot.usable) badges.push(["bad", REJECT[spot.reject_reason] || "Spot unusable"]);
    $("#lab-badges").innerHTML = badges.map(([t, s]) => '<span class="badge ' + t + '">' + s + "</span>").join("");
    $("#lab-empty").hidden = !!spot;
    const dx = spot && ref ? (spot.x - ref[0]) * SCALE : null, dy = spot && ref ? (spot.y - ref[1]) * SCALE : null;
    const dist = $("#lab-dist");
    dist.hidden = dx == null;
    if (dx != null) { dist.textContent = "Offset " + Math.hypot(dx, dy).toFixed(2) + " mm"; dist.classList.toggle("alert", Math.abs(dx) > TOL || Math.abs(dy) > TOL); }
    for (const [id, tid, v] of [["#lab-dx", "#lab-tx", dx], ["#lab-dy", "#lab-ty", dy]]) {
      $(id).innerHTML = v == null ? "—" : signed(v) + "<small>mm</small>";
      $(tid).className = "tile" + (v == null ? "" : Math.abs(v) > TOL ? " alert" : " ok");
    }
    $("#lab-set").disabled = !(spot && spot.usable);
    $("#lab-clear").disabled = !ref;
    const rows = spot
      ? [["Centroid", spot.x.toFixed(1) + ", " + spot.y.toFixed(1)], ["Error", Math.hypot(spot.x - st.x, spot.y - st.y).toFixed(3) + " px"],
         ["Fit σ", fit ? fit.sigma.toFixed(2) + " px" : "—"], ["Saturated", Math.round(spot.saturated_frac * 100) + "%"], ["Halo", spot.halo + " px"]]
      : [["Spot", "none"]];
    $("#lab-read").innerHTML = rows.map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>").join("");
  };

  const paint = () => {
    const img = frame();
    const det = RS.detectSpot(img, st.prev);
    st.det = det;
    st.prev = det && !det.none ? [det.x, det.y] : null;
    drawFrame(img, det);
    st.fit = drawProfile(img, det);
    ui();
    kick();
  };
  let queued = false;
  const render = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  };

  const move = (ev) => {
    const r = paper.getBoundingClientRect();
    st.x = Math.max(0, Math.min(W - 1, ((ev.clientX - r.left) * W) / r.width));
    st.y = Math.max(0, Math.min(H - 1, ((ev.clientY - r.top) * H) / r.height));
    render();
  };
  let down = false;
  paper.addEventListener("pointerdown", (ev) => { down = true; paper.setPointerCapture(ev.pointerId); move(ev); });
  paper.addEventListener("pointermove", (ev) => { if (down) move(ev); });
  paper.addEventListener("pointerup", () => { down = false; });
  paper.addEventListener("pointercancel", () => { down = false; });
  const setRef = () => { if (st.det && !st.det.none && st.det.usable) { st.ref = [st.det.x, st.det.y]; ui(); kick(); } };
  const clearRef = () => { st.ref = null; ui(); kick(); };
  paper.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    if (k === "s") { setRef(); return; }
    if (k === "r") { clearRef(); return; }
    const s = ev.shiftKey ? 10 : 1;
    const dx = ev.key === "ArrowLeft" ? -s : ev.key === "ArrowRight" ? s : 0;
    const dy = ev.key === "ArrowUp" ? -s : ev.key === "ArrowDown" ? s : 0;
    if (!dx && !dy) return;
    ev.preventDefault();
    st.x = Math.max(0, Math.min(W - 1, st.x + dx));
    st.y = Math.max(0, Math.min(H - 1, st.y + dy));
    render();
  });
  $("#lab-set").addEventListener("click", setRef);
  $("#lab-clear").addEventListener("click", clearRef);
  const bind = (id, key, fmt) => {
    const el = $(id), out = $(id + "-v");
    el.addEventListener("input", () => { st[key] = +el.value; out.textContent = fmt(st[key]); render(); });
  };
  bind("#lab-sigma", "sigma", (v) => v.toFixed(1));
  bind("#lab-amp", "amp", (v) => String(v));
  bind("#lab-noise", "noise", (v) => v.toFixed(1));

  if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); kick(); }).observe(panel);
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); else cancelAnimationFrame(anim); }).observe(panel);
  resize();
  paint();
  // layout can still move after the script runs (web fonts, images): size the target view again
  const settle = () => { resize(); kick(); };
  addEventListener("load", settle);
  if (document.fonts) document.fonts.ready.then(settle);
}
}
`;

export const spotScript = [spotCoreScript, labScript];
