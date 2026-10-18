// Spatial figures. Both draw one shaft model (spatialcore.mjs) twice: on the left as an isometric view of
// the shaft, on the right as the operator panel's live view from Cart B's camera, with its readings.
// Two points: drag P1/P2 on the live view; the shaft view shows the rays, the 3D segment and its split
// along gravity. Clearance: drag the reference and upper boxes, move the beam, add glare; the grid,
// readings and warnings follow the rules of car_top.py.
import { spatialCoreScript } from "./spatialcore.mjs";

export const spatialCss = `
.spx{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:stretch}
.spx>div{min-width:0}
.spx .col{display:flex;flex-direction:column;gap:10px}
.spx .col>div:last-child{flex:1;display:flex;flex-direction:column}
.spx .col>div:last-child svg{flex:1;min-height:110px}
.spx .side{top:22px}
.spx .lbl{display:flex;justify-content:space-between;gap:8px;font:10.5px/1.5 var(--mono);color:var(--muted);margin:0 0 6px}
.spx .lbl b{font-weight:400;color:var(--text-2)}
.spx svg{display:block;width:100%;height:auto}
.spx .iso3 .f0{fill:var(--card)}
.spx .iso3 .f1{fill:var(--well)}
.spx .iso3 .f2{fill:color-mix(in srgb,var(--well) 70%,var(--rule))}
.spx .iso3 .f3{fill:var(--rule)}
.spx .iso3 path.face{stroke:var(--faint);stroke-width:.5;stroke-linejoin:round}
.spx .iso3 .thin{fill:var(--text-2)}
.spx .iso3 .ray{stroke:var(--sp-blue);stroke-width:.8;fill:none;stroke-dasharray:2 2}
.spx .iso3 .seg{stroke:var(--ink);stroke-width:1.6;fill:none;stroke-linecap:round}
.spx .iso3 .leg{stroke:var(--sp-blue);stroke-width:1;fill:none;stroke-dasharray:4 3}
.spx .iso3 .pt{fill:var(--card);stroke:var(--ink);stroke-width:1.2}
.spx .iso3 .cam{fill:var(--ink)}
.spx .iso3 .fr{stroke:var(--sp-blue);stroke-width:.5;fill:none;opacity:.6}
.spx .iso3 .refp{fill:var(--sp-blue);fill-opacity:.16;stroke:var(--sp-blue);stroke-width:.8}
.spx .iso3 .drop{stroke-width:.9;fill:none;opacity:.8}
.spx .iso3 .low{stroke:var(--ink);stroke-width:1.2;fill:var(--card)}
.spx .chart text{font:9.5px var(--mono);fill:var(--muted)}
.spx .chart .axis{stroke:var(--rule);stroke-width:1}
.spx .chart .base{stroke:var(--sp-blue);stroke-width:2}
.spx .chart .prof{fill:color-mix(in srgb,var(--sp-blue) 10%,transparent);stroke:var(--ink);stroke-width:1.2;stroke-linejoin:round}
.spx .chart .unk{fill:url(#spx-hatch);stroke:var(--faint);stroke-width:.6}
.spx .chart .tri{fill:color-mix(in srgb,var(--sp-blue) 8%,transparent);stroke:var(--sp-blue);stroke-width:1;stroke-dasharray:4 3}
.spx .chart .hyp{stroke:var(--ink);stroke-width:1.6}
.spx .chart .val{fill:var(--ink)}
:root{--sp-blue:#3e63dd}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--sp-blue:#6b9bff}}
:root[data-theme="dark"]{--sp-blue:#6b9bff}

/* operator panel replica: shares .app tokens with the spot lab when both are on a page; repeated here */
.spx .app{--a-surface:#fff;--a-line:rgba(0,0,0,.08);--a-text:#1d1d1f;--a-text-2:#6e6e73;--a-text-3:#86868b;--a-accent:#0071e3;--a-accent-soft:rgba(0,113,227,.1);
  --a-ok:#248a3d;--a-ok-soft:rgba(52,199,89,.14);--a-warn:#c93400;--a-warn-soft:rgba(255,149,0,.14);--a-bad:#e0241b;--a-bad-soft:rgba(255,59,48,.11);--a-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.04);
  font:12px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:var(--a-text);display:flex;flex-direction:column;gap:8px}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .spx .app{--a-surface:#1c1c1e;--a-line:rgba(255,255,255,.1);--a-text:#f5f5f7;--a-text-2:#a1a1a6;--a-text-3:#6e6e73;--a-accent:#0a84ff;--a-accent-soft:rgba(10,132,255,.16);
  --a-ok:#30d158;--a-ok-soft:rgba(48,209,88,.15);--a-warn:#ff9f0a;--a-warn-soft:rgba(255,159,10,.16);--a-bad:#ff453a;--a-bad-soft:rgba(255,69,58,.16);--a-shadow:none}}
:root[data-theme="dark"] .spx .app{--a-surface:#1c1c1e;--a-line:rgba(255,255,255,.1);--a-text:#f5f5f7;--a-text-2:#a1a1a6;--a-text-3:#6e6e73;--a-accent:#0a84ff;--a-accent-soft:rgba(10,132,255,.16);
  --a-ok:#30d158;--a-ok-soft:rgba(48,209,88,.15);--a-warn:#ff9f0a;--a-warn-soft:rgba(255,159,10,.16);--a-bad:#ff453a;--a-bad-soft:rgba(255,69,58,.16);--a-shadow:none}
.spx .app-card{background:var(--a-surface);border-radius:12px;box-shadow:var(--a-shadow),0 0 0 1px var(--a-line);overflow:hidden}
.spx .app-card.grow{flex:1}
.spx .head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;padding:7px 9px;border-bottom:1px solid var(--a-line)}
.spx .head h5{margin:0;font-size:12px;font-weight:600}
.spx .head .eyebrow{font-size:10.5px;color:var(--a-text-3)}
.spx .head .eyebrow.ok{color:var(--a-ok)}
.spx .head .eyebrow.bad{color:var(--a-bad)}
.spx .seg{display:inline-flex;padding:2px;border-radius:8px;background:color-mix(in srgb,var(--a-text) 6%,transparent)}
.spx .seg span{padding:2px 8px;border-radius:6px;font-size:10.5px;font-weight:550;color:var(--a-text-2)}
.spx .seg span.on{background:var(--a-surface);color:var(--a-text);box-shadow:0 0 0 .5px var(--a-line),0 1px 2px rgba(0,0,0,.08)}
.spx .badges{display:flex;gap:4px}
.spx .badge{display:inline-flex;align-items:center;min-height:18px;padding:0 6px;border-radius:999px;font-size:10px;font-weight:550;color:var(--a-text-3);white-space:nowrap}
.spx .badge.ok{background:var(--a-ok-soft);color:var(--a-ok)}
.spx .badge.bad{background:var(--a-bad-soft);color:var(--a-bad)}
.spx .hintbar{margin:0;padding:5px 9px;font-size:10.5px;color:var(--a-text-2);border-bottom:1px solid var(--a-line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spx .stage{position:relative;background:#0c0c0e;touch-action:none;cursor:crosshair;outline:none}
.spx .stage:focus-visible{box-shadow:inset 0 0 0 2px var(--a-accent)}
.spx .stage .ep circle{fill:none;stroke:#fff;stroke-width:2}
.spx .stage .ep circle.k{stroke:#0a84ff;stroke-width:5;opacity:.35}
.spx .stage .ep text{font:600 15px -apple-system,system-ui,sans-serif;fill:#fff}
.spx .stage .ep.sel circle{stroke:#ffd60a}
.spx .stage .dline{stroke:#ffd60a;stroke-width:2.2}
.spx .stage .box{fill:none;stroke-width:2.4;cursor:move}
.spx .stage .box.base{stroke:#0a84ff;fill:rgba(10,132,255,.14)}
.spx .stage .box.over{stroke:#ff9f0a;fill:rgba(255,159,10,.12)}
.spx .stage .box.sel{stroke-dasharray:8 5}
.spx .stage .tag{font:600 13px -apple-system,system-ui,sans-serif}
.spx .stage .loupe rect.frame{fill:none;stroke:rgba(255,255,255,.85);stroke-width:2}
.spx .nudge{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 9px;font-size:10.5px;color:var(--a-text-2)}
.spx .nudge button{appearance:none;border:0;border-radius:6px;min-width:22px;padding:2px 6px;font-weight:550;font-size:10.5px;line-height:1.4;font-family:inherit;background:color-mix(in srgb,var(--a-text) 6%,transparent);color:var(--a-text);cursor:pointer}
.spx .nudge button[aria-pressed="true"]{background:var(--a-accent-soft);color:var(--a-accent)}
.spx .nudge .pos{margin-left:auto;font-family:var(--mono);color:var(--a-text-3)}
.spx .reading{padding:8px 9px;display:grid;gap:6px}
.spx .reading .pl{font-size:10.5px;font-weight:550;color:var(--a-text-2)}
.spx .reading .pv{font:600 22px/1.1 var(--mono);font-variant-numeric:tabular-nums}
.spx .reading .pv small{margin-left:4px;font-size:11px;font-weight:500;color:var(--a-text-3)}
.spx .reading .ps{font-size:10px;color:var(--a-text-3)}
.spx .reading dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0;font-size:10.5px}
.spx .reading dt{color:var(--a-text-2)}
.spx .reading dd{margin:0;text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
.spx .reading .warn{margin:0;padding:0;list-style:none;display:grid;gap:3px}
.spx .reading .warn li{font-size:10px;line-height:1.35;padding:4px 6px;border-radius:6px;background:var(--a-warn-soft);color:var(--a-warn)}
.spx .reading .warn li.bad{background:var(--a-bad-soft);color:var(--a-bad)}
.spx .grid{display:grid;gap:1px;padding:1px;background:var(--a-line);border-radius:4px}
.spx .grid i{aspect-ratio:2.4;border-radius:1px;background:var(--a-surface)}
.spx .grid i.m{background:color-mix(in srgb,#e5484d calc((1 - var(--t)) * 100%),#30a46c)}
.spx .grid i.u{background:repeating-linear-gradient(45deg,color-mix(in srgb,var(--a-text) 18%,transparent) 0 2px,transparent 2px 5px)}
.spx .grid i.x{background:color-mix(in srgb,var(--a-text) 6%,transparent)}
.spx .grid i.low{box-shadow:inset 0 0 0 2px var(--a-text)}
.spx .legend{display:flex;flex-wrap:wrap;gap:8px;font-size:9.5px;color:var(--a-text-3)}
.spx .legend i{display:inline-block;width:9px;height:7px;border-radius:1px;margin-right:3px;vertical-align:-1px}
.spx .side label.rng{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:2px 6px;align-items:center}
.spx .side label.rng input{grid-column:1/3;width:100%;accent-color:var(--accent);margin:0}
.spx .side label.rng output{font:10.5px var(--mono);text-align:right;color:var(--text-2)}
.spx .side label.chk{display:flex;gap:6px;align-items:center;margin-top:6px}
.spx .side label.chk input{accent-color:var(--accent);margin:0}
@media (max-width:760px){
  .spx{grid-template-columns:minmax(0,1fr);gap:14px}
  .spx .side{order:1;margin:0 0 6px}
  .spx .app{order:2}
  .spx .col{order:3}
  .spx .side .s-hint,.spx .side .s-keys{display:none}
  .spx .side .s-group:first-of-type{margin-top:0;padding-top:0;border-top:0}
  .spx .side dl.s-read{grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr);gap:0 8px;font-size:10.5px}
}
`;

const appHead = (mode) => `<header class="head"><div class="seg" aria-hidden="true"><span${mode === "two" ? ' class="on"' : ""}>Two points</span><span${mode === "clear" ? ' class="on"' : ""}>Car-top clearance</span></div><div class="badges"><span class="badge ok" data-k="depth">Depth ready</span><span class="badge">14.6 FPS</span></div></header>`;

export const spatialTwoMarkup = `
<div class="spx" data-spx="two" id="sp-two">
  <div class="col">
    <div><p class="lbl"><b>Shaft</b><span>same model · 1 grid square = 500 mm</span></p><svg class="iso3" data-k="iso" viewBox="0 0 400 380" role="img" aria-label="Shaft view: the camera, the rays to P1 and P2, and the distance split along gravity"></svg></div>
    <div><p class="lbl"><b>Along gravity</b><span>IMU vertical</span></p><svg class="chart" data-k="chart" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The distance split into a vertical and a horizontal part"></svg></div>
  </div>
  <div class="app" aria-label="Replica of the operator panel, two-point mode">
    <p class="lbl"><b>Operator panel</b><span>replica · labels translated</span></p>
    <section class="app-card">${appHead("two")}
      <p class="hintbar" data-k="hint">Click P1 and P2 on textured surfaces; drag an endpoint or nudge it</p>
      <div class="stage" data-k="stage" tabindex="0" role="application" aria-label="Live view. Drag P1 or P2; arrow keys move the selected point by 1 px, Shift by 5 px."><svg data-k="cam" viewBox="0 0 640 400"></svg></div>
      <div class="nudge"><span>Nudge</span><button type="button" data-p="0" aria-pressed="true">P1</button><button type="button" data-p="1" aria-pressed="false">P2</button>
        <button type="button" data-d="-1,0" aria-label="Left 1 px">←</button><button type="button" data-d="0,-1" aria-label="Up 1 px">↑</button><button type="button" data-d="0,1" aria-label="Down 1 px">↓</button><button type="button" data-d="1,0" aria-label="Right 1 px">→</button><span class="pos" data-k="pos"></span></div>
    </section>
    <section class="app-card grow"><header class="head"><h5>Readings</h5><span class="eyebrow" data-k="state">Ready</span></header><div class="reading" data-k="reading"></div></section>
  </div>
  <div class="side">
    <p class="s-hint">Drag P1 or P2 on the live view</p>
    <p class="s-keys"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 1 px</p>
    <p class="s-keys"><kbd>Shift</kbd> 5 px · <kbd>Tab</kbd> next point</p>
    <div class="s-group"><span>Points in the shaft</span><dl class="s-read" data-k="side"></dl></div>
  </div>
</div>
`;

export const spatialClearMarkup = `
<div class="spx" data-spx="clear" id="sp-clear">
  <div class="col">
    <div><p class="lbl"><b>Shaft</b><span>same model · 1 grid square = 500 mm</span></p><svg class="iso3" data-k="iso" viewBox="0 0 400 380" role="img" aria-label="Shaft view: the reference patch on the car top and the lowest structure found in each grid cell"></svg></div>
    <div><p class="lbl"><b>Clearance profile</b><span>lowest per grid column</span></p><svg class="chart" data-k="chart" viewBox="0 0 400 150" role="img" aria-label="Lowest overhead profile across the width, unknown columns hatched"></svg></div>
  </div>
  <div class="app" aria-label="Replica of the operator panel, car-top clearance mode">
    <p class="lbl"><b>Operator panel</b><span>replica · labels translated</span></p>
    <section class="app-card">${appHead("clear")}
      <p class="hintbar" data-k="hint">Box the flat car top, then box the structure above</p>
      <div class="stage" data-k="stage" tabindex="0" role="application" aria-label="Live view. Drag the blue reference box or the orange upper box; arrow keys move the selected box."><svg data-k="cam" viewBox="0 0 640 400"></svg></div>
    </section>
    <section class="app-card grow"><header class="head"><h5>Readings</h5><span class="eyebrow" data-k="state">Ready</span></header><div class="reading" data-k="reading"></div></section>
  </div>
  <div class="side">
    <p class="s-hint">Drag a box on the live view</p>
    <p class="s-keys"><kbd>Tab</kbd> next box · <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 4 px</p>
    <div class="s-group"><span>Shaft</span>
      <label class="rng">Beam above car top <output data-k="beam-v"></output><input data-k="beam" type="range" min="1300" max="2300" step="50" value="1750"></label>
      <label class="chk"><input data-k="glare" type="checkbox"> Glare on the beam</label>
      <label class="chk"><input data-k="wall" type="checkbox"> Reference box on the wall</label></div>
    <div class="s-group"><span>Grid · 6 × 8</span><dl class="s-read" data-k="side"></dl></div>
  </div>
</div>
`;

const figureJs = `
{
const CAM = SC.cameraOf();
const W = SC.IMG.w, H = SC.IMG.h;
const CLIP_X = 1250, CLIP_Y = 1250;
// isometric view of the shaft: from behind the camera, up and to the right
const AZ = 34 * Math.PI / 180, EL = 30 * Math.PI / 180;
const VW = [Math.sin(AZ) * Math.cos(EL), Math.sin(EL), -Math.cos(AZ) * Math.cos(EL)];
const VR = (() => { const r = [-VW[2], 0, VW[0]]; const n = Math.hypot(...r); return r.map((v) => v / n); })();
const VS = (() => { const s = [VR[1] * VW[2] - VR[2] * VW[1], VR[2] * VW[0] - VR[0] * VW[2], VR[0] * VW[1] - VR[1] * VW[0]]; const n = Math.hypot(...s); return s.map((v) => v / n); })();
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const isoFit = (() => {
  const pts = [];
  for (const x of [-CLIP_X, CLIP_X]) for (const y of [-1110, CLIP_Y]) for (const z of [-200, 2400]) pts.push([x, y, z]);
  const xs = pts.map((p) => dot(p, VR)), ys = pts.map((p) => -dot(p, VS));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(388 / (x1 - x0), 368 / (y1 - y0));
  return { k, ox: 200 - ((x0 + x1) / 2) * k, oy: 190 - ((y0 + y1) / 2) * k };
})();
const I = (p) => [isoFit.ox + dot(p, VR) * isoFit.k, isoFit.oy - dot(p, VS) * isoFit.k];
const f2 = (v) => v.toFixed(1);
const pathOf = (pts, close = true) => "M" + pts.map((q) => f2(q[0]) + " " + f2(q[1])).join("L") + (close ? "Z" : "");
const FACES = [[[0, 2, 4], [0, 3, 4], [0, 3, 5], [0, 2, 5], [-1, 0, 0]], [[1, 2, 4], [1, 2, 5], [1, 3, 5], [1, 3, 4], [1, 0, 0]],
  [[0, 2, 4], [0, 2, 5], [1, 2, 5], [1, 2, 4], [0, -1, 0]], [[0, 3, 4], [1, 3, 4], [1, 3, 5], [0, 3, 5], [0, 1, 0]],
  [[0, 2, 4], [1, 2, 4], [1, 3, 4], [0, 3, 4], [0, 0, -1]], [[0, 2, 5], [0, 3, 5], [1, 3, 5], [1, 2, 5], [0, 0, 1]]];
const corner = (b, [i, j, l]) => [b[i], b[j], b[l]];
const clipBox = (b) => [Math.max(b[0], -CLIP_X), Math.min(b[1], CLIP_X), b[2], Math.min(b[3], CLIP_Y), b[4], b[5]];
function isoScene(scene) {
  const list = scene.map((it) => ({ it, b: clipBox(it.b) })).filter(({ b }) => b[0] < b[1] && b[2] < b[3]);
  const key = ({ it, b }) => (it.layer < 2 ? -1e9 + it.layer * 1e6 : 0) + dot([(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2], VW);
  list.sort((a, b) => key(a) - key(b));
  let out = "";
  // floor grid under the car top for scale: 500 mm squares on the car-top surface
  for (const { it, b } of list) {
    for (const f of FACES) {
      const n = f[4];
      if (dot(n, VW) <= 0) continue;
      const pts = f.slice(0, 4).map((c) => I(corner(b, c)));
      const tone = it.thin ? "thin" : n[1] > 0 ? "f0" : n[1] < 0 ? "f3" : n[0] !== 0 ? "f2" : "f1";
      out += '<path class="face ' + tone + '" d="' + pathOf(pts) + '"/>';
    }
    if (it.id === "car") {
      let g = "";
      for (let x = -1000; x <= 1000; x += 500) g += pathOf([I([x, b[3], b[4] + 20]), I([x, b[3], b[5] - 20])], false);
      for (let z = 500; z <= 2000; z += 500) g += pathOf([I([b[0] + 20, b[3], z]), I([b[1] - 20, b[3], z])], false);
      out += '<path d="' + g + '" style="stroke:var(--faint);stroke-width:.5;fill:none"/>';
    }
  }
  return out;
}
function isoCamera() {
  // camera body and a short view volume toward the image corners
  const c = CAM.at;
  const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(([u, v]) => { const d = SC.rayOf(CAM, u, v); return [c[0] + d[0] * 520, c[1] + d[1] * 520, c[2] + d[2] * 520]; });
  let s = '<path class="fr" d="' + corners.map((p) => pathOf([I(c), I(p)], false)).join("") + pathOf(corners.map(I)) + '"/>';
  const body = [-55, 55, -20, 20, -40, 0];
  for (const f of FACES) { if (dot(f[4], VW) <= 0) continue; s += '<path class="face ' + (f[4][1] > 0 ? "f0" : f[4][0] ? "f2" : "f1") + '" d="' + pathOf(f.slice(0, 4).map((q) => I(corner(body, q)))) + '"/>'; }
  return s;
}
// live view: IR-lit mono frame, faces shaded by facing and range, speckle where depth is valid
const SPECK = (() => { const out = []; let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 1400; i++) out.push([r() * W, r() * H]); return out; })();
function camScene(scene) {
  const faces = [];
  for (const it of scene) {
    for (const f of FACES) {
      const n = f[4];
      const pts3 = f.slice(0, 4).map((c) => corner(it.b, c));
      const cen = pts3.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
      const toCam = [CAM.at[0] - cen[0], CAM.at[1] - cen[1], CAM.at[2] - cen[2]];
      if (dot(n, toCam) <= 0) continue;
      const dist = Math.hypot(...toCam);
      const lam = Math.abs(dot(n, toCam)) / dist;
      const g = Math.round(255 * Math.min(1, (0.18 + 0.7 * lam) * it.tone * Math.min(1, 1900 / dist)));
      const glare = it.glare && n[1] < 0;
      faces.push({ layer: it.layer < 2 ? it.layer : 2, dist, d: pathOf(pts3.map((p) => SC.project(CAM, p))), fill: glare ? "rgb(250,250,250)" : "rgb(" + g + "," + g + "," + g + ")" });
    }
  }
  faces.sort((a, b) => a.layer - b.layer || b.dist - a.dist);
  let out = '<rect width="' + W + '" height="' + H + '" fill="#0c0c0e"/>' + faces.map((f) => '<path d="' + f.d + '" fill="' + f.fill + '"/>').join("");
  let dots = "";
  for (const [u, v] of SPECK) { const d = SC.depthAt(scene, CAM, u, v, { noise: false }); if (d.valid) dots += "M" + f2(u) + " " + f2(v) + "h1.4"; }
  out += '<path d="' + dots + '" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>';
  return out;
}
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const signed = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
const local = (fig) => (k) => fig.querySelector('[data-k="' + k + '"]');

// ---------------------------------------------------------------- two points
const two = document.querySelector('[data-spx="two"]');
if (two) {
  const $ = local(two);
  const scene = SC.sceneOf();
  const camBg = camScene(scene);
  const isoBg = isoScene(scene) + isoCamera();
  const pts = [SC.project(CAM, [-90, -530, 2272]).slice(0, 2).map(Math.round), SC.project(CAM, [90, 610, 2272]).slice(0, 2).map(Math.round)];
  let sel = 0;
  const camSvg = $("cam"), stage = $("stage");
  const draw = () => {
    const r = SC.twoPoint(scene, CAM, pts[0], pts[1]);
    // live view overlay: line, endpoints, 4× loupe on the selected point
    const [a, b] = pts;
    let ov = '<line class="dline" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
    pts.forEach((p, i) => { ov += '<g class="ep' + (i === sel ? " sel" : "") + '"><circle class="k" cx="' + p[0] + '" cy="' + p[1] + '" r="9"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="9"/><text x="' + (p[0] + 13) + '" y="' + (p[1] - 10) + '">P' + (i + 1) + "</text></g>"; });
    const L = 140, Z = 4, s = pts[sel], lx = s[0] < W / 2 ? W - L - 10 : 10;
    ov += '<g class="loupe"><clipPath id="spx-lc"><rect x="' + lx + '" y="10" width="' + L + '" height="' + L + '"/></clipPath><g clip-path="url(#spx-lc)"><g transform="translate(' + (lx + L / 2 - s[0] * Z) + " " + (10 + L / 2 - s[1] * Z) + ") scale(" + Z + ')">' + camBg + "</g>" +
      '<path d="M' + (lx + L / 2 - 14) + " " + (10 + L / 2) + "h28M" + (lx + L / 2) + " " + (10 + L / 2 - 14) + 'v28" stroke="#ffd60a" stroke-width="2"/></g><rect class="frame" x="' + lx + '" y="10" width="' + L + '" height="' + L + '"/></g>';
    camSvg.innerHTML = camBg + ov;
    $("pos").textContent = "P" + (sel + 1) + " (" + s[0] + ", " + s[1] + ") px";
    // readings
    const st = $("state");
    const bad = (p) => !p.valid ? (p.reason === "thin" ? "no depth on a thin rope" : p.reason === "range" ? "outside 0.2–12 m" : "no depth") : "";
    if (r.ok) {
      st.textContent = "Ready"; st.className = "eyebrow ok";
      $("reading").innerHTML = '<div><div class="pl">3D distance</div><div class="pv">' + fmt(r.D) + '<small>mm</small></div><div class="ps">camera frame, fused stereo depth</div></div><dl><dt>Height difference</dt><dd>' + signed(r.dv) + " mm</dd><dt>Horizontal</dt><dd>" + fmt(r.dh) + " mm</dd><dt>P1 depth</dt><dd>" + fmt(r.p.zc) + " mm</dd><dt>P2 depth</dt><dd>" + fmt(r.q.zc) + " mm</dd></dl>";
    } else {
      st.textContent = "Waiting for depth"; st.className = "eyebrow bad";
      $("reading").innerHTML = '<div><div class="pl">3D distance</div><div class="pv">—</div></div><ul class="warn">' + [r.p, r.q].map((p, i) => bad(p) ? '<li class="bad">P' + (i + 1) + ": " + bad(p) + "</li>" : "").join("") + "</ul>";
    }
    $("hint").textContent = r.ok ? "Drag an endpoint or nudge it; confirm to freeze the reading" : "Move the point onto a textured surface with depth";
    // shaft view
    let iso = isoBg;
    if (r.ok) {
      const A = r.p.p, B = r.q.p, K = [A[0], B[1], A[2]];
      iso += '<path class="ray" d="' + pathOf([I(CAM.at), I(A)], false) + pathOf([I(CAM.at), I(B)], false) + '"/>';
      iso += '<path class="leg" d="' + pathOf([I(A), I(K), I(B)], false) + '"/>';
      iso += '<path class="seg" d="' + pathOf([I(A), I(B)], false) + '"/>';
      for (const p of [A, B]) { const q = I(p); iso += '<circle class="pt" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="3"/>'; }
    } else {
      for (const [i, p] of [r.p, r.q].entries()) if (p.valid) { const q = I(p.p); iso += '<path class="ray" d="' + pathOf([I(CAM.at), q], false) + '"/><circle class="pt" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="3"/>'; }
    }
    $("iso").innerHTML = iso;
    // along gravity: right triangle, hypotenuse D
    const ch = $("chart");
    if (r.ok) {
      const k = Math.min(110 / Math.max(Math.abs(r.dv), 1), 260 / Math.max(r.dh, 1));
      const w = r.dh * k, hgt = Math.abs(r.dv) * k;
      const x0 = 200 - w / 2, x1 = x0 + w, y0 = r.dv >= 0 ? 75 + hgt / 2 : 75 - hgt / 2, y1 = y0 - r.dv * k;
      ch.innerHTML = '<path class="tri" d="M' + f2(x0) + " " + f2(y0) + "L" + f2(x1) + " " + f2(y0) + "L" + f2(x1) + " " + f2(y1) + 'Z"/><path class="hyp" d="M' + f2(x0) + " " + f2(y0) + "L" + f2(x1) + " " + f2(y1) + '"/>' +
        '<text x="' + f2((x0 + x1) / 2) + '" y="' + f2(y0 + (r.dv >= 0 ? 14 : -6)) + '" text-anchor="middle">horizontal ' + fmt(r.dh) + ' mm</text><text x="' + f2(x1 + 8) + '" y="' + f2((y0 + y1) / 2 + 3) + '">' + (r.dv >= 0 ? "up " : "down ") + fmt(Math.abs(r.dv)) + ' mm</text>' +
        '<text class="val" x="' + f2((x0 + x1) / 2 - 8) + '" y="' + f2((y0 + y1) / 2 + 3) + '" text-anchor="end">D ' + fmt(r.D) + " mm</text>";
    } else ch.innerHTML = '<text x="200" y="80" text-anchor="middle">waiting for depth at both points</text>';
    // side rail
    $("side").innerHTML = [r.p, r.q].map((p, i) => "<dt>P" + (i + 1) + "</dt><dd>" + (p.valid ? p.p.map((v) => Math.round(v)).join(", ") : bad(p)) + "</dd>").join("") +
      (r.ok ? "<dt>Noise at P2</dt><dd>±" + (1.2e-6 * r.q.zc * r.q.zc).toFixed(1) + " mm</dd>" : "");
  };
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };
  const toPx = (ev) => { const r = camSvg.getBoundingClientRect(); return [Math.round(((ev.clientX - r.left) * W) / r.width), Math.round(((ev.clientY - r.top) * H) / r.height)]; };
  let drag = -1;
  stage.addEventListener("pointerdown", (ev) => {
    const p = toPx(ev);
    const d = pts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]));
    sel = d[0] <= d[1] ? 0 : 1;
    drag = sel;
    pts[sel] = [Math.max(0, Math.min(W - 1, p[0])), Math.max(0, Math.min(H - 1, p[1]))];
    stage.setPointerCapture(ev.pointerId);
    two.querySelectorAll("[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.p === sel)));
    schedule();
  });
  stage.addEventListener("pointermove", (ev) => { if (drag < 0) return; const p = toPx(ev); pts[drag] = [Math.max(0, Math.min(W - 1, p[0])), Math.max(0, Math.min(H - 1, p[1]))]; schedule(); });
  const end = () => { drag = -1; };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  const nudge = (dx, dy, step) => { pts[sel] = [Math.max(0, Math.min(W - 1, pts[sel][0] + dx * step)), Math.max(0, Math.min(H - 1, pts[sel][1] + dy * step))]; schedule(); };
  stage.addEventListener("keydown", (ev) => {
    const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (ev.key === "Tab" && !ev.shiftKey && sel === 0) { ev.preventDefault(); sel = 1; two.querySelectorAll("[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.p === sel))); schedule(); return; }
    if (!m) return;
    ev.preventDefault();
    nudge(m[0], m[1], ev.shiftKey ? 5 : 1);
  });
  two.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { sel = +b.dataset.p; two.querySelectorAll("[data-p]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); schedule(); }));
  two.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", (ev) => { const [dx, dy] = b.dataset.d.split(",").map(Number); nudge(dx, dy, ev.shiftKey ? 5 : 1); }));
  draw();
}

// ---------------------------------------------------------------- clearance
const clr = document.querySelector('[data-spx="clear"]');
if (clr) {
  const $ = local(clr);
  const BASE0 = [110, 366, 530, 398], OVER0 = [40, 34, 600, 96], WALL = [370, 200, 470, 260];
  const boxes = { base: BASE0.slice(), over: OVER0.slice() };
  let sel = "over", beam = 1750, glare = false, scene = null, camBg = "", isoBg = "";
  const camSvg = $("cam"), stage = $("stage");
  const rebuild = () => {
    scene = SC.sceneOf({ beamBottom: SC.CAR_TOP_Y + beam, glare });
    camBg = camScene(scene);
    isoBg = isoScene(scene) + isoCamera();
  };
  const ramp = (t) => "color-mix(in srgb,#e5484d " + Math.round((1 - t) * 100) + "%,#30a46c)";
  const draw = () => {
    const r = SC.clearance(scene, CAM, boxes.base, boxes.over);
    // live view: boxes with their tags
    let ov = "";
    for (const [k, cls, label] of [["base", "base", "Reference"], ["over", "over", "Upper region"]]) {
      const b = boxes[k];
      ov += '<rect class="box ' + cls + (sel === k ? " sel" : "") + '" data-box="' + k + '" x="' + b[0] + '" y="' + b[1] + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '"/>';
      ov += '<text class="tag" x="' + (b[0] + 4) + '" y="' + (k === "base" ? b[1] - 6 : b[3] + 16) + '" fill="' + (k === "base" ? "#0a84ff" : "#ff9f0a") + '">' + label + "</text>";
    }
    if (r.ok) { const p = SC.project(CAM, r.at); ov += '<path d="M' + f2(p[0] - 12) + " " + f2(p[1]) + "h24M" + f2(p[0]) + " " + f2(p[1] - 12) + 'v24" stroke="#fff" stroke-width="2.5"/>'; }
    camSvg.innerHTML = camBg + ov;
    // readings
    const st = $("state");
    const g = r.grid;
    const vals = g ? g.values.flat().filter((v) => v != null) : [];
    const lo = 800, hi = 2400; // fixed colour scale in mm, the same as the profile axis
    const gridHtml = g ? '<div class="grid" style="grid-template-columns:repeat(' + g.cols + ',1fr)">' + g.states.map((row, i) => row.map((s, j) => {
      const low = r.ok && r.lowest[0] === i && r.lowest[1] === j;
      if (s === "measured") { const t = Math.max(0, Math.min(1, (g.values[i][j] - lo) / (hi - lo))); return '<i class="m' + (low ? " low" : "") + '" style="--t:' + t.toFixed(3) + '" title="' + Math.round(g.values[i][j]) + ' mm"></i>'; }
      return '<i class="' + (s === "unknown" ? "u" : "x") + '" title="' + (s === "unknown" ? "unknown, no valid depth" : "below the margin, excluded") + '"></i>';
    }).join("")).join("") + '</div><div class="legend"><span><i style="background:#e5484d"></i>0.8 m</span><span><i style="background:#30a46c"></i>2.4 m</span><span><i style="background:repeating-linear-gradient(45deg,#999 0 2px,transparent 2px 4px)"></i>unknown</span><span><i style="box-shadow:inset 0 0 0 2px currentColor"></i>lowest</span></div>' : "";
    if (r.ok) {
      st.textContent = "Ready"; st.className = "eyebrow ok";
      $("reading").innerHTML = '<div><div class="pl">Minimum clearance</div><div class="pv">' + fmt(r.min) + '<small>mm</small></div><div class="ps">cell r' + (r.lowest[0] + 1) + " c" + (r.lowest[1] + 1) + ", along gravity to the reference plane</div></div>" + gridHtml +
        (r.warnings.length ? '<ul class="warn">' + r.warnings.map((w) => "<li>" + w + "</li>").join("") + "</ul>" : "");
    } else {
      st.textContent = "Rejected"; st.className = "eyebrow bad";
      $("reading").innerHTML = '<div><div class="pl">Minimum clearance</div><div class="pv">—</div></div><ul class="warn"><li class="bad">' + r.reason + "</li></ul>" + gridHtml;
    }
    $("hint").textContent = r.ok ? "Confirm the reading, then mark the limiting obstruction and save" : r.code.startsWith("base") ? "Box only the flat car top" : "Box the shaft top, beams or other structure above";
    // shaft view: reference patch through the corner rays, drops from the plane to each cell's lowest point
    let iso = isoBg;
    const b = boxes.base;
    const patch = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([u, v]) => SC.depthAt(scene, CAM, u, v, { noise: false }));
    if (patch.every((p) => p.valid)) iso += '<path class="refp" d="' + pathOf(patch.map((p) => I(p.p))) + '"/>';
    if (g && r.plane) {
      for (let i = 0; i < g.rows; i++) for (let j = 0; j < g.cols; j++) {
        const p = g.locs?.[i]?.[j];
        if (!p) continue;
        const foot = [p[0], (r.plane.c - r.plane.n[0] * p[0] - r.plane.n[2] * p[2]) / r.plane.n[1], p[2]];
        const t = Math.max(0, Math.min(1, (g.values[i][j] - lo) / (hi - lo)));
        iso += '<path class="drop" style="stroke:' + ramp(t) + '" d="' + pathOf([I(foot), I(p)], false) + '"/>';
      }
      if (r.ok) { const q = I(r.at), f = I([r.at[0], SC.CAR_TOP_Y, r.at[2]]); iso += '<path class="seg" d="' + pathOf([f, q], false) + '"/><circle class="low" cx="' + f2(q[0]) + '" cy="' + f2(q[1]) + '" r="3"/><circle class="low" cx="' + f2(f[0]) + '" cy="' + f2(f[1]) + '" r="2"/>'; }
    }
    $("iso").innerHTML = iso;
    // clearance profile: lowest value per grid column across the width, unknown columns hatched
    const ch = $("chart");
    let s = '<defs><pattern id="spx-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v5" stroke="var(--faint)" stroke-width="1.6"/></pattern></defs>';
    const X0 = 40, X1 = 390, Y0 = 128, top = 2400, ky = (Y0 - 12) / top;
    s += '<path class="axis" d="M' + X0 + " 12V" + Y0 + '"/>';
    for (const v of [0, 1000, 2000]) s += '<text x="' + (X0 - 4) + '" y="' + f2(Y0 - v * ky + 3) + '" text-anchor="end">' + v / 1000 + " m</text>";
    if (g) {
      const cw = (X1 - X0) / g.cols;
      let prof = "M" + X0 + " " + Y0;
      for (let j = 0; j < g.cols; j++) {
        const col = g.values.map((row, i) => (g.states[i][j] === "measured" ? row[j] : null)).filter((v) => v != null);
        const unknown = g.states.every((row) => row[j] === "unknown");
        const x = X0 + j * cw;
        if (!col.length) {
          if (unknown) s += '<rect class="unk" x="' + f2(x) + '" y="12" width="' + f2(cw) + '" height="' + (Y0 - 12) + '"/>';
          prof += "L" + f2(x) + " " + Y0 + "L" + f2(x + cw) + " " + Y0;
          continue;
        }
        const y = Y0 - Math.min(...col) * ky;
        prof += "L" + f2(x) + " " + f2(y) + "L" + f2(x + cw) + " " + f2(y);
        if (g.states.some((row) => row[j] === "unknown")) s += '<rect class="unk" x="' + f2(x) + '" y="12" width="' + f2(cw) + '" height="' + f2(y - 12) + '" opacity=".6"/>';
      }
      s += '<path class="prof" d="' + prof + "L" + X1 + " " + Y0 + 'Z"/>';
      if (r.ok) { const x = X0 + (r.lowest[1] + 0.5) * cw, y = Y0 - r.min * ky; s += '<path d="M' + f2(x - 7) + " " + f2(y) + "h14M" + f2(x) + " " + f2(y - 7) + 'v14" stroke="var(--ink)" stroke-width="1.4"/><text class="val" x="' + f2(x + 9) + '" y="' + f2(y + 13) + '">' + fmt(r.min) + " mm</text>"; }
    }
    s += '<path class="base" d="M' + X0 + " " + Y0 + "H" + X1 + '"/>';
    ch.innerHTML = s;
    // side rail
    const flat = g ? g.states.flat() : [];
    const cnt = (k) => flat.filter((x) => x === k).length;
    const ref = r.reference;
    $("side").innerHTML = (g ? "<dt>Measured</dt><dd>" + cnt("measured") + "</dd><dt>Unknown</dt><dd" + (cnt("unknown") ? ' class="bad"' : "") + ">" + cnt("unknown") + "</dd><dt>Excluded</dt><dd>" + cnt("excluded") + "</dd>" : "") +
      (ref ? "<dt>Plane inliers</dt><dd" + (ref.ratio < SC.CLEAR_CFG.min_reference_inlier_ratio ? ' class="bad"' : "") + ">" + Math.round(ref.ratio * 100) + "%</dd><dt>Plane RMS</dt><dd>" + ref.rms.toFixed(1) + " mm</dd><dt>Plane tilt</dt><dd" + (ref.tilt > SC.CLEAR_CFG.max_reference_tilt_deg ? ' class="bad"' : "") + ">" + ref.tilt.toFixed(1) + "°</dd>" : "");
  };
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };
  const toPx = (ev) => { const r = camSvg.getBoundingClientRect(); return [((ev.clientX - r.left) * W) / r.width, ((ev.clientY - r.top) * H) / r.height]; };
  const inside = (b, p) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
  const move = (k, dx, dy) => {
    const b = boxes[k], w = b[2] - b[0], h = b[3] - b[1];
    const x = Math.max(0, Math.min(W - w, b[0] + dx)), y = Math.max(0, Math.min(H - h, b[1] + dy));
    boxes[k] = [Math.round(x), Math.round(y), Math.round(x + w), Math.round(y + h)];
    if (k === "base") $("wall").checked = boxes.base.join() === WALL.join();
    schedule();
  };
  let drag = null;
  stage.addEventListener("pointerdown", (ev) => {
    const p = toPx(ev);
    const k = inside(boxes.base, p) ? "base" : inside(boxes.over, p) ? "over" : null;
    if (!k) return;
    sel = k; drag = { k, p };
    stage.setPointerCapture(ev.pointerId);
    schedule();
  });
  stage.addEventListener("pointermove", (ev) => { if (!drag) return; const p = toPx(ev); move(drag.k, p[0] - drag.p[0], p[1] - drag.p[1]); drag.p = p; });
  const end = () => { drag = null; };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab" && !ev.shiftKey && sel === "over") { ev.preventDefault(); sel = "base"; schedule(); return; }
    const m = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[ev.key];
    if (!m) return;
    ev.preventDefault();
    move(sel, m[0], m[1]);
  });
  const beamIn = $("beam"), beamOut = $("beam-v");
  beamIn.addEventListener("input", () => { beam = +beamIn.value; beamOut.textContent = fmt(beam) + " mm"; rebuild(); schedule(); });
  $("glare").addEventListener("change", (ev) => { glare = ev.target.checked; rebuild(); schedule(); });
  $("wall").addEventListener("change", (ev) => { boxes.base = (ev.target.checked ? WALL : BASE0).slice(); sel = "base"; schedule(); });
  beamOut.textContent = fmt(beam) + " mm";
  rebuild();
  draw();
}
}
`;

export const spatialScript = [spatialCoreScript, figureJs];
