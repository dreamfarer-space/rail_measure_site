// Figure: quality gates. Each case has two states: the behaviour before the October 2026
// fixes and the behaviour with the current gates. Numbers come from issues #20 and #25;
// the frame positions are the documented samples, not live measurements.
export const qualityCss = `
.qg{display:grid;gap:18px}
.qg .scenarios{display:flex;flex-wrap:wrap;gap:6px}
.qg .scenarios button{appearance:none;border:1px solid var(--rule);background:var(--card);color:var(--text-2);border-radius:999px;padding:4px 11px;font:12px/1.5 var(--sans);cursor:pointer}
.qg .scenarios button:hover{border-color:var(--faint);color:var(--ink)}
.qg .scenarios button[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--ground)}
.qg .plot{border:1px solid var(--rule);border-radius:10px;background:var(--card);padding:8px 10px 2px}
.qg .plot text{font:11px var(--mono);fill:var(--muted)}
.qg .dot{fill:var(--accent)}
.qg .dot.bad{fill:#c0392b}
.qg .gate{display:flex;align-items:baseline;gap:8px;font-size:12.5px;line-height:1.7;border-top:1px solid var(--rule);padding-top:6px}
.qg .gate:first-child{border-top:0;padding-top:0}
.qg .gate .state{font:11px var(--mono);width:46px;flex:none;text-transform:uppercase;letter-spacing:.04em}
.qg .gate.pass .state{color:var(--accent)}
.qg .gate.fail .state{color:#c0392b}
.qg .gate.na .state{color:var(--muted)}
.qg .gate .why{color:var(--muted)}
.qg .verdict{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;font-size:13px}
.qg .verdict .chip{font:11px var(--mono);text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:999px;background:var(--well);color:var(--text-2)}
.qg .verdict .chip.ok{background:rgba(47,138,87,.12);color:var(--accent)}
.qg .verdict .chip.no{background:rgba(192,57,43,.1);color:#c0392b}
.qg .nums{font:11.5px/1.8 var(--mono);color:var(--text-2);font-variant-numeric:tabular-nums}
.qg .toggle{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.qg .toggle input{accent-color:var(--accent)}
@media (max-width:560px){.qg .gate{flex-wrap:wrap}.qg .gate .why{width:100%}}
`;

export const qualityMarkup = `
<div class="qg" id="qg">
  <div class="scenarios" role="group" aria-label="Simulated cases">
    <button type="button" data-case="ideal" aria-pressed="true">Ideal spot</button>
    <button type="button" data-case="reflection" aria-pressed="false">White reflection</button>
    <button type="button" data-case="edge" aria-pressed="false">Frame edge</button>
    <button type="button" data-case="moving" aria-pressed="false">Moving window</button>
    <button type="button" data-case="vibration" aria-pressed="false">10 Hz vibration</button>
  </div>
  <div class="plot"><svg id="qg-plot" viewBox="0 0 560 150" role="img" aria-label="Simulated frame positions around the true centre"></svg></div>
  <div class="verdict"><span class="chip" id="qg-chip">—</span><span id="qg-verdict"></span></div>
  <div class="nums" id="qg-nums"></div>
  <div id="qg-gates"></div>
  <label class="toggle"><input type="checkbox" id="qg-fix" checked> Show the current gates (October 2026)</label>
</div>
`;

export const qualityScript = `
const CASES = {
  ideal: {
    label: "Ideal spot",
    offsets: [0.04, -0.03, 0.02, -0.05, 0.01, 0.06, -0.02, 0.03, -0.01, 0.02, -0.04, 0.05, -0.03, 0.01, 0.0],
    truth: 0,
    before: {
      verdict: "Accepted", reason: "no gate needed", mean: "+0.01 px", rejected: 0,
      gates: [["pass","Halo","green halo present"],["pass","Track","first frame"],["pass","Clip","fully inside"],["pass","Drift","no trend"]]
    },
    after: {
      verdict: "Accepted", reason: "15 of 15 frames used; spread and drift inside the limits", mean: "+0.01 px", rejected: 0,
      gates: [["pass","Halo","green halo present"],["pass","Track","first frame"],["pass","Clip","fully inside"],["pass","Drift","no trend"],["pass","Outlier","0 of 15 rejected"]]
    },
    note: "Synthetic σ = 6 px spot. This is the case that always worked: 0.046 px RMS unsaturated, 0.016 px saturated over 20 frames."
  },
  reflection: {
    label: "White reflection",
    offsets: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    truth: null,
    before: {
      verdict: "Accepted (wrong)", reason: "saturation skipped the green test; returned (309.5, 209.5)", mean: "(309.5, 209.5)", rejected: 0,
      gates: [["na","Halo","not checked before the fix"],["na","Track","no context"],["pass","Clip","inside the frame"]]
    },
    after: {
      verdict: "Rejected", reason: "no unsaturated green halo; the candidate is a saturated white block", mean: "—", rejected: 15,
      gates: [["fail","Halo","0 halo px, 100% saturated"],["na","Track","no candidate near the last position"],["pass","Clip","inside the frame"],["fail","Outlier","never enters the window"]]
    },
    note: "A 20×20 px pure-white block. The old detector accepted it at (309.5, 209.5) with 100% saturation."
  },
  edge: {
    label: "Frame edge",
    offsets: [1.92,1.9,1.94,1.91,1.93,1.92,1.9,1.95,1.92,1.91,1.93,1.92,1.9,1.94,1.92],
    truth: 0,
    before: {
      verdict: "Accepted (wrong)", reason: "centroid pulled inward by the missing edge pixels", mean: "+1.92 px", rejected: 0,
      gates: [["pass","Halo","halo exists"],["pass","Track","stable"],["na","Clip","not checked before the fix"]]
    },
    after: {
      verdict: "Rejected", reason: "the candidate touches the frame edge, so it is marked clipped", mean: "—", rejected: 15,
      gates: [["pass","Halo","halo exists but is cut"],["pass","Track","stable"],["fail","Clip","touches x = 0"],["fail","Outlier","frame marked unusable"]]
    },
    note: "True centre x = 2 px; the intensity centroid reports x = 3.9208 px. At x = 5 px the bias is 0.74 px."
  },
  moving: {
    label: "Moving window",
    offsets: [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7],
    truth: 0,
    before: {
      verdict: "Accepted (wrong)", reason: "MAD removes no frames; the mean lags the newest position", mean: "107 px, newest 114 px", rejected: 0,
      gates: [["pass","Halo","clean spot"],["pass","Track","continuously tracked"],["pass","Clip","inside the frame"],["na","Drift","not checked before the fix"]]
    },
    after: {
      verdict: "Rejected", reason: "linear drift of 14 px in 0.42 s exceeds the 2 px limit", mean: "—", rejected: 15,
      gates: [["pass","Halo","clean spot"],["pass","Track","continuously tracked"],["pass","Clip","inside the frame"],["fail","Drift","14 px > 2 px"],["pass","Outlier","0 frames rejected"]]
    },
    note: "15 frames from x = 100 to x = 114: mean 107, 7 px behind the newest frame (≈1.80 mm at the default scale)."
  },
  vibration: {
    label: "10 Hz vibration",
    offsets: [4,4,4,4,4,-2,-2,-2,-2,-2,-2,-2,-2,-2,-2],
    truth: 0,
    before: {
      verdict: "Accepted (wrong)", reason: "MAD cuts the five peaks; survivors have zero variance, so the old code called it stable", mean: "318 px, dx = −0.513 mm", rejected: 5,
      gates: [["pass","Halo","clean spot"],["pass","Track","same position"],["pass","Clip","inside the frame"],["pass","Drift","filtered slope is zero"],["na","Outlier","no rejection cap"]]
    },
    after: {
      verdict: "Rejected", reason: "5 of 15 frames rejected on one side; 33% exceeds the 15% cap", mean: "318 px, dx = −0.513 mm", rejected: 5,
      gates: [["pass","Halo","clean spot"],["pass","Track","same position"],["pass","Clip","inside the frame"],["pass","Drift","filtered slope is zero"],["fail","Outlier","33% > 15% cap"]]
    },
    note: "10 Hz at 30 fps lands on three phases: five frames at +4 px, ten at −2 px. The cap is the fix that exists; the raw-spread pre-check and one-sided test remain recommendations."
  }
};

const qg = document.querySelector("#qg");
if (qg) {
  const plot = qg.querySelector("#qg-plot");
  const chip = qg.querySelector("#qg-chip");
  const verdict = qg.querySelector("#qg-verdict");
  const nums = qg.querySelector("#qg-nums");
  const gates = qg.querySelector("#qg-gates");
  const fix = qg.querySelector("#qg-fix");
  let cur = "ideal";

  const raw = (offsets) => {
    const n = offsets.length;
    const mean = offsets.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(offsets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, n - 1));
    return { mean, sd };
  };

  const draw = () => {
    const c = CASES[cur];
    const st = fix.checked ? c.after : c.before;
    const w = 560, h = 150, left = 44, right = 540, mid = (left + right) / 2;
    const span = 10;
    const x = (v) => mid + (v / span) * ((right - left) / 2);
    let svg = '<line x1="' + left + '" y1="96" x2="' + right + '" y2="96" stroke="var(--rule)"/>';
    svg += '<line x1="' + mid + '" y1="18" x2="' + mid + '" y2="112" stroke="var(--faint)" stroke-dasharray="4 4"/>';
    svg += '<text x="' + mid + '" y="132" text-anchor="middle">true centre</text>';
    svg += '<text x="' + left + '" y="132">−10 px</text><text x="' + right + '" y="132" text-anchor="end">+10 px</text>';
    c.offsets.forEach((o, i) => {
      const bad = st.verdict.includes("wrong") || c === CASES.reflection;
      const cx = x(o), cy = 96 - (i % 5) * 13 + 26;
      svg += '<circle class="dot' + (bad ? ' bad' : '') + '" cx="' + cx + '" cy="' + cy + '" r="3.2"/>';
    });
    plot.innerHTML = svg;
    chip.textContent = st.verdict;
    chip.className = "chip " + (st.verdict.startsWith("Accepted") && !st.verdict.includes("wrong") ? "ok" : "no");
    verdict.textContent = st.reason;
    const r = raw(c.offsets);
    nums.textContent = "raw mean " + (r.mean >= 0 ? "+" : "") + r.mean.toFixed(2) + " px · raw spread " + r.sd.toFixed(2) +
      " px · output mean " + (st.mean || "—") + " · frames dropped " + st.rejected + "/15";
    gates.innerHTML = st.gates.map(([state, name, why]) =>
      '<div class="gate ' + state + '"><span class="state">' + state + '</span><span><b>' + name + '</b> <span class="why">— ' + why + '</span></span></div>'
    ).join("");
  };

  for (const b of qg.querySelectorAll(".scenarios button")) {
    b.addEventListener("click", () => {
      cur = b.dataset.case;
      for (const x of qg.querySelectorAll(".scenarios button")) x.setAttribute("aria-pressed", String(x === b));
      draw();
    });
  }
  fix.addEventListener("change", draw);
  draw();
}
`;
