// 项目介绍页（版式参照 anatomy 介绍页：左侧目录、550px 正文栏、右侧旁注、编号小节）。
// 运行：node build.mjs  → index.html（独立页面，图片在 img/）
//       node build.mjs --artifact <out>  → 不带 doctype/head 的版本，供发布为 Artifact
// 依赖 ../anatomy/verticality/verticality-embed.json（先在 verticality 目录运行 node build.mjs）。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { baseStyle } from "../shared/site-style.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fig = JSON.parse(readFileSync(join(HERE, "..", "anatomy", "verticality", "verticality-embed.json"), "utf8"));
// VERSION：独立维护目录里在上一级，仓库里在上两级
const VERSION = readFileSync([join(HERE, "..", "VERSION"), join(HERE, "..", "..", "VERSION")].find(existsSync), "utf8").trim();

const SECTIONS = [
  ["principle", "光束不动，靶板动"],
  ["robot", "小车，凑近看"],
  ["steps", "一次测量怎么走"],
  ["spot", "光斑怎么认"],
  ["nodes", "两个节点，不联网"],
  ["more", "还能测什么"],
  ["deploy", "部署"],
  ["limits", "使用边界"],
];

const PARTS = [
  ["tracks", "同步带履带", "两侧皮带夹住导轨"],
  ["jaw", "导靴夹爪", "上端卡住导轨两侧"],
  ["pi", "树莓派 5", "节点 1，跑 server.py"],
  ["camera", "相机 1", "隔着亚克力看光斑"],
  ["target", "靶板", "绿色亚克力上贴靶纸"],
  ["endbox", "测距端盒", "下端测距孔朝下"],
];

const head = (n, id, title) => `<h2 class="sec" id="${id}"><span>${title}</span><i>${String(n).padStart(2, "0")}</i></h2>`;
const note = (n, text) => `<sup class="ref">${n}</sup><span class="note"><b>${n}</b>${text}</span>`;

const style = baseStyle + `
.more-link{margin:40px 0 0;font-size:14px}
/* 示意图配色并入页面底色 */
.fig.iso{--anatomy-paper:var(--ground);--anatomy-page:var(--ground)}
`;

const rail = `<nav class="rail" aria-label="目录">
  <a class="brand" href="#top"><svg viewBox="0 0 26 26" aria-hidden="true"><path d="M9 2v22M17 2v22M6 6h14M6 13h14M6 20h14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="9.5" r="1.6" fill="var(--accent)"/></svg>rail_measure</a>
  <ol>${SECTIONS.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("")}</ol>
</nav>`;

const body = `
<div class="wrap" id="top">
${rail}
<main>
  <header class="top"><h1>rail_measure <span>· 电梯导轨与空间尺寸测量巡检系统</span></h1></header>
  <p class="lede">一束激光垂下来，小车沿导轨往下爬。导轨<em>哪里弯</em>，靶纸上就看得见。</p>
  <div class="strip">${["camera", "pi", "jaw", "tracks", "target"].map((n) => `<a href="#robot" tabindex="-1"><img src="img/${n}.jpg" alt=""></a>`).join("")}</div>
  <div class="meta"><span>v${VERSION}</span><span>两个边缘节点</span><span>现场局域网，不连互联网</span><span><a href="#deploy">部署 ↓</a></span></div>

  <p>导轨装得正不正，常见的检查办法是从井道顶部挂一根铅垂钢丝，人在轿顶上逐段量钢丝到导轨的距离。读数靠眼睛，记录靠纸笔，量完一根导轨要好几个人配合。</p>
  <p>rail_measure 把这件事交给一套离线测量系统：井道顶部固定一台激光器，向下打出一条铅垂光束；一台爬轨小车夹在导轨上往下走，车头的靶纸接住光斑，靶纸背面的相机读出光斑位置，测距仪同时给出高度。<em>光束不会弯，导轨会</em>，所以光斑在靶面上挪了多少，导轨在这个高度就偏了多少。</p>

  <div class="figure iso fig" data-theme="light">
    ${fig.stage}
    <div class="side">
      <div>上下移动指针控制小车高度</div>
      <div><kbd>↑</kbd> <kbd>↓</kbd> 逐米 · <kbd>Home</kbd> 回基准</div>
      <div class="readout" data-readout aria-live="off"></div>
    </div>
  </div>

  <p class="para">这是原理示意，按现场工装和小车实物照片画成。小车在 20 m 处设基准，之后每 2 m 停一次记录测点；读数里的 dX、dY 用的是和看板同一套偏差算法，光斑走出 ±3 mm 公差框就判为超差。${note(1, "井道高度压缩为 1 m = 10 个单位，横向偏差放大 3 倍，和靶面刻度同比例。图里导轨各段的偏差是示意数据。")}</p>

  ${head(1, "principle", "光束不动，靶板动")}
  <p>整套垂直度测量只依赖一个事实：</p>
  <blockquote><p>光束是直的，导轨不是。</p><cite>垂直度测量原理</cite></blockquote>
  <p>激光器固定在导轨顶端，光束的平面位置在整次测量中不变。小车被导轨带着走，导轨往哪边弯，靶板就往哪边偏，光斑在靶面上的位置跟着反方向挪。每个测点的 dX、dY 都是光斑相对<em>基准点</em>的偏移，单位毫米；高度来自激光测距仪。</p>
  <p class="para">像素换算成毫米有两条路。做过靶面标定时，光斑像素先去畸变，再经靶面单应性映射到靶面坐标，纸面倾斜和相机绕光轴的旋转都算在里面；没做时只乘一个比例 <code>pixel_size_mm</code>，默认 0.256557 mm/px。${note(2, "未做靶面标定时不修正纸面倾斜和相机旋转，所以正式测量前应先在「标定与设备」页完成镜头畸变和靶面标定。")}</p>
  <p>现场操作只有三个键：</p>
  <dl class="keys">
    <div><dt><kbd>S</kbd> 设为基准</dt><dd>小车停在基准位置、光斑稳定后按下，之后所有测点都相对这里计算。</dd></div>
    <div><dt><kbd>M</kbd> 记录测点</dt><dd>到下一个高度，画面和高度稳定后记录一次 dX、dY 和高度。</dd></div>
    <div><dt><kbd>R</kbd> 清除基准</dt><dd>重新选基准位置，已经记录的测点保留在 Session 里。</dd></div>
  </dl>

  ${head(2, "robot", "小车，凑近看")}
  <p>爬轨小车是一台黑色 3D 打印件拼成的机器，长约三十厘米。底盘是左右两条同步带履带，导轨从中间槽穿过，被两侧皮带夹住；两端各有一个滚轮压在导轨顶面上，上端再用一对橙色导靴卡住导轨两侧。</p>
  <div class="grid">${PARTS.map(([n, a, b]) => `<figure><img src="img/${n}.jpg" alt="${a}" loading="lazy"><figcaption>${a}<span>${b}</span></figcaption></figure>`).join("")}</div>
  <p class="para">车身上从下往上依次是测距端盒、树莓派仓、立塔和相机、电池仓、靶板。靶板是一块贴了靶纸的绿色亚克力，横伸出车体去接光斑；相机站在立塔前，镜头朝上，隔着亚克力看靶纸背面的透射光斑。${note(3, "上面的示意图正是照这几张照片重画的：履带侧板的长圆孔和三角孔、导靴的 V 形倒角、仓口垫高的树莓派，都能在图里找到。")}</p>
  <figure class="wide"><img src="img/side.jpg" alt="爬轨小车侧面：左端导靴夹爪和绿色靶板，中间相机和立塔，右端树莓派仓与测距端盒，下方是履带底盘" loading="lazy"><figcaption>侧面。左端是导靴夹爪和靶板，右端是测距端盒；下方是履带底盘，侧板开孔里能看到同步带的齿。</figcaption></figure>

  ${head(3, "steps", "一次测量怎么走")}
  <p>从开机到出报告，顺序是固定的。前四步决定数据能不能用，后两步只是把它记下来。</p>
  <ol class="steps">
    <li data-n="01"><span><b>开机检查。</b>两个节点在线，相机、激光测距、模型都显示就绪；CPU 温度低于 70°C，内存和磁盘占用低于 75%。</span></li>
    <li data-n="02"><span><b>标定。</b>在「标定与设备」页完成镜头畸变标定和靶面标定，曝光调到光斑不过曝。</span></li>
    <li data-n="03"><span><b>锁定光斑。</b>靶面视图里能看到光斑，徽标显示「光斑锁定」，激光高度在更新。</span></li>
    <li data-n="04"><span><b>设为基准。</b>小车停在基准高度，等光斑稳定后按 <kbd>S</kbd>。</span></li>
    <li data-n="05"><span><b>逐点记录。</b>每到一个高度按 <kbd>M</kbd>，取最近 0.5 秒的多帧平均；光斑还在动就拒绝并说明原因。</span></li>
    <li data-n="06"><span><b>出报告。</b>板端规则引擎根据当前 Session 生成 Markdown 初筛报告，不调用任何云端服务。</span></li>
  </ol>

  ${head(4, "spot", "光斑怎么认")}
  <p>背景是均匀的白纸，光斑是中心可能饱和的亮斑，外圈是纸张散射出的绿色光晕。检测按<em>比背景亮、而且偏绿</em>找候选，再用扣除背景后的亮度加权求亚像素质心。没有绿色光晕的全饱和亮块会被当成金属或白色反光排除掉。</p>
  <p>以下几种帧仍然显示和跟踪，但不进入测量平均：</p>
  <dl class="keys">
    <div><dt><code>clipped</code></dt><dd>光斑被画面或 ROI 边缘截断，质心会往里偏。</dd></div>
    <div><dt><code>ambiguous</code></dt><dd>没有跟踪上下文时出现第二个强候选，能量超过最强者的一半。</dd></div>
    <div><dt><code>elongated</code></dt><dd>长短轴比超过上限，通常是光晕或杂散反射连在主光斑上。</dd></div>
  </dl>
  <p class="para">记录测点时，先按中位数和 MAD 剔除个别跳点，再对窗口内的点做线性拟合：漂移超过 2 px 判为 <code>drift</code>，任一轴标准差超过 2.5 px 判为 <code>jitter</code>，剔除帧数超过 15% 判为 <code>outliers</code>。导轨上约 5 Hz 以上的振动在 0.5 秒窗口内能平均掉。${note(4, "例外是振动频率接近帧率的 1/n 时（30 fps 下约 7.5、10、15、20 Hz），采样会聚成几簇，均值可能偏出一个振幅，这时会被判为 outliers 拒绝。")}</p>

  ${head(5, "nodes", "两个节点，不联网")}
  <p>系统由两台边缘节点和一个操作终端组成，都在现场局域网里工作：</p>
  <dl class="card">
    <div><dt>节点 1 · 垂直度</dt><dd>树莓派 4B/5，相机 1（OAK-D Pro W，只用 IMX378 广角彩色相机），USB 串口激光测距仪<small><code>server.py</code> · WebSocket 8765 推实时数据 · HTTP 8081 报节点状态</small></dd></div>
    <div><dt>节点 2 · 空间与缺陷</dt><dd>鲁班猫 RK3588（或 8GB 树莓派），相机 2（OAK-D Pro W，用红外散斑和 IMU）<small><code>oak_spatial_measure.py</code> · HTTP 8080 提供网页、REST 接口和视频</small></dd></div>
    <div><dt>操作终端</dt><dd>浏览器、Windows 桌面端或 Android 平板<small>React 网页 · Electron · WebView，强光现场可切浅色主题</small></dd></div>
  </dl>
  <p>网页由节点 2 提供，页面直接连节点 1 的 WebSocket 取垂直度数据；节点 2 在后台轮询节点 1 的状态接口，把两边的设备健康汇总到顶部的状态胶囊里。</p>

  ${head(6, "more", "还能测什么")}
  <p>垂直度只是其中一项。同一套终端里还有：</p>
  <ul class="plain">
    <li><b>空间尺寸。</b>相机 2 双目深度：两点三维距离；轿顶上方的竖直净空，包括障碍位置和看不见的区域。确认后冻结成一条可复核的记录。</li>
    <li><b>井道测站。</b>云台扫描四面墙，解算截面净宽、净深和对角线，以及全高净空和井壁偏差。</li>
    <li><b>缺陷检测。</b>对电梯部件做 7 类疑似缺陷的整图分类。模型是弱标注训练的，结果必须人工复核。</li>
    <li><b>巡检报告。</b>板端规则引擎生成 Markdown 初筛报告，Session 可以导出 CSV 和 JSON。</li>
    <li><b>小车控制。</b>两台 ESP32 小车手动点动、云台控制，以及按激光高度闭环的自动下行；顶部常驻急停。</li>
  </ul>

  ${head(7, "deploy", "部署")}
  <p>两个节点各编辑一份配置（相机 MXID、激光串口、节点 1 地址），再用同一个安装脚本装成 systemd 服务：</p>
  <pre><span class="c"># 节点 1：垂直度</span>
sudo CONFIG_FILE=config.pi-verticality.json APP_DIR=/opt/rail_measure \\
  SERVICE_USER="$USER" ./deploy/install.sh
sudo systemctl enable --now rail-measure

<span class="c"># 节点 2：空间与缺陷</span>
sudo CONFIG_FILE=config.pi-spatial-defect.json APP_DIR=/opt/rail_measure \\
  SERVICE_USER="$USER" ./deploy/install.sh
sudo systemctl enable --now rail-measure</pre>
  <p class="para">装好后用浏览器打开 <code>http://&lt;节点2 IP&gt;:8080/</code>。配置文件在 <code>/opt/rail_measure/</code> 下修改，重新运行安装脚本不会覆盖它。${note(5, "主仓库是私有仓库，克隆需要访问权限。硬件接线、串口权限和验收清单见仓库里的 docs/deployment.md。")}</p>

  ${head(8, "limits", "使用边界")}
  <ul class="plain">
    <li><b>是初筛，不是验收。</b>规则引擎的判断不能代替针对具体导轨型号和测量方法的国标允差判定，结论须由持证检验人员确认。</li>
    <li><b>质心有固定偏差的可能。</b>只有光斑亮度关于中心对称时质心才无偏；连在主光斑上的非对称光晕或杂散反射会把它拉向一侧，多帧平均消除不了。</li>
    <li><b>反光过滤只在合成图像上验证过。</b>装了绿色窄带滤光片时，白色反光的边缘也可能偏绿，需要在真机上确认。</li>
    <li><b>标准差不等于精度。</b>窗口标准差和靶面标定残差都不是完整的测量精度，现场重复性和系统偏差要用可靠的位移基准另行验证。</li>
  </ul>

  <p class="more-link"><a href="../features/index.html">三种功能：垂直度检测 · 空间尺寸测量 · 异常缺陷识别 →</a></p>

  <footer><span>rail_measure v${VERSION}</span><span>示意图由 anatomy 绘制 · 照片摄于现场</span></footer>
</main>
</div>`;

const themeSync = `
const box = document.querySelector(".fig");
const dark = matchMedia("(prefers-color-scheme: dark)");
const sync = () => {
  const t = document.documentElement.dataset.theme;
  box.dataset.theme = t ? t : dark.matches ? "dark" : "light";
};
sync();
dark.addEventListener("change", sync);
new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
const links = [...document.querySelectorAll(".rail ol a")];
const io = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
}, { rootMargin: "0px 0px -70% 0px" });
document.querySelectorAll("h2.sec").forEach((h) => io.observe(h));
`;

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Noto+Serif+SC:wght@400;500&display=swap">`;
const scripts = `<script>${themeSync}</script><script type="module">${fig.script.replace(/<\/(script)/gi, "<\\/$1")}</script>`;
const title = "rail_measure 导轨巡检";
const headTags = `<title>${title}</title><meta name="claude:viewport-fit-sides" content="cover">${fonts}<style>${fig.css}${style}</style>`;

const i = process.argv.indexOf("--artifact");
if (i > 0) {
  writeFileSync(process.argv[i + 1], headTags + body + scripts);
  console.log("wrote", process.argv[i + 1]);
} else {
  const meta = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;
  writeFileSync(join(HERE, "index.html"), `<!doctype html><html lang="zh-CN"><head>${meta}${headTags}</head><body>${body}${scripts}</body></html>`);
  console.log("wrote index.html");
}
