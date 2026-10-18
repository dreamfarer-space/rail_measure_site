// Figure: linked spot lab. Left is a synthetic Gaussian spot on paper, generated with the same
// parameters as tests/test_verticality_vision.py (σ = 6 px, BGR amplitude 60/400/90, noise 2).
// Right is a static replica of the operator panel's live view, driven by the same state.
export const spotCss = `
.lab{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
.lab .pane{border:1px solid var(--rule);border-radius:10px;background:var(--card);overflow:hidden}
.lab .pane-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 11px;border-bottom:1px solid var(--rule)}
.lab .pane-head h4{margin:0;font-size:12px;font-weight:600}
.lab .pane-head span{font:10.5px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.lab canvas{display:block;width:100%;height:auto;touch-action:none;cursor:crosshair;background:#f4f2ec}
.lab .paper{outline:none}
.lab .paper:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.lab .controls{display:grid;gap:8px;padding:10px 11px;border-top:1px solid var(--rule);min-width:0}
.lab .controls label{display:grid;grid-template-columns:54px minmax(0,1fr) 38px;align-items:center;gap:6px;font-size:11.5px;color:var(--muted)}
.lab .controls input[type=range]{width:100%;accent-color:var(--accent)}
.lab .controls output{font:11px var(--mono);text-align:right;color:var(--text-2)}
.lab .check{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--muted)}
.lab .readouts{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:10px 11px;border-top:1px solid var(--rule);font:11.5px/1.7 var(--mono);color:var(--text-2)}
.lab .readouts dt{color:var(--muted)}
.lab .readouts dd{margin:0;font-variant-numeric:tabular-nums}
.lab .verdict{display:flex;align-items:center;gap:8px;padding:8px 11px;border-top:1px solid var(--rule);font-size:12px}
.lab .verdict b{font:10.5px var(--mono);text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:999px}
.lab .verdict b.ok{background:rgba(47,138,87,.12);color:var(--accent)}
.lab .verdict b.no{background:rgba(183,121,31,.12);color:#b7791f}
.lab .verdict span{color:var(--muted)}
@media (max-width:760px){.lab{grid-template-columns:minmax(0,1fr)}}
`;

export const spotMarkup = `
<div class="lab">
  <div class="pane">
    <div class="pane-head"><h4>Synthetic target</h4><span>σ = 6 px · 520 × 390</span></div>
    <canvas id="lab-paper" class="paper" width="520" height="390" tabindex="0" role="application"
            aria-label="Synthetic paper with a Gaussian spot. Drag the spot, or use the arrow keys."></canvas>
    <div class="controls">
      <label>σ <input id="lab-sigma" type="range" min="3" max="12" step="0.5" value="6"><output id="lab-sigma-v">6.0</output></label>
      <label>Green <input id="lab-amp" type="range" min="20" max="120" step="5" value="70"><output id="lab-amp-v">70</output></label>
      <label>Noise <input id="lab-noise" type="range" min="0" max="8" step="0.5" value="2"><output id="lab-noise-v">2.0</output></label>
      <label class="check"><input id="lab-glare" type="checkbox"> Add a saturated white reflection</label>
    </div>
  </div>

  <div class="pane">
    <div class="pane-head"><h4>Live view · Camera 1</h4><span>MJPEG · linked</span></div>
    <canvas id="lab-panel" width="520" height="390" aria-label="Replica of the operator panel showing the same frame"></canvas>
    <dl class="readouts">
      <dt>Spot</dt><dd id="lab-xy">—</dd>
      <dt>Saturated</dt><dd id="lab-sat">—</dd>
      <dt>Green halo</dt><dd id="lab-halo">—</dd>
      <dt>Height</dt><dd>12.40 m</dd>
    </dl>
    <div class="verdict"><b id="lab-chip" class="ok">ok</b><span id="lab-why">candidate accepted</span></div>
  </div>
</div>
`;

export const spotScript = `
const paper = document.querySelector("#lab-paper");
if (paper) {
  const panel = document.querySelector("#lab-panel");
  const W = paper.width, H = paper.height;
  const bg = { r: 170, g: 178, b: 172 };
  const state = { x: 300, y: 210, sigma: 6, amp: 70, noise: 2, glare: false };
  const base = document.createElement("canvas");
  base.width = W; base.height = H;
  const bctx = base.getContext("2d", { willReadFrequently: true });
  const pctx = paper.getContext("2d", { willReadFrequently: true });
  const gctx = panel.getContext("2d", { willReadFrequently: true });

  const noiseCanvas = () => {
    const img = bctx.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() + Math.random() + Math.random() - 1.5) * 3.2 * state.noise;
      d[i] = bg.r + n; d[i + 1] = bg.g + n; d[i + 2] = bg.b + n; d[i + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
  };
  noiseCanvas();

  const paint = (ctx) => {
    ctx.drawImage(base, 0, 0);
    const rMax = Math.ceil(state.sigma * 4);
    const img = ctx.getImageData(Math.max(0, state.x - rMax), Math.max(0, state.y - rMax),
      Math.min(W, rMax * 2), Math.min(H, rMax * 2));
    const d = img.data;
    const ox = Math.max(0, state.x - rMax), oy = Math.max(0, state.y - rMax);
    const gw = img.width;
    for (let yy = 0; yy < img.height; yy++) {
      for (let xx = 0; xx < img.width; xx++) {
        const dx = ox + xx - state.x, dy = oy + yy - state.y;
        const gauss = Math.exp(-(dx * dx + dy * dy) / (2 * state.sigma * state.sigma));
        if (gauss < 0.004) continue;
        const i = (yy * gw + xx) * 4;
        d[i] = Math.min(255, d[i] + 0.16 * state.amp * gauss);
        d[i + 1] = Math.min(255, d[i + 1] + state.amp * 5.7 * gauss);
        d[i + 2] = Math.min(255, d[i + 2] + 0.23 * state.amp * gauss);
      }
    }
    ctx.putImageData(img, ox, oy);
    if (state.glare) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(70, 60, 20, 20);
    }
  };

  const detect = () => {
    const img = pctx.getImageData(0, 0, W, H).data;
    let sx = 0, sy = 0, sw = 0, halo = 0, sat = 0, area = 0;
    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const i = (y * W + x) * 4;
        const r = img[i], g = img[i + 1], b = img[i + 2];
        const excess = g - (r + b) / 2;
        if (excess <= 8 || g <= bg.g + 14) continue;
        area++;
        const isSat = g >= 250;
        if (isSat) sat++; else halo++;
        const w = Math.max(1, g - bg.g);
        sx += x * w; sy += y * w; sw += w;
      }
    }
    if (!area) return { ok: false, why: "no green candidate", halo: 0, sat: 0 };
    const cx = sx / sw, cy = sy / sw;
    const clipped = cx < 10 || cy < 10 || cx > W - 10 || cy > H - 10;
    const satFrac = sat / area;
    if (clipped) return { ok: false, why: "candidate touches the frame edge", halo, sat: satFrac, cx, cy };
    if (halo < 25) return { ok: false, why: "no unsaturated green halo", halo, sat: satFrac, cx, cy };
    return { ok: true, why: typeof satFrac === "number" && satFrac > 0.6 ? "accepted, overexposed but usable" : "candidate accepted", halo, sat: satFrac, cx, cy };
  };

  const overlay = (ctx, det) => {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    if (det.cx) {
      ctx.strokeStyle = det.ok ? "#39c07a" : "#e0a53a";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(det.cx, det.cy, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(det.cx - 20, det.cy); ctx.lineTo(det.cx + 20, det.cy);
      ctx.moveTo(det.cx, det.cy - 20); ctx.lineTo(det.cx, det.cy + 20); ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(8, H - 26, 150, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText("520 × 390 · frame " + (det.ok ? "usable" : "rejected"), 14, H - 13);
    ctx.restore();
  };

  const render = () => {
    paint(pctx);
    const det = detect();
    paint(gctx);
    overlay(gctx, det);
    document.querySelector("#lab-xy").textContent = det.cx ? det.cx.toFixed(1) + ", " + det.cy.toFixed(1) + " px" : "—";
    document.querySelector("#lab-sat").textContent = det.cx ? Math.round(det.sat * 100) + "%" : "—";
    document.querySelector("#lab-halo").textContent = det.cx ? det.halo + " px" : "—";
    const chip = document.querySelector("#lab-chip");
    chip.textContent = det.ok ? "ok" : "reject";
    chip.className = det.ok ? "ok" : "no";
    document.querySelector("#lab-why").textContent = det.why;
  };

  const move = (ev) => {
    const r = paper.getBoundingClientRect();
    state.x = Math.max(12, Math.min(W - 12, (ev.clientX - r.left) * (W / r.width)));
    state.y = Math.max(12, Math.min(H - 12, (ev.clientY - r.top) * (H / r.height)));
    render();
  };
  let down = false;
  paper.addEventListener("pointerdown", (ev) => { down = true; paper.setPointerCapture(ev.pointerId); move(ev); });
  paper.addEventListener("pointermove", (ev) => { if (down) move(ev); });
  paper.addEventListener("pointerup", () => { down = false; });
  paper.addEventListener("pointercancel", () => { down = false; });
  paper.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 10 : 2;
    const dx = ev.key === "ArrowLeft" ? -step : ev.key === "ArrowRight" ? step : 0;
    const dy = ev.key === "ArrowUp" ? -step : ev.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    ev.preventDefault();
    state.x = Math.max(12, Math.min(W - 12, state.x + dx));
    state.y = Math.max(12, Math.min(H - 12, state.y + dy));
    render();
  });

  const bind = (id, key, out, fmt) => {
    const el = document.querySelector(id), o = document.querySelector(out);
    el.addEventListener("input", () => { state[key] = +el.value; o.textContent = fmt(state[key]); if (key === "noise") noiseCanvas(); render(); });
  };
  bind("#lab-sigma", "sigma", "#lab-sigma-v", (v) => v.toFixed(1));
  bind("#lab-amp", "amp", "#lab-amp-v", (v) => String(v));
  bind("#lab-noise", "noise", "#lab-noise-v", (v) => v.toFixed(1));
  document.querySelector("#lab-glare").addEventListener("change", (ev) => { state.glare = ev.target.checked; render(); });

  state.x = 300; state.y = 210;
  render();
}
`;
