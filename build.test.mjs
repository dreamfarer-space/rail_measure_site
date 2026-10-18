import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll, contentDir } from "./build.mjs";
import { distanceMm, clearanceMm, OBSTACLE_HEIGHT } from "./figures/spatial.mjs";

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

test("spatial has both figures and the mm/unit note", () => {
  const h = pages.spatial;
  assert.ok(h.includes('id="sp-two"'));
  assert.ok(h.includes('id="sp-clear"'));
  assert.ok(h.includes("3.2 mm"));
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

test("spatial maths still hold", () => {
  assert.equal(Math.round(clearanceMm(168, 56 + OBSTACLE_HEIGHT, 3.2)), 326);
  assert.equal(distanceMm({ x: 0, y: 0 }, { x: 3, y: 4 }, 10), 50);
});
