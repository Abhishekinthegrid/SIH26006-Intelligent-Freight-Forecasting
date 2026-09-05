from __future__ import annotations

import os
from functools import lru_cache
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import ForecastInput
from .ports import PORT_COORDS, PORT_COUNTRY
from .ml.predictor import load, predict_rate, predict_rate_batch, predict_vessel_batch, predict_month_batch, MONTHS
from .routing import fast_route, route_optimizer

app = FastAPI(title="SIH26006 Freight Intelligence ML API")

app = FastAPI(title="SIH26006 Freight Intelligence ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://sih-26006-intelligent-freight-forec.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

CARGO_TYPES = ["Coal", "Iron Ore", "Grain", "Fertilizer", "Cement", "Sugar"]
VESSEL_TYPES = ["Handysize", "Handymax", "Supramax", "Ultramax", "Panamax", "Kamsarmax", "Post-Panamax", "Capesize", "Newcastlemax", "VLOC"]
CAPACITY = {
    "Handysize": 35000, "Handymax": 50000, "Supramax": 55000, "Ultramax": 65000,
    "Panamax": 78000, "Kamsarmax": 85000, "Post-Panamax": 105000,
    "Capesize": 160000, "Newcastlemax": 240000, "VLOC": 350000,
}


def _base_payload(inp: ForecastInput):
    p = inp.model_dump()
    if p["origin_port"] not in PORT_COORDS or p["destination_port"] not in PORT_COORDS:
        raise HTTPException(status_code=400, detail="Please choose valid origin and destination ports.")
    if p["origin_port"] == p["destination_port"]:
        raise HTTPException(status_code=400, detail="Origin and destination ports must be different.")
    if PORT_COUNTRY.get(p["origin_port"]) != p["origin_country"]:
        raise HTTPException(status_code=400, detail="Origin port does not belong to the selected origin country.")
    if PORT_COUNTRY.get(p["destination_port"]) != p["destination_country"]:
        raise HTTPException(status_code=400, detail="Destination port does not belong to the selected destination country.")
    p["quantity_tonnes"] = float(p["quantity_tonnes"])
    p["fuel_price_usd_tonne"] = float(p["fuel_price_usd_tonne"])
    p["port_congestion"] = float(p["port_congestion"])
    return p


@app.get("/health")
def health():
    model, meta = load()
    return {
        "status": "ok" if model is not None else "model_missing",
        "model_loaded": model is not None,
        "model_name": "CatBoost freight regression + ML-ranked SeaRoute maritime routing",
        "training_rows": (meta or {}).get("rows_total", (meta or {}).get("total_rows", 0)),
        "mongodb": False,
        "route_cache": "LRU 2048 port pairs",
    }


@lru_cache(maxsize=1)
def _metadata_payload():
    ports_by = {}
    for port, country in PORT_COUNTRY.items():
        ports_by.setdefault(country, []).append(port)
    _, meta = load()
    return {
        "countries": sorted(ports_by),
        "ports_by_country": {k: sorted(v) for k, v in sorted(ports_by.items())},
        "port_country": PORT_COUNTRY,
        "port_coords": PORT_COORDS,
        "cargo_types": CARGO_TYPES,
        "vessel_types": VESSEL_TYPES,
        "months": MONTHS,
        "model": meta or {},
    }


@app.get("/api/metadata")
def metadata():
    return _metadata_payload()


def _route_payload(p):
    return route_optimizer(
        p["origin_port"],
        p["destination_port"],
        p,
        lambda pl, route_distance: predict_rate(pl, route_distance=route_distance),
        batch_rate_fn=predict_rate_batch,
    )


def _route_response(r):
    return {
        "coordinates": r["route"],
        "distance_nm": round(r["distance_nm"], 1),
        "predicted_rate": round(r["predicted_rate"], 2),
        "estimated_route_cost": round(r["estimated_route_cost"], 2),
        "alternatives": [
            {
                "distance_nm": round(x["distance_nm"], 1),
                "predicted_rate": round(x["predicted_rate"], 2),
                "estimated_route_cost": round(x["estimated_route_cost"], 2),
            }
            for x in r["alternatives"]
        ],
        "label": r["label"],
        "selection_method": r["selection_method"],
        "route_source": r.get("route_source", "SeaRoute maritime network"),
        "validated_against_landmask": bool(r.get("validated_against_landmask", True)),
    }


@app.get("/api/route")
def get_route(
    origin_port: str,
    destination_port: str,
    origin_country: str,
    destination_country: str,
    cargo_type: str = "Coal",
    quantity_tonnes: float = 50000,
    vessel_type: str = "Panamax",
    fuel_price_usd_tonne: float = 620,
    port_congestion: float = 0.35,
    month: str = "March",
):
    p = {
        "origin_country": origin_country,
        "origin_port": origin_port,
        "destination_country": destination_country,
        "destination_port": destination_port,
        "cargo_type": cargo_type,
        "quantity_tonnes": float(quantity_tonnes),
        "vessel_type": vessel_type,
        "fuel_price_usd_tonne": float(fuel_price_usd_tonne),
        "port_congestion": float(port_congestion),
        "month": month,
    }
    try:
        p = _base_payload(ForecastInput(**p))
        return _route_response(fast_route(p["origin_port"], p["destination_port"]))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"No validated sea route is available: {exc}")


@app.post("/api/predict")
def predict(inp: ForecastInput):
    p = _base_payload(inp)
    try:
        route = _route_payload(p)
        dist = float(route["distance_nm"])
        rate = float(route["predicted_rate"])
        _, meta = load()

        vessel_rates = predict_vessel_batch(p, VESSEL_TYPES, dist)
        comparisons = []
        for vessel_type, rr in zip(VESSEL_TYPES, vessel_rates):
            capacity = CAPACITY[vessel_type]
            trips = max(1, int((p["quantity_tonnes"] / (capacity * 0.9) - 1e-9) + 0.9999))
            fit = min(1.0, p["quantity_tonnes"] / capacity)
            utilization = min(1.0, p["quantity_tonnes"] / (capacity * 0.9))
            cost = float(rr) * p["quantity_tonnes"] * trips
            score = cost * (1 + 0.18 * max(0, fit - 0.9) + 0.06 * max(0, 0.35 - fit))
            comparisons.append({
                "vessel_type": vessel_type,
                "capacity_tonnes": capacity,
                "trips": trips,
                "utilization": fit,
                "indicative_rate": float(rr),
                "estimated_cost": cost,
                "ml_score": score,
            })

        feasible = [x for x in comparisons if x["capacity_tonnes"] >= p["quantity_tonnes"] * 0.85] or comparisons
        best = min(feasible, key=lambda x: x["ml_score"])

        monthly_rates = predict_month_batch(p, best["vessel_type"], dist)
        monthly = [{"month": m, "rate": float(r)} for m, r in zip(MONTHS, monthly_rates)]
        best_month = min(monthly, key=lambda x: x["rate"])["month"]
        baseline_rate = sum(x["rate"] for x in monthly) / len(monthly)
        savings = max(0.0, (baseline_rate - rate) / max(baseline_rate, 1e-9) * 100)
        total = rate * p["quantity_tonnes"]
        recommended = min(p["quantity_tonnes"], best["capacity_tonnes"] * 0.9)

        return {
            "predicted_freight_rate": round(rate, 2),
            "estimated_total_cost": round(total, 2),
            "savings_percent": round(savings, 1),
            "best_vessel": best["vessel_type"],
            "best_charter_month": best_month,
            "recommended_procurement_tonnes": round(recommended, 0),
            "vessel_comparison": sorted(comparisons, key=lambda x: x["ml_score"]),
            "monthly_outlook": [{"month": x["month"], "rate": round(x["rate"], 2)} for x in monthly],
            "route": _route_response(route),
            "model_explanation": {
                "type": "CatBoostRegressor",
                "training_rows": int((meta or {}).get("rows_train", (meta or {}).get("training_rows", 0))),
                "features_used": (meta or {}).get("features", (meta or {}).get("feature_columns", [])),
                "target": "freight_rate_usd_tonne",
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Forecast service unavailable: {exc}")
