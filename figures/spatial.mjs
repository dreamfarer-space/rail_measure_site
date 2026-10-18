// 空间尺寸互动图：左图拖 P1/P2 算三维距离（按比例示意），右图拖上方障碍算轿顶净空。
// 纯函数同时被构建脚本和页面内联脚本使用（内联脚本由函数源码 toString 生成，避免两份公式）。
export const SCALE_MM = 3.2; // 1 个 SVG 单位 = 3.2 mm（示意图比例，非实测）
export const OBSTACLE_HEIGHT = 10;

export function distanceMm(a, b, scale) {
  return Math.hypot(b.x - a.x, b.y - a.y) * scale;
}

export function clearanceMm(roofY, obstructionBottomY, scale) {
  return Math.max(0, (roofY - obstructionBottomY) * scale);
}

export const spatialCss = `
.sp{display:block;width:100%;height:auto;touch-action:none}
.sp .handle{fill:var(--ground);stroke:var(--ink);stroke-width:2;cursor:grab}
.sp .handle:active{cursor:grabbing}
.sp .handle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sp .gridline{stroke:var(--rule);stroke-width:1}
.sp .dim{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 4}
.sp .bar{fill:var(--well-2);stroke:var(--rule);cursor:ns-resize}
.sp .bar:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sp .label{font:12px var(--mono);fill:var(--text-2);font-variant-numeric:tabular-nums}
.sp .tag{font:12px var(--sans);fill:var(--muted)}
`;

export const spatialTwoMarkup = `
  <figure class="sample-fig">
    <svg class="sp" id="sp-two" viewBox="0 0 640 250" role="img" aria-label="Two-point distance: drag P1 or P2">
      <defs>
        <pattern id="sp-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" class="gridline" fill="none"/>
        </pattern>
      </defs>
      <rect x="40" y="24" width="560" height="190" fill="url(#sp-grid)" stroke="var(--rule)"/>
      <line id="sp-line" class="dim" x1="180" y1="120" x2="430" y2="170"/>
      <circle id="p1" class="handle" cx="180" cy="120" r="7" tabindex="0" role="button"
              aria-label="Endpoint P1, arrow keys to move, Shift to accelerate"/>
      <circle id="p2" class="handle" cx="430" cy="170" r="7" tabindex="0" role="button"
              aria-label="Endpoint P2, arrow keys to move, Shift to accelerate"/>
      <text class="tag" x="180" y="106">P1</text>
      <text class="tag" x="438" y="166">P2</text>
      <text class="label" id="sp-dist" x="40" y="240" aria-live="polite">D = 0 mm</text>
    </svg>
    <figcaption>Two-point distance. Drag a handle, or focus it and use the arrow keys (1 unit, Shift 10 units).</figcaption>
  </figure>
`;

export const spatialClearMarkup = `
  <figure class="sample-fig">
    <svg class="sp" id="sp-clear" viewBox="0 0 640 210" role="img" aria-label="Car-top clearance: drag the obstruction up or down">
      <line class="gridline" x1="40" y1="168" x2="600" y2="168"/>
      <text class="tag" x="40" y="192">Car-top standing surface (reference plane)</text>
      <rect id="obs" class="bar" x="40" y="56" width="560" height="${OBSTACLE_HEIGHT}" tabindex="0" role="slider"
            aria-orientation="vertical" aria-label="Obstruction height, adjust with the arrow keys; the distance is measured from its lower face to the reference plane"
            aria-valuemin="0" aria-valuemax="429" aria-valuenow="326" aria-valuetext="Clearance 326 millimetres"/>
      <text class="tag" x="40" y="44">Upper region (shaft top / beams / obstructions)</text>
      <line id="clr-line" class="dim" x1="320" y1="66" x2="320" y2="168"/>
      <text class="label" id="clr-dist" x="332" y="120" aria-live="polite">H = 0 mm</text>
    </svg>
    <figcaption>Car-top clearance. The obstruction is its lower face; unmeasured cells are treated as unknown.</figcaption>
  </figure>
`;

export const spatialScript = `
const SCALE_MM = ${SCALE_MM};
const distanceMm = ${distanceMm.toString()};
const clearanceMm = ${clearanceMm.toString()};
const pinch = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const two = document.querySelector("#sp-two");
if (two) {
  const p1 = two.querySelector("#p1"), p2 = two.querySelector("#p2");
  const line = two.querySelector("#sp-line"), out = two.querySelector("#sp-dist");
  const toSvg = (ev) => {
    const pt = two.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(two.getScreenCTM().inverse());
  };
  const draw = () => {
    const a = { x: +p1.getAttribute("cx"), y: +p1.getAttribute("cy") };
    const b = { x: +p2.getAttribute("cx"), y: +p2.getAttribute("cy") };
    line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    out.textContent = "D = " + Math.round(distanceMm(a, b, SCALE_MM)).toLocaleString("zh-CN") + " mm";
  };
  for (const el of [p1, p2]) {
    let dragId = null;
    const move = (ev) => {
      if (ev.pointerId !== dragId) return;
      const p = toSvg(ev);
      el.setAttribute("cx", pinch(p.x, 48, 592));
      el.setAttribute("cy", pinch(p.y, 32, 206));
      draw();
    };
    const stop = () => {
      if (dragId === null) return;
      el.removeEventListener("pointermove", move);
      if (el.hasPointerCapture(dragId)) el.releasePointerCapture(dragId);
      dragId = null;
    };
    el.addEventListener("pointerdown", (ev) => {
      dragId = ev.pointerId;
      el.setPointerCapture(ev.pointerId);
      el.addEventListener("pointermove", move);
    });
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("lostpointercapture", stop);
    el.addEventListener("keydown", (ev) => {
      const step = ev.shiftKey ? 10 : 1;
      const dx = ev.key === "ArrowLeft" ? -step : ev.key === "ArrowRight" ? step : 0;
      const dy = ev.key === "ArrowUp" ? -step : ev.key === "ArrowDown" ? step : 0;
      if (!dx && !dy) return;
      ev.preventDefault();
      el.setAttribute("cx", pinch(+el.getAttribute("cx") + dx, 48, 592));
      el.setAttribute("cy", pinch(+el.getAttribute("cy") + dy, 32, 206));
      draw();
    });
  }
  draw();
}

const clr = document.querySelector("#sp-clear");
if (clr) {
  const bar = clr.querySelector("#obs"), out = clr.querySelector("#clr-dist"), line = clr.querySelector("#clr-line");
  const roofY = 168;
  const barH = +bar.getAttribute("height");
  const draw = () => {
    const bottom = +bar.getAttribute("y") + barH;
    line.setAttribute("y1", bottom);
    const mm = Math.round(clearanceMm(roofY, bottom, SCALE_MM));
    out.setAttribute("y", Math.max(84, (bottom + roofY) / 2));
    out.textContent = "H = " + mm.toLocaleString("zh-CN") + " mm";
    bar.setAttribute("aria-valuenow", String(mm));
    bar.setAttribute("aria-valuetext", "Clearance " + mm + " mm");
  };
  const setY = (y) => { bar.setAttribute("y", pinch(y, 24, roofY - barH)); draw(); };
  const toSvg = (ev) => {
    const pt = clr.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(clr.getScreenCTM().inverse());
  };
  let dragId = null;
  const move = (ev) => {
    if (ev.pointerId !== dragId) return;
    setY(toSvg(ev).y);
  };
  const stop = () => {
    if (dragId === null) return;
    bar.removeEventListener("pointermove", move);
    if (bar.hasPointerCapture(dragId)) bar.releasePointerCapture(dragId);
    dragId = null;
  };
  bar.addEventListener("pointerdown", (ev) => {
    dragId = ev.pointerId;
    bar.setPointerCapture(ev.pointerId);
    bar.addEventListener("pointermove", move);
  });
  bar.addEventListener("pointerup", stop);
  bar.addEventListener("pointercancel", stop);
  bar.addEventListener("lostpointercapture", stop);
  bar.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 10 : 2;
    const dy = ev.key === "ArrowUp" ? -step : ev.key === "ArrowDown" ? step : 0;
    if (!dy) return;
    ev.preventDefault();
    setY(+bar.getAttribute("y") + dy);
  });
  draw();
}
`;
