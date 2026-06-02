# TeNa AI Business Analytics Platform

Prototype decision cockpit for SME business analysis and bank relationship-manager review.

## Demo Runbook

1. Start the backend:

```bash
cd server
npm install
npm run dev
```

2. Start the frontend:

```bash
npm install
npm run dev
```

3. Open the Vite URL, usually `http://localhost:5173`.

4. Confirm the backend:

```bash
curl http://localhost:8000/api/health
```

## Recommended Demo Flow

For the most reliable presentation, use the banker-first path:

1. Use the bottom-left account switcher.
2. Select the SQB banker account.
3. Open the Deal Pipeline.
4. Open one application and present the Overview, lending recommendation, explainability, and assistant.
5. Switch back to the founder account only if you want to show live intake.

History is scoped to analyses run by the current account. The Deal Pipeline is broader: it includes current-account analyses plus marketplace/partner-sourced businesses that are ready for bank review.

The founder flow can run live agent analysis from Overview. In `USE_MOCK=true`, the app uses deterministic mock agent responses so the demo does not depend on Gemini, Nominatim, or Overpass availability.

## Scripts

```bash
npm run dev      # frontend
npm run build    # frontend typecheck + production build
npm run lint     # strict lint; currently not clean
```

Backend scripts are in `server/package.json`.
