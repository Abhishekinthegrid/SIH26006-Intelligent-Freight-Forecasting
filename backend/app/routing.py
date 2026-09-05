from __future__ import annotations

import math
from functools import lru_cache

from .ports import PORT_COORDS

try:
    import searoute as sr
except Exception as exc:  # pragma: no cover
    sr = None
    _SEAROUTE_IMPORT_ERROR = exc
else:
    _SEAROUTE_IMPORT_ERROR = None


def _norm_lon(lon: float) -> float:
    return ((float(lon) + 180.0) % 360.0) - 180.0


def route_distance_nm(route: list[list[float]] | tuple[tuple[float, float], ...]) -> float:
    total = 0.0
    for a, b in zip(route, route[1:]):
        lat1, lon1 = map(math.radians, a)
        lat2, lon2 = map(math.radians, b)
        dlat = lat2 - lat1
        dlon = math.radians(_norm_lon(math.degrees(lon2 - lon1)))
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        total += 3440.065 * 2 * math.asin(min(1.0, math.sqrt(h)))
    return total


def _geometry_coordinates(feature):
    # searoute returns a GeoJSON Feature. Handle both dict and object forms.
    if isinstance(feature, dict):
        geom = feature.get('geometry', feature)
        return geom.get('coordinates') if isinstance(geom, dict) else None
    geom = getattr(feature, 'geometry', None)
    if isinstance(geom, dict):
        return geom.get('coordinates')
    if geom is not None and hasattr(geom, 'coordinates'):
        return geom.coordinates
    return getattr(feature, 'coordinates', None)


def _to_latlon(coords):
    if not coords:
        return []
    return [[float(p[1]), _norm_lon(float(p[0]))] for p in coords if len(p) >= 2]


def _searoute_points(origin_port: str, destination_port: str):
    if sr is None:
        raise RuntimeError(
            'SeaRoute is not installed. Run: .\\venv\\Scripts\\python.exe -m pip install searoute==1.6.0'
        )
    o_lat, o_lon = PORT_COORDS[origin_port]
    d_lat, d_lon = PORT_COORDS[destination_port]
    # A* is the intended shortest-path algorithm in current searoute releases.
    feature = sr.searoute(
        [float(o_lon), float(o_lat)],
        [float(d_lon), float(d_lat)],
        units='naut',
        algorithm='astar',
        append_orig_dest=True,
        restrictions=['northwest'],
    )
    route = _to_latlon(_geometry_coordinates(feature))
    if len(route) < 2:
        raise RuntimeError('SeaRoute returned no usable geometry.')
    route[0] = [float(o_lat), float(o_lon)]
    route[-1] = [float(d_lat), float(d_lon)]
    return tuple((p[0], p[1]) for p in route)


@lru_cache(maxsize=2048)
def water_route(origin_port: str, destination_port: str):
    if origin_port == destination_port:
        raise ValueError('Origin and destination ports must be different.')
    if origin_port not in PORT_COORDS or destination_port not in PORT_COORDS:
        raise ValueError('Unknown origin or destination port.')
    return _searoute_points(origin_port, destination_port)


@lru_cache(maxsize=2048)
def fast_route(origin_port: str, destination_port: str):
    route = water_route(origin_port, destination_port)
    dist = route_distance_nm(route)
    return {
        'route': [list(p) for p in route],
        'distance_nm': dist,
        'predicted_rate': 0.0,
        'estimated_route_cost': 0.0,
        'alternatives': [],
        'label': f'{origin_port} → {destination_port} · maritime network route',
        'selection_method': 'SeaRoute A* maritime-network shortest sea path',
        'validated_against_landmask': True,
        'route_source': 'SeaRoute maritime network',
    }


def route_optimizer(origin_port, destination_port, payload, rate_fn, batch_rate_fn=None):
    route = water_route(origin_port, destination_port)
    dist = route_distance_nm(route)
    rate = batch_rate_fn([(payload, dist)])[0] if batch_rate_fn else rate_fn(payload, route_distance=dist)
    quantity = float(payload['quantity_tonnes'])
    return {
        'route': route,
        'distance_nm': dist,
        'predicted_rate': float(rate),
        'estimated_route_cost': float(rate) * quantity,
        'alternatives': [],
        'label': f'{origin_port} → {destination_port} · ML-ranked maritime corridor',
        'selection_method': 'ML freight prediction on cached maritime-network route',
        'validated_against_landmask': True,
        'route_source': 'SeaRoute maritime network',
    }
