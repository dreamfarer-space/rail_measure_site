
const buttons = [...document.querySelectorAll(".classes button")];
const img = document.querySelector("#defect-img");
const cap = document.querySelector("#defect-cap");
const select = (b, focus) => {
  for (const x of buttons) { const on = x === b; x.setAttribute("aria-checked", String(on)); x.tabIndex = on ? 0 : -1; }
  if (focus) b.focus();
  img.src = "img/defect/" + b.dataset.file;
  img.alt = b.dataset.label;
  cap.textContent = b.dataset.label + " · sample " + b.dataset.source;
};
buttons.forEach((b, i) => {
  b.addEventListener("click", () => select(b, false));
  b.addEventListener("keydown", (ev) => {
    const step = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    ev.preventDefault();
    select(buttons[(i + step + buttons.length) % buttons.length], true);
  });
});
