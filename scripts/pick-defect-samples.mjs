// 按 labels_v2.json 每个类别挑第一张有文件的样本，复制到 ../img/defect/，并写下来源 id。
// 运行：node scripts/pick-defect-samples.mjs [--dataset <目录>]
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = process.argv.indexOf("--dataset");
const dataset = resolve(
  arg > 0
    ? process.argv[arg + 1]
    : join(HERE, "..", "..", "..", "datasets", "elevator_defect_detection")
);
const outDir = join(HERE, "..", "img", "defect");

if (!existsSync(join(dataset, "labels_v2.json"))) {
  throw new Error(`找不到 ${join(dataset, "labels_v2.json")}；用 --dataset 指向 elevator_defect_detection`);
}

const labels = JSON.parse(readFileSync(join(dataset, "labels_v2.json"), "utf8"));

// 人工挑过的“无现场水印/OSD”样本（项目名、执行人、时间、地点水印已确认不存在）。
// 其余类别取 labels_v2 里第一张有文件的图片。
const PREFERRED = {
  normal: "asset_0185",
  rust_corrosion: "asset_0008",
  wire_rope_damage: "asset_0371",
};
const files = new Map();
for (const sub of ["../elevator_defect_training/images", "derived", "assets"]) {
  const dir = join(dataset, sub);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (/\.(jpe?g|png)$/i.test(name)) files.set(name.slice(0, name.lastIndexOf(".")), join(dir, name));
  }
}

mkdirSync(outDir, { recursive: true });
const rows = [];
for (const [code, label] of Object.entries(labels.classes)) {
  const wanted = PREFERRED[code];
  const ids = labels.labels[code] || [];
  const id = (wanted && ids.includes(wanted) ? wanted : null) || ids.find((stem) => files.has(stem));
  if (!id) throw new Error(`类别 ${code} 没有可用样本`);
  const src = files.get(id);
  const file = code + src.slice(src.lastIndexOf(".")).toLowerCase();
  copyFileSync(src, join(outDir, file));
  rows.push({ code, label, file, source: id });
}

writeFileSync(
  join(outDir, "index.json"),
  JSON.stringify({ dataset: "elevator_defect_detection", classes: rows }, null, 2) + "\n"
);
console.log(`wrote ${rows.length} samples -> ${outDir}`);
