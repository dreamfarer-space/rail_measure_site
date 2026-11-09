// Cart B (spatial measurement) in the anatomy isometric style.
// Run: node build.mjs          → spatial.html (light), spatial.svg, spatial-embed.json, spatial-cart.svg
//      node build.mjs --dark   → spatial-dark.html
//
// Same crawler as Cart A (two timing-belt tracks clamp the T-rail blade, end rollers on the rail face,
// jaws with amber pads at the upper end), drawn from the photos in docs/anatomy/real/IMG_1092–1097.
// Payload, from the lower end up: a servo box carrying a turntable disc on four standoffs, a servo in a
// U-bracket that tilts the OAK-D Pro W, the Lubancat RK3588 enclosure, the tall battery box and two
// Wi-Fi antennas. The cart stands on the rail above an elevator car top; the camera's view volume, the
// patch of car top it covers and the IR speckle on that patch follow the servo angle.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 600;
const HEIGHT = 600;

// ---- model ------------------------------------------------------------------------------------
const MM = 3.5; // 1 unit ≈ 3.5 mm, the cart's own scale
const CZ = 72; // cart lower end above the car-top surface (z = 0)
const Y0 = -4.5; // cart plate surface (same as Cart A)
const AXIS = [0, Y0 + 35, 15]; // servo horn axis in cart coordinates (runs along x)
const SWING = 13; // horn axis → camera centre
const HFOV = 127; // OAK-D Pro W stereo pair, degrees
const VFOV = 79.5;
const RANGE_MM = [200, 12000]; // configured depth envelope
const CAR = { x: -72, y: 2, w: 144, d: 140, r: 2 }; // car-top plan
// web/src/lib/robot.ts: servo 5 pans the turntable 0–180°, servo 6 tilts the bracket 45–135°; 90/90 looks
// straight out of the plate into the shaft, tilt 45 leans toward the lower end of the cart (down the rail).
const PAN = [0, 180];
const TILT = [45, 135];

const P0 = k.fitProjection(
  [...k.boxCorners(CAR, -14, 0), [-20, -70, 236], [24, 36, CZ + 98], [-90, 0, 46], [0, -40, -14]],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 50 },
);
let P = P0;

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const box = (x0, x1, y0, y1) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.6 });
const B = (x0, x1, y0, y1, z0, z1, bevel = 0.3) => k.slabOf(box(x0, x1, y0, y1), z0, z1 - z0, P, 2, bevel);
const FX = () => G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]); // polygon (y, z) along x
const FY = () => G.frameOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); // polygon (z, x) along y
const discX = (c, s0, s1, r) => G.disc(s0, s1, r, G.frameAlong(c, [1, 0, 0]), P);
const discY = (c, s0, s1, r) => G.disc(s0, s1, r, G.frameAlong(c, [0, 1, 0]), P);
const poly = (pts) => k.pathOf(pts.map(at), true);
const hole = (pts) => `<path class="iso-shade" data-shade="0" d="${poly(pts)}"/>` + L(poly(pts), { tone: "lo" });
const roundRect = (a0, a1, b0, b1, r, n = 6) => {
  const pts = [];
  const arc = (ca, cb, from) => {
    for (let i = 0; i <= n; i++) {
      const t = from + (i / n) * (Math.PI / 2);
      pts.push([ca + r * Math.cos(t), cb + r * Math.sin(t)]);
    }
  };
  arc(a1 - r, b1 - r, 0);
  arc(a0 + r, b1 - r, Math.PI / 2);
  arc(a0 + r, b0 + r, Math.PI);
  arc(a1 - r, b0 + r, (3 * Math.PI) / 2);
  return pts;
};

// ---- shaft: wall column, brackets, T-rail ------------------------------------------------------
const COLUMN = { x: -12, y: -66, w: 24, d: 14, r: 1 };
const RAIL_Z = [-14, 236];
const BRACKETS = [40, 196];
function column() {
  const out = [];
  out.push(S(k.slabOf(COLUMN, RAIL_Z[0], RAIL_Z[1] - RAIL_Z[0] + 6, P, 3, 0.5), { tone: "lo", inner: L(k.sideSeam(COLUMN, 118, P, 3), { tone: "faint" }) }));
  for (const z of BRACKETS) out.push(D([[-7, z + 8], [7, z + 8], [-7, z - 3], [7, z - 3]].map(([x, zz]) => at([x, COLUMN.y + COLUMN.d, zz])), { size: 0.45 }));
  for (const z of BRACKETS) {
    const plan = box(-20, 20, COLUMN.y + COLUMN.d, -36);
    out.push(S(k.slabOf(plan, z, 5, P, 2, 0.4), { tone: "mid" }));
    out.push(L(k.lineOnTop([plan.x, plan.y + 4], [plan.x + plan.w, plan.y + 4], z + 5, P), { tone: "faint" }));
    out.push(D([at([-16, plan.y + plan.d / 2 + 1, z + 5]), at([16, plan.y + plan.d / 2 + 1, z + 5])], { size: 0.45 }));
  }
  return out.join("");
}
const FLANGE = [[-36, -18], [-30, -18], [-30, 18], [-36, 18]];
const BLADE = [[-30, -3], [-8, -3], [-8, 3], [-30, 3]];
const railFrame = () => G.frameOf([0, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]); // polygon (y, x) along z
const rail = (polyYX, z0, z1, tone = "mid") => S(G.prismOf(railFrame(), polyYX, z0, z1, P), { tone });
function railClips(side) {
  const out = [];
  for (const z of BRACKETS) {
    const x0 = side < 0 ? -18 : 10;
    out.push(S(k.slabOf(box(x0, x0 + 8, -30, -27.6), z - 2, 9, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([x0 + 4, -27.6, z + 2.5])], { size: 0.5, tone: "hi" }));
  }
  return out.join("");
}

// ---- car top -----------------------------------------------------------------------------------
function carTop() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CAR, -14, 10, P)}"/>`];
  out.push(S(k.slabOf(CAR, -14, 14, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(CAR, -7, P, 6), { tone: "faint" }) }));
  // tread plate: diamond studs in a field inset from the edge
  const studs = [];
  for (let x = CAR.x + 10; x < CAR.x + CAR.w - 6; x += 8) for (let y = CAR.y + 10; y < CAR.y + CAR.d - 6; y += 8) studs.push(at([x + ((y / 8) % 2 ? 4 : 0), y, 0]));
  out.push(L(k.planOutline(k.insetPlan(CAR, 5), 0, P, 6), { tone: "lo" }));
  out.push(D(studs, { size: 0.32, tone: "lo" }));
  out.push(D(k.corners(CAR, 2.6).map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}
// guide shoe on the car crosshead: two cheeks either side of the blade and a cap at the tip
function shoe(side) {
  const out = [];
  if (side < 0) {
    out.push(S(B(-16, 16, -6, 6, 0, 4, 0.4), { tone: "lo" }));
    out.push(S(B(-8, -3.4, -26, -4, 4, 18, 0.4), { tone: "mid" }));
    return out.join("");
  }
  out.push(S(B(3.4, 8, -26, -4, 4, 18, 0.4), { tone: "mid" }));
  out.push(S(B(-8, 8, -8, -4, 4, 18, 0.4), { tone: "mid", inner: L(k.sideSeam(box(-8, 8, -8, -4), 11, P, 2), { tone: "faint" }) }));
  out.push(D([[8, -22, 8], [8, -22, 14], [8, -8, 8], [8, -8, 14]].map(at), { size: 0.45 }));
  out.push(D([at([-12, 4, 4]), at([12, 4, 4])], { size: 0.5 }));
  return out.join("");
}
// balustrade along the −x edge and the back edge: posts, top rail, knee rail, toe board
function balustrade() {
  const out = [];
  const x = CAR.x + 4;
  const ys = [CAR.y + 4, CAR.y + 56, CAR.y + CAR.d - 4];
  out.push(S(B(x - 1, x + 1, CAR.y + 2, CAR.y + CAR.d - 2, 0, 6, 0.2), { tone: "lo" }));
  out.push(S(B(x - 1, -22, CAR.y + 3, CAR.y + 5, 0, 6, 0.2), { tone: "lo" }));
  for (const y of ys) out.push(S(k.cylinder(x, y, 1.3, 0, 46, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(-24, CAR.y + 4, 1.3, 0, 46, P, 16), { tone: "mid" }));
  const railAt = (z, r) => {
    const along = S(G.disc(0, ys[2] - ys[0], r, G.frameAlong([x, ys[0], z], [0, 1, 0]), P), { tone: "mid", crease: "none" });
    const back = S(G.disc(0, -24 - x, r, G.frameAlong([x, CAR.y + 4, z], [1, 0, 0]), P), { tone: "mid", crease: "none" });
    return back + along;
  };
  out.push(railAt(24, 0.9), railAt(46, 1.2));
  for (const y of ys) out.push(S(k.cylinder(x, y, 1.9, 44.4, 2.4, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(-24, CAR.y + 4, 1.9, 44.4, 2.4, P, 16), { tone: "mid" }));
  return out.join("");
}
// car-top inspection station: box, stop button, toggle, socket, cable gland
function station() {
  const out = [];
  const st = box(22, 46, 70, 88);
  out.push(S(k.slabOf(st, 0, 16, P, 2, 0.6), { tone: "mid", inner: L(k.sideSeam(st, 12, P, 2), { tone: "faint" }) }));
  out.push(S(k.cylinder(30, 79, 3.2, 16, 1.2, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(30, 79, 2.6, 17.2, 2.2, P, 24, 0.3), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(39, 75, 1.6, 16, 1, P, 16), { tone: "lo" }));
  out.push(S(B(38.4, 39.6, 74.4, 75.6, 17, 20, 0.1), { tone: "mid" }));
  out.push(L(k.planOutline(box(36, 43, 81, 86), 16, P, 2), { tone: "lo" }));
  out.push(D([at([38, 83.5, 16]), at([41, 83.5, 16])], { size: 0.45 }));
  out.push(D(k.corners(st, 2).map(([x, y]) => at([x, y, 16])), { size: 0.45 }));
  out.push(S(discX([46, 80, 6], 0, 1.6, 1.6), { tone: "lo" }));
  return out.join("");
}

// ---- cart chassis (as Cart A) ------------------------------------------------------------------
const BELT = { x0: 3.4, x1: 18.6, z0: 9, z1: 71, y0: -13.5, y1: -6.5 };
const CH = { z0: 8, z1: 72, y0: -14.5, y1: Y0 - 1 };
function beltBlock(sx) {
  const r = (BELT.x1 - BELT.x0) / 2;
  const cx = sx * (BELT.x0 + r);
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push([BELT.z1 - r + r * Math.sin((i / 12) * Math.PI), cx + r * Math.cos((i / 12) * Math.PI)]);
  for (let i = 0; i <= 12; i++) pts.push([BELT.z0 + r - r * Math.sin((i / 12) * Math.PI), cx - r * Math.cos((i / 12) * Math.PI)]);
  const out = [S(G.prismOf(FY(), pts, BELT.y0, BELT.y1, P), { tone: "lo" })];
  const teeth = [];
  const V = k.towardViewer(P);
  for (let i = 1; i < 24; i++) {
    const t = (i / 24) * Math.PI;
    const n = [-Math.cos(t), 0, Math.sin(t)];
    if (n[0] * V[0] + n[2] * V[2] < 0.15) continue;
    const x = cx - r * Math.cos(t);
    const z = BELT.z1 - r + r * Math.sin(t);
    teeth.push(k.segment([x, BELT.y0, z], [x, BELT.y1, z], P));
  }
  out.push(L(teeth.join(""), { tone: "faint" }));
  return out.join("");
}
function chassisSide(sx) {
  const out = [];
  out.push(S(B(sx < 0 ? -20 : 3.2, sx < 0 ? -3.2 : 20, CH.y0, CH.y0 + 1, CH.z0, CH.z1), { tone: "lo" }));
  if (sx < 0) {
    out.push(S(B(-20, -18.8, CH.y0, CH.y1, CH.z0, CH.z1), { tone: "mid" }));
    out.push(beltBlock(-1));
    return out.join("");
  }
  out.push(beltBlock(1));
  const x = 20;
  const slot = (z0, z1) => roundRect(z0, z1, -8.4, -6.4, 1, 4).map(([z, y]) => [x, y, z]);
  const tri1 = [[x, -9.6, 12], [x, -12.8, 12], [x, -12.8, 37]];
  const tri2 = [[x, -9.6, 68], [x, -12.8, 68], [x, -12.8, 43]];
  const teeth = [];
  for (const [z0, z1] of [[13, 37], [43, 67]]) for (let z = z0 + 1.2; z < z1 - 0.8; z += 1.4) teeth.push(k.segment([x, -8.4, z], [x, -6.4, z], P));
  for (let z = 12.9; z < 36; z += 1.4) teeth.push(k.segment([x, -12.8, z], [x, -12.8 + (3.2 * (37 - z)) / 25, z], P));
  for (let z = 67.1; z > 44; z -= 1.4) teeth.push(k.segment([x, -12.8, z], [x, -12.8 + (3.2 * (z - 43)) / 25, z], P));
  const inner = [slot(13, 37), slot(43, 67), tri1, tri2].map(hole).join("") + L(teeth.join(""), { tone: "faint" });
  out.push(S(B(18.8, 20, CH.y0, CH.y1, CH.z0, CH.z1), { tone: "mid", inner }));
  out.push(D([[x, -10.8, 9.6], [x, -10.8, 70.4], [x, -7.4, 40], [x, -11, 40]].map(at), { size: 0.45 }));
  return out.join("");
}
function tipRoller(z) {
  const out = [];
  out.push(S(B(-3.6, -2.6, -7.6, Y0 - 1, z - 1.4, z + 1.4, 0.2), { tone: "mid" }));
  out.push(S(discX([0, -6.8, z], -2.5, 2.5, 1.2), { tone: "hi", crease: "lo" }));
  out.push(S(B(2.6, 3.6, -7.6, Y0 - 1, z - 1.4, z + 1.4, 0.2), { tone: "mid" }));
  out.push(D([at([3.6, -6.8, z])], { size: 0.45 }));
  return out.join("");
}
const PAD = [[-12.5, 85], [-11.5, 84], [-6.4, 84], [-6.4, 94.6], [-7.4, 96], [-11.5, 96], [-12.5, 95]];
function jawSide(sx) {
  const [a0, a1] = sx < 0 ? [-9.2, -5.2] : [5.2, 9.2];
  const [p0, p1] = sx < 0 ? [-5.2, -3.2] : [3.2, 5.2];
  const arm = S(B(a0, a1, -13.4, Y0, 82.6, 91, 0.4), { tone: "mid", inner: L(k.segment([sx < 0 ? a0 : a1, -13.4, 87], [sx < 0 ? a0 : a1, Y0, 87], P), { tone: "faint" }) });
  const pad = S(G.prismOf(FX(), PAD, p0, p1, P), { tone: "hi", crease: "lo" });
  return sx < 0 ? arm + pad : pad + arm + D([at([a1, -10, 89.4]), at([a1, -10, 84.4])], { size: 0.45 });
}
function jawBridge() {
  const out = [];
  out.push(S(B(-11, 11, Y0, Y0 + 4, 79, 85, 0.5), { tone: "mid" }));
  out.push(hole([[-6, Y0 + 4, 80.4], [6, Y0 + 4, 80.4], [6, Y0 + 4, 83.6], [-6, Y0 + 4, 83.6]]));
  out.push(S(discX([0, Y0 + 3.4, 82], -3.4, 3.4, 1.1), { tone: "hi", crease: "lo" }));
  out.push(D([at([-8.6, Y0 + 4, 82]), at([8.6, Y0 + 4, 82])], { size: 0.5 }));
  return out.join("");
}

// ---- Cart B payload ----------------------------------------------------------------------------
// Lubancat RK3588 on the enclosure top: PCB, SoC heat spreader, blue GPIO header, USB/Ethernet stack
const SBC_Y = Y0 + 16;
function lubancat() {
  const out = [];
  const yb = SBC_Y;
  out.push(S(B(-16, 16, yb, yb + 0.6, 34, 55, 0.2), { tone: "mid" }));
  out.push(D([[-14.4, 35.6], [14.4, 35.6], [-14.4, 53.4], [14.4, 53.4]].map(([x, z]) => at([x, yb + 0.6, z])), { size: 0.45 }));
  // GPIO header along the −x edge, blue body with pins
  out.push(S(B(-15.2, -12.8, yb + 0.6, yb + 1.6, 36, 52, 0.1), { tone: "lo", crease: "none" }));
  const pins = [];
  for (let i = 0; i < 18; i++) for (const x of [-14.6, -13.4]) pins.push(at([x, yb + 1.6, 36.6 + i * 0.85]));
  out.push(D(pins, { size: 0.26, tone: "mid" }));
  // SoC with a finned spreader
  const fins = [];
  for (let z = 41.4; z < 49; z += 1.3) fins.push(k.segment([-4, yb + 2.6, z], [4, yb + 2.6, z], P));
  out.push(S(B(-4.6, 4.6, yb + 0.6, yb + 2.6, 40.6, 49.4, 0.3), { tone: "mid", inner: L(fins.join(""), { tone: "faint" }) }));
  // eMMC, PMIC, RAM
  out.push(S(B(-10.6, -6.4, yb + 0.6, yb + 1.2, 38, 44, 0.1), { tone: "lo", crease: "none" }));
  out.push(S(B(-10.6, -6.4, yb + 0.6, yb + 1.2, 45.6, 51.6, 0.1), { tone: "lo", crease: "none" }));
  out.push(S(B(6.4, 10.2, yb + 0.6, yb + 1.1, 47, 51, 0.1), { tone: "lo", crease: "none" }));
  // ports on the +x edge: Ethernet, two USB-A, USB-C
  out.push(S(B(10.6, 16.6, yb + 0.6, yb + 4.6, 35, 39.4, 0.2), { tone: "mid" }));
  out.push(hole([[16.6, yb + 1.4, 36], [16.6, yb + 3.8, 36], [16.6, yb + 3.8, 38.4], [16.6, yb + 1.4, 38.4]]));
  for (const z of [40.2, 44.2]) {
    out.push(S(B(11, 16.6, yb + 0.6, yb + 3.8, z, z + 3.4, 0.2), { tone: "mid" }));
    out.push(L(k.segment([16.6, yb + 2.2, z + 0.6], [16.6, yb + 2.2, z + 2.8], P), { tone: "lo" }));
  }
  out.push(S(B(13.6, 16.6, yb + 0.6, yb + 1.8, 49, 52, 0.2), { tone: "mid" }));
  return out.join("");
}
// Wi-Fi antennas lying across the upper end, held by a strap to the battery box
function antennas() {
  const out = [];
  for (const [y, z] of [[Y0 + 8, 88], [Y0 + 13.4, 90.6]]) {
    out.push(S(G.disc(-26, 22, 1.5, G.frameAlong([0, y, z], [1, 0, 0]), P), { tone: "lo", crease: "none" }));
    out.push(S(G.disc(22, 25, 1.9, G.frameAlong([0, y, z], [1, 0, 0]), P), { tone: "mid" }));
    out.push(S(G.disc(25, 27, 1.1, G.frameAlong([0, y, z], [1, 0, 0]), P), { tone: "hi", crease: "lo" }));
  }
  out.push(S(B(-3, 3, Y0 + 5.6, Y0 + 15.8, 85, 93.2, 0.3), { tone: "mid" }));
  return out.join("");
}

function cartBack() {
  return chassisSide(-1) + jawSide(-1);
}
function cartFront() {
  const out = [];
  out.push(chassisSide(1));
  out.push(tipRoller(-6), tipRoller(75));
  // plate: rounded upper corners, a long round nose at the lower (camera) end
  const outline = [];
  const arcPts = (cz, cx, r, a0, a1, n = 6) => { for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n; outline.push([cz + r * Math.cos(t), cx + r * Math.sin(t)]); } };
  arcPts(78, -16, 5, -Math.PI / 2, 0);
  arcPts(78, 16, 5, 0, Math.PI / 2);
  for (let i = 0; i <= 16; i++) { const t = Math.PI / 2 + (i / 16) * Math.PI; outline.push([10 + 13 * Math.cos(t), 21 * Math.sin(t)]); }
  out.push(S(G.prismOf(FY(), outline, Y0 - 1, Y0, P), { tone: "mid" }));
  out.push(D([[-17, -2], [17, -2], [-17, 77], [17, 77], [-15, 40], [15, 40], [-10, -7], [10, -7]].map(([x, z]) => at([x, Y0, z])), { size: 0.45 }));

  // servo box (pan servo inside), switch and power button on the +x face
  const sb = box(-18, 18, Y0, Y0 + 20);
  out.push(S(B(-18, 18, Y0, Y0 + 20, 2, 30, 0.6), { tone: "mid", inner: L(k.sideSeam(sb, 22, P, 2), { tone: "faint" }) + hole([[18, Y0 + 5, 8], [18, Y0 + 9, 8], [18, Y0 + 9, 14], [18, Y0 + 5, 14]]) }));
  out.push(S(G.prismOf(FX(), [[Y0 + 5.6, 9.6], [Y0 + 8.4, 9.6], [Y0 + 8.4, 12.4], [Y0 + 5.6, 12.4]], 18, 18.8, P), { tone: "hi", crease: "lo" }));
  out.push(S(discX([18, Y0 + 14, 11], 0, 0.8, 1.7), { tone: "mid" }));
  out.push(L(G.circleOf(G.frameAlong([18.8, Y0 + 14, 11], [1, 0, 0]), 0, 0.8, P), { tone: "lo" }));
  out.push(D([[18, Y0 + 17, 4.4], [18, Y0 + 17, 27.6], [18, Y0 + 3, 4.4], [18, Y0 + 3, 27.6]].map(at), { size: 0.45 }));

  // Lubancat enclosure: walls round a recess, board at the recess floor
  const enc = box(-20, 20, Y0, Y0 + 16);
  out.push(S(B(-20, 20, Y0, Y0 + 16, 30, 58, 0.5), { tone: "mid", inner: L(k.sideSeam(enc, 44, P, 2), { tone: "faint" }) + hole([[20, Y0 + 4, 46], [20, Y0 + 8, 46], [20, Y0 + 8, 53], [20, Y0 + 4, 53]]) }));
  out.push(lubancat());
  out.push(S(B(-20, -17, SBC_Y, SBC_Y + 4, 30, 58, 0.3), { tone: "mid" }));
  out.push(S(B(-17, 20, SBC_Y, SBC_Y + 4, 30, 32.6, 0.3), { tone: "mid" }));

  // battery box (tallest), seam and screws
  const bat = box(-20, 20, Y0, Y0 + 30);
  out.push(S(B(-20, 20, Y0, Y0 + 30, 58, 80, 0.7), { tone: "mid", inner: L(k.sideSeam(bat, 69, P, 2), { tone: "faint" }) }));
  out.push(D([[20, Y0 + 26, 61], [20, Y0 + 26, 77], [20, Y0 + 4, 61], [20, Y0 + 4, 77]].map(at), { size: 0.45 }));
  out.push(D([[-16.5, 61.5], [16.5, 61.5], [-16.5, 76.5], [16.5, 76.5]].map(([x, z]) => at([x, Y0 + 30, z])), { size: 0.45 }));
  out.push(S(discX([20, Y0 + 12, 64], 0, 1, 1.8), { tone: "mid" }));
  out.push(L(G.circleOf(G.frameAlong([21, Y0 + 12, 64], [1, 0, 0]), 0, 0.8, P), { tone: "lo" }));

  out.push(jawBridge(), jawSide(1), antennas());

  // turntable: four standoffs from the servo box to a disc, pan bearing ring, bracket base
  for (const [x, z] of [[-9, 6], [9, 6], [-9, 24], [9, 24]]) out.push(S(G.disc(0, 4, 0.9, G.frameAlong([x, Y0 + 20, z], [0, 1, 0]), P), { tone: "lo" }));
  out.push(S(discY([0, Y0 + 24, 15], 0, 1, 14), { tone: "mid" }));
  out.push(L(G.circleOf(G.frameAlong([0, Y0 + 25, 15], [0, 1, 0]), 0, 11, P), { tone: "faint" }));
  out.push(D([[-9, 6], [9, 6], [-9, 24], [9, 24]].map(([x, z]) => at([x, Y0 + 25, z])), { size: 0.5 }));
  return out.join("");
}

// ---- the pan/tilt head (rebuilt in the browser for each pose) ----------------------------------
// Pan turns the disc about the plate normal (+y); tilt turns the bracket about the horn axis, which pans with
// the disc. Head frame: a = horn axis, u = optical axis, v = camera "up". world = horn axis centre.
const HEAD = { r: SWING, half: 16, depth: 4.6, height: 5.6, armX: [11.2, 12.6], body: [-10, 0.5, -5, 5] };
function headParts(pan, tilt, PP, world, port) {
  const ps = Math.sin(((pan - 90) * Math.PI) / 180), pc = Math.cos(((pan - 90) * Math.PI) / 180);
  const th = (tilt * Math.PI) / 180;
  const ax = [pc, 0, -ps];
  const az = [ps, 0, pc];
  const u = [-Math.cos(th) * ps, Math.sin(th), -Math.cos(th) * pc];
  const v = [Math.sin(th) * ps, Math.cos(th), Math.sin(th) * pc];
  const o = world;
  const F = { o, a: ax, u, v };
  const Fs = { o, a: ax, u: [0, 1, 0], v: az };
  const V = G.viewOf(PP);
  const rr = HEAD.r;
  const parts = [];
  const add = (svg, centre) => parts.push({ svg, d: k.depthOf(centre, PP) });
  const p3 = (s, a, b, f = F) => [o[0] + f.a[0] * s + f.u[0] * a + f.v[0] * b, o[1] + f.a[1] * s + f.u[1] * a + f.v[1] * b, o[2] + f.a[2] * s + f.u[2] * a + f.v[2] * b];
  // tilt servo lying on the disc: body, mounting ears with screws, horn hub
  {
    const [y0, y1, z0, z1] = HEAD.body;
    const body = [[y0, z0], [y1, z0], [y1, z1], [y0, z1]];
    const ears = [[-3, z0 + 0.6], [-2, z0 + 0.6], [-2, z1 - 0.6], [-3, z1 - 0.6]];
    const svg = k.solidSvg(G.prismOf(Fs, body, -10, 10, PP), { tone: "lo" }) + k.solidSvg(G.prismOf(Fs, ears, -13, 13, PP), { tone: "lo" }) +
      k.dotsSvg([[-12, -3], [-12, 3], [12, -3], [12, 3]].map(([s, b]) => k.iso(p3(s, -2, b, Fs), PP)), { size: 0.4 });
    add(svg, p3(0, -6, 0, Fs));
    const hub = { o: p3(10, 0, 0), a: ax, u: [0, 1, 0], v: az };
    add(k.solidSvg(G.disc(0, 1.2, 3.2, G.frameAlong(hub.o, ax), PP), { tone: "mid" }), p3(10.6, 0, 0));
  }
  // bracket arms: from the horn axis to the camera back, one each side
  for (const [x0, x1] of [[-HEAD.armX[1], -HEAD.armX[0]], [HEAD.armX[0], HEAD.armX[1]]]) {
    const arm = roundRect(-2.6, rr - HEAD.depth, -3, 3, 2.6, 5);
    const end = x1 > 0 ? x1 : x0;
    const svg = k.solidSvg(G.prismOf(F, arm, x0, x1, PP), { tone: "mid" }) + k.dotsSvg([k.iso(p3(end, 0, 0), PP), k.iso(p3(end, rr - HEAD.depth - 2.2, 0), PP)], { size: 0.45 });
    add(svg, p3((x0 + x1) / 2, rr / 2, 0));
  }
  // servo horn on the +x arm
  add(k.solidSvg(G.disc(0, 0.8, 2.2, G.frameAlong(p3(HEAD.armX[1], 0, 0), ax), PP), { tone: "hi", crease: "lo" }), p3(HEAD.armX[1] + 1, 0, 0));
  // camera: body, heatsink fins on the back, stereo pair, colour lens and IR projector on the front
  {
    const out = [];
    const facing = G.dot3(u, V) > 0;
    const fins = [];
    for (let b = -4.2; b <= 4.21; b += 1.4) {
      const fin = [[rr - HEAD.depth - 2, b - 0.32], [rr - HEAD.depth, b - 0.32], [rr - HEAD.depth, b + 0.32], [rr - HEAD.depth - 2, b + 0.32]];
      fins.push(k.solidSvg(G.prismOf(F, fin, -10, 10, PP), { tone: "mid", crease: "none" }));
    }
    const lensAt = (s, r1, r2) => {
      const Fl = G.frameAlong(p3(s, rr + HEAD.depth, 0.6), u);
      return k.solidSvg(G.disc(0, 0.5, r1, Fl, PP), { tone: "mid" }) + k.solidSvg(G.disc(0.5, 0.9, r2, Fl, PP), { tone: "lo" });
    };
    const front = [lensAt(-11.6, 2.3, 1.4), lensAt(11.6, 2.3, 1.4), lensAt(-3.2, 2, 1.2),
      k.solidSvg(G.prismOf(F, [[rr + HEAD.depth, -0.6], [rr + HEAD.depth + 0.3, -0.6], [rr + HEAD.depth + 0.3, 1.8], [rr + HEAD.depth, 1.8]], 3.2, 7.6, PP), { tone: "lo", crease: "none" })];
    if (facing) out.push(...fins);
    else out.push(...front);
    const body = roundRect(rr - HEAD.depth, rr + HEAD.depth, -HEAD.height, HEAD.height, 1.6, 4);
    const seam = k.lineSvg(k.pathOf([k.iso(p3(-HEAD.half, rr + HEAD.depth, -HEAD.height + 1.2), PP), k.iso(p3(HEAD.half, rr + HEAD.depth, -HEAD.height + 1.2), PP)]), { tone: "faint" });
    out.push(k.solidSvg(G.prismOf(F, body, -HEAD.half, HEAD.half, PP), { tone: "hi", crease: "lo", inner: facing ? seam : "" }));
    out.push(...(facing ? front : fins));
    // USB-C lead from the camera's +x end to the Lubancat
    if (port) out.push(k.wireSvg(k.iso(p3(HEAD.half, rr - 1.5, -1), PP), k.iso(port[1], PP), { via: [k.iso(port[0], PP)], tone: "lo", size: 0.6 }));
    add(out.join(""), p3(0, rr, 0));
  }
  parts.sort((a, b) => a.d - b.d);
  const lens = p3(-3.2, rr + HEAD.depth + 0.9, 0.6);
  return { svg: parts.map((q) => q.svg).join(""), lens, dir: u, up: v, side: ax };
}

// ---- assemble ----------------------------------------------------------------------------------
const OFF = [0, 0, CZ];
const toWorld = (p) => [p[0] + OFF[0], p[1] + OFF[1], p[2] + OFF[2]];
const worldAxis = toWorld(AXIS);
const PORT = [toWorld([19, Y0 + 26, 30]), toWorld([16.6, SBC_Y + 2.2, 41.9])];
const POSE0 = [90, 60];
const head0 = headParts(POSE0[0], POSE0[1], P, worldAxis, PORT);

// speckle sites: a fixed scatter over the car top, shown where the view volume lands
const rand = (() => {
  let s = 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();
const SPECKLE = [];
for (let i = 0; i < 900; i++) SPECKLE.push([+(CAR.x + 4 + rand() * (CAR.w - 8)).toFixed(1), +(CAR.y + 4 + rand() * (CAR.d - 8)).toFixed(1)]);

const scene = (opts = {}) => [
  column(),
  rail(FLANGE, RAIL_Z[0], RAIL_Z[1]),
  railClips(-1),
  shoe(-1),
  rail(BLADE, RAIL_Z[0], 0),
  carTop(),
  `<g data-part="foot">${opts.foot || ""}</g>`,
  balustrade(),
  station(),
  `<g data-part="cart-back" transform="${k.translateAlong(P, OFF)}">${cartBack()}</g>`,
  rail(BLADE, 0, RAIL_Z[1]),
  railClips(1),
  shoe(1),
  `<g data-part="cart" transform="${k.translateAlong(P, OFF)}">${cartFront()}</g>`,
  `<g data-part="head">${head0.svg}</g>`,
  `<g data-part="rays"></g>`,
];

const LABEL =
  "Cart B on the guide rail above an elevator car top. Two timing-belt tracks clamp the rail blade; the jaws and amber pads hold the upper end. A servo on a turntable tilts the OAK-D Pro W stereo camera; its view volume, the patch of car top it covers and the infrared speckle on that patch follow the servo angle.";
const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: scene() });

// ---- live script -------------------------------------------------------------------------------
const lathe = readFileSync(join(HERE, "..", "kit", "lathe.mjs"), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const kitScript = readFileSync(join(HERE, "..", "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const live = `
const P = ${JSON.stringify(P0)};
const k = { iso, depthOf, solidSvg, lineSvg, dotsSvg, pathOf, wireSvg };
const HEAD = ${JSON.stringify(HEAD)}, AXIS_W = ${JSON.stringify(worldAxis)}, PORT = ${JSON.stringify(PORT)};
const CAR = ${JSON.stringify(CAR)}, MM = ${MM}, HFOV = ${HFOV}, VFOV = ${VFOV}, RANGE = ${JSON.stringify(RANGE_MM)};
const PAN = ${JSON.stringify(PAN)}, TILT = ${JSON.stringify(TILT)}, POSE0 = ${JSON.stringify(POSE0)};
const SPECKLE = ${JSON.stringify(SPECKLE)};
const roundRect = ${roundRect.toString()};
const headParts = ${headParts.toString()};
const stage = document.querySelector(".sp-stage");
const svgEl = stage.querySelector("svg");
const headG = svgEl.querySelector('[data-part="head"]');
const footG = svgEl.querySelector('[data-part="foot"]');
const raysG = svgEl.querySelector('[data-part="rays"]');
const readout = document.querySelector("[data-sp-readout]") || document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const tanH = Math.tan((HFOV / 2) * Math.PI / 180), tanV = Math.tan((VFOV / 2) * Math.PI / 180);
const crossv = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotv = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scr = (p) => iso(p, P);
const pt = (p) => scr(p).map((v) => v.toFixed(2)).join(" ");
// keep the part of a plan polygon (on z = 0) where f(p) >= 0
const clip = (poly, f) => {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
};
function footprint(h) {
  const { lens, dir, up, side } = h;
  const corner = (sx, sy) => [0, 1, 2].map((i) => dir[i] + side[i] * sx * tanH + up[i] * sy * tanV);
  const cs = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  let poly = [[CAR.x, CAR.y], [CAR.x + CAR.w, CAR.y], [CAR.x + CAR.w, CAR.y + CAR.d], [CAR.x, CAR.y + CAR.d]];
  for (let i = 0; i < 4 && poly.length; i++) {
    let n = crossv(cs[i], cs[(i + 1) % 4]);
    if (dotv(n, dir) < 0) n = n.map((v) => -v);
    poly = clip(poly, ([x, y]) => dotv(n, [x - lens[0], y - lens[1], -lens[2]]));
  }
  // nothing nearer than the depth envelope's near limit
  if (poly.length) poly = clip(poly, ([x, y]) => dotv(dir, [x - lens[0], y - lens[1], -lens[2]]) - RANGE[0] / MM);
  return poly;
}
const area = (poly) => Math.abs(poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function draw(pan, tilt) {
  const h = headParts(pan, tilt, P, AXIS_W, PORT);
  headG.innerHTML = h.svg;
  const poly = footprint(h);
  const { lens, dir } = h;
  let foot = "", rays = "";
  const hit = dir[2] < -1e-3 ? lens[2] / -dir[2] : Infinity;
  const centre = [lens[0] + dir[0] * hit, lens[1] + dir[1] * hit, 0];
  const onCar = isFinite(hit) && centre[0] >= CAR.x && centre[0] <= CAR.x + CAR.w && centre[1] >= CAR.y && centre[1] <= CAR.y + CAR.d;
  const lp = pt(lens);
  if (poly.length >= 3) {
    foot += '<path class="sp-foot" d="M' + poly.map(([x, y]) => pt([x, y, 0])).join("L") + 'Z"/>';
    const sign = poly.reduce((s, a, i) => { const b = poly[(i + 1) % poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) > 0 ? 1 : -1;
    const inside = (x, y) => poly.every((a, i) => { const b = poly[(i + 1) % poly.length]; return sign * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) >= 0; });
    let dots = "";
    for (const [x, y] of SPECKLE) if (inside(x, y)) { const [sx, sy] = scr([x, y, 0]); dots += "M" + (sx - 0.45).toFixed(2) + " " + sy.toFixed(2) + "a.45 .45 0 1 0 .9 0a.45 .45 0 1 0 -.9 0"; }
    foot += '<path class="sp-speckle" d="' + dots + '"/>';
    const ring = poly.map(([x, y]) => [x, y, 0]);
    rays += '<path class="sp-vol" d="' + ring.map((p, i) => "M" + lp + "L" + pt(p) + "L" + pt(ring[(i + 1) % ring.length]) + "Z").join("") + '"/>';
    rays += '<path class="sp-ray" d="' + ring.map((p) => "M" + lp + "L" + pt(p)).join("") + '"/>';
  }
  if (onCar) {
    const c = scr(centre);
    rays += '<path class="sp-axis" d="M' + lp + "L" + pt(centre) + '"/><circle class="sp-hit" r="1.6" cx="' + c[0].toFixed(2) + '" cy="' + c[1].toFixed(2) + '"/>';
  } else {
    const a = scr(lens), b = scr([lens[0] + dir[0] * 70, lens[1] + dir[1] * 70, lens[2] + dir[2] * 70]);
    rays += '<linearGradient id="sp-fade" gradientUnits="userSpaceOnUse" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"><stop offset="0" stop-color="var(--anatomy-blue)" stop-opacity=".9"/><stop offset="1" stop-color="var(--anatomy-blue)" stop-opacity="0"/></linearGradient>';
    rays += '<path class="sp-axis" style="stroke:url(#sp-fade);stroke-dasharray:none" d="M' + lp + "L" + b.map((v) => v.toFixed(2)).join(" ") + '"/>';
  }
  const l = scr(lens);
  rays += '<circle class="sp-lens" r="1.1" cx="' + l[0].toFixed(2) + '" cy="' + l[1].toFixed(2) + '"/>';
  footG.innerHTML = foot;
  raysG.innerHTML = rays;
  const cover = poly.length >= 3 ? Math.round((100 * area(poly)) / (CAR.w * CAR.d)) : 0;
  const looking = dir[2] < -0.45 ? "car top" : dir[2] > 0.45 ? "up the rail" : "across";
  const range = onCar ? Math.round(Math.hypot(centre[0] - lens[0], centre[1] - lens[1], centre[2] - lens[2]) * MM) : null;
  const rows = [["Pan · servo 5", Math.round(pan) + "°"], ["Tilt · servo 6", Math.round(tilt) + "°"], ["Looking", looking], ["Axis range", range ? range + " mm" : "no return"], ["Car top in view", cover + "%"]];
  if (readout && readout.tagName === "DL") readout.innerHTML = rows.map(([a, b], i) => "<dt>" + a + "</dt><dd" + (i === 3 && !range ? ' class="bad"' : "") + ">" + b + "</dd>").join("");
  else if (readout) readout.textContent = rows.slice(2).map((r) => r.join(" ")).join(" · ");
  stage.setAttribute("aria-valuetext", rows.map((r) => r.join(" ")).join(", "));
}
let pose = POSE0.slice(), target = POSE0.slice(), touring = !still.matches, clock = 0, last = 0, frame = 0, visible = false, idle = 0;
// idle tour: look down at the car top, lean to each side, then out across the shaft and up the rail
const TOUR = [[90, 60], [90, 45], [40, 50], [140, 50], [90, 90], [90, 135], [90, 60]];
const DWELL = 2.4;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = TOUR[Math.floor(clock / DWELL) % TOUR.length].slice(); }
  const f = still.matches ? 1 : 1 - Math.exp(-dt / 0.5);
  for (const i of [0, 1]) { pose[i] += (target[i] - pose[i]) * f; if (Math.abs(target[i] - pose[i]) < 0.05) pose[i] = target[i]; }
  draw(pose[0], pose[1]);
  frame = visible && (touring || pose[0] !== target[0] || pose[1] !== target[1]) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (pan, tilt) => {
  touring = false;
  target = [clamp(pan, PAN[0], PAN[1]), clamp(tilt, TILT[0], TILT[1])];
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const r = svgEl.getBoundingClientRect();
  const fx = clamp((event.clientX - r.left) / r.width, 0, 1);
  const fy = clamp(((event.clientY - r.top) / r.height - 0.1) / 0.75, 0, 1);
  steer(PAN[1] - fx * (PAN[1] - PAN[0]), TILT[1] - fy * (TILT[1] - TILT[0]));
});
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 5 : 15;
  let [pan, tilt] = target;
  if (event.key === "ArrowLeft") pan += step;
  else if (event.key === "ArrowRight") pan -= step;
  else if (event.key === "ArrowUp") tilt += step;
  else if (event.key === "ArrowDown") tilt -= step;
  else if (event.key === "Home") [pan, tilt] = [90, 90];
  else return;
  event.preventDefault();
  steer(pan, tilt);
});
draw(pose[0], pose[1]);
`;

const css = `
.sp-foot{fill:var(--anatomy-blue);fill-opacity:.1;stroke:var(--anatomy-blue);stroke-width:.7;stroke-linejoin:round}
.sp-speckle{fill:var(--anatomy-blue);opacity:.75}
.sp-vol{fill:var(--anatomy-blue);fill-opacity:.035;stroke:none}
.sp-ray{fill:none;stroke:var(--anatomy-blue);stroke-width:.45;stroke-opacity:.55}
.sp-axis{fill:none;stroke:var(--anatomy-blue);stroke-width:.8;stroke-dasharray:2 2}
.sp-hit{fill:var(--anatomy-blue)}
.sp-lens{fill:var(--anatomy-blue)}
.sp-stage{outline:none;cursor:ns-resize;touch-action:pan-x}
`;
const stageHtml = `<div class="sp-stage" tabindex="0" role="application" aria-label="Camera pan and tilt: arrow keys, Home looks straight out">${svg}</div>`;
// lathe.mjs shares a few helper names with iso-kit.mjs, so it gets its own scope
const script = kitScript + "\nconst G = (() => {\n" + lathe + "\nreturn { frameOf, frameAlong, prismOf, disc, viewOf, dot3, circleOf };\n})();\n" + live;
const body = k.plateHtml({
  fig: "Fig 2",
  title: "Cart B · spatial measurement",
  hint: "Point to aim the camera · ←→ pan · ↑↓ tilt",
  readout: "",
  keys: [],
  caption: "Cart B rides the rail like Cart A; the servo tilts the depth camera from down the rail, across the shaft, to up the rail.",
  body: `<style>${css}</style>${stageHtml}`,
});
const file = theme === "light" ? "spatial.html" : "spatial-dark.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Cart B", theme, body, script }));
console.log("wrote", file);

if (theme === "light") {
  writeFileSync(join(HERE, "spatial-embed.json"), JSON.stringify({ stage: stageHtml, css: k.ISO_CSS + css, script }));
  console.log("wrote spatial-embed.json");
  // cart alone on a rail stub, for the home page
  P = k.fitProjection([[-30, -40, -24], [30, 40, -24], [-30, -40, 112], [30, 40, 112], [-28, 0, 96]], 360, 420, { pad: 18, azimuth: 50 });
  const plinth = { x: -30, y: -44, w: 60, d: 84, r: 3 };
  const head = headParts(90, 60, P, AXIS, [[19, Y0 + 26, 30], [16.6, SBC_Y + 2.2, 41.9]]);
  const cartSvg = k.figureSvg({
    width: 360,
    height: 420,
    label: "Cart B: the spatial-measurement crawler with its servo-tilted depth camera",
    standalone: false,
    body: [
      `<path class="iso-halo" d="${k.haloOf(plinth, -24, 6, P)}"/>`,
      S(k.slabOf(plinth, -24, 6, P, 4, 0.8), { tone: "mid" }),
      D(k.corners(plinth, 4).map(([x, y]) => at([x, y, -18])), { size: 0.5 }),
      rail(FLANGE, -18, 104),
      cartBack(),
      rail(BLADE, -18, 104),
      cartFront(),
      head.svg,
    ],
  });
  writeFileSync(join(HERE, "spatial-cart.svg"), cartSvg);
  console.log("wrote spatial-cart.svg");
}
