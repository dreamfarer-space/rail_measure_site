// Figure core shared by the spot lab and the quality-gate figure: a JavaScript port of
// detect_spot() and average_spot_detail() from try_valuelock.py, plus the synthetic paper
// frames of tests/test_verticality_vision.py that issues #20 and #25 used for their probes.
// The functions are exported for build.test.mjs and inlined into the page as source text.

export const DETECTION = {
  min_contrast: 25, noise_k: 6, min_area: 4, max_area: 6000, max_aspect: 3, min_fill: 0.3,
  min_green_excess: 10, saturation_level: 250, max_saturated_frac: 0.2, min_halo_px: 8,
  track_gate_px: 40, max_competing_ratio: 0.5,
};

export const AVERAGING = {
  window_sec: 0.5, min_samples: 5, mad_k: 3.5, mad_floor_px: 0.5, max_outlier_fraction: 0.15,
  max_std_px: 2.5, max_drift_px: 2, drift_t: 3,
};

// Rules before the fixes. #20 (8024a2b) added the halo, tracking, clip and stillness gates;
// #25 (246252b) raised the MAD floor from 0.1 px and capped the rejected fraction at 15%.
export const BEFORE_20 = { detect: { legacy: true }, average: { mad_floor_px: 0.1, max_outlier_fraction: -1, max_std_px: 0, max_drift_px: 0 } };
export const BEFORE_25 = { detect: {}, average: { mad_floor_px: 0.1, max_outlier_fraction: -1 } };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Back of the white paper: flat BGR plus Gaussian noise, as float channels. */
export function paperFrame(w = 640, h = 480, seed = 0, bgr = [170, 178, 172], noise = 2) {
  const rand = mulberry32(seed + 1);
  const ch = bgr.map(() => new Float32Array(w * h));
  for (let c = 0; c < 3; c++) {
    const a = ch[c];
    for (let i = 0; i < a.length; i += 2) {
      const u = Math.max(rand(), 1e-12), v = rand();
      const m = Math.sqrt(-2 * Math.log(u)) * noise;
      a[i] = bgr[c] + m * Math.cos(2 * Math.PI * v);
      if (i + 1 < a.length) a[i + 1] = bgr[c] + m * Math.sin(2 * Math.PI * v);
    }
  }
  return { w, h, ch };
}

/** Adds a Gaussian spot with BGR amplitude; (60, 400, 90) saturates the core, (5, 60, 10) does not. */
export function addSpot(f, cx, cy, sigma = 6, amp = [60, 400, 90]) {
  const r = Math.ceil(sigma * 5);
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(f.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(f.h - 1, Math.ceil(cy + r));
  const k = 1 / (2 * sigma * sigma);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const g = Math.exp(-((x - cx) * (x - cx) + (y - cy) * (y - cy)) * k);
      const i = y * f.w + x;
      for (let c = 0; c < 3; c++) f.ch[c][i] += amp[c] * g;
    }
  }
  return f;
}

/** img[y0:y1, x0:x1] = value, as in the probes. */
export function fillRect(f, x0, y0, x1, y1, value = 255) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) f.ch[c][y * f.w + x] = value;
  return f;
}

/** np.clip(img, 0, 255).astype(np.uint8): clip, then truncate. */
export function toU8(f) {
  const ch = f.ch.map((a) => {
    const o = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) { const v = a[i]; o[i] = v <= 0 ? 0 : v >= 255 ? 255 : v | 0; }
    return o;
  });
  return { w: f.w, h: f.h, b: ch[0], g: ch[1], r: ch[2] };
}

function median(values) {
  const s = Float64Array.from(values).sort();
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/**
 * detect_spot(): candidates brighter than the paper, each checked for size, shape, halo and
 * colour; the best one is chosen by tracking or energy, then located by background-subtracted
 * intensity weighting. With params.legacy the pre-#20 rules apply: a fully saturated candidate
 * skips the colour test, there is no halo or tracking gate and nothing is marked clipped.
 * Returns null when no candidate survives; `considered` lists every component and its verdict.
 */
export function detectSpot(img, prev = null, params = {}) {
  const p = { ...DETECTION, ...params };
  const { w, h, g, r, b } = img;
  const sample = [];
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) sample.push(g[y * w + x]);
  const background = median(sample);
  const noise = median(sample.map((v) => Math.abs(v - background))) * 1.4826;
  const threshold = Math.max(p.min_contrast, p.noise_k * noise);

  const labels = new Int32Array(w * h);
  const comps = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (labels[i] || g[i] - background <= threshold) continue;
    const id = comps.length + 1;
    let top = 0, area = 0, minx = w, miny = h, maxx = 0, maxy = 0;
    stack[top++] = i;
    labels[i] = id;
    while (top) {
      const j = stack[--top];
      const x = j % w, y = (j - x) / w;
      area++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const k = yy * w + xx;
          if (!labels[k] && g[k] - background > threshold) { labels[k] = id; stack[top++] = k; }
        }
      }
    }
    comps.push({ label: id, bbox: [minx, miny, maxx - minx + 1, maxy - miny + 1], area });
  }
  if (!comps.length) return null;
  comps.sort((a, c) => c.area - a.area);

  const considered = [];
  const candidates = [];
  for (const c of comps.slice(0, 50)) {
    const [x, y, bw, bh] = c.bbox;
    const reject = (why) => considered.push({ bbox: c.bbox, why });
    if (c.area < p.min_area || c.area > p.max_area) { reject("size"); continue; }
    if (Math.max(bw, bh) / Math.max(1, Math.min(bw, bh)) > p.max_aspect) { reject("aspect"); continue; }
    if (c.area / (bw * bh) < p.min_fill) { reject("fill"); continue; }
    let sat = 0, unsat = 0, ge = 0, peak = 0, energy = 0;
    for (let yy = y; yy < y + bh; yy++) {
      for (let xx = x; xx < x + bw; xx++) {
        const k = yy * w + xx;
        if (labels[k] !== c.label) continue;
        const gg = g[k];
        if (gg > peak) peak = gg;
        energy += gg - background;
        if (gg >= p.saturation_level) sat++;
        else { unsat++; ge += gg - Math.max(r[k], b[k]); }
      }
    }
    const greenExcess = unsat ? ge / unsat : NaN;
    if (p.legacy) {
      if (unsat && greenExcess < p.min_green_excess) { reject("colour"); continue; }
    } else {
      if (unsat < p.min_halo_px) { reject("halo"); continue; }
      if (greenExcess < p.min_green_excess) { reject("colour"); continue; }
    }
    const cand = { label: c.label, bbox: c.bbox, area: c.area, peak, energy, halo: unsat, saturated_frac: sat / c.area, green_excess: greenExcess };
    candidates.push(cand);
    considered.push({ bbox: c.bbox, why: null, cand });
  }
  if (!candidates.length) return { none: true, considered, background, threshold };

  let best = null;
  let tracked = false;
  if (prev && !p.legacy) {
    const near = candidates.filter((c) => {
      const [x, y, bw, bh] = c.bbox;
      return Math.hypot(x + bw / 2 - prev[0], y + bh / 2 - prev[1]) <= p.track_gate_px;
    });
    if (near.length) { best = near.reduce((a, c) => (c.energy > a.energy ? c : a)); tracked = true; }
  }
  if (!best) best = candidates.reduce((a, c) => (c.energy > a.energy ? c : a));
  const others = candidates.filter((c) => c !== best).map((c) => c.energy);
  const competing = others.length && best.energy > 0 ? Math.max(...others) / best.energy : 0;

  const [x, y, bw, bh] = best.bbox;
  const pad = Math.max(2, Math.floor(0.25 * Math.max(bw, bh)));
  const xa = Math.max(0, x - pad), ya = Math.max(0, y - pad);
  const xb = Math.min(w, x + bw + pad), yb = Math.min(h, y + bh + pad);
  let total = 0, sx = 0, sy = 0, edge = false;
  for (let yy = ya; yy < yb; yy++) {
    for (let xx = xa; xx < xb; xx++) {
      const k = yy * w + xx;
      const lab = labels[k];
      let wt = g[k] - background - 0.5 * threshold;
      if (wt < 0 || (lab !== 0 && lab !== best.label)) wt = 0;
      if (!wt) continue;
      total += wt; sx += wt * xx; sy += wt * yy;
      if ((xa === 0 && xx === 0) || (ya === 0 && yy === 0) || (xb === w && xx === w - 1) || (yb === h && yy === h - 1)) edge = true;
    }
  }
  if (total <= 0) return { none: true, considered, background, threshold };
  const clipped = !p.legacy && edge;

  let reject_reason = null;
  if (clipped) reject_reason = "clipped";
  else if (!p.legacy && !tracked && competing > p.max_competing_ratio) reject_reason = "ambiguous";

  return {
    x: sx / total, y: sy / total, bbox: best.bbox, area: best.area, peak: best.peak,
    halo: best.halo, saturated_frac: best.saturated_frac, saturated: best.saturated_frac > p.max_saturated_frac,
    background, threshold, clipped, candidates: candidates.length, competing, tracked,
    usable: reject_reason === null, reject_reason, considered,
  };
}

function linearDrift(ts, vs) {
  const n = ts.length;
  const tm = ts.reduce((a, v) => a + v, 0) / n, vm = vs.reduce((a, v) => a + v, 0) / n;
  let stt = 0;
  for (const t of ts) stt += (t - tm) * (t - tm);
  if (n < 3 || stt <= 0) return [0, 0];
  let s = 0;
  for (let i = 0; i < n; i++) s += (ts[i] - tm) * (vs[i] - vm);
  const slope = s / stt;
  let resid = 0;
  for (let i = 0; i < n; i++) resid += (vs[i] - vm - slope * (ts[i] - tm)) ** 2;
  const se = Math.sqrt(resid / (n - 2) / stt);
  const drift = slope * (Math.max(...ts) - Math.min(...ts));
  if (se <= 1e-12) return [drift, slope ? Infinity : 0];
  return [drift, Math.abs(slope) / se];
}

function stdev(v) {
  if (v.length < 2) return 0;
  const m = v.reduce((a, x) => a + x, 0) / v.length;
  return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1));
}

/**
 * average_spot_detail(): MAD outlier rejection around the median, then the outlier cap,
 * drift and jitter checks. Samples are [t, [x, y] | null]. Adds `points` (each with `kept`)
 * and `band` (median and half-width per axis) so a figure can draw the window.
 */
export function averageSpot(samples, now, opts = {}) {
  const o = { ...AVERAGING, ...opts };
  let points = samples.filter(([t, s]) => s && now - t >= 0 && now - t <= o.window_sec + 1e-9)
    .map(([t, s]) => ({ t, x: s[0], y: s[1], kept: true }));
  const total = points.length;
  let band = null;
  if (total >= 3 && o.mad_k > 0) {
    const mx = median(points.map((q) => q.x)), my = median(points.map((q) => q.y));
    const sx = Math.max(o.mad_floor_px, 1.4826 * median(points.map((q) => Math.abs(q.x - mx))));
    const sy = Math.max(o.mad_floor_px, 1.4826 * median(points.map((q) => Math.abs(q.y - my))));
    band = { mx, my, hx: o.mad_k * sx, hy: o.mad_k * sy };
    for (const q of points) q.kept = Math.abs(q.x - mx) <= band.hx && Math.abs(q.y - my) <= band.hy;
  }
  const kept = points.filter((q) => q.kept);
  if (kept.length < Math.max(1, o.min_samples)) return { mean: null, points, band, total, rejected: total - kept.length, stable: false, reason: "samples" };
  const xs = kept.map((q) => q.x), ys = kept.map((q) => q.y), ts = kept.map((q) => q.t);
  const std = [stdev(xs), stdev(ys)];
  const dx = linearDrift(ts, xs), dy = linearDrift(ts, ys);
  const rejected = total - kept.length;
  let reason = null;
  if (o.max_outlier_fraction >= 0 && rejected > Math.max(1, Math.floor(o.max_outlier_fraction * total))) reason = "outliers";
  else if (o.max_drift_px > 0 && ((Math.abs(dx[0]) > o.max_drift_px && dx[1] > o.drift_t) || (Math.abs(dy[0]) > o.max_drift_px && dy[1] > o.drift_t))) reason = "drift";
  else if (o.max_std_px > 0 && Math.max(...std) > o.max_std_px) reason = "jitter";
  return {
    mean: [xs.reduce((a, v) => a + v, 0) / xs.length, ys.reduce((a, v) => a + v, 0) / ys.length],
    std, drift: [dx[0], dy[0]], samples: kept.length, rejected, total, stable: reason === null, reason, points, band,
  };
}

/** Least-squares Gaussian through the unsaturated samples of one row: ln(v − bg) = a + b·x + c·x². */
export function fitGaussian(xs, vs, background, lo, hi) {
  let n = 0;
  const S = new Float64Array(7), T = new Float64Array(3);
  const x0 = xs.reduce((a, v) => a + v, 0) / xs.length;
  for (let i = 0; i < xs.length; i++) {
    const e = vs[i] - background;
    if (e <= lo || vs[i] >= hi) continue;
    const x = xs[i] - x0, l = Math.log(e), wt = e * e;
    n++;
    for (let k = 0; k <= 4; k++) S[k] += wt * x ** k;
    T[0] += wt * l; T[1] += wt * x * l; T[2] += wt * x * x * l;
  }
  if (n < 4) return null;
  const A = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (!D) return null;
  const col = (j) => A.map((row, i) => row.map((v, k) => (k === j ? T[i] : v)));
  const [a, b, c] = [0, 1, 2].map((j) => det(col(j)) / D);
  if (c >= 0) return null;
  const sigma = Math.sqrt(-1 / (2 * c));
  const mu = -b / (2 * c);
  return { mu: mu + x0, sigma, peak: Math.exp(a - (b * b) / (4 * c)), used: n };
}

export const spotCoreScript = `
const RS = (() => {
const DETECTION = ${JSON.stringify(DETECTION)};
const AVERAGING = ${JSON.stringify(AVERAGING)};
const BEFORE_20 = ${JSON.stringify(BEFORE_20)};
const BEFORE_25 = ${JSON.stringify(BEFORE_25)};
${[mulberry32, paperFrame, addSpot, fillRect, toU8, median, detectSpot, linearDrift, stdev, averageSpot, fitGaussian].map(String).join("\n")}
return { DETECTION, AVERAGING, BEFORE_20, BEFORE_25, paperFrame, addSpot, fillRect, toU8, detectSpot, averageSpot, fitGaussian };
})();
`;
