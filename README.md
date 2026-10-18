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
node build.mjs      # writes the five HTML files and verticality.js / spatial.js / defect.js
node --test build.test.mjs
```

Sources:

- `content/*.md` — page copy (frontmatter plus a small Markdown subset)
- `figures/*.mjs` — interactive figures, hand-built SVG and canvas
- `site.mjs` — page shell, navigation, table of contents, marginal notes
- `shared/site-style.mjs` — shared design tokens
- `vendor/verticality-embed.json` — prebuilt isometric principle figure
- `img/defect/` — eight defect samples with source ids in `index.json`
- `img/photos/` — home-page photo strip

## Notes

- The site is static. The linked spot figure compares a synthetic Gaussian spot with a replica of the operator panel; it is not a camera feed.
- Every threshold and metric on the pages is traced to the project documents or the two public issue write-ups. Numbers that only illustrate a mechanism are labelled illustrative.
- Screenshot labels printed on the equipment itself belong to the equipment, not to the site copy.
- The classifier is a whole-frame screener: it does not localize defects, and a clean result is not an acceptance decision.
