// Figure core for the spatial page: one shaft scene in millimetres, the pinhole camera on Cart B's
// head, ray-cast depth with stereo noise, the two-point maths and a port of the car-top clearance rules
// in car_top.py (reference plane by RANSAC, 6 × 8 image grid, 5th percentile, unknown cells).
// World axes: x to the right, y up (against gravity), z away from the camera along the floor.
// Exported for build.test.mjs and inlined into the page as source text.

export const CAR_TOP_Y = -1050;
export const CLEAR_CFG = {
  ransac_threshold_mm: 15, min_reference_points: 150, min_reference_inlier_ratio: 0.6, max_reference_rms_mm: 12,
  max_reference_tilt_deg: 10, grid_rows: 6, grid_cols: 8, min_cell_valid_ratio: 0.3, cell_percentile: 5,
  surface_margin_mm: 30, min_known_ratio: 0.5, min_range_mm: 200, max_range_mm: 12000,
};
export const IMG = { w: 640, h: 400, f: 268.5 }; // 100° horizontal, simplified pinhole
export const POSE = { pitch: 5, yaw: 0, at: [0, 0, 0] }; // tilt servo at 95°: car top below, overhead beam above

/** Axis-aligned boxes [x0, x1, y0, y1, z0, z1]; layer orders the camera image, thin parts give no depth. */
export function sceneOf({ beamBottom = 700, glare = false } = {}) {
  const Y = CAR_TOP_Y;
  const items = [
    { id: "wall", b: [-1700, 1700, -1700, 1600, 2300, 2400], layer: 0, tone: 0.42 },
    { id: "flange", b: [-75, 75, -1700, 1600, 2290, 2300], layer: 0.5, tone: 0.55 },
    { id: "blade", b: [-8, 8, -1700, 1600, 2200, 2290], layer: 0.6, tone: 0.7 },
    { id: "car", b: [-1100, 1100, Y - 60, Y, 250, 2150], layer: 1, tone: 0.5 },
    { id: "crosshead", b: [-1100, 1100, Y, Y + 120, 2080, 2150], layer: 2, tone: 0.6 },
    { id: "station", b: [350, 650, Y, Y + 220, 1000, 1250], layer: 2, tone: 0.72 },
    { id: "beam", b: [-1700, 1700, beamBottom, beamBottom + 260, 1250, 1450], layer: 2, tone: 0.62, glare },
  ];
  for (const [i, y] of [[0, -530], [1, 610]]) {
    for (const s of [-1, 1]) items.push({ id: `clip${i}${s > 0 ? "r" : "l"}`, b: s < 0 ? [-118, -62, y - 28, y + 28, 2272, 2290] : [62, 118, y - 28, y + 28, 2272, 2290], layer: 0.7, tone: 0.8 });
  }
  for (const z of [400, 1250, 2050]) items.push({ id: `post${z}`, b: [-1080, -1040, Y, Y + 1100, z - 20, z + 20], layer: 2, tone: 0.66 });
  items.push({ id: "rail-top", b: [-1084, -1036, Y + 1080, Y + 1120, 380, 2070], layer: 2, tone: 0.7 });
  items.push({ id: "rail-knee", b: [-1080, -1040, Y + 520, Y + 550, 380, 2070], layer: 2, tone: 0.66 });
  for (const x of [-330, -280, -230]) items.push({ id: `rope${x}`, b: [x - 7, x + 7, Y + 120, 1600, 2110, 2124], layer: 2, tone: 0.85, thin: true });
  return items;
}

export function cameraOf({ pitch = POSE.pitch, yaw = POSE.yaw, at = POSE.at } = {}) {
  const p = (pitch * Math.PI) / 180, q = (yaw * Math.PI) / 180;
  const fwd = [Math.sin(q) * Math.cos(p), Math.sin(p), Math.cos(q) * Math.cos(p)];
  const right = [Math.cos(q), 0, -Math.sin(q)];
  const down = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  return { at, fwd, right, down };
}

/** World point → pixel [u, v, depth along the optical axis]. */
export function project(cam, p) {
  const d = [p[0] - cam.at[0], p[1] - cam.at[1], p[2] - cam.at[2]];
  const z = d[0] * cam.fwd[0] + d[1] * cam.fwd[1] + d[2] * cam.fwd[2];
  const x = d[0] * cam.right[0] + d[1] * cam.right[1] + d[2] * cam.right[2];
  const y = d[0] * cam.down[0] + d[1] * cam.down[1] + d[2] * cam.down[2];
  return [IMG.w / 2 + (IMG.f * x) / z, IMG.h / 2 + (IMG.f * y) / z, z];
}

export function rayOf(cam, u, v) {
  const x = (u - IMG.w / 2) / IMG.f, y = (v - IMG.h / 2) / IMG.f;
  const d = [0, 1, 2].map((i) => cam.fwd[i] + cam.right[i] * x + cam.down[i] * y);
  const n = Math.hypot(d[0], d[1], d[2]);
  return d.map((c) => c / n);
}

function hitBox(o, d, b) {
  let t0 = 0, t1 = Infinity, axis = -1, sign = 0;
  for (let i = 0; i < 3; i++) {
    const lo = b[i * 2], hi = b[i * 2 + 1];
    if (Math.abs(d[i]) < 1e-12) { if (o[i] < lo || o[i] > hi) return null; continue; }
    let ta = (lo - o[i]) / d[i], tb = (hi - o[i]) / d[i];
    let s = -1;
    if (ta > tb) { [ta, tb] = [tb, ta]; s = 1; }
    if (ta > t0) { t0 = ta; axis = i; sign = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return axis < 0 ? null : { t: t0, axis, sign };
}

/** Deterministic per-pixel noise in [-1, 1]. */
export const hash = (u, v) => {
  const s = Math.sin(u * 127.1 + v * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

/** Depth at a pixel: nearest surface, with stereo noise growing with range². Thin parts and glare give none. */
export function depthAt(scene, cam, u, v, { noise = true } = {}) {
  const d = rayOf(cam, u, v);
  let best = null;
  for (const it of scene) {
    const h = hitBox(cam.at, d, it.b);
    if (h && (!best || h.t < best.t)) best = { ...h, it };
  }
  if (!best) return { valid: false, reason: "nothing" };
  const n = [0, 0, 0];
  n[best.axis] = best.sign;
  if (best.it.thin) return { valid: false, reason: "thin", item: best.it.id };
  if (best.it.glare && best.axis === 1 && best.sign < 0) return { valid: false, reason: "glare", item: best.it.id };
  const zc = best.t * (d[0] * cam.fwd[0] + d[1] * cam.fwd[1] + d[2] * cam.fwd[2]);
  if (best.t < CLEAR_CFG.min_range_mm || best.t > CLEAR_CFG.max_range_mm) return { valid: false, reason: "range" };
  const sigma = noise ? 1.2e-6 * zc * zc : 0; // stereo error grows with the square of depth
  const t = best.t + sigma * hash(u, v) * best.t / zc;
  return { valid: true, p: [cam.at[0] + d[0] * t, cam.at[1] + d[1] * t, cam.at[2] + d[2] * t], t, zc, item: best.it.id, n };
}

/** Two points: Euclidean distance, gravity-aligned height difference (P2 higher is positive), horizontal part. */
export function twoPoint(scene, cam, a, b) {
  const p = depthAt(scene, cam, a[0], a[1]);
  const q = depthAt(scene, cam, b[0], b[1]);
  if (!p.valid || !q.valid) return { ok: false, p, q };
  const dx = q.p[0] - p.p[0], dy = q.p[1] - p.p[1], dz = q.p[2] - p.p[2];
  const D = Math.hypot(dx, dy, dz);
  return { ok: true, p, q, D, dv: dy, dh: Math.hypot(dx, dz) };
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RANSAC plane through points: returns { n, c, inliers, rms } with n·p = c, or null. */
export function ransacPlane(pts, thr, iters = 200, seed = 0) {
  if (pts.length < 3) return null;
  const rnd = mulberry(seed + 11);
  let best = null;
  for (let k = 0; k < iters; k++) {
    const [a, b, c] = [0, 1, 2].map(() => pts[Math.floor(rnd() * pts.length)]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) continue;
    n = n.map((x) => x / len);
    const cc = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    let count = 0;
    for (const p of pts) if (Math.abs(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - cc) <= thr) count++;
    if (!best || count > best.count) best = { n, c: cc, count };
  }
  if (!best) return null;
  const inl = pts.filter((p) => Math.abs(best.n[0] * p[0] + best.n[1] * p[1] + best.n[2] * p[2] - best.c) <= thr);
  const rms = Math.sqrt(inl.reduce((s, p) => s + (best.n[0] * p[0] + best.n[1] * p[1] + best.n[2] * p[2] - best.c) ** 2, 0) / inl.length);
  return { n: best.n, c: best.c, inliers: inl.length, rms };
}

function percentile(values, pct) {
  const s = [...values].sort((a, b) => a - b);
  const i = (pct / 100) * (s.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/**
 * measure_frame(): fit the reference plane inside `base` (pixel rect [x1, y1, x2, y2]), then grid `over`
 * into rows × cols, project each valid point along gravity onto the plane and keep the 5th percentile
 * of heights above the 30 mm margin per cell. Cells with under 30% valid depth are unknown.
 */
export function clearance(scene, cam, base, over, cfg = CLEAR_CFG, stride = 4) {
  const up = [0, 1, 0];
  const pts = [];
  for (let v = base[1]; v < base[3]; v += stride) for (let u = base[0]; u < base[2]; u += stride) {
    const d = depthAt(scene, cam, u, v);
    if (d.valid) pts.push(d.p);
  }
  if (pts.length < cfg.min_reference_points) return { ok: false, code: "base_sparse", reason: "Too little valid depth in the reference box", points: pts.length };
  const fit = ransacPlane(pts, cfg.ransac_threshold_mm);
  if (!fit) return { ok: false, code: "base_not_planar", reason: "Reference box is not a plane" };
  const ratio = fit.inliers / pts.length;
  let n = fit.n, c = fit.c;
  if (n[1] < 0) { n = n.map((x) => -x); c = -c; }
  const tilt = (Math.acos(Math.min(1, n[1])) * 180) / Math.PI;
  const reference = { points: pts.length, inliers: fit.inliers, ratio, rms: fit.rms, tilt };
  if (ratio < cfg.min_reference_inlier_ratio) return { ok: false, code: "base_not_planar", reason: "Reference box is not flat or holds equipment", reference };
  if (fit.rms > cfg.max_reference_rms_mm) return { ok: false, code: "base_rms", reason: `Reference fit RMS ${fit.rms.toFixed(0)} mm is too high`, reference };
  if (tilt > cfg.max_reference_tilt_deg) return { ok: false, code: "base_tilt", reason: `Reference plane tilts ${tilt.toFixed(1)}°`, reference };

  const rows = cfg.grid_rows, cols = cfg.grid_cols;
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ total: 0, valid: 0, d: [], at: [] })));
  for (let v = over[1]; v < over[3]; v += stride) for (let u = over[0]; u < over[2]; u += stride) {
    const r = Math.min(rows - 1, Math.floor(((v - over[1]) * rows) / (over[3] - over[1])));
    const k = Math.min(cols - 1, Math.floor(((u - over[0]) * cols) / (over[2] - over[0])));
    const cell = cells[r][k];
    cell.total++;
    const d = depthAt(scene, cam, u, v);
    if (!d.valid) continue;
    cell.valid++;
    const h = (n[0] * d.p[0] + n[1] * d.p[1] + n[2] * d.p[2] - c) / n[1];
    if (h >= cfg.surface_margin_mm) { cell.d.push(h); cell.at.push(d.p); }
  }
  const values = [], states = [], locs = [];
  for (let r = 0; r < rows; r++) {
    values.push([]); states.push([]); locs.push([]);
    for (let k = 0; k < cols; k++) {
      const cell = cells[r][k];
      if (!cell.total || cell.valid / cell.total < cfg.min_cell_valid_ratio) { values[r].push(null); states[r].push("unknown"); locs[r].push(null); continue; }
      if (!cell.d.length) { values[r].push(null); states[r].push("excluded"); locs[r].push(null); continue; }
      const val = percentile(cell.d, cfg.cell_percentile);
      let pick = 0;
      cell.d.forEach((h, i) => { if (Math.abs(h - val) < Math.abs(cell.d[pick] - val)) pick = i; });
      values[r].push(val); states[r].push("measured"); locs[r].push(cell.at[pick]);
    }
  }
  const flat = states.flat();
  const measured = flat.filter((s) => s === "measured").length, unknown = flat.filter((s) => s === "unknown").length;
  const unknownRatio = measured + unknown ? unknown / (measured + unknown) : 0;
  if (measured + unknown === 0) return { ok: false, code: "over_none", reason: "Nothing above the reference plane in the upper box", reference };
  if (1 - unknownRatio < cfg.min_known_ratio) return { ok: false, code: "over_sparse", reason: "Too little valid depth above; unknown space is not clearance", reference, grid: { rows, cols, values, states } };
  let low = null;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) if (states[r][k] === "measured" && (!low || values[r][k] < values[low[0]][low[1]])) low = [r, k];
  if (!low) return { ok: false, code: "over_none", reason: "Nothing above the reference plane in the upper box", reference };
  const warnings = [];
  if (unknown) {
    warnings.push(`Unknown area ${Math.round(unknownRatio * 100)}%: the lowest limit may lie in an unmeasured part; check on site`);
    const near = [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr || dc) && states[low[0] + dr]?.[low[1] + dc] === "unknown"));
    if (near) warnings.push("The lowest cell borders unmeasured cells; the true minimum may be smaller");
  }
  return { ok: true, min: values[low[0]][low[1]], lowest: low, at: locs[low[0]][low[1]], grid: { rows, cols, values, states, locs }, reference, unknownRatio, plane: { n, c }, warnings };
}

export const spatialCoreScript = `
const SC = (() => {
const CAR_TOP_Y = ${CAR_TOP_Y}, CLEAR_CFG = ${JSON.stringify(CLEAR_CFG)}, IMG = ${JSON.stringify(IMG)}, POSE = ${JSON.stringify(POSE)};
${[sceneOf, cameraOf, project, rayOf, hitBox, depthAt, twoPoint, mulberry, ransacPlane, percentile, clearance].map(String).join("\n")}
const hash = ${hash.toString()};
return { CAR_TOP_Y, CLEAR_CFG, IMG, POSE, sceneOf, cameraOf, project, rayOf, depthAt, twoPoint, clearance, hash };
})();
`;
