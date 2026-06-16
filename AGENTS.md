# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single client-side **Vite + React 19 + TypeScript** portfolio SPA (`revamped-portfolio`). There is no backend, database, or environment variables — the only service is the Vite dev server. Standard commands live in `package.json` (`dev`, `build`, `lint`, `preview`).

- **Run (dev):** `npm run dev` serves on `http://localhost:5173` (Vite default; no port override in `vite.config.ts`). This is the only service needed to test the app end-to-end.
- **Build:** `npm run build` runs `tsc -b && vite build`. Build is clean; the >500 kB chunk-size warning (e.g. `EarthOrbit`) is expected and not an error.
- **Lint:** `npm run lint` currently reports pre-existing errors (e.g. `react-hooks/set-state-in-effect` in `ProjectsSection.tsx` and `ResearchSection.tsx`). These are pre-existing in `main`, not environment problems — do not treat a failing `npm run lint` as a setup failure.
- **Routing:** It's an SPA using `react-router-dom`. Routes include `/`, `/projects/:slug`, `/research/:slug`, `/ism` and `/ism/:section`. The homepage plays an intro/3D animation that can take a few seconds to settle.
