// Builds the five English pages of the rail_measure site from Markdown content.
// Run: node build.mjs  →  index.html, verticality.html, spatial.html, defect.html, how-i-built-it.html
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { page } from "./site.mjs";
import { spatialCss, spatialTwoMarkup, spatialClearMarkup, spatialScript } from "./figures/spatial.mjs";
import { qualityCss, qualityMarkup, qualityScript } from "./figures/quality.mjs";
import { spotCss, spotMarkup, spotScript } from "./figures/spotlab.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const contentDir = process.env.RAIL_SITE_CONTENT || join(HERE, "content");
const VERSION = readFileSync(join(HERE, "VERSION"), "utf8").trim();
const fig = JSON.parse(readFileSync(join(HERE, "vendor", "verticality-embed.json"), "utf8"));
const samples = JSON.parse(readFileSync(join(HERE, "img", "defect", "index.json"), "utf8"));
const LABEL_EN = {
  normal: "No visible defect",
  clearance_engagement: "Spacing or engagement",
  deformation_crack_aging: "Deformation, cracks, aging",
  missing_loose_part: "Missing or loose part",
  oil_dirt: "Oil, dirt, foreign object",
  rust_corrosion: "Rust",
  wear: "Wear",
  wire_rope_damage: "Wire-rope damage",
};
for (const c of samples.classes) c.labelEn = LABEL_EN[c.code] || c.label;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");

const classButtons = samples.classes
  .map(
    (c, i) =>
      `<button type="button" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-file="${esc(c.file)}" data-label="${esc(c.labelEn)}" data-source="${esc(c.source)}">${esc(c.labelEn)}</button>`
  )
  .join("");

const gallery = `
<div class="gallery">
  <div class="classes" role="radiogroup" aria-label="Defect classes">${classButtons}</div>
  <figure class="sample"><img id="defect-img" src="img/defect/${esc(samples.classes[0].file)}" alt="${esc(samples.classes[0].labelEn)}"><figcaption id="defect-cap">${esc(samples.classes[0].labelEn)} · sample ${esc(samples.classes[0].source)}</figcaption></figure>
</div>`;

const EMBED_EN = {
  "小车高度：方向键上下移动": "Cart height: use the up and down arrow keys",
  "电梯导轨垂直度测量工装：顶部激光器沿导轨向下打出铅垂光束，爬轨小车用两条同步带履带夹住分段拼接的 T 型导轨，上端导靴夹爪卡住导轨，车上靶板接住光斑，靶板下方相机看透射光斑，下端测距仪测高度。小车下行时，导轨的弯曲带动靶板横移，光斑在靶面上的位移就是该高度的导轨偏差。":
    "Guide-rail verticality rig: a laser at the shaft top projects a plumb beam down the rail. A crawler clamps the segmented T-rail with two timing-belt tracks, its upper guide-shoe jaws grip the rail, a target plate catches the spot, a camera behind the plate images the transmitted spot, and a rangefinder below measures height. As the cart descends, rail curvature moves the plate sideways; the spot displacement is the rail deviation at that height.",
  "超差": "out of tolerance",
  "合格": "within tolerance",
};
const localize = (text) => Object.entries(EMBED_EN).reduce((acc, [a, b]) => acc.split(a).join(b), text);
// The embed writes one line of text into [data-readout]; the side rail shows it as label/value rows.
const PRINCIPLE_READOUT_LINE = "if (readout.textContent !== text) readout.textContent = text;";
const PRINCIPLE_READOUT_ROWS =
  'if (readout.dataset.text !== text) { readout.dataset.text = text; readout.innerHTML = "<dt>Height</dt><dd>" + H.toFixed(2) + " m</dd><dt>dX</dt><dd>" + fmt(dx) + " mm</dd><dt>dY</dt><dd>" + fmt(dy) + " mm</dd><dt>Status</dt><dd class=\\"" + (over ? "bad" : "ok") + "\\">" + (over ? "超差" : "合格") + "</dd>"; }';
const principleScript = () => {
  if (!fig.script.includes(PRINCIPLE_READOUT_LINE)) throw new Error("principle readout line changed");
  return localize(fig.script.replace(PRINCIPLE_READOUT_LINE, PRINCIPLE_READOUT_ROWS));
};

export const FIGURES = {
  principle: {
    html: `<figure class="fig iso fig" data-theme="light">${localize(fig.stage)}<div class="side"><p class="s-hint">Move the pointer up and down to drive the cart</p><p class="s-keys"><kbd>↑</kbd><kbd>↓</kbd> 1 m</p><p class="s-keys"><kbd>Home</kbd> back to the datum</p><div class="s-group"><span>At the cart</span><dl class="s-read" data-readout aria-live="off"></dl></div></div></figure>
<p class="fig-cap"><b>Principle</b> · 20 m compressed to 200 units, lateral offset exaggerated 3×, numbers illustrative</p>`,
    css: fig.css,
    script: principleScript(),
  },
  quality: {
    html: `<figure class="fig">${qualityMarkup}</figure>
<p class="fig-cap"><b>Probes</b> · the frames and windows of issues #20 and #25, run through a JavaScript port of <code>detect_spot()</code> and <code>average_spot_detail()</code>, once with the rules before each fix and once with the current defaults</p>`,
    css: qualityCss,
    script: qualityScript,
  },
  spotlab: {
    html: `<figure class="fig">${spotMarkup}</figure>
<p class="fig-cap"><b>Linked simulation</b> · left, a synthetic frame with the test-suite Gaussian spot; right, the operator panel's target view with its labels translated, driven by a port of the detector; neither is a camera feed</p>`,
    css: spotCss,
    script: spotScript,
  },
  "spatial-two": {
    html: `<figure class="fig">${spatialTwoMarkup}<p class="fig-cap"><b>Two-point distance</b> · drag an endpoint or focus it and use the arrow keys; 1 unit = 3.2 mm, illustrative</p></figure>`,
    css: spatialCss,
    script: spatialScript,
  },
  "spatial-clear": {
    html: `<figure class="fig">${spatialClearMarkup}<p class="fig-cap"><b>Car-top clearance</b> · the obstruction is measured from its lower face; unknown cells are not free space</p></figure>`,
    css: spatialCss,
    script: spatialScript,
  },
  "defect-gallery": {
    html: `<figure class="fig">${gallery}<p class="fig-cap"><b>Samples</b> · eight training photographs, resized to 900 px, watermarks removed; the caption keeps the source id. Labels printed on the equipment itself are part of the equipment, not site copy.</p></figure>`,
    css: `
.gallery .classes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 16px}
.gallery .classes button{appearance:none;border:0;background:var(--well);color:var(--text-2);border-radius:7px;padding:7px 8px;font:12.5px/1.4 var(--sans);cursor:pointer;transition:background .15s,color .15s;text-align:left}
.gallery .classes button:hover{background:var(--well-2);color:var(--ink)}
.gallery .classes button[aria-checked="true"]{background:var(--ink);color:var(--ground)}
.gallery .sample{margin:0}
.gallery .sample img{display:block;width:100%;height:auto;border-radius:10px;background:var(--well);box-shadow:0 0 0 1px var(--rule)}
.gallery .sample figcaption{font-size:12px;color:var(--muted);margin-top:8px}
@media (max-width:560px){.gallery .classes{grid-template-columns:repeat(2,minmax(0,1fr))}}
`,
    script: `
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
`,
  },
};

const NOTE_RE = /^::: note (\d+)\s*$/;

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const toc = [];
  let i = 0;
  let secNo = 0;
  const flushPara = (buf) => {
    if (buf.length) {
      out.push(`<p>${inline(buf.join(" "))}</p>`);
      buf.length = 0;
    }
  };
  const para = [];
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { flushPara(para); i++; continue; }

    const h2 = line.match(/^##\s+(.+?)\s*\{\{?#([a-z0-9-]+)\}?\}\s*$/);
    if (h2) {
      flushPara(para);
      secNo++;
      toc.push([h2[2], h2[1]]);
      out.push(`<h2 class="sec" id="${h2[2]}"><span>${inline(h2[1])}</span><i>${String(secNo).padStart(2, "0")}</i></h2>`);
      i++;
      continue;
    }
    if (/^###\s+/.test(line)) {
      flushPara(para);
      out.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`);
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      flushPara(para);
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const note = line.match(NOTE_RE);
    if (note) {
      flushPara(para);
      const buf = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") buf.push(lines[i++]);
      i++;
      const n = note[1];
      const html = `<aside class="note" id="note-${n}"><b>${n}</b>${inline(buf.join(" "))}</aside>`;
      const last = out[out.length - 1];
      if (last && last.startsWith("<p>")) {
        const marked = last.replace(/<\/p>$/, `<sup class="ref"><a href="#note-${n}" id="ref-${n}">${n}</a></sup></p>`);
        out[out.length - 1] = `<div class="noted">${html}${marked}</div>`;
      } else {
        out.push(`<div class="noted">${html}</div>`);
      }
      continue;
    }
    const figKey = line.match(/^\[\[figure:([a-z-]+)\]\]$/);
    if (figKey) {
      flushPara(para);
      const f = FIGURES[figKey[1]];
      if (!f) throw new Error(`unknown figure: ${figKey[1]}`);
      out.push(f.html);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      flushPara(para);
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(1).filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map(cells);
      const isNum = (c) => /^[\d.,%±+\-–—\s]+$/.test(c) && /\d/.test(c);
      out.push(
        `<table class="table"><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c, i) => i === 0 && r.length > 1
            ? `<th scope="row">${inline(c)}</th>`
            : `<td${isNum(c) ? ' class="num"' : ""}>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara(para);
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushPara(para);
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ""));
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushPara(para);
      const buf = [];
      while (i < lines.length && lines[i].startsWith("> ")) buf.push(lines[i++].slice(2));
      out.push(`<blockquote><p>${inline(buf.join(" "))}</p></blockquote>`);
      continue;
    }
    if (line.startsWith("---")) {
      flushPara(para);
      out.push("<hr>");
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara(para);
  return { html: out.join("\n"), toc };
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("missing frontmatter");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

const ORDER = ["index", "verticality", "spatial", "defect", "how-i-built-it"];

const PAGES = {
  index: { file: "index.html", nav: "rail_measure", current: "index.html", figures: [], strip: true },
  verticality: { file: "verticality.html", nav: "Verticality", current: "verticality.html", figures: ["principle", "spotlab", "quality"] },
  spatial: { file: "spatial.html", nav: "Spatial measurement", current: "spatial.html", figures: ["spatial-two", "spatial-clear"] },
  defect: { file: "defect.html", nav: "Defect recognition", current: "defect.html", figures: ["defect-gallery"] },
  "how-i-built-it": { file: "how-i-built-it.html", nav: "How I built it", current: "how-i-built-it.html", figures: [] },
};

const strip = `<div class="strip">${["camera", "pi", "jaw", "tracks", "target"]
  .map((n) => `<a href="verticality.html" tabindex="-1"><img src="img/photos/${n}.jpg" alt=""></a>`)
  .join("")}</div>`;
const stripCss = `.strip{margin:26px 0 40px}`;

export function buildAll() {
  const written = [];
  ORDER.forEach((slug, idx) => {
    const cfg = PAGES[slug];
    const raw = readFileSync(join(contentDir, `${slug}.md`), "utf8").replaceAll(String.fromCharCode(13), "");
    const { meta, body } = parseFrontmatter(raw);
    const { html, toc } = renderMarkdown(body);
    const extraCss = cfg.figures.map((k) => FIGURES[k].css).join("\n") + (cfg.strip ? stripCss : "");
    const extraScript = [...new Set(cfg.figures.flatMap((k) => FIGURES[k].script))].join("\n");
    const scriptFile = `${slug}.js`;
    if (extraScript) writeFileSync(join(HERE, scriptFile), extraScript);
    const prevSlug = ORDER[idx - 1], nextSlug = ORDER[idx + 1];
    const prev = prevSlug ? [PAGES[prevSlug].file, PAGES[prevSlug].nav] : null;
    const next = nextSlug ? [PAGES[nextSlug].file, PAGES[nextSlug].nav] : null;
    const out = page({
      title: meta.title || cfg.nav,
      nav: meta.nav || cfg.nav,
      subtitle: meta.subtitle || meta.nav || cfg.nav,
      lede: inline(meta.lede || ""),
      meta: `<span>v${VERSION}</span>${(meta.meta || "").split("·").map((s) => s.trim()).filter((s) => s && !s.includes(`v${VERSION}`)).map((s) => `<span>${inline(s)}</span>`).join("")}`,
      toc,
      body: (cfg.strip ? strip : "") + html,
      prev, next, current: cfg.current, extraCss, scriptSrc: extraScript ? scriptFile : "",
    });
    const path = join(HERE, cfg.file);
    writeFileSync(path, out);
    written.push(path);
  });
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = buildAll();
  for (const f of files) console.log("wrote", relative(process.cwd(), f));
}
