from __future__ import annotations

from pathlib import Path
import json
import pandas as pd
from catboost import CatBoostRegressor
from ..ports import PORT_COORDS

BASE = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE / "models" / "freight_model.cbm"
META_PATH = BASE / "models" / "model_meta.json"
MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
MONTH_TO_NUM = {m: i for i, m in enumerate(MONTHS, 1)}
MODEL = None
META = None


def load():
    global MODEL, META
    if MODEL is None:
        if not MODEL_PATH.exists():
            raise RuntimeError(f'Model not found: {MODEL_PATH}')
        MODEL = CatBoostRegressor()
        MODEL.load_model(str(MODEL_PATH))
    if META is None and META_PATH.exists():
        META = json.loads(META_PATH.read_text(encoding='utf-8'))
    return MODEL, META


def hav_nm(a, b):
    from math import radians, sin, cos, asin, sqrt
    p1, l1 = radians(a[0]), radians(a[1])
    p2, l2 = radians(b[0]), radians(b[1])
    dp = p2 - p1
    dl = l2 - l1
    h = sin(dp/2)**2 + cos(p1)*cos(p2)*sin(dl/2)**2
    return 3440.065 * 2 * asin(sqrt(min(1.0, h)))


def _row_dict(payload, vessel_type=None, month=None, route_distance=None):
    a = PORT_COORDS[payload['origin_port']]
    b = PORT_COORDS[payload['destination_port']]
    dist = float(route_distance if route_distance is not None else hav_nm(a, b))
    m = month or payload['month']
    oc, dc = str(payload['origin_country']), str(payload['destination_country'])
    op, dp = str(payload['origin_port']), str(payload['destination_port'])
    return {
        'origin_country': oc,
        'origin_port': op,
        'destination_country': dc,
        'destination_port': dp,
        'cargo_type': str(payload['cargo_type']),
        'vessel_type': str(vessel_type or payload['vessel_type']),
        'month': str(m),
        'month_num': float(MONTH_TO_NUM[m]),
        'quantity_tonnes': float(payload['quantity_tonnes']),
        'fuel_price_usd_tonne': float(payload['fuel_price_usd_tonne']),
        'port_congestion': float(payload['port_congestion']),
        'route_distance_nm': dist,
        'country_pair': f'{oc} -> {dc}',
        'port_pair': f'{op} -> {dp}',
    }


def _feature_names(model):
    names = list(getattr(model, 'feature_names_', []) or [])
    if names:
        return names
    names = list((META or {}).get('features') or (META or {}).get('feature_columns') or [])
    if names:
        return names
    raise RuntimeError('Model feature metadata is missing.')


def _cat_feature_names(model, names):
    indices = list(getattr(model, 'get_cat_feature_indices', lambda: [])() or [])
    if indices:
        return {names[i] for i in indices if 0 <= i < len(names)}
    meta_cats = (META or {}).get('categorical_features', [])
    if meta_cats and all(isinstance(x, int) for x in meta_cats):
        return {names[i] for i in meta_cats if 0 <= i < len(names)}
    return set(meta_cats)


def _predict_rows(rows):
    model, _ = load()
    names = _feature_names(model)
    cat_names = _cat_feature_names(model, names)
    frame = pd.DataFrame(rows)
    missing = [c for c in names if c not in frame.columns]
    if missing:
        raise RuntimeError(f'Model features missing from prediction payload: {missing}')

    # Match the data types expected by the saved CatBoost model. This keeps
    # compatibility with both the bootstrap model (month is categorical) and
    # the 1M-row model (month_num/country_pair/port_pair may be present).
    frame = frame[names].copy()
    for col in names:
        if col in cat_names:
            frame[col] = frame[col].astype(str)
        else:
            frame[col] = pd.to_numeric(frame[col], errors='coerce').fillna(0.0).astype(float)

    values = model.predict(frame)
    return [float(x) for x in values]


def predict_rate(payload, vessel_type=None, month=None, route_distance=None):
    return _predict_rows([_row_dict(payload, vessel_type, month, route_distance)])[0]


def predict_rate_batch(payload_distance_pairs):
    rows = [_row_dict(payload, route_distance=distance) for payload, distance in payload_distance_pairs]
    return _predict_rows(rows)


def predict_vessel_batch(payload, vessel_types, route_distance):
    rows = [_row_dict(payload, vessel_type=v, route_distance=route_distance) for v in vessel_types]
    return _predict_rows(rows)


def predict_month_batch(payload, vessel_type, route_distance):
    rows = [_row_dict(payload, vessel_type=vessel_type, month=m, route_distance=route_distance) for m in MONTHS]
    return _predict_rows(rows)
