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

export const siteStyle = `
body{font-size:14px;line-height:1.52}
.wrap{--gap:36px;grid-template-columns:var(--rail) var(--column) var(--rail);padding-block:40px 110px}
.rail{font-size:13px;line-height:1.55}
.rail .brand{margin-bottom:26px;font-size:13.5px}
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
.title{font-size:14px;font-weight:600;margin:0}
.title span{font-weight:400;color:var(--muted)}
.lede{font-size:16.5px;line-height:1.5;margin:0 0 12px;text-wrap:pretty}
.meta{margin:10px 0 42px}
.article{position:relative}
.article h3{font-size:14px;font-weight:600;margin:34px 0 10px}
.article p{margin:0 0 15px}
.article ul,.article ol{margin:0 0 16px;padding-left:20px}
.article li{margin:0 0 6px}
.article blockquote{margin:34px 0 36px}
.article blockquote p{font-size:24px;line-height:1.35}
.article pre{background:var(--well);padding:14px 16px;border-radius:8px;overflow-x:auto;font:12px/1.7 var(--mono);margin:0 0 18px}
.article pre code{background:none;padding:0}
.article code{font-size:12px}
.article hr{border:0;border-top:1px solid var(--rule);margin:40px 0}
.sec{font-size:14px;margin:76px 0 18px;scroll-margin-top:24px}
.sec:first-child{margin-top:0}
.noted{position:relative}
.note{position:absolute;left:calc(100% + var(--gap));top:-3px;width:var(--rail);font-size:11.5px;line-height:1.55;color:var(--muted);margin:0}
.note b{position:absolute;left:-13px;font-weight:400;font-size:10px;color:var(--faint)}

.table{width:100%;border-collapse:collapse;margin:24px 0 30px;font-size:12.5px;line-height:1.5}
.table th,.table td{padding:8px 14px 8px 0;text-align:left;vertical-align:top;border-bottom:1px solid var(--rule)}
.table thead th{font-size:10.5px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--rule)}
.table tbody th{font-weight:500;color:var(--text-2);white-space:nowrap;padding-right:26px}
.table .num{font:11.5px/1.5 var(--mono);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.table tbody tr:last-child th,.table tbody tr:last-child td{border-bottom:0}
.ref a{color:var(--muted);text-decoration:none;font:9.5px var(--mono);padding-left:1px}
.ref a:hover{color:var(--ink)}
.note:target{color:var(--ink)}

.fig{margin:40px 0 34px;position:relative}
.fig svg,.fig canvas{display:block;width:100%;height:auto}
.fig .side{position:absolute;top:36%;left:calc(100% + var(--gap));width:var(--rail);font-size:11.5px;line-height:1.7;color:var(--muted)}
.fig .side kbd{font-size:10.5px;padding:1px 4px}
.fig .readout{color:var(--ink);font:11.5px/1.7 var(--mono);margin-top:8px;font-variant-numeric:tabular-nums}
.fig-cap{display:flex;flex-wrap:wrap;gap:2px 10px;color:var(--muted);font-size:11.5px;line-height:1.55;margin:-24px 0 34px}
.fig-cap b{font-weight:500;color:var(--text-2)}
.pager{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--rule);margin-top:90px;padding-top:18px;font-size:13px}
.pager a{text-decoration:none;color:var(--text-2)}
.pager a:hover{color:var(--ink)}
.pager span{color:var(--muted);font-size:12px}
@media (max-width:1100px){
  .wrap{display:block;padding:24px 16px 90px}
  .rail{display:none}
  .top{display:block;margin-bottom:18px}
  .top ul{list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:0;font-size:13px}
  .top a{color:var(--muted);text-decoration:none}
  .top a[aria-current="page"]{color:var(--ink)}
  .noted{position:static}
  .note{position:static;width:auto;margin:8px 0 16px;padding-left:14px;border-left:1px solid var(--rule)}
  .note b{position:static;margin-right:6px}
  .fig .side{position:static;width:auto;margin-top:10px}
  .fig-cap{margin-top:8px}
}
@media (max-width:560px){
  .table{font-size:12px;table-layout:fixed;width:100%}
  .table th,.table td{padding:7px 6px;overflow-wrap:anywhere}
  .lede{font-size:16px}
  .article blockquote p{font-size:21px}
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

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(title)} · rail_measure</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"><style>${baseStyle}${siteStyle}${extraCss}</style></head><body><div class="wrap">
<aside class="rail"><a class="brand" href="index.html">${MARK}rail_measure</a><nav class="sites" aria-label="Site"><ul>${sites(current)}</ul></nav>${tocHtml}</aside>
<main>
<header class="masthead"><nav class="top" aria-label="Site"><ul>${sites(current)}</ul></nav><h1 class="title">rail_measure <span>· ${esc(subtitle || nav)}</span></h1></header>
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
