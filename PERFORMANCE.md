# Performance report

## Measurement method

Run `npm run analyze` for the Webpack bundle analyzer and `npm run report:bundle` after a production build. The size script measures gzip level 9 of each emitted `.next/static/chunks/*.js` file independently and reports the aggregate plus route chunk candidates. These figures describe emitted JavaScript assets; they do not include CSS, images, network transfer headers, or server bundles. The analyzer HTML files identify large dependencies and lazy chunks.

## Current build

Measured 12 October 2026 after the external API and map changes. The production build completed successfully. There are 352 emitted JavaScript chunks with an aggregate gzip level 9 size of **2,957,839 bytes (2.82 MiB)**. Next's build table reports **301 KB first-load JS** for `/map`, **228 KB** for `/admin/api-health`, and **103 KB shared** across routes. Subtracting the shared figure gives approximate route-specific first-load sizes of 198 KB and 125 KB respectively. The analyzer wrote client, Node.js, and Edge reports under `.next/analyze/`.

| Metric | Result | Target |
|---|---:|---:|
| Total emitted static JavaScript, gzip | 2,957,839 bytes (2.82 MiB) | <200 KB |
| Fleet map first-load JS (Next build) | 301 KB total; ~198 KB route-specific | <50 KB |
| API health first-load JS (Next build) | 228 KB total; ~125 KB route-specific | <30 KB |

The map and admin feature panels load lazily. The admin PDF exporter dynamically imports jsPDF only after the user selects Export PDF. The current whole-app and route first-load targets are **not met**. The 2.82 MiB aggregate includes all application routes and chunks, including unrelated finance, reporting, AI, and document workflows. A prior-build gzip snapshot was not retained, so this records the current baseline rather than a before/after delta. Further reductions require broader route-level code splitting and dependency review.

## Repeatable check

```powershell
npm run build
npm run report:bundle
npm run analyze
```

Keep a dated copy of analyzer outputs before and after dependency or route changes when comparing regressions.
