// 导轨垂直度测量原理示意图（anatomy 等轴测风格）。
// 运行：node build.mjs            → verticality.html（浅色）、verticality.svg
//       node build.mjs --dark     → verticality-dark.html
//
// 结构对应现场工装：1 顶部激光器 → 2 铅垂光束 → 3 靶板（绿色亚克力 + 靶纸）→ 4 相机（靶板下方看透射光斑）
// → 5 树莓派仓 → 6 测距仪端盒（下端测距孔）→ 7 T 型导轨 → 8 爬轨小车（同步带履带夹导轨 + 上端橙色导靴夹爪）。
// 小车外形按 docs/anatomy/real/ 下的实物照片绘制。
// 偏差模型与看板一致：dX/dY = 光斑相对基准点（SET REF）的靶面位移，公差 ±3 mm（useSessionManager 默认值）。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

const WIDTH = 600;
const HEIGHT = 600;

// ---- 真实模型 --------------------------------------------------------------
const LAT = 3; // 横向放大：每 mm 偏差画 3 个单位（与靶板刻度同一比例）
const PER_M = 10; // 竖向压缩：井道 1 m = 10 个单位
const TOL_MM = 3; // 看板默认公差 dx_mm = dy_mm = 3
const RAIL_TOP = 330;
// 导轨分段（每段 5.5 m，接头处为连接板），接头处相对铅垂线的偏差 (mm)
const JOINTS = [0, 55, 110, 165, 220, 275, 330];
const DEV = [[0, -1.0], [0.6, -1.5], [1.5, 0.2], [2.6, 1.0], [1.8, 2.2], [0.4, 2.9], [-0.6, 2.1]];
const CONTACT = 40; // 履带夹持段中点相对小车下端的高度
const devAt = (z) => {
  const i = Math.max(0, Math.min(JOINTS.length - 2, JOINTS.findIndex((_, j) => z < JOINTS[j + 1])));
  const t = Math.max(0, Math.min(1, (z - JOINTS[i]) / (JOINTS[i + 1] - JOINTS[i])));
  return [DEV[i][0] + (DEV[i + 1][0] - DEV[i][0]) * t, DEV[i][1] + (DEV[i + 1][1] - DEV[i][1]) * t];
};
const H_REF = 20; // 在 20 m 处 SET REF
const H_MIN = 4;
const STOPS = Array.from({ length: (H_REF - H_MIN) / 2 + 1 }, (_, i) => H_REF - 2 * i);
const REF = devAt(H_REF * PER_M + CONTACT);
const TARGET_Y = 18; // 靶心在小车坐标中的 y（离导轨端面约 9 cm，越过车体）
const BOARD = { z0: 75.4, z1: 77, y1: 34 }; // 绿色亚克力靶板（水平，垂直于导轨）
const TARGET_TOP = BOARD.z1 + 0.2; // 靶纸表面在小车坐标中的高度
const BEAM = [REF[0] * LAT, REF[1] * LAT + TARGET_Y]; // 铅垂光束的平面位置（固定）
const LASER_Z = 304; // 激光器出光口

// ---- 相机 ------------------------------------------------------------------
const PLATE = { x: -56, y: -92, w: 128, d: 168, r: 6 };
const COLUMN = { x: -12, y: -66, w: 24, d: 14, r: 1 };
const TOP_DEV = DEV[DEV.length - 1].map((v) => v * LAT);
let P = k.fitProjection(
  [...k.boxCorners(PLATE, -15, 0), [COLUMN.x, COLUMN.y, 346], [BEAM[0], BEAM[1] + 8, 340], [24, 36, 200 + 93], [24, 36, 40]],
  WIDTH,
  HEIGHT,
  { pad: 34, azimuth: 50 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (p) => k.depthOf(p, P);
const byDepth = (pts) => [...pts].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
const box = (x0, x1, y0, y1) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.6 });

// ---- 底座（底坑） -------------------------------------------------------------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 7, -15, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -13.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // 测距反射板：测距仪正下方
  const refl = { x: -15, y: -4, w: 30, d: 30, r: 1.2 };
  out.push(S(k.slabOf(refl, 0, 0.8, P, 3, 0.4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(refl, 2.4), 0.8, P, 3), { tone: "faint" }));
  out.push(D(k.corners(refl, 2.2).map(([x, y]) => at([x, y, 0.8])), { size: 0.4 }));
  // 刻度尺条（沿前缘）
  const strip = { x: PLATE.x + 12, y: PLATE.y + PLATE.d - 13, w: 96, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.45 }));
  // 铭牌
  const label = { x: PLATE.x + PLATE.w - 40, y: PLATE.y + 40, w: 28, d: 16, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  [[4, 22], [8, 16], [12, 19]].forEach(([dy, len]) => out.push(L(k.lineOnTop([label.x + 4, label.y + dy], [label.x + 4 + len, label.y + dy], 0.8, P), { tone: "lo", free: true })));
  return out.join("");
}

// ---- 井道立柱与导轨支架 --------------------------------------------------------
const BRACKETS = [27, 82, 137, 192, 247, 302];
function column() {
  const out = [];
  out.push(S(k.slabOf({ x: COLUMN.x - 6, y: COLUMN.y - 4, w: COLUMN.w + 12, d: COLUMN.d + 8, r: 1.2 }, 0, 3, P, 3, 0.5), { tone: "mid" }));
  out.push(D([[COLUMN.x - 3, COLUMN.y + COLUMN.d + 2], [COLUMN.x + COLUMN.w + 3, COLUMN.y + COLUMN.d + 2], [COLUMN.x + COLUMN.w + 3, COLUMN.y - 1]].map(([x, y]) => at([x, y, 3])), { size: 0.5 }));
  const seams = [110, 220].map((z) => L(k.sideSeam(COLUMN, z, P, 3), { tone: "faint" })).join("");
  out.push(S(k.slabOf(COLUMN, 3, 343, P, 3, 0.5), { tone: "lo", inner: seams }));
  for (const z of BRACKETS) {
    // 膨胀螺栓（立柱前面）
    out.push(D([[-7, z + 8], [7, z + 8], [-7, z - 3], [7, z - 3]].map(([x, zz]) => at([x, COLUMN.y + COLUMN.d, zz])), { size: 0.45 }));
  }
  return out.join("");
}

function brackets() {
  const out = [];
  for (const z of BRACKETS) {
    const [dx, dy] = devAt(z).map((v) => v * LAT);
    const back = -36 + dy;
    const plan = box(-20 + dx * 0.5, 20 + dx * 0.5, COLUMN.y + COLUMN.d, back);
    out.push(S(k.slabOf(plan, z, 5, P, 2, 0.4), { tone: "mid" }));
    out.push(L(k.lineOnTop([plan.x, plan.y + 4], [plan.x + plan.w, plan.y + 4], z + 5, P), { tone: "faint" }));
    out.push(D([at([plan.x + 4, plan.y + plan.d / 2 + 1, z + 5]), at([plan.x + plan.w - 4, plan.y + plan.d / 2 + 1, z + 5])], { size: 0.45 }));
  }
  return out.join("");
}

// ---- T 型导轨（分段、按偏差倾斜） ----------------------------------------------
const FLANGE = [[-18, -36], [18, -36], [18, -30], [-18, -30]];
const BLADE = [[-3, -30], [3, -30], [3, -8], [-3, -8]];
function sectionFrame(i) {
  const o = [DEV[i][0] * LAT, DEV[i][1] * LAT, JOINTS[i]];
  const e = [DEV[i + 1][0] * LAT, DEV[i + 1][1] * LAT, JOINTS[i + 1]];
  const a = G.unit3(G.sub3(e, o));
  const u = G.unit3(G.sub3([1, 0, 0], G.mul3(a, a[0])));
  return { F: G.frameOf(o, a, u, G.cross3(a, u)), len: G.len3(G.sub3(e, o)) };
}
function railPart(poly, tone) {
  const out = [];
  for (let i = 0; i < JOINTS.length - 1; i++) {
    const { F, len } = sectionFrame(i);
    out.push(S(G.prismOf(F, poly, 0, len, P), { tone }));
  }
  return out.join("");
}
function fishBolts() {
  const pts = [];
  for (const z of JOINTS.slice(1, -1)) {
    const [dx, dy] = devAt(z).map((v) => v * LAT);
    for (const x of [-12, 12]) for (const dz of [-7, -3, 3, 7]) pts.push(at([dx + x, dy - 30, z + dz]));
  }
  return D(pts, { size: 0.45 });
}
function clips(side) {
  const out = [];
  for (const z of BRACKETS) {
    const [dx, dy] = devAt(z).map((v) => v * LAT);
    const x0 = side < 0 ? -18 : 10;
    const plan = box(dx + x0, dx + x0 + 8, dy - 30, dy - 27.6);
    out.push(S(k.slabOf(plan, z - 2, 9, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([dx + x0 + 4, dy - 27.6, z + 2.5])], { size: 0.5, tone: "hi" }));
  }
  return out.join("");
}

// ---- 爬轨小车（在 z = 0 处建模，整体平移） -----------------------------------
// 按实物照片：两条同步带履带模块夹住导轨导向面（导轨从中间槽穿过），上下两端各一个顶面滚轮，
// 上端橙色导靴夹爪；底板上依次是测距仪端盒（测距孔朝下）、树莓派仓、立塔 + 相机、电池仓、靶板。
// 1 单位 ≈ 3.5 mm；y = Y0 为底板上表面。
const Y0 = -4.5;
const FX = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]); // 多边形 (y, z)，沿 x 拉伸
const FY = G.frameOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); // 多边形 (z, x)，沿 y 拉伸
const B = (x0, x1, y0, y1, z0, z1, bevel = 0.3) => k.slabOf(box(x0, x1, y0, y1), z0, z1 - z0, P, 2, bevel);
const discX = (c, s0, s1, r) => G.disc(s0, s1, r, G.frameAlong(c, [1, 0, 0]), P);
const poly = (pts) => k.pathOf(pts.map(at), true);
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
const hole = (pts) => `<path class="iso-shade" data-shade="0" d="${poly(pts)}"/>` + L(poly(pts), { tone: "lo" });

// 底盘：同步带模块（底盖 + 带轮组 + 外侧板），xs = ±1
const CH = { z0: 8, z1: 72, y0: -14.5, y1: Y0 - 1 };
const BELT = { x0: 3.4, x1: 18.6, z0: 9, z1: 71, y0: -13.5, y1: -6.5 };
function beltBlock(sx) {
  const r = (BELT.x1 - BELT.x0) / 2;
  const cx = sx * (BELT.x0 + r);
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push([BELT.z1 - r + r * Math.sin((i / 12) * Math.PI), cx + r * Math.cos((i / 12) * Math.PI)]);
  for (let i = 0; i <= 12; i++) pts.push([BELT.z0 + r - r * Math.sin((i / 12) * Math.PI), cx - r * Math.cos((i / 12) * Math.PI)]);
  const out = [S(G.prismOf(FY, pts, BELT.y0, BELT.y1, P), { tone: "lo" })];
  // 带齿：上端弧面上，跨满带宽
  const teeth = [];
  const V = k.towardViewer(P);
  for (let i = 1; i < 24; i++) {
    const t = (i / 24) * Math.PI;
    const n = [Math.cos(t) * -1, 0, Math.sin(t)];
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
  // 外侧板：上排两条长圆孔、下排两个三角孔，透出同步带
  const x = 20;
  const slot = (z0, z1) => {
    const pts = roundRect(z0, z1, -8.4, -6.4, 1, 4).map(([z, y]) => [x, y, z]);
    return pts;
  };
  const tri1 = [[x, -9.6, 12], [x, -12.8, 12], [x, -12.8, 37]];
  const tri2 = [[x, -9.6, 68], [x, -12.8, 68], [x, -12.8, 43]];
  const teeth = [];
  for (const [z0, z1] of [[13, 37], [43, 67]]) for (let z = z0 + 1.2; z < z1 - 0.8; z += 1.4) teeth.push(k.segment([x, -8.4, z], [x, -6.4, z], P));
  for (let z = 12.9; z < 36; z += 1.4) teeth.push(k.segment([x, -12.8, z], [x, -12.8 + 3.2 * (37 - z) / 25, z], P));
  for (let z = 67.1; z > 44; z -= 1.4) teeth.push(k.segment([x, -12.8, z], [x, -12.8 + 3.2 * (z - 43) / 25, z], P));
  const inner = [slot(13, 37), slot(43, 67), tri1, tri2].map(hole).join("") + L(teeth.join(""), { tone: "faint" });
  out.push(S(B(18.8, 20, CH.y0, CH.y1, CH.z0, CH.z1), { tone: "mid", inner }));
  out.push(D([[x, -10.8, 9.6], [x, -10.8, 70.4], [x, -7.4, 40], [x, -11, 40]].map(at), { size: 0.45 }));
  return out.join("");
}
// 导轨顶面滚轮（两端各一个，挂在底板下）
function tipRoller(z) {
  const out = [];
  out.push(S(B(-3.6, -2.6, -7.6, Y0 - 1, z - 1.4, z + 1.4, 0.2), { tone: "mid" }));
  out.push(S(discX([0, -6.8, z], -2.5, 2.5, 1.2), { tone: "hi", crease: "lo" }));
  out.push(S(B(2.6, 3.6, -7.6, Y0 - 1, z - 1.4, z + 1.4, 0.2), { tone: "mid" }));
  out.push(D([at([3.6, -6.8, z])], { size: 0.45 }));
  return out.join("");
}
// 上端导靴夹爪：横梁 + 两臂 + 橙色导靴（V 形倒角）
const PAD = [[-12.5, 85], [-11.5, 84], [-6.4, 84], [-6.4, 94.6], [-7.4, 96], [-11.5, 96], [-12.5, 95]];
function jawSide(sx) {
  const out = [];
  const [a0, a1] = sx < 0 ? [-9.2, -5.2] : [5.2, 9.2];
  const [p0, p1] = sx < 0 ? [-5.2, -3.2] : [3.2, 5.2];
  const arm = () => S(B(a0, a1, -13.4, Y0, 82.6, 91, 0.4), { tone: "mid", inner: L(k.segment([sx < 0 ? a0 : a1, -13.4, 87], [sx < 0 ? a0 : a1, Y0, 87], P), { tone: "faint" }) });
  const pad = () => S(G.prismOf(FX, PAD, p0, p1, P), { tone: "hi", crease: "lo" });
  if (sx < 0) out.push(arm(), pad());
  else out.push(pad(), arm(), D([at([a1, -10, 89.4]), at([a1, -10, 84.4])], { size: 0.45 }));
  return out.join("");
}
function jawBridge() {
  const out = [];
  out.push(S(B(-11, 11, Y0, Y0 + 4, 77.2, 85, 0.5), { tone: "mid" }));
  // 横梁上的窗口与压紧滚轮
  out.push(hole([[-6, Y0 + 4, 79], [6, Y0 + 4, 79], [6, Y0 + 4, 83], [-6, Y0 + 4, 83]]));
  out.push(S(discX([0, Y0 + 3.4, 81], -3.4, 3.4, 1.3), { tone: "hi", crease: "lo" }));
  out.push(D([at([-8.6, Y0 + 4, 81]), at([8.6, Y0 + 4, 81])], { size: 0.5 }));
  return out.join("");
}

// 树莓派 5（垫高到仓口：PCB + 风扇散热器 + GPIO + 接口 + USB-TTL 下载器）
const PI_Y = Y0 + 19; // PCB 底面
function pi() {
  const out = [];
  const yb = PI_Y;
  // 四角铜柱（立在仓内托板上）
  for (const [x, z] of [[-10.6, 21.8], [10.6, 21.8], [-10.6, 35.2], [10.6, 35.2]]) out.push(S(B(x - 0.6, x + 0.6, Y0 + 17.5, yb, z - 0.6, z + 0.6, 0.1), { tone: "lo" }));
  out.push(S(B(-12, 12, yb, yb + 0.5, 20.5, 36.5, 0.2), { tone: "mid" }));
  out.push(D([[-10.6, 21.8], [10.6, 21.8], [-10.6, 35.2], [10.6, 35.2]].map(([x, z]) => at([x, yb + 0.5, z])), { size: 0.5 }));
  // GPIO 双排针（沿 PCB 下长边）
  const pins = [];
  for (let i = 0; i < 20; i++) for (const z of [21.3, 21.9]) pins.push([-9.4 + i * 0.9, 0, z]);
  out.push(S(B(-9.9, 8.1, yb + 0.5, yb + 1.3, 20.9, 22.3, 0.1), { tone: "lo", crease: "none" }));
  out.push(D(pins.map(([x, , z]) => at([x, PI_Y + 1.3, z])), { size: 0.28, tone: "mid" }));
  // 散热器 + 鳍片 + 风扇
  const hs = { x0: -6, x1: 6, z0: 24, z1: 33 };
  const finLines = [];
  for (let x = hs.x0 + 1.5; x < hs.x1 - 0.5; x += 1.5) finLines.push(k.segment([x, yb + 3, hs.z0], [x, yb + 3, hs.z0 + 3.2], P));
  out.push(S(B(hs.x0, hs.x1, yb + 0.5, yb + 3, hs.z0, hs.z1, 0.3), { tone: "mid", inner: L(finLines.join(""), { tone: "faint" }) }));
  const fan = G.frameAlong([1.5, yb + 3, 29.6], [0, 1, 0]);
  out.push(L(G.circleOf(fan, 0, 2.8, P) + G.circleOf(fan, 0, 0.9, P), { tone: "lo" }));
  out.push(L(G.spokesOf(fan, 0, 0.9, 2.8, 7, P, { sweep: 0.5 }), { tone: "faint" }));
  // 风扇线：散热器侧 → GPIO 旁插座
  out.push(k.wireSvg(at([6, yb + 1.8, 31]), at([7.4, yb + 0.5, 23.6]), { via: [at([7.4, yb + 1.8, 31])], tone: "lo", size: 0.6 }));
  // 接口：以太网 + 两组 USB，朝 +x 侧
  out.push(S(B(8.6, 13, yb + 0.5, yb + 4.4, 24, 28, 0.2), { tone: "mid" }));
  out.push(S(B(8.6, 13, yb + 0.5, yb + 4.2, 28.6, 32.2, 0.2), { tone: "mid" }));
  out.push(S(B(8.6, 13, yb + 0.5, yb + 4.2, 32.8, 36.4, 0.2), { tone: "mid" }));
  out.push(L(k.segment([13, yb + 2.4, 33.5], [13, yb + 2.4, 35.7], P), { tone: "lo" }));
  // USB-TTL 下载器（插在下层 USB 口）
  out.push(S(B(13, 18.4, yb + 1.2, yb + 3.4, 29.2, 31.6, 0.3), { tone: "hi", crease: "lo" }));
  out.push(S(B(18.4, 19.4, yb + 1.6, yb + 3, 29.6, 31.2, 0.2), { tone: "lo" }));
  return out.join("");
}

function carriageBack() {
  return [chassisSide(-1), jawSide(-1)].join("");
}

function carriageFront() {
  const out = [];
  out.push(chassisSide(1));
  out.push(tipRoller(5), tipRoller(75));
  // 底板（圆角长板，盖住两条履带）
  const plate = roundRect(-1, 83, -21, 21, 5);
  out.push(S(G.prismOf(FY, plate, Y0 - 1, Y0, P), { tone: "mid" }));
  out.push(D([[-17, 6], [17, 6], [-17, 77], [17, 77], [-14, 40], [14, 40]].map(([x, z]) => at([x, Y0, z])), { size: 0.45 }));

  // 6 测距仪端盒（下端面开测距孔，朝下打到底坑反射板）
  const endSeam = L(k.sideSeam(box(-20, 20, Y0, Y0 + 31), 4 + 11, P, 2), { tone: "faint" });
  out.push(S(B(-20, 20, Y0, Y0 + 31, 2.5, 18.5, 0.6), { tone: "mid", inner: endSeam }));
  out.push(D([[20, Y0 + 27, 5], [20, Y0 + 27, 16], [20, Y0 + 3, 5], [20, Y0 + 3, 16]].map(at), { size: 0.45 }));
  out.push(D([[-17, 5.4], [17, 5.4], [-17, 15.6], [17, 15.6]].map(([x, z]) => at([x, Y0 + 31, z])), { size: 0.45 }));

  // 5 树莓派仓：仓体（侧面开关）+ -x 侧挡边，派垫高在仓口
  const sw = { z0: 25, z1: 31, y0: Y0 + 1.6, y1: Y0 + 6.4 };
  const swInner = hole([[20, sw.y0, sw.z0], [20, sw.y1, sw.z0], [20, sw.y1, sw.z1], [20, sw.y0, sw.z1]]);
  out.push(S(B(-20, 20, Y0, Y0 + 17.5, 18.5, 38, 0.4), { tone: "mid", inner: swInner }));
  out.push(S(B(-20, -18.6, Y0 + 17.5, Y0 + 22, 18.5, 38, 0.3), { tone: "mid" }));
  out.push(pi());
  out.push(S(G.prismOf(FX, [[Y0 + 2.6, 26.4], [Y0 + 5.4, 26.4], [Y0 + 5.4, 29.6], [Y0 + 2.6, 29.6]], 20, 20.8, P), { tone: "hi", crease: "lo" }));
  out.push(L(k.segment([20.8, Y0 + 4, 26.4], [20.8, Y0 + 4, 29.6], P), { tone: "lo" }));


  // 立塔（相机靠在塔面上）
  out.push(S(B(-20, 20, Y0, Y0 + 22, 38, 46, 0.6), { tone: "mid" }));
  out.push(D([[20, Y0 + 18, 40], [20, Y0 + 18, 44], [20, Y0 + 4, 40], [20, Y0 + 4, 44]].map(at), { size: 0.45 }));

  // 台阶座 + 4 相机（镜头朝 +z 看靶板背面，顶面散热鳍片）
  out.push(S(B(-18, 18, Y0, Y0 + 11, 46, 55, 0.5), { tone: "mid" }));
  const cy0 = Y0 + 11;
  const cy1 = Y0 + 27.5;
  out.push(S(B(-11, 11, cy0, cy1, 46, 53.6, 0.6), { tone: "hi", crease: "lo" }));
  for (let z = 46.9; z < 53; z += 1.3) out.push(S(B(-10, 10, cy1, cy1 + 1, z, z + 0.55, 0), { tone: "mid", crease: "none" }));
  const camY = TARGET_Y;
  out.push(S(G.disc(0, 1.2, 3.4, G.frameAlong([0, camY, 53.6], [0, 0, 1]), P), { tone: "mid" }));
  out.push(S(G.disc(1.2, 2.2, 2.3, G.frameAlong([0, camY, 53.6], [0, 0, 1]), P), { tone: "lo" }));
  out.push(L(k.ring(0, camY, 1.2, 55.8, P, 24), { tone: "lo" }));

  // 电池仓（带台阶缺口与 DC 插座）
  const bat = box(-17.5, 17.5, Y0, Y0 + 18);
  out.push(S(B(-17.5, 17.5, Y0, Y0 + 18, 55, 74, 0.6), { tone: "mid", inner: L(k.sideSeam(bat, 64.5, P, 2), { tone: "faint" }) }));
  out.push(S(B(-17.5, 17.5, Y0 + 18, Y0 + 19, 55, 60, 0.3), { tone: "mid" }));
  out.push(S(discX([17.5, Y0 + 7, 60], 0, 1, 1.8), { tone: "mid" }));
  out.push(L(G.circleOf(G.frameAlong([18.5, Y0 + 7, 60], [1, 0, 0]), 0, 0.8, P), { tone: "lo" }));
  out.push(hole([[17.5, Y0 + 2, 66], [17.5, Y0 + 4.4, 66], [17.5, Y0 + 4.4, 69], [17.5, Y0 + 2, 69]]));
  out.push(D([[17.5, Y0 + 14, 57], [17.5, Y0 + 14, 72]].map(at), { size: 0.45 }));
  out.push(D([[-14.5, 57.6], [14.5, 57.6], [-14.5, 71.4], [14.5, 71.4]].map(([x, z]) => at([x, Y0 + 18, z])), { size: 0.45 }));

  // 3 靶板：插槽座 + 两侧立槽 + 绿色亚克力 + 靶纸（朝上迎激光）
  out.push(S(B(-20, 20, Y0, Y0 + 6, 74, BOARD.z1, 0.4), { tone: "mid" }));
  out.push(S(B(-22.6, -21, Y0, Y0 + 24, 74.6, BOARD.z1, 0.3), { tone: "mid" }));
  out.push(S(B(-21, 21, Y0 + 3, BOARD.y1, BOARD.z0, BOARD.z1, 0.3), { tone: "lo" }));
  const paper = { x: -19.6, y: Y0 + 6.6, w: 39.2, d: BOARD.y1 - Y0 - 7.4, r: 0.4 };
  out.push(S(k.slabOf(paper, BOARD.z1, 0.2, P, 2), { tone: "hi", flat: true, crease: "none" }));
  const zt = TARGET_TOP;
  for (const [x, y] of k.corners(paper, 3.6)) out.push(S(k.slabOf(box(x - 2.2, x + 2.2, y - 2.2, y + 2.2), zt, 0.05, P, 2), { tone: "lo", flat: true, crease: "none" }));
  out.push(L(k.lineOnTop([paper.x, TARGET_Y], [paper.x + paper.w, TARGET_Y], zt, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([0, paper.y], [0, paper.y + paper.d], zt, P), { tone: "lo" }));
  const tx = k.topTicks(-15, 15, LAT, 5, TARGET_Y, zt, [1, 2], P);
  const ty = k.topTicks(TARGET_Y - 15, TARGET_Y + 9, LAT, 5, 0, zt, [1, 2], P, "y");
  out.push(L(tx.minor + ty.minor, { tone: "lo" }), L(tx.major + ty.major, { tone: "mid" }));
  const tol = TOL_MM * LAT;
  out.push(`<path data-part="tol" class="iso-line" data-tone="mid" d="${k.planOutline({ x: -tol, y: TARGET_Y - tol, w: 2 * tol, d: 2 * tol, r: 0 }, zt, P, 1)}"/>`);
  out.push(S(B(21, 22.6, Y0, Y0 + 24, 74.6, BOARD.z1, 0.3), { tone: "mid" }));
  out.push(D([[22.6, Y0 + 4, 75.8], [22.6, Y0 + 20, 75.8]].map(at), { size: 0.45 }));

  // 上端导靴夹爪
  out.push(jawBridge(), jawSide(1));
  return out.join("");
}

// ---- 1 顶部激光器（固定在导轨顶端） -------------------------------------------
function laser() {
  const out = [];
  const [ox, oy] = TOP_DEV;
  const clamp = box(ox - 10, ox + 10, oy - 37, oy - 5);
  out.push(S(k.slabOf(clamp, 316, 20, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(clamp, 326, P, 3), { tone: "faint" }) }));
  out.push(D([at([ox - 6, oy - 5, 320]), at([ox + 6, oy - 5, 320]), at([ox - 6, oy - 5, 332]), at([ox + 6, oy - 5, 332])], { size: 0.45 }));
  out.push(S(discX([ox + 10, oy - 21, 326], 0, 2, 2.6), { tone: "mid" }));
  out.push(S(discX([ox + 12, oy - 21, 326], 0, 3, 3.6), { tone: "mid" }));
  const armY0 = oy - 5;
  const armY1 = BEAM[1] - 7;
  out.push(S(k.slabOf(box(BEAM[0] - 4, BEAM[0] + 4, armY0, armY1), 327, 5, P, 2, 0.4), { tone: "mid" }));
  out.push(D([at([BEAM[0], armY0 + 4, 332]), at([BEAM[0], armY1 - 3, 332])], { size: 0.45 }));
  // 激光头：调平座 + 机身 + 散热环 + 出光口
  const [bx, by] = BEAM;
  out.push(S(k.cylinder(bx, by, 4, LASER_Z, 3, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(bx, by, 7.5, LASER_Z + 3, 5, P, 40, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(bx, by, 7.5, LASER_Z + 3, LASER_Z + 8, 30, P), { tone: "lo" }));
  out.push(S(k.cylinder(bx, by, 6.4, LASER_Z + 8, 22, P, 40, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideArc(bx, by, 6.4, LASER_Z + 20, P, 32), { tone: "faint" }) }));
  out.push(L(k.ring(bx, by, 3, LASER_Z + 30, P, 24), { tone: "lo" }));
  out.push(D([at([bx, by, LASER_Z + 30])], { size: 0.6, tone: "mid" }));
  return out.join("");
}

// ---- 组装 ------------------------------------------------------------------
const H0 = H_REF;
const pose = (H) => {
  const cz = H * PER_M;
  const dev = devAt(cz + CONTACT);
  return { cz, dev, off: [dev[0] * LAT, dev[1] * LAT, cz] };
};
const p0 = pose(H0);
const spotOf = (q) => [BEAM[0], BEAM[1], q.cz + TARGET_TOP];
const s0 = spotOf(p0);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "电梯导轨垂直度测量工装：顶部激光器沿导轨向下打出铅垂光束，爬轨小车用两条同步带履带夹住分段拼接的 T 型导轨，上端导靴夹爪卡住导轨，车上靶板接住光斑，靶板下方相机看透射光斑，下端测距仪测高度。小车下行时，导轨的弯曲带动靶板横移，光斑在靶面上的位移就是该高度的导轨偏差。",
  body: [
    base(),
    column(),
    brackets(),
    railPart(FLANGE, "mid"),
    fishBolts(),
    clips(-1),
    `<g data-part="carriage-back" transform="${k.translateAlong(P, p0.off)}">${carriageBack()}</g>`,
    railPart(BLADE, "mid"),
    clips(1),
    `<g data-part="carriage" transform="${k.translateAlong(P, p0.off)}">${carriageFront()}</g>`,
    `<path data-part="beam" class="iso-line" data-tone="green" d="${k.segment([BEAM[0], BEAM[1], LASER_Z], s0, P)}" style="stroke-width:1.1"/>`,
    `<g data-part="spot" transform="translate(${at(s0).join(" ")})"><circle r="3.2" style="fill:var(--anatomy-green);opacity:.28"/><circle r="1.3" style="fill:var(--anatomy-green)"/></g>`,
    laser(),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const JOINTS = ${JSON.stringify(JOINTS)}, DEV = ${JSON.stringify(DEV)};
const LAT = ${LAT}, PER_M = ${PER_M}, CONTACT = ${CONTACT}, TOL = ${TOL_MM};
const BEAM = ${JSON.stringify(BEAM)}, LASER_Z = ${LASER_Z}, TARGET_TOP = ${TARGET_TOP};
const REF = ${JSON.stringify(REF)};
const STOPS = ${JSON.stringify(STOPS)}, H_REF = ${H_REF}, H_MIN = ${H_MIN};
const devAt = ${devAt.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const back = svg.querySelector('[data-part="carriage-back"]');
const front = svg.querySelector('[data-part="carriage"]');
const beam = svg.querySelector('[data-part="beam"]');
const spot = svg.querySelector('[data-part="spot"]');
const tol = svg.querySelector('[data-part="tol"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
let H = H_REF, target = H_REF, touring = !still.matches, clock = 0, last = 0, frame = 0, visible = false, idle = 0;
const DWELL = 1.8;
const tourAt = (t) => {
  const n = STOPS.length;
  const i = Math.floor(t / DWELL) % (n + 1);
  return i < n ? STOPS[i] : H_REF;
};
function draw() {
  const cz = H * PER_M;
  const dev = devAt(cz + CONTACT);
  const t = translateAlong(P, [dev[0] * LAT, dev[1] * LAT, cz]);
  back.setAttribute("transform", t);
  front.setAttribute("transform", t);
  const s = [BEAM[0], BEAM[1], cz + TARGET_TOP];
  beam.setAttribute("d", segment([BEAM[0], BEAM[1], LASER_Z], s, P));
  spot.setAttribute("transform", "translate(" + iso(s, P).join(" ") + ")");
  const dx = REF[0] - dev[0], dy = REF[1] - dev[1];
  const over = Math.abs(dx) > TOL || Math.abs(dy) > TOL;
  tol.setAttribute("data-tone", over ? "red" : "mid");
  const text = "H " + H.toFixed(2) + " m · dX " + fmt(dx) + " · dY " + fmt(dy) + " mm · " + (over ? "超差" : "合格");
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", H.toFixed(1));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  H = still.matches ? target : H + (target - H) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(target - H) < 0.002) H = target;
  draw();
  frame = visible && (touring || H !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (h) => {
  touring = false;
  target = clamp(h, H_MIN, H_REF);
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000);
  run();
};
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const r = svg.getBoundingClientRect();
  const f = clamp(((event.clientY - r.top) / r.height - 0.18) / 0.6, 0, 1);
  steer(H_REF - f * (H_REF - H_MIN + 1));
});
stage.addEventListener("keydown", (event) => {
  let h = null;
  if (event.key === "ArrowUp" || event.key === "ArrowRight") h = target + 1;
  if (event.key === "ArrowDown" || event.key === "ArrowLeft") h = target - 1;
  if (event.key === "Home") h = H_REF;
  if (event.key === "End") h = H_MIN;
  if (h === null) return;
  event.preventDefault();
  steer(Math.round(h));
});
draw();
`;

const kitScript = readFileSync(join(HERE, "..", "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const css = `<style>.iso-line[data-tone="red"]{stroke:var(--anatomy-red)}</style>`;
const body = k.plateHtml({
  fig: "Fig 1",
  title: "导轨垂直度测量",
  hint: "上下移动指针控制小车高度 · ↑↓ 键逐米",
  readout: "",
  keys: [
    { mark: "green", label: "铅垂激光束与靶面光斑：光束固定，靶板随导轨弯曲横移" },
    { mark: "raised", label: "靶板：绿色亚克力上贴靶纸，1 mm 刻度十字线、±3 mm 公差框、四角 ArUco 定位码" },
    { mark: "edge", label: "爬轨小车：两条同步带履带夹住导轨导向面，两端顶面滚轮，上端橙色导靴夹爪" },
    { mark: "edge", label: "T 型导轨按 5.5 m 分段拼接，接头处偏差不同（横向放大 3 倍显示）" },
  ],
  caption:
    "顶部激光器（1）贴着导轨（7）向下打出铅垂光束（2）。爬轨小车（8）底盘是左右两条同步带履带，导轨从中间槽穿过、被两侧皮带夹住，两端各有一个滚轮压在导轨顶面，上端的橙色导靴夹爪卡住导轨两侧。车头的靶板（3）是一块贴了靶纸的绿色亚克力板，横伸出车体接住光斑；立塔上的相机（4）在靶板下方隔着亚克力跟踪透射光斑，下端测距仪（6）透过端盒的测距孔向下测出高度，树莓派（5）把高度和光斑位置推给看板。在 20 m 处 SET REF 后，小车每 2 m 停一次 MEASURE：导轨哪里弯，靶板就跟着偏，光斑相对基准的位移就是该高度的 dX/dY，超过 ±3 mm 判为超差。井道高度压缩为 1 m = 10 单位，横向偏差与靶面刻度同比例放大。",
  body: `${css}<div class="iso-stage" tabindex="0" role="slider" aria-label="小车高度：方向键上下移动" aria-valuemin="${H_MIN}" aria-valuemax="${H_REF}" aria-valuenow="${H_REF}">${svg}</div>`,
});

const file = theme === "light" ? "verticality.html" : "verticality-dark.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "导轨垂直度测量", theme, body, script: kitScript + live }));
console.log("wrote", file);
if (theme === "light") {
  const still = k.figureSvg({ width: WIDTH, height: HEIGHT, label: "导轨垂直度测量工装示意图", body: svg.replace(/^<svg[^>]*>|<\/svg>$/g, ""), standalone: "light" });
  writeFileSync(join(HERE, "verticality.svg"), still);
  console.log("wrote verticality.svg");
  // 供介绍页内嵌：figure 本体 + 运行脚本（页面需提供 .iso-stage 与 [data-readout]）
  const stage = `<div class="iso-stage" tabindex="0" role="slider" aria-label="小车高度：方向键上下移动" aria-valuemin="${H_MIN}" aria-valuemax="${H_REF}" aria-valuenow="${H_REF}">${svg}</div>`;
  writeFileSync(join(HERE, "verticality-embed.json"), JSON.stringify({ stage, css: k.ISO_CSS + css.replace(/<\/?style>/g, ""), script: kitScript + live }));
  console.log("wrote verticality-embed.json");
}

// Cart A alone on a short rail stub, for the home page (same parts, refitted camera).
if (theme === "light") {
  P = k.fitProjection([[-30, -40, -24], [30, 40, -24], [-30, -40, 104], [30, 40, 104], [-28, 34, 80]], 360, 420, { pad: 18, azimuth: 50 });
  const plinth = { x: -30, y: -44, w: 60, d: 84, r: 3 };
  const stub = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const cart = k.figureSvg({
    width: 360,
    height: 420,
    label: "Cart A: the verticality crawler with its target board, camera and rangefinder",
    body: [
      `<path class="iso-halo" d="${k.haloOf(plinth, -24, 6, P)}"/>`,
      S(k.slabOf(plinth, -24, 6, P, 4, 0.8), { tone: "mid" }),
      D(k.corners(plinth, 4).map(([x, y]) => at([x, y, -18])), { size: 0.5 }),
      S(G.prismOf(stub, FLANGE, -18, 100, P), { tone: "mid" }),
      carriageBack(),
      S(G.prismOf(stub, BLADE, -18, 100, P), { tone: "mid" }),
      carriageFront(),
    ],
  });
  writeFileSync(join(HERE, "verticality-cart.svg"), cart);
  console.log("wrote verticality-cart.svg");
}
