// Shared shell for the five-page rail_measure site.
// Layout follows skills.wheresryan.sh/anatomy: 168 px rail, 550 px column,
// site nav above the page table of contents, serif italic section numbers.
import { baseStyle } from "./shared/site-style.mjs";

export const SITE_NAV = [
  ["index.html", "rail_measure"],
  ["verticality.html", "Verticality"],
  ["spatial.html", "Spatial measurement"],
  ["defect.html", "Defect recognition"],
  ["how-i-built-it.html", "How I built it"],
];

const MARK = `<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M9 2v22M17 2v22M6 6h14M6 13h14M6 20h14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="9.5" r="1.6" fill="var(--accent)"/></svg>`;

// Fonts are served from ../shared/fonts (Fontsource woff2, SIL OFL 1.1) so the site
// does not depend on Google Fonts, which is slow or blocked on some networks.
const FONT_DIR = "shared/fonts";
const RANGES = {
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
};
const FACES = [
  // inscription capitals: brand and page title
  ["Cinzel", "cinzel", 500, "normal"], ["Cinzel", "cinzel", 600, "normal"],
  // display: lede and headings
  ["Cormorant Garamond", "cormorant-garamond", 500, "normal"], ["Cormorant Garamond", "cormorant-garamond", 500, "italic"],
  ["Cormorant Garamond", "cormorant-garamond", 600, "normal"],
  // small capitals: table heads, labels, meta
  ["Cormorant SC", "cormorant-sc", 500, "normal"], ["Cormorant SC", "cormorant-sc", 600, "normal"],
  // book text and marginalia
  ["EB Garamond", "eb-garamond", 400, "normal"], ["EB Garamond", "eb-garamond", 400, "italic"],
  ["EB Garamond", "eb-garamond", 500, "normal"], ["EB Garamond", "eb-garamond", 600, "normal"],
  // small text: navigation, tables, controls
  ["Crimson Pro", "crimson-pro", 400, "normal"], ["Crimson Pro", "crimson-pro", 400, "italic"],
  ["Crimson Pro", "crimson-pro", 500, "normal"], ["Crimson Pro", "crimson-pro", 600, "normal"],
  // figures and code
  ["Courier Prime", "courier-prime", 400, "normal"], ["Courier Prime", "courier-prime", 700, "normal"],
];
const fontFaces = FACES.flatMap(([family, file, weight, style]) =>
  Object.entries(RANGES).map(([sub, range]) =>
    `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(${FONT_DIR}/${file}-${sub}-${weight}-${style}.woff2) format("woff2");unicode-range:${range}}`
  )
).join("\n");
// The faces above the fold are needed on first paint.
const FONT_PRELOAD = ["eb-garamond-latin-400-normal", "cormorant-garamond-latin-500-normal", "crimson-pro-latin-400-normal"]
  .map((f) => `<link rel="preload" href="${FONT_DIR}/${f}.woff2" as="font" type="font/woff2" crossorigin>`)
  .join("");

export const siteStyle = `
:root{
  --cjk:"Noto Serif SC","Songti SC","STSong","SimSun",serif;
  --inscription:"Cinzel","Trajan Pro",var(--cjk);
  --display:"Cormorant Garamond","EB Garamond",var(--cjk);
  --caps:"Cormorant SC","EB Garamond",var(--cjk);
  --serif:"EB Garamond",Garamond,var(--cjk);
  --sans:"Crimson Pro","EB Garamond",var(--cjk);
  --mono:"Courier Prime","Courier New",ui-monospace,monospace;
}
body{font-size:15px;line-height:1.55;font-kerning:normal;font-variant-ligatures:common-ligatures;text-rendering:optimizeLegibility}
.article p,.article li{text-wrap:pretty}
.article>p,.article .noted>p,.article>ul li,.article>ol li{font-family:var(--serif)}
.article>p,.article .noted>p,.article>ul li,.article>ol li{font-size:18px;line-height:1.64;letter-spacing:.004em;color:color-mix(in srgb,var(--ink) 90%,var(--ground));
  font-variant-numeric:oldstyle-nums proportional-nums;font-variant-ligatures:common-ligatures discretionary-ligatures;hanging-punctuation:first}
/* a two-line initial opens the first section, as in a printed book */
.article>.sec:first-child+p::first-letter{float:left;font:500 3.6em/.78 var(--display);margin:.1em .1em 0 0;color:var(--ink)}
@supports (initial-letter:2){.article>.sec:first-child+p::first-letter{float:none;initial-letter:2;font-size:1em;line-height:inherit;margin:0 .3em 0 0}}
.article em{font-size:1em}
.article strong{font-weight:600}
.article p code,.article li code{font-size:13px}
.wrap{--gap:36px;grid-template-columns:var(--rail) var(--column) var(--rail);padding-block:40px 110px}
.rail{font-size:15px;line-height:1.5}
.rail .brand{margin-bottom:26px;font:600 14px var(--inscription);letter-spacing:.06em}
.rail .sites{margin:0 0 30px}
.rail .sites ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.rail .sites a{color:var(--muted);text-decoration:none;display:block}
.rail .sites a:hover{color:var(--ink)}
.rail .sites a[aria-current="page"]{color:var(--ink);text-decoration:underline;text-decoration-color:var(--faint);text-underline-offset:3px}
.rail .toc{display:grid;gap:6px}
.rail .toc a{display:block}
.rail .toc li{opacity:.9}
.rail .toc a.on{color:var(--ink)}
main{grid-column:2}
.masthead{border-bottom:1px solid var(--rule);padding-bottom:12px;margin-bottom:30px}
.top{display:none}
.title{font:600 14px var(--inscription);letter-spacing:.06em;margin:0}
.title span{font:italic 400 16px var(--serif);letter-spacing:0;color:var(--muted)}
.lede{font:italic 500 26px/1.3 var(--display);color:var(--text-2);letter-spacing:.002em;margin:0 0 16px;max-width:30em;text-wrap:balance}
.meta{margin:12px 0 46px;padding-top:12px;border-top:1px solid var(--rule);font:400 14.5px/1.5 var(--sans);letter-spacing:.015em;font-variant-numeric:lining-nums;color:var(--muted)}
.meta>span:first-child{font:600 13.5px/1.5 var(--caps);letter-spacing:.06em;color:var(--text-2)}
.meta>span+span::before{content:"·";color:var(--faint)}
.article{position:relative}
.article h3{font:italic 500 23px/1.25 var(--display);margin:38px 0 10px}
.article p{margin:0 0 15px}
.article ul,.article ol{margin:0 0 16px;padding-left:20px}
.article li{margin:0 0 6px}
.article blockquote{margin:34px 0 36px}
.article blockquote p{font-size:25px;line-height:1.32}
.article pre{background:var(--well);padding:14px 16px;border-radius:8px;overflow-x:auto;font:13px/1.65 var(--mono);margin:0 0 18px}
.article pre code{background:none;padding:0}
.article code{font-size:12px}
.article hr{border:0;border-top:1px solid var(--rule);margin:40px 0}
.sec{font:600 28px/1.15 var(--display);margin:76px 0 20px;scroll-margin-top:24px}
.sec i{font:italic 500 21px var(--display)}
.sec:first-child{margin-top:0}
.noted{position:relative}
.note{position:absolute;left:calc(100% + var(--gap));top:-1px;width:var(--rail);font:italic 400 14px/1.45 var(--serif);color:var(--muted);margin:0}
.note b{position:absolute;left:-13px;font:500 13px var(--caps);color:var(--faint)}

.table-wrap{margin:24px 0 30px;overflow-x:auto;-webkit-overflow-scrolling:touch}
.table{width:100%;border-collapse:collapse;margin:0;font-size:15px;line-height:1.4}
.table th,.table td{padding:8px 14px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--rule)}
.table thead th{font:600 14px/1.3 var(--caps);letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--rule)}
.table tbody th{font-weight:500;color:var(--text-2);white-space:nowrap;padding-right:26px}
.table .num{font:13px/1.5 var(--mono);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.table tbody tr:last-child th,.table tbody tr:last-child td{border-bottom:0}
.ref a{color:var(--muted);text-decoration:none;font:500 12px var(--caps);padding-left:1px}
.ref a:hover{color:var(--ink)}
.note:target{color:var(--ink)}

.fig{margin:40px 0 34px;position:relative}
.fig svg,.fig canvas{display:block;width:100%;height:auto}
.fig .side{position:absolute;top:36%;left:calc(100% + var(--gap));width:var(--rail);font-size:14px;line-height:1.55;color:var(--muted)}
.fig .side .s-hint{font-style:italic}
.fig .side kbd{font-size:10.5px;padding:1px 4px}
.fig .side .s-hint{margin:0 0 4px}
.fig .side .s-keys{margin:0 0 3px;display:flex;flex-wrap:wrap;align-items:center;gap:3px 4px}
.fig .side .s-group{margin-top:12px;padding-top:10px;border-top:1px solid var(--rule)}
.fig .side .s-group>span{display:block;font:600 13px/1.4 var(--caps);color:var(--faint);letter-spacing:.06em;margin-bottom:6px}
.fig .side dl.s-read{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 10px;margin:0;font:11.5px/1.75 var(--mono)}
.fig .side dl.s-read dt{color:var(--muted);font:13.5px/1.45 var(--sans)}
.fig .side dl.s-read dd{margin:0;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.fig .side dl.s-read dd.ok{color:var(--accent)}
.fig .side dl.s-read dd.bad{color:#c0392b}
.fig .side .s-seg{display:inline-flex;padding:2px;border-radius:7px;background:var(--well)}
.fig .side .s-seg button{appearance:none;border:0;background:none;border-radius:5px;padding:3px 9px;font:13.5px/1.4 var(--sans);color:var(--text-2);cursor:pointer}
.fig .side .s-seg button:hover:not(:disabled){background:var(--card);color:var(--ink);box-shadow:0 0 0 1px var(--rule)}
.fig .side .s-seg button:disabled{color:var(--faint);cursor:default}
.fig .side .s-seg kbd{font-size:9.5px;padding:0 3px;margin-left:4px;background:none;color:var(--faint)}
.fig .readout{color:var(--ink);font:12px/1.7 var(--mono);margin-top:8px;font-variant-numeric:tabular-nums}
.fig-cap{color:var(--muted);font:italic 400 15px/1.45 var(--serif);margin:-24px 0 34px;text-wrap:pretty}
.fig-cap b{font:600 14px var(--caps);letter-spacing:.04em;color:var(--text-2);margin-right:4px}
.fig-cap code{font-size:11.5px;font-style:normal}
.pager{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--rule);margin-top:90px;padding-top:18px;font:italic 500 19px var(--display)}
.pager a{text-decoration:none;color:var(--text-2)}
.pager a:hover{color:var(--ink)}
.pager span{color:var(--muted);font-size:12px}
@media (max-width:1100px){
  .wrap{display:block;padding:24px 16px 90px}
  .rail{display:none}
  .masthead{margin-bottom:24px}
  .top{display:block;position:sticky;top:0;z-index:5;margin:0 -16px 14px;padding:0 16px;padding-top:env(safe-area-inset-top,0px);
    background:color-mix(in srgb,var(--ground) 86%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(12px);backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid var(--rule)}
  .top ul{list-style:none;display:flex;gap:20px;margin:0;padding:0;font-size:15.5px;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)}
  .top ul::-webkit-scrollbar{display:none}
  .top li{flex:none}
  .top li:last-child{padding-right:28px}
  .top a{display:block;padding:11px 0 10px;color:var(--muted);text-decoration:none;white-space:nowrap}
  .top a[aria-current="page"]{color:var(--ink);box-shadow:inset 0 -1.5px 0 var(--ink)}
  .sec{scroll-margin-top:64px}
  .noted{position:static;display:flex;flex-direction:column}
  .noted>p{order:0}
  .note{order:1;position:static;width:auto;margin:-6px 0 16px;padding-left:14px;border-left:1px solid var(--rule)}
  .note b{position:static;margin-right:6px}
  .fig .side{position:static;width:auto;margin-top:10px}
  .fig-cap{margin-top:8px}
  .pager{margin-top:64px}
  .pager a{padding:6px 0}
}
@media (hover:none) and (pointer:coarse){
  .fig .side .s-keys,.fig .side .s-seg kbd{display:none}
  .iso-stage,.sp-stage{touch-action:pan-y}
}
.h-touch{display:none}
@media (hover:none){.h-mouse{display:none}.h-touch{display:inline}}
@media (max-width:560px){
  .table-wrap{margin-inline:-16px;padding-inline:16px}
  .table{font-size:14.5px;min-width:calc(var(--cols,2) * 108px)}
  .table tbody th{white-space:normal;padding-right:14px}
  .table th,.table td{padding:8px 12px 8px 0}
  .lede{font-size:23px}
  .sec{font-size:25px}
  .article>p,.article .noted>p,.article>ul li,.article>ol li{font-size:17.5px;line-height:1.6}
  .meta{gap:2px 14px}
  .meta>span+span::before{content:none}
  .article blockquote p{font-size:22px}
  .fig{margin:32px 0 28px}
}
`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));

const sites = (current) =>
  SITE_NAV.map(
    ([href, label]) =>
      `<li><a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a></li>`
  ).join("");

export function page({ title, nav, subtitle, lede, meta, toc, body, prev, next, current, extraCss = "", scriptSrc = "" }) {
  const tocHtml = toc.length
    ? `<ol class="toc" aria-label="On this page">${toc
        .map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`)
        .join("")}</ol>`
    : "";
  const pager = `<div class="pager">${
    prev ? `<a href="${prev[0]}">← ${prev[1]}</a>` : "<span></span>"
  }${next ? `<a href="${next[0]}">${next[1]} →</a>` : ""}</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${title === "rail_measure" ? `rail_measure · ${esc(subtitle || "offline rail inspection")}` : `${esc(title)} · rail_measure`}</title>${FONT_PRELOAD}<style>${fontFaces}${baseStyle}${siteStyle}${extraCss}</style></head><body><div class="wrap">
<aside class="rail"><a class="brand" href="index.html">${MARK}rail_measure</a><nav class="sites" aria-label="Site"><ul>${sites(current)}</ul></nav>${tocHtml}</aside>
<main>
<nav class="top" aria-label="Site"><ul>${sites(current)}</ul></nav>
<header class="masthead"><h1 class="title">rail_measure <span>· ${esc(subtitle || nav)}</span></h1></header>
<p class="lede">${lede}</p>
${meta ? `<div class="meta">${meta}</div>` : ""}
<article class="article">${body}</article>
${pager}
</main></div>
<script>
const dark = matchMedia("(prefers-color-scheme: dark)");
for (const box of document.querySelectorAll(".fig.iso")) {
  const sync = () => { const t = document.documentElement.dataset.theme; box.dataset.theme = t ? t : dark.matches ? "dark" : "light"; };
  sync(); dark.addEventListener("change", sync);
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
// Figures steered by hovering get no pointermove from a tap; replay the tap as one.
for (const stage of document.querySelectorAll(".iso-stage,.sp-stage")) {
  stage.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse") return;
    stage.dispatchEvent(new PointerEvent("pointermove", { clientX: ev.clientX, clientY: ev.clientY, pointerType: ev.pointerType, bubbles: true }));
  });
}
const here = document.querySelector('.top a[aria-current="page"]');
if (here) here.parentElement.parentElement.scrollLeft = here.offsetLeft - 16;
const links = [...document.querySelectorAll(".toc a")];
const marks = [...document.querySelectorAll("h2.sec[id]")];
const syncRail = () => {
  if (!marks.length) return;
  const y = scrollY + 120;
  let cur = marks[0];
  for (const s of marks) if (s.getBoundingClientRect().top + scrollY <= y) cur = s;
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) cur = marks[marks.length - 1];
  for (const a of links) a.classList.toggle("on", a.getAttribute("href") === "#" + cur.id);
};
addEventListener("scroll", syncRail, { passive: true });
syncRail();
</script>${scriptSrc ? `<script src="${scriptSrc}" defer></script>` : ""}</body></html>`;
}
