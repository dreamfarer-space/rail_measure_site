// 站点共用设计 token 与三栏版式：从 docs/intro/build.mjs 抽出，intro 与 features 共用。
// 只放结构性样式；页面专属规则（如 .fig.iso 配色）留在各页 build.mjs。
export const baseStyle = `
/* 版式：左目录 168 · 正文 550 · 右旁注 168，三栏居中；窄屏只留正文，旁注随段落内联 */
:root{
  --ground:#fafafa; --ink:#171717; --text-2:#525252; --muted:#8f8f8f; --faint:#bdbdbd;
  --rule:#ebebeb; --well:#f1f1f1; --card:#ffffff; --accent:#2f8a57;
  --sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;
  --serif:"EB Garamond","Noto Serif SC","Songti SC",Georgia,serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --column:550px; --rail:168px; --gap:48px;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --ground:#0e0e0e; --ink:#ececec; --text-2:#a8a8a8; --muted:#767676; --faint:#4a4a4a;
  --rule:#232323; --well:#1b1b1b; --card:#151515; --accent:#5fcf91; color-scheme:dark}}
:root[data-theme="dark"]{
  --ground:#0e0e0e; --ink:#ececec; --text-2:#a8a8a8; --muted:#767676; --faint:#4a4a4a;
  --rule:#232323; --well:#1b1b1b; --card:#151515; --accent:#5fcf91; color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.75 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:underline;text-decoration-color:var(--faint);text-underline-offset:3px}
a:hover{text-decoration-color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
em{font-family:var(--serif);font-style:italic;font-size:1.06em}
code,kbd{font:12.5px/1 var(--mono);background:var(--well);padding:2px 5px;border-radius:4px;color:var(--ink)}
.wrap{display:grid;grid-template-columns:var(--rail) var(--column) var(--rail);column-gap:var(--gap);justify-content:center;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:56px 120px}
.rail{position:sticky;top:calc(56px + env(safe-area-inset-top,0px));align-self:start;font-size:13.5px;line-height:1.95}
.rail .brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:500;margin-bottom:28px}
.rail .brand svg{width:26px;height:26px;flex:none}
.rail ol{list-style:none;margin:0;padding:0}
.rail a{color:var(--muted);text-decoration:none}
.rail a:hover,.rail a.on{color:var(--ink)}
main{min-width:0;grid-column:2}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.top h1{font-size:15px;font-weight:600;margin:0}
.top h1 span{font-weight:400;color:var(--muted)}
.lede{font-size:16px;margin:18px 0 0}
.strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;border-block:1px solid var(--rule);padding-block:16px;margin-top:22px}
.strip img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;filter:grayscale(1) contrast(.9) brightness(1.08);opacity:.85;transition:filter .3s,opacity .3s}
.strip a:hover img{filter:none;opacity:1}
.meta{display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--muted);font-size:13.5px;margin:14px 0 36px}
.meta>span+span::before{content:"·";margin-right:10px;color:var(--faint)}
p{margin:0 0 16px}
.para{position:relative}
.ref{font-size:10px;color:var(--muted);margin-left:1px}
.note{float:right;clear:right;width:var(--rail);margin-right:calc(-1 * (var(--rail) + var(--gap)));font-size:12.5px;line-height:1.6;color:var(--muted);position:relative;top:.3em}
.note b{position:absolute;left:-14px;font-weight:400;font-size:10px}
.figure{margin:56px 0 40px;position:relative}
.figure .iso-stage{outline:none;cursor:ns-resize;touch-action:pan-x}
.figure svg{display:block;width:100%;height:auto}
.figure .side{position:absolute;top:44%;left:calc(100% + var(--gap));width:var(--rail);font-size:12.5px;color:var(--muted);line-height:1.9}
.figure .side kbd{font-size:11px;padding:1px 5px}
.figure .readout{color:var(--ink);font:12.5px/1.6 var(--mono);margin-top:10px;font-variant-numeric:tabular-nums;white-space:normal}
.sec{display:flex;align-items:center;gap:16px;font-size:15px;font-weight:600;margin:88px 0 24px;scroll-margin-top:40px}
.sec::after{content:"";flex:1;height:1px;background:var(--rule);order:1}
.sec i{order:2;font-family:var(--serif);font-weight:400;color:var(--muted);font-size:16px}
blockquote{margin:28px 0 30px;padding:0}
blockquote p{font-family:var(--serif);font-size:27px;line-height:1.35;margin:0 0 6px;text-wrap:balance}
blockquote cite{font-style:normal;font-size:12.5px;color:var(--muted)}
.keys{border-top:1px solid var(--rule);margin:22px 0 28px}
.keys div{display:grid;grid-template-columns:100px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid var(--rule)}
.keys dt{margin:0}.keys dd{margin:0;color:var(--text-2)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px 18px;margin:30px 0 26px;text-align:center}
.grid figure{margin:0}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;filter:grayscale(1) contrast(.92) brightness(1.06);transition:filter .35s}
.grid figure:hover img{filter:none}
.grid figcaption{font-size:13px;line-height:1.45;margin-top:8px}
.grid figcaption span{display:block;color:var(--muted)}
.wide{margin:30px 0 10px}
.wide img{width:100%;border-radius:8px;display:block}
.wide figcaption{font-size:12.5px;color:var(--muted);margin-top:8px}
.steps{list-style:none;margin:22px 0 28px;padding:0;border-top:1px solid var(--rule)}
.steps li{display:grid;grid-template-columns:28px 1fr;gap:6px;padding:14px 0;border-bottom:1px solid var(--rule);color:var(--text-2)}
.steps li::before{content:attr(data-n);color:var(--faint);font-variant-numeric:tabular-nums}
.steps b{color:var(--ink);font-weight:600}
.card{background:var(--card);border-radius:12px;box-shadow:0 0 0 1px var(--rule),0 1px 2px rgb(0 0 0/.04);padding:6px 20px;margin:24px 0 26px}
.card div{display:grid;grid-template-columns:116px 1fr;gap:16px;padding:16px 0;border-bottom:1px solid var(--rule)}
.card div:last-child{border-bottom:0}
.card dt{color:var(--muted);font-size:13.5px}.card dd{margin:0}
.card dd small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
pre{background:var(--card);box-shadow:0 0 0 1px var(--rule);border-radius:10px;padding:16px 18px;overflow-x:auto;font:12.5px/1.7 var(--mono);margin:22px 0 26px}
pre .c{color:var(--muted)}
ul.plain{margin:0 0 18px;padding-left:1.1em;color:var(--text-2)}
ul.plain li{margin-bottom:10px}
ul.plain b{color:var(--ink)}
footer{margin-top:96px;padding-top:18px;border-top:1px solid var(--rule);color:var(--muted);font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media (max-width:1100px){
  .wrap{grid-template-columns:minmax(0,var(--column));padding-block:36px 96px}
  .rail{display:none} main{grid-column:1}
  .note{float:none;display:block;width:auto;margin:8px 0 0;padding-left:14px;top:0}
  .note b{left:0}
  .figure .side{position:static;width:auto;margin-top:12px}
}
@media (max-width:520px){
  .strip{grid-template-columns:repeat(3,1fr)} .strip a:nth-child(n+4){display:none}
  .grid{grid-template-columns:repeat(2,1fr)}
  .keys div,.card div{grid-template-columns:1fr;gap:4px}
  blockquote p{font-size:23px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
