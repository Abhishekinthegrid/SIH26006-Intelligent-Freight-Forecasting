# SIH26006 Freight Intelligence — Optimized 2D ML Build

This build keeps the existing dark maritime V3 UI while moving route selection to the backend.

## What changed

- React still uses the same Home / Forecast / Routes / Vessels / Insights / About layout.
- Country and port metadata comes from FastAPI `/api/metadata` (single backend source of truth).
- Freight prediction uses CatBoost.
- Geographic routing uses the SeaRoute maritime network instead of hand-drawn straight lines.
- The backend validates returned route interiors against the bundled land mask.
- ML ranks the water-only route candidates using predicted freight plus a transparent fuel-distance component.
- Route candidates are cached (LRU 2048) so the same port pair is fast on subsequent requests.
- Vessel comparison and the 12-month outlook are batch-predicted to reduce model-call overhead.
- The frontend does not call routing when unrelated fields such as quantity/fuel/congestion/month change.
- The home page contains a real global 2D satellite map with port markers; it does not draw decorative routes that can cross land.
- Map overlays use translucent/blurred panels so the satellite map remains visible.
- MongoDB is not required for the local prediction demo.

## First-time Windows setup

Use Python 3.11 for the backend environment.

1. Open this folder in VS Code.
2. Double-click `SETUP_PROJECT.bat`.
3. The setup script installs backend packages, installs the frontend, and starts both services.
4. Open `http://localhost:5173`.

The package contains a bootstrap model so the UI can start immediately. To train the final model on the supplied 1M-row CSV, run `RETRAIN_MODEL.bat` once. Training is an offline step; prediction requests do not reread the 1M CSV.

## Manual run

Backend terminal:

```powershell
cd "C:\SIH project v4\backend"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend terminal:

```powershell
cd "C:\SIH project v4\frontend"
npm.cmd run dev
```

Open `http://localhost:5173`.

## API

- `GET /health`
- `GET /api/metadata`
- `GET /api/route?...`
- `POST /api/predict`

## Routing design

SeaRoute is used only for maritime-network geometry. ML does not invent latitude/longitude points. The ML model ranks valid SeaRoute candidates using the same freight model used for prediction. This prevents the yellow line from becoming an arbitrary straight line across countries.

This is a planning visualization, not navigation-grade routing.
