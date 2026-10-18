
const SCALE_MM = 3.2;
const distanceMm = function distanceMm(a, b, scale) {
  return Math.hypot(b.x - a.x, b.y - a.y) * scale;
};
const clearanceMm = function clearanceMm(roofY, obstructionBottomY, scale) {
  return Math.max(0, (roofY - obstructionBottomY) * scale);
};
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
