// Figure: quality gates. Each case rebuilds the probe from issues #20 and #25 (same frames,
// same sample windows) and runs it through the ported pipeline in spotcore.mjs twice: once with
// the rules before the fix and once with the current gates. The pipeline column shows which
// gate stops the case; the result line shows what the operator gets.
import { spotCoreScript } from "./spotcore.mjs";

export const qualityCss = `
.qg{display:grid;gap:14px}
.qg .cases{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule)}
.qg .cases button{appearance:none;display:flex;align-items:baseline;gap:8px;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:none;padding:8px 10px;text-align:left;font:12.5px/1.4 var(--sans);color:var(--muted);cursor:pointer;min-width:0}
.qg .cases button:hover{color:var(--ink)}
.qg .cases button[aria-selected="true"]{color:var(--ink);background:var(--card);box-shadow:inset 0 -2px 0 var(--ink)}
.qg .cases i{font:italic 13px/1 var(--serif);color:var(--faint)}
.qg .cases span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qg .cases sup{font:9.5px var(--mono);color:var(--faint)}
.qg .bar{display:grid;justify-items:start;gap:10px}
.qg .lbl{display:flex;flex-wrap:wrap;gap:0 10px;font:10.5px/1.5 var(--mono);color:var(--muted);margin:0;min-width:0}
.qg .lbl b{font-weight:400;color:var(--text-2)}
.qg .mode{display:inline-flex;padding:2px;border-radius:7px;background:var(--well)}
.qg .mode button{appearance:none;border:0;background:none;border-radius:5px;padding:3px 10px;font:12px/1.5 var(--sans);color:var(--muted);cursor:pointer}
.qg .mode button:hover{color:var(--ink)}
.qg .mode button[aria-pressed="true"]{background:var(--card);color:var(--ink);box-shadow:0 0 0 1px var(--rule)}
.qg canvas{display:block;width:100%;height:auto;border-radius:6px;box-shadow:0 0 0 1px var(--rule)}
.qg .pipe{display:grid;grid-template-columns:4fr 3fr;gap:0 14px}
.qg .grp{min-width:0}
.qg .grp>span{display:block;font:10px/1.5 var(--mono);color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.qg .cells{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);position:relative}
.qg .cells::before{content:"";position:absolute;left:12%;right:12%;top:11px;height:1px;background:var(--rule)}
.qg .cell{appearance:none;position:relative;display:grid;justify-items:center;gap:3px;border:0;background:none;padding:0 2px 6px;cursor:pointer;font:11.5px/1.3 var(--sans);color:var(--text-2);transition:opacity .25s;min-width:0}
.qg .cell .m{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:11px/1 var(--mono);background:var(--ground);box-shadow:0 0 0 1px var(--rule)}
.qg .cell .t{font:9.5px/1.2 var(--mono);color:var(--faint);min-height:1.2em}
.qg .cell.pass .m{color:var(--accent);box-shadow:0 0 0 1px currentColor}
.qg .cell.stop .m{color:#fff;background:#c0392b;box-shadow:none}
.qg .cell.stop{color:#c0392b}
.qg .cell.absent{color:var(--faint)}
.qg .cell.absent .n{text-decoration:line-through}
.qg .cell.absent .m{color:var(--faint);box-shadow:0 0 0 1px var(--rule) inset}
.qg .cell.skip{opacity:.4}
.qg .cell[aria-pressed="true"]{box-shadow:inset 0 -2px 0 var(--ink)}
.qg .cell.hidden{opacity:0}
.qg .detail{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 10px;background:var(--well);border-radius:6px;padding:9px 12px;font-size:12px;line-height:1.5}
.qg .detail b{font-weight:500}
.qg .detail .rule{color:var(--muted)}
.qg .detail .out{grid-column:1/3;font:11px/1.5 var(--mono);color:var(--text-2)}
.qg .detail.stop .out{color:#c0392b}
.qg .result{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 12px;align-items:baseline;border-top:1px solid var(--rule);padding-top:12px;font-size:12.5px}
.qg .chip{font:10.5px var(--mono);text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:4px;background:var(--well);color:var(--text-2);white-space:nowrap}
.qg .chip.ok{background:rgba(47,138,87,.12);color:var(--accent)}
.qg .chip.no{background:rgba(192,57,43,.1);color:#c0392b}
.qg .chip.warn{background:rgba(183,121,31,.12);color:#b7791f}
.qg .result .sees{grid-column:1/3;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;color:var(--muted);font-size:11.5px}
.qg .result .sees code{font-size:10.5px;line-height:1.5;white-space:normal;padding:3px 6px}
.qg .notes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;border-top:1px solid var(--rule);padding-top:12px;font-size:12px;line-height:1.55;color:var(--text-2)}
.qg .notes h6{margin:0 0 4px;font:10px/1.5 var(--mono);color:var(--faint);text-transform:uppercase;letter-spacing:.06em}
.qg .notes p{margin:0}
@media (prefers-reduced-motion:reduce){.qg .cell{transition:none}}
@media (max-width:560px){
  .qg .cases{grid-template-columns:repeat(2,minmax(0,1fr))}
  .qg .pipe{grid-template-columns:minmax(0,1fr);gap:10px}
  .qg .notes{grid-template-columns:minmax(0,1fr);gap:10px}
  .qg .result{grid-template-columns:minmax(0,1fr)}
  .qg .result .sees{grid-column:auto}
}
`;

const TABS = [
  ["reflection", "White reflection", "#20"],
  ["track", "Lost track", "#20"],
  ["edge", "Frame edge", "#20"],
  ["halo", "Attached halo", "#20"],
  ["moving", "Moving cart", "#20"],
  ["vibration", "10 Hz vibration", "#25"],
];

export const qualityMarkup = `
<div class="qg" id="qg">
  <div class="cases" role="tablist" aria-label="Probe cases">${TABS.map(
    ([k, label, issue], i) =>
      `<button type="button" role="tab" data-case="${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><i>${String(i + 1).padStart(2, "0")}</i><span>${label}</span><sup>${issue}</sup></button>`
  ).join("")}</div>
  <div class="bar"><div class="mode" role="group" aria-label="Rules"><button type="button" data-mode="before" aria-pressed="true">Before the fix</button><button type="button" data-mode="after" aria-pressed="false">Current gates</button></div>
    <p class="lbl"><b id="qg-vlabel">Probe frame</b><span id="qg-vmeta"></span></p></div>
  <canvas id="qg-view" width="640" height="300" role="img" aria-label="The probe frame or sample window with the detector output"></canvas>
  <div class="pipe" id="qg-pipe"></div>
  <div class="detail" id="qg-detail" aria-live="polite"></div>
  <div class="result" aria-live="polite"><span class="chip" id="qg-chip">—</span><span id="qg-verdict"></span><div class="sees" id="qg-sees"></div></div>
  <div class="notes"><div><h6 id="qg-story-h">What the issue found</h6><p id="qg-story"></p></div><div><h6>Fix</h6><p id="qg-fix"></p></div></div>
</div>
`;

const qualityJs = `
{
const qg = document.querySelector("#qg");
if (qg) {
  const SCALE = 0.256557;
  const NO_SPOT = "Usable green spot not detected in at least 5 frames within 0.5s (camera stale, spot lost, clipped by the frame edge or ambiguous), cannot record!";
  const frameCase = (o) => ({ kind: "frame", ...o });
  const CASES = {
    reflection: frameCase({
      label: "20 × 20 px white block, no laser", view: [230, 173, 160, 75], prev: null, truth: null,
      build: () => RS.fillRect(RS.paperFrame(640, 480, 0, [170, 178, 172], 0), 300, 200, 320, 220),
      story: "A 20 × 20 px fully saturated white block, with no laser in the frame. The old detector skipped the colour test for saturated candidates and returned it as the spot.",
      issue: "#20", fix: "A candidate needs at least min_halo_px = 8 unsaturated green pixels. A saturated white block has none, so it never becomes a candidate.",
    }),
    track: frameCase({
      label: "spot at (150, 150), white block at (479.5, 329.5)", view: [0, 90, 640, 300], prev: [250, 250], truth: [150, 150],
      build: () => RS.fillRect(RS.addSpot(RS.paperFrame(640, 480, 2), 150, 150, 6, [5, 60, 10]), 470, 320, 490, 340),
      story: "Tracking was lost (last position 250, 250). A white reflection carried more energy than the real, unsaturated spot, so the old detector jumped to it.",
      issue: "#20", fix: "The halo gate removes the white block; tracking prefers a candidate within track_gate_px = 40 px of the last spot; with no tracking context, two near-equal candidates are ambiguous.",
    }),
    edge: frameCase({
      label: "true centre x = 2 px", view: [0, 210, 128, 60], prev: null, truth: [2, 240],
      build: () => RS.addSpot(RS.paperFrame(640, 480, 0), 2, 240, 6, [5, 60, 10]),
      story: "Half the spot lies outside the frame. The intensity centroid of what remains moves inward: x = 3.92 px in the issue, 0.74 px bias at x = 5.",
      issue: "#20", fix: "Any weighted pixel touching the frame or ROI edge marks the spot clipped. It still shows in the target view but is excluded from averaging.",
    }),
    halo: frameCase({
      label: "spot at 320 + half-strength halo at 328", view: [288, 225, 64, 30], prev: null, truth: [320, 240],
      build: () => RS.addSpot(RS.addSpot(RS.paperFrame(640, 480, 7), 320, 240, 6, [5, 60, 10]), 328, 240, 6, [2, 30, 5]),
      story: "A half-strength halo 8 px to the right merges with the spot. In one frame the blend looks like a single, slightly wide spot, and the centroid moves 2.4 px.",
      issue: "#20", fix: "Not fixed. max_elongation exists but is off by default, because a real laser spot can be elliptical. The bias is repeatable and averaging cannot remove it; it is documented under Limits.",
    }),
    moving: {
      kind: "window", label: "15 frames, x from 100 to 114 in 0.42 s", truth: 114, now: 100.42, range: [97, 117],
      samples: () => Array.from({ length: 15 }, (_, i) => [100 + i * 0.03, [100 + i, 200]]),
      story: "The cart was still moving. Every frame is a clean spot and none is an outlier, so the old window averaged them: mean 107, 7 px (1.80 mm) behind the newest position.",
      issue: "#20", fix: "A least-squares slope across the window; drift above average_max_drift_px = 2 px with a significant slope, or std above 2.5 px, rejects the window.",
    },
    vibration: {
      kind: "window", label: "10 Hz at 30 fps: 5 frames at 324, 10 at 318", truth: 320, now: 100 + 14 / 30, range: [315, 327],
      samples: () => Array.from({ length: 15 }, (_, i) => [100 + i / 30, [i % 3 === 0 ? 324 : 318, 240]]),
      story: "Vibration aliased with the frame rate. Ten frames sat on the median, so MAD was zero and the 0.1 px floor cut the five peaks. The survivors had zero spread and passed the stillness check: dx = −0.513 mm, std 0.0000.",
      issue: "#25", fix: "The MAD floor is now 0.5 px and at most 15% of the window may be rejected. Here 5 of 15 (33%) are, so the window is refused as vibrating.",
    },
  };

  const view = qg.querySelector("#qg-view"), vctx = view.getContext("2d");
  const off = document.createElement("canvas"); off.width = 640; off.height = 480;
  const octx = off.getContext("2d");
  const pipe = qg.querySelector("#qg-pipe");
  let picked = -1;
  const $ = (s) => qg.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n, f) => getComputedStyle(document.body).getPropertyValue(n).trim() || f;
  const fmt = (v, d = 2) => (v >= 0 ? "+" : "") + v.toFixed(d);
  const cache = {};
  let cur = "reflection", mode = "before", timer = 0;

  const run = (key) => {
    if (cache[key]) return cache[key];
    const c = CASES[key];
    const out = {};
    if (c.kind === "frame") {
      const img = RS.toU8(c.build());
      out.img = img;
      out.before = RS.detectSpot(img, c.prev, RS.BEFORE_20.detect);
      out.after = RS.detectSpot(img, c.prev);
    } else {
      const s = c.samples();
      out.before = RS.averageSpot(s, c.now, (key === "vibration" ? RS.BEFORE_25 : RS.BEFORE_20).average);
      out.after = RS.averageSpot(s, c.now);
    }
    return (cache[key] = out);
  };

  // stage rows: [mark class, name, rule, outcome, tag]
  const stagesFor = (key, m) => {
    const c = CASES[key], r = run(key), d = r[m], before = m === "before";
    const tag20 = before ? "added in #20" : "#20", tag25 = before ? "added in #25" : "#25";
    const rows = [];
    if (c.kind === "frame") {
      const comps = d ? d.considered.length : 0;
      rows.push(["pass", "Bright region", "green > paper + max(25, 6σ)", comps + " component" + (comps === 1 ? "" : "s")]);
      const block = d && d.considered.find((q) => q.why === "halo");
      if (before) rows.push(["absent", "Halo and colour", "≥ 8 unsaturated green px", "saturated candidates skipped the colour test", tag20]);
      else rows.push([block ? "stop" : "pass", "Halo and colour", "≥ 8 unsaturated green px", block ? "white block: 0 halo px → dropped" : "halo " + (d && !d.none ? d.halo : 0) + " px", "#20"]);
      if (d && d.none) {
        rows.push(["skip", "Tracking", "within 40 px of the last spot", "no candidate left"]);
        rows.push(["skip", "Frame edge", "weighted pixels off the edge", "—"]);
      } else {
        if (before) rows.push(["absent", "Tracking", "within 40 px of the last spot", "strongest candidate wins", tag20]);
        else rows.push(["pass", "Tracking", "within 40 px of the last spot", c.prev ? (d.tracked ? "tracked" : "nothing within 40 px of (" + c.prev.join(", ") + "); " + d.candidates + " candidate" + (d.candidates === 1 ? "" : "s") + ", not ambiguous") : "no previous position", "#20"]);
        if (before) rows.push(["absent", "Frame edge", "weighted pixels off the edge", "not checked", tag20]);
        else rows.push([d.clipped ? "stop" : "pass", "Frame edge", "weighted pixels off the edge", d.clipped ? "touches x = 0 → clipped, not usable" : "inside the frame", "#20"]);
      }
      const usable = d && !d.none && d.usable;
      const w = usable ? "pass" : "skip";
      rows.push([w, "Window outliers", "median ± 3.5·MAD", usable ? "15 identical frames" : "frames never enter the window"]);
      rows.push([before ? "absent" : w, "Rejection cap", "≤ 15% of the window", before ? "no cap" : usable ? "0 of 15" : "—", tag25]);
      rows.push([before ? "absent" : w, "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", before ? "not checked" : usable ? "still" : "—", tag20]);
    } else {
      rows.push(["pass", "Bright region", "green > paper + max(25, 6σ)", "one clean spot per frame"]);
      rows.push([before && key === "moving" ? "absent" : "pass", "Halo and colour", "≥ 8 unsaturated green px", "halo present", tag20]);
      rows.push([before && key === "moving" ? "absent" : "pass", "Tracking", "within 40 px of the last spot", "tracked every frame", tag20]);
      rows.push([before && key === "moving" ? "absent" : "pass", "Frame edge", "weighted pixels off the edge", "inside the frame", tag20]);
      const floor = before ? 0.1 : 0.5;
      rows.push(["pass", "Window outliers", "median ± 3.5·max(MAD, " + floor + " px)", d.rejected + " of " + d.total + " outside " + d.band.mx.toFixed(1) + " ± " + d.band.hx.toFixed(2) + " px"]);
      if (before) rows.push(["absent", "Rejection cap", "≤ 15% of the window", "no cap: " + d.rejected + " dropped silently", tag25]);
      else rows.push([d.reason === "outliers" ? "stop" : "pass", "Rejection cap", "≤ 15% of the window", d.rejected + " of " + d.total + " = " + Math.round((100 * d.rejected) / d.total) + "%" + (d.reason === "outliers" ? " > 15% → vibrating" : ""), "#25"]);
      const stillMsg = "drift " + d.drift[0].toFixed(2) + " px · std " + d.std[0].toFixed(2) + " px";
      if (before && key === "moving") rows.push(["absent", "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", "not checked", tag20]);
      else if (d.reason === "outliers") rows.push(["skip", "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", "not reached"]);
      else rows.push([d.reason === "drift" || d.reason === "jitter" ? "stop" : "pass", "Stillness", "drift ≤ 2 px, std ≤ 2.5 px", stillMsg + (d.reason ? " → " + d.reason : ""), "#20"]);
    }
    return rows;
  };

  const verdictFor = (key, m) => {
    const c = CASES[key], d = run(key)[m];
    if (c.kind === "frame") {
      if (!d || d.none) return ["ok", "Rejected", "no candidate survives, so there is no spot to measure", [["", "No spot"]], NO_SPOT];
      const err = c.truth ? Math.hypot(d.x - c.truth[0], d.y - c.truth[1]) : null;
      const pos = "(" + d.x.toFixed(2) + ", " + d.y.toFixed(2) + ")";
      if (!d.usable) return ["ok", "Rejected", pos + " shown but excluded from averaging", [["bad", "Spot clipped by the edge"]], NO_SPOT];
      if (c.truth === null) return ["no", "Accepted, wrong", pos + " reported, but the frame has no laser at all", [["ok", "Spot locked"]], "Measurement recorded."];
      if (err > 1) return [key === "halo" ? "warn" : "no", key === "halo" ? "Accepted, biased" : "Accepted, wrong", pos + " · " + err.toFixed(2) + " px (" + (err * SCALE).toFixed(2) + " mm) from the true centre", [["ok", "Spot locked"]], key === "halo" ? "Measurement recorded with a fixed bias; see Limits." : "Measurement recorded."];
      return ["ok", "Accepted", pos + " · " + err.toFixed(2) + " px from the true centre", [["ok", "Spot locked"]], "Ready to record."];
    }
    const mean = d.mean ? d.mean[0] : null;
    const bias = mean - c.truth;
    if (d.stable) return ["no", "Accepted, wrong", "mean x = " + mean.toFixed(2) + " px · " + fmt(bias) + " px (" + fmt(bias * SCALE, 3) + " mm) from " + (key === "moving" ? "the newest position" : "the true centre") + ", std " + d.std[0].toFixed(2) + " px", [["ok", "Spot locked"]], "Measurement recorded."];
    const msg = d.reason === "outliers"
      ? "Green spot is vibrating (" + d.rejected + "/" + d.total + " frames rejected as outliers within 0.5s, the average would be biased); wait for the vibration to settle, cannot record!"
      : "Green spot is not still (" + d.reason + ": std=(" + d.std[0].toFixed(2) + ", " + d.std[1].toFixed(2) + ") px, drift=(" + d.drift[0].toFixed(2) + ", " + d.drift[1].toFixed(2) + ") px within 0.5s); wait for the target to settle, cannot record!";
    return ["ok", "Rejected", "the window is refused: " + d.reason, [["ok", "Spot locked"]], msg];
  };

  const drawFrame = (key, m) => {
    const c = CASES[key], r = run(key), d = r[m];
    const img = r.img, id = octx.createImageData(640, 480);
    for (let i = 0, j = 0; i < 640 * 480; i++, j += 4) { id.data[j] = img.r[i]; id.data[j + 1] = img.g[i]; id.data[j + 2] = img.b[i]; id.data[j + 3] = 255; }
    octx.putImageData(id, 0, 0);
    const [vx, vy, vw, vh] = c.view, W = view.width, H = view.height, k = W / vw;
    vctx.imageSmoothingEnabled = vw < 300 ? false : true;
    vctx.drawImage(off, vx, vy, vw, vh, 0, 0, W, H);
    const X = (x) => (x - vx + 0.5) * k, Y = (y) => (y - vy + 0.5) * k;
    vctx.font = "20px ui-monospace,monospace";
    vctx.lineWidth = 1.5;
    if (d) for (const q of d.considered) {
      const [bx, by, bw, bh] = q.bbox;
      vctx.setLineDash(q.why ? [4, 4] : []);
      vctx.strokeStyle = q.why ? "rgba(192,57,43,.9)" : "rgba(17,17,17,.55)";
      vctx.strokeRect(X(bx - 0.5) - 3, Y(by - 0.5) - 3, bw * k + 6, bh * k + 6);
      if (q.why) { vctx.fillStyle = "rgba(192,57,43,.95)"; vctx.fillText("no halo", X(bx - 0.5) - 3, Y(by - 0.5) - 8); }
    }
    vctx.setLineDash([]);
    if (c.truth) {
      vctx.strokeStyle = "rgba(255,255,255,.95)"; vctx.lineWidth = 1.5;
      vctx.setLineDash([3, 3]); vctx.beginPath(); vctx.arc(X(c.truth[0]), Y(c.truth[1]), Math.max(14, 6 * k), 0, Math.PI * 2); vctx.stroke(); vctx.setLineDash([]);
    }
    if (d && !d.none) {
      const bad = verdictFor(key, m)[0] !== "ok";
      const px = X(d.x), py = Y(d.y), s = 18;
      vctx.strokeStyle = bad ? "#c0392b" : d.usable ? "#1f6f45" : "#b7791f"; vctx.lineWidth = 2.5;
      vctx.beginPath(); vctx.moveTo(px - s, py); vctx.lineTo(px + s, py); vctx.moveTo(px, py - s); vctx.lineTo(px, py + s); vctx.stroke();
    }
    vctx.fillStyle = "rgba(0,0,0,.5)"; vctx.fillRect(0, H - 34, W, 34);
    vctx.fillStyle = "#fff";
    vctx.fillText((c.truth ? "○ true centre   " : "") + "+ detector output   ▭ candidate", 10, H - 11);
    $("#qg-vlabel").textContent = "Probe frame";
    $("#qg-vmeta").textContent = c.label + " · " + (vw === 640 ? "rows 90–390" : vw + " × " + vh + " px crop");
  };

  const drawWindow = (key, m) => {
    const c = CASES[key], d = run(key)[m];
    const W = view.width, H = view.height, L = 46, R = 14, T = 16, B = 36;
    const ink = css("--muted", "#8f8f8f"), rule = css("--rule", "#ebebeb"), acc = css("--accent", "#2f8a57"), text = css("--text-2", "#525252");
    vctx.fillStyle = css("--card", "#fff"); vctx.fillRect(0, 0, W, H);
    const [lo, hi] = c.range;
    const X = (i) => L + (i / 14) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    vctx.font = "18px ui-monospace,monospace"; vctx.lineWidth = 1;
    vctx.strokeStyle = rule; vctx.fillStyle = ink;
    for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) { vctx.beginPath(); vctx.moveTo(L, Y(v)); vctx.lineTo(W - R, Y(v)); vctx.stroke(); vctx.fillText(String(v), 6, Y(v) + 4); }
    if (d.band) {
      vctx.fillStyle = "rgba(47,138,87,.10)";
      vctx.fillRect(L, Y(d.band.mx + d.band.hx), W - L - R, Y(d.band.mx - d.band.hx) - Y(d.band.mx + d.band.hx));
    }
    vctx.setLineDash([5, 5]); vctx.strokeStyle = text; vctx.lineWidth = 1.5;
    vctx.beginPath(); vctx.moveTo(L, Y(c.truth)); vctx.lineTo(W - R, Y(c.truth)); vctx.stroke(); vctx.setLineDash([]);
    vctx.fillStyle = text; vctx.textAlign = "right"; vctx.fillText(key === "moving" ? "newest " + c.truth : "true " + c.truth, W - R, Y(c.truth) - 6); vctx.textAlign = "left";
    d.points.forEach((q, i) => {
      const x = X(i), y = Y(q.x);
      vctx.beginPath(); vctx.arc(x, y, 5, 0, Math.PI * 2);
      if (q.kept) { vctx.fillStyle = acc; vctx.fill(); }
      else { vctx.strokeStyle = "#c0392b"; vctx.lineWidth = 2; vctx.beginPath(); vctx.moveTo(x - 5, y - 5); vctx.lineTo(x + 5, y + 5); vctx.moveTo(x + 5, y - 5); vctx.lineTo(x - 5, y + 5); vctx.stroke(); }
    });
    if (d.mean) {
      const y = Y(d.mean[0]);
      vctx.strokeStyle = d.stable ? "#c0392b" : ink; vctx.lineWidth = 2; if (!d.stable) vctx.setLineDash([2, 4]);
      vctx.beginPath(); vctx.moveTo(L, y); vctx.lineTo(W - R, y); vctx.stroke(); vctx.setLineDash([]);
      vctx.fillStyle = d.stable ? "#c0392b" : ink;
      vctx.fillText((d.stable ? "output " : "not output ") + d.mean[0].toFixed(1), L + 6, y - 6);
    }
    vctx.fillStyle = ink;
    vctx.fillText("frame 1", L, H - 10); vctx.textAlign = "right"; vctx.fillText("frame 15", W - R, H - 10);
    vctx.textAlign = "center"; vctx.fillText("● kept   ✕ rejected   ▬ MAD band", (L + W - R) / 2, H - 10); vctx.textAlign = "left";
    $("#qg-vlabel").textContent = "Sample window";
    $("#qg-vmeta").textContent = c.label;
  };

  const draw = (animate) => {
    const c = CASES[cur];
    (c.kind === "frame" ? drawFrame : drawWindow)(cur, mode);
    const rows = stagesFor(cur, mode);
    const MARK = { pass: "✓", stop: "✕", absent: "–", skip: "·" };
    const SHORT = { "Bright region": "Bright", "Halo and colour": "Halo", "Tracking": "Track", "Frame edge": "Edge", "Window outliers": "Outliers", "Rejection cap": "Cap", "Stillness": "Still" };
    if (picked < 0 || picked >= rows.length) {
      const stop = rows.findIndex((r) => r[0] === "stop"), absent = rows.findIndex((r) => r[0] === "absent");
      picked = stop >= 0 ? stop : absent >= 0 ? absent : rows.length - 1;
    }
    const cell = ([st, name, , , tag], i) =>
      '<button type="button" class="cell ' + st + '" data-i="' + i + '" aria-pressed="' + (i === picked) + '"><span class="m">' + MARK[st] + '</span><span class="n">' +
      SHORT[name] + '</span><span class="t">' + (tag ? tag.replace("added in ", "+") : "") + "</span></button>";
    pipe.innerHTML = '<div class="grp"><span>Per frame</span><div class="cells">' + rows.slice(0, 4).map(cell).join("") +
      '</div></div><div class="grp"><span>Per 0.5 s window</span><div class="cells">' + rows.slice(4).map((r, i) => cell(r, i + 4)).join("") + "</div></div>";
    const [pst, pname, prule, pout, ptag] = rows[picked];
    const det = $("#qg-detail");
    det.className = "detail " + pst;
    det.innerHTML = "<b>" + pname + '</b><span class="rule">' + prule + (ptag ? " · " + ptag : "") + '</span><span class="out">' +
      (pst === "absent" ? "this gate did not exist yet: " : "") + pout + "</span>";
    const [tone, chip, text, badges, msg] = verdictFor(cur, mode);
    $("#qg-chip").textContent = chip;
    $("#qg-chip").className = "chip " + tone;
    $("#qg-verdict").textContent = text;
    $("#qg-sees").innerHTML = '<span>Operator sees</span><span class="app">' + badges.map(([t, s]) => '<span class="badge ' + t + '">' + s + "</span>").join(" ") + "</span><code>" + msg + "</code>";
    $("#qg-story-h").textContent = "What " + c.issue + " found";
    $("#qg-story").textContent = c.story;
    $("#qg-fix").textContent = c.fix;
    clearTimeout(timer);
    if (animate && !reduce) {
      const items = [...pipe.querySelectorAll(".cell")];
      const stop = items.findIndex((li) => li.classList.contains("stop"));
      items.forEach((li) => li.classList.add("hidden"));
      let i = 0;
      const step = () => { if (i < items.length) { items[i++].classList.remove("hidden"); timer = setTimeout(step, i - 1 === stop ? 260 : 90); } };
      step();
    }
  };

  const tabs = [...qg.querySelectorAll('[role="tab"]')];
  const select = (b, focus) => {
    for (const t of tabs) { const on = t === b; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; }
    if (focus) b.focus();
    cur = b.dataset.case;
    picked = -1;
    draw(true);
  };
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => select(b, false));
    b.addEventListener("keydown", (ev) => {
      const s = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
      if (s) { ev.preventDefault(); select(tabs[(i + s + tabs.length) % tabs.length], true); }
      else if (ev.key.toLowerCase() === "f") setMode(mode === "before" ? "after" : "before");
    });
  });
  const modes = [...qg.querySelectorAll("[data-mode]")];
  const setMode = (m) => {
    mode = m;
    picked = -1;
    for (const b of modes) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    draw(true);
  };
  for (const b of modes) b.addEventListener("click", () => setMode(b.dataset.mode));
  pipe.addEventListener("click", (ev) => {
    const b = ev.target.closest(".cell");
    if (!b) return;
    picked = +b.dataset.i;
    draw(false);
  });
  draw(false);
}
}
`;

export const qualityScript = [spotCoreScript, qualityJs];
