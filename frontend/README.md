# PGGateway — Frontend (Operator Portal)

Multi-tenant operator portal for PGGateway. Banking-grade FDS + reconciliation UI.
UI labels in Bahasa Indonesia. Built to `docs/DESIGN.md` and `docs/frontend-plan-20260627.md`.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (DESIGN.md tokens mapped to theme)
- React Router (routing)
- TanStack Query (server state)
- lucide-react (icons)
- Inter font (Google Fonts), tabular figures ON for all numbers

> Note: pinned to Vite 5 / TypeScript 5 / React 18 for compatibility with Node 20.14.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build -> dist/
npm run preview  # serve the build
```

## Screens (mock data — no backend yet)

| Route              | Screen                                   |
| ------------------ | ---------------------------------------- |
| `/`                | Dashboard (5 KPI, live txn feed, alerts) |
| `/fds`             | FDS alert queue (index)                  |
| `/fds/:id`         | FDS alert detail (3-col + risk gauge)    |
| `/rekonsiliasi`    | Reconciliation (3 stats + mismatch table)|
| `/transaksi`,`/audit` | placeholders (in inventory, out of scope)|

## Demo states (DESIGN.md §8)

Every data screen implements **ready / loading / empty / error**. Toggle via the
in-page "Demo state" control, or directly with the query param:

```
/?state=loading      /?state=empty      /?state=error
/rekonsiliasi?state=empty
/fds/A-20431?state=error
```

Status is always **color + icon + text** (never color alone), per a11y §10.
Fraud-score thresholds: ≥80 danger, 60–79 warning, <60 muted (locked, §3).
