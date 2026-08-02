# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single client-side **Vite + React 19 + TypeScript** portfolio SPA (`revamped-portfolio`). There is no backend, database, or environment variables — the only service is the Vite dev server. Standard commands live in `package.json` (`dev`, `build`, `lint`, `preview`).

- **Run (dev):** `npm run dev` serves on `http://localhost:5173` (Vite default; no port override in `vite.config.ts`). This is the only service needed to test the app end-to-end.
- **Build:** `npm run build` runs `tsc -b && vite build && node scripts/prerender-meta.mjs`. The prerender step writes per-route HTML (titles/descriptions), `sitemap.xml` and `robots.txt` into `dist/`; it parses the data files with regexes and fails the build on an empty parse, so refactoring `src/data/*.ts` to computed strings will break it. Build is clean; the >500 kB chunk-size warning (`index`, `airfoilGeometry`) is expected and not an error.
- **Lint:** `npm run lint` is expected to report **zero** problems. There is no pre-existing-error baseline any more — treat any lint output as a regression you introduced.
- **Routing:** It's an SPA using `react-router-dom`. Routes include `/`, `/projects/:slug`, `/research/:slug`, `/ism` and `/ism/:section`, plus a catch-all `*` rendering `NotFoundPage`. The landing screen is static DOM that paints on the first frame; the 3D viewers are lazy-loaded further down the page.
