# rail_measure_site

Public documentation site for **rail_measure**, an offline elevator guide-rail inspection system. Five English pages, built as static HTML with no framework.

Live: https://dreamfarer-space.github.io/rail_measure_site/

## Pages

| File | Page |
|---|---|
| `index.html` | rail_measure overview |
| `verticality.html` | Verticality measurement |
| `spatial.html` | Spatial measurement |
| `defect.html` | Defect recognition |
| `how-i-built-it.html` | How I built it |

The layout follows the three-column anatomy style: 168 px rail, 550 px column, marginal notes, and a page table of contents under the site navigation.

## Build

Requires Node 20 or newer. There are no other dependencies.

```bash
node anatomy/verticality/build.mjs
node anatomy/spatial/build.mjs
node build.mjs      # writes the five HTML files and verticality.js / spatial.js / defect.js
node --test build.test.mjs
```

Sources:

- `content/*.md` — page copy (frontmatter plus a small Markdown subset)
- `figures/*.mjs` — interactive figures, hand-built SVG and canvas
- `anatomy/kit/*.mjs` — isometric 3D projection and lathe primitives
- `anatomy/verticality/build.mjs` & `anatomy/spatial/build.mjs` — Cart A & Cart B isometric figure generators
- `intro/` — standalone Chinese overview page (`node intro/build.mjs`)
- `scripts/` — defect sample selection and resize scripts
- `site.mjs` — page shell, navigation, table of contents, marginal notes
- `shared/site-style.mjs` & `shared/fonts/` — shared design tokens and self-hosted fonts
- `vendor/` — prebuilt isometric embeds and cart SVGs
- `img/defect/` — eight defect samples with source ids in `index.json`
- `img/photos/` — home-page photo strip

## Notes

- The site is static. The linked spot figure compares a synthetic Gaussian spot with a replica of the operator panel; it is not a camera feed.
- Every threshold and metric on the pages is traced to the project documents or the two public issue write-ups. Numbers that only illustrate a mechanism are labelled illustrative.
- Screenshot labels printed on the equipment itself belong to the equipment, not to the site copy.
- The classifier is a whole-frame screener: it does not localize defects, and a clean result is not an acceptance decision.
