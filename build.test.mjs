import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll, contentDir } from "./build.mjs";
import * as SC from "./figures/spatialcore.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const files = buildAll();
const read = (f) => readFileSync(join(HERE, f), "utf8");
const pages = {
  index: read("index.html"),
  verticality: read("verticality.html"),
  spatial: read("spatial.html"),
  defect: read("defect.html"),
  "how-i-built-it": read("how-i-built-it.html"),
};

test("five pages are written", () => {
  assert.deepEqual(files.map((f) => f.split(/[\\/]/).pop()), [
    "index.html", "verticality.html", "spatial.html", "defect.html", "how-i-built-it.html",
  ]);
});

test("every page has the five-item site nav and one current item", () => {
  for (const [slug, html] of Object.entries(pages)) {
    const nav = html.match(/<nav class="sites"[\s\S]*?<\/nav>/)[0];
    for (const label of ["rail_measure", "Verticality", "Spatial measurement", "Defect recognition", "How I built it"]) {
      assert.ok(nav.includes(">" + label + "</a>"), `${slug} missing ${label}`);
    }
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1, slug);
  }
});

test("table of contents anchors exist in the page", () => {
  for (const [slug, html] of Object.entries(pages)) {
    const toc = html.match(/<ol class="toc"[\s\S]*?<\/ol>/);
    assert.ok(toc, `${slug} has no toc`);
    const ids = [...toc[0].matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 4, `${slug} toc too short`);
    for (const id of ids) assert.ok(html.includes(`id="${id}"`), `${slug} missing #${id}`);
  }
});

test("copy is English and fully rendered", () => {
  for (const [slug, html] of Object.entries(pages)) {
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
    assert.ok(!/[\u4e00-\u9fff]/.test(text), `${slug} still contains Chinese`);
    assert.ok(!text.includes("[[figure:"), `${slug} has a raw figure marker`);
    assert.ok(!text.includes("::: note"), `${slug} has a raw note marker`);
    assert.ok(!text.includes("undefined"), `${slug} has undefined`);
  }
});

test("verticality has all three figures and the linked lab", () => {
  const h = pages.verticality;
  assert.equal((h.match(/<figure class="fig/g) || []).length, 3);
  assert.ok(h.includes('id="lab-paper"'));
  assert.ok(h.includes('id="lab-panel"'));
  assert.ok(h.includes('id="qg"'));
  assert.ok(h.includes('data-case="vibration"'));
});

test("spatial has Cart B and both measurement figures", () => {
  const h = pages.spatial;
  assert.ok(h.includes('class="sp-stage"'));
  assert.ok(h.includes('id="sp-two"'));
  assert.ok(h.includes('id="sp-clear"'));
  assert.ok(h.includes("car_top.py"));
});

test("defect gallery has eight English classes", () => {
  const h = pages.defect;
  assert.equal((h.match(/data-file="/g) || []).length, 8);
  for (const label of ["No visible defect", "Rust", "Wire-rope damage"]) assert.ok(h.includes(label), label);
});

test("figure scripts are written and non-empty", () => {
  for (const f of ["verticality.js", "spatial.js", "defect.js"]) {
    const p = join(HERE, f);
    assert.ok(existsSync(p), f);
    assert.ok(readFileSync(p, "utf8").length > 500, f);
  }
});

test("local links and images resolve", () => {
  for (const [slug, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/(?:src|href)="((?!https?:|#|data:)[^"]+)"/g)) {
      assert.ok(existsSync(join(HERE, m[1].split("?")[0])), `${slug}: ${m[1]}`);
    }
  }
});

test("content files carry frontmatter and five to seven sections", () => {
  for (const slug of Object.keys(pages)) {
    const md = readFileSync(join(contentDir, `${slug}.md`), "utf8").split(String.fromCharCode(13)).join("");

    assert.match(md, /^---\n/, slug);
    const n = (md.match(/^## /gm) || []).length;
    assert.ok(n >= 4 && n <= 8, `${slug}: ${n} sections`);
  }
});


test("margin notes are anchored in the body text", () => {
  for (const [slug, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/<aside class="note" id="note-(\d+)"/g)) {
      const n = m[1];
      assert.ok(html.includes(`href="#note-${n}"`), `${slug} note ${n} has no in-text marker`);
      assert.ok(html.includes(`id="ref-${n}"`), `${slug} note ${n} marker has no id`);
    }
  }
});

test("tables use row headers and no vertical rules", () => {
  const h = pages.index;
  assert.ok(h.includes('<th scope="row">Verticality</th>'));
  assert.ok(h.includes('<th scope="col">Measurement</th>'));
  assert.ok(h.includes('<table class="table">'));
});

test("spatial model: two points along gravity and car-top clearance", () => {
  const cam = SC.cameraOf();
  const scene = SC.sceneOf();
  const px = (p) => SC.project(cam, p).slice(0, 2).map(Math.round);
  // bracket clips 1140 mm apart vertically on the far wall
  const two = SC.twoPoint(scene, cam, px([-90, -530, 2272]), px([90, 610, 2272]));
  assert.ok(two.ok);
  assert.ok(Math.abs(two.dv - 1140) < 15, `dv ${two.dv}`);
  assert.ok(Math.abs(two.D - Math.hypot(two.dv, two.dh)) < 1e-6);
  // a hoist rope gives no depth
  assert.equal(SC.depthAt(scene, cam, ...px([-280, 0, 2117])).reason, "thin");
  // beam 1750 mm above the car top
  const ok = SC.clearance(scene, cam, [110, 366, 530, 398], [40, 34, 600, 96]);
  assert.ok(ok.ok, ok.reason);
  assert.ok(Math.abs(ok.min - 1750) < 25, `min ${ok.min}`);
  // reference box on the wall: the plane is vertical, so it is rejected
  assert.equal(SC.clearance(scene, cam, [370, 200, 470, 260], [40, 34, 600, 96]).code, "base_tilt");
  // glare on the beam underside leaves too little valid depth above
  const glare = SC.clearance(SC.sceneOf({ glare: true }), cam, [110, 366, 530, 398], [40, 34, 600, 96]);
  assert.ok(!glare.ok || glare.warnings.length, "glare must reject or warn");
});

test("detector port reproduces the #20 and #25 probes", async () => {
  const S = await import("./figures/spotcore.mjs");
  const white = S.toU8(S.fillRect(S.paperFrame(640, 480, 0, [170, 178, 172], 0), 300, 200, 320, 220));
  const old = S.detectSpot(white, null, S.BEFORE_20.detect);
  assert.deepEqual([old.x, old.y], [309.5, 209.5]);
  assert.ok(S.detectSpot(white).none);
  const edge = S.detectSpot(S.toU8(S.addSpot(S.paperFrame(), 2, 240, 6, [5, 60, 10])));
  assert.equal(edge.reject_reason, "clipped");
  const moving = Array.from({ length: 15 }, (_, i) => [100 + i * 0.03, [100 + i, 200]]);
  assert.equal(S.averageSpot(moving, 100.42, S.BEFORE_20.average).mean[0], 107);
  assert.equal(S.averageSpot(moving, 100.42).reason, "drift");
  const vib = Array.from({ length: 15 }, (_, i) => [100 + i / 30, [i % 3 === 0 ? 324 : 318, 240]]);
  assert.ok(S.averageSpot(vib, 100 + 14 / 30, S.BEFORE_25.average).stable);
  assert.equal(S.averageSpot(vib, 100 + 14 / 30).reason, "outliers");
});
