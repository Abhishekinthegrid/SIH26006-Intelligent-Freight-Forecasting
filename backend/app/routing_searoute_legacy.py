"""Fast maritime routing using the SeaRoute maritime network.

Important design rule:
- SeaRoute supplies only maritime-network paths.
- The land mask is used as a second validation layer for returned geometry.
- The freight ML model ranks valid sea-route candidates; it does not invent map points.
- Routes are cached so repeated requests are essentially O(1) after the first calculation.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Point
from shapely.strtree import STRtree

from .ports import PORT_COORDS

try:
    import searoute as sr
except Exception as exc:  # pragma: no cover - handled at runtime
    sr = None
    SEAROUTE_IMPORT_ERROR = exc
else:
    SEAROUTE_IMPORT_ERROR = None

BASE = Path(__file__).resolve().parents[1]
LAND_PATH = BASE / "data" / "landmask.geojson"
TREE: STRtree | None = None
GEOMS = []


def _load_land() -> None:
    global TREE, GEOMS
    if TREE is not None:
        return
    fc = json.loads(LAND_PATH.read_text(encoding="utf-8"))
    geoms = []
    for feature in fc.get("features", []):
        geometry = feature.get("geometry") or {}
        gtype = geometry.get("type")
        coords = geometry.get("coordinates")
        if not coords:
            continue
        # The shipped land mask is Natural-Earth style polygon data.
        if gtype == "Polygon":
            geoms.append(__import__("shapely.geometry", fromlist=["Polygon"]).Polygon(coords[0]))
        elif gtype == "MultiPolygon":
            Polygon = __import__("shapely.geometry", fromlist=["Polygon"]).Polygon
            for poly in coords:
                geoms.append(Polygon(poly[0]))
    GEOMS = geoms
    TREE = STRtree(GEOMS)


def norm_lon(lon: float) -> float:
    return ((float(lon) + 180.0) % 360.0) - 180.0


def land(lat: float, lon: float) -> bool:
    _load_land()
    p = Point(norm_lon(lon), float(lat))
    for idx in TREE.query(p):
        geom = GEOMS[int(idx)]
        if geom.contains(p) or geom.touches(p):
            return True
    return False


def _route_has_land(points: list[list[float]], samples_per_segment: int = 5) -> bool:
    """Validate the interior of a SeaRoute line against the land mask.

    Port coordinates can be on terminals/coast polygons, so endpoints are ignored;
    every interior sample must remain in water.
    """
    if len(points) < 2:
        return True
    for i in range(len(points) - 1):
        a = points[i]
        b = points[i + 1]
        for j in range(1, samples_per_segment):
            t = j / samples_per_segment
            lat = a[0] + (b[0] - a[0]) * t
            lon = norm_lon(a[1] + (b[1] - a[1]) * t)
            if land(lat, lon):
                return True
    return False


def route_distance_nm(route: list[list[float]]) -> float:
    total = 0.0
    for a, b in zip(route, route[1:]):
        lat1, lon1 = map(math.radians, a)
        lat2, lon2 = map(math.radians, b)
        dlat = lat2 - lat1
        dlon = math.radians(norm_lon(math.degrees(lon2 - lon1)))
        h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        total += 3440.065 * 2 * math.asin(min(1.0, math.sqrt(h)))
    return total


def _convert_geojson(coords) -> list[list[float]]:
    """GeoJSON coordinates are [lon, lat]; frontend uses [lat, lon]."""
    result: list[list[float]] = []
    for pair in coords:
        if len(pair) >= 2:
            result.append([float(pair[1]), norm_lon(float(pair[0]))])
    return result


def _make_searoute(origin_port: str, destination_port: str, restrictions: tuple[str, ...]) -> list[list[float]]:
    if sr is None:
        raise RuntimeError(
            f"SeaRoute is not installed. Install it with: pip install searoute==1.6.0 ({SEAROUTE_IMPORT_ERROR})"
        )

    origin_lat, origin_lon = PORT_COORDS[origin_port]
    dest_lat, dest_lon = PORT_COORDS[destination_port]

    feature = sr.searoute(
        [float(origin_lon), float(origin_lat)],
        [float(dest_lon), float(dest_lat)],
        units="naut",
        append_orig_dest=True,
        algorithm="astar",
        restrictions=list(restrictions),
    )
    coords = getattr(feature, "geometry", None)
    if isinstance(coords, dict):
        coords = coords.get("coordinates")
    if coords is None:
        coords = getattr(feature, "coordinates", None)
    if not coords:
        raise RuntimeError("SeaRoute returned no geometry for the selected ports.")

    route = _convert_geojson(coords)
    if len(route) < 2:
        raise RuntimeError("SeaRoute returned an unusable route geometry.")
    # Always anchor to the exact selected ports for the UI markers.
    route[0] = [float(origin_lat), float(origin_lon)]
    route[-1] = [float(dest_lat), float(dest_lon)]
    return route


@lru_cache(maxsize=2048)
def _candidate_routes(origin_port: str, destination_port: str) -> tuple[tuple[tuple[float, float], ...], ...]:
    if origin_port == destination_port:
        raise ValueError("Origin and destination ports must be different.")
    if origin_port not in PORT_COORDS or destination_port not in PORT_COORDS:
        raise ValueError("Unknown origin or destination port.")

    # Three maritime-network profiles provide route alternatives. The first is normally
    # the shortest practical route; alternatives make ML ranking meaningful.
    profiles = [
        (),
        ("suez",),
        ("south_africa",),
    ]
    seen = set()
    output = []
    for restrictions in profiles:
        try:
            route = _make_searoute(origin_port, destination_port, restrictions)
        except Exception:
            continue
        if _route_has_land(route):
            continue
        key = tuple((round(a, 4), round(b, 4)) for a, b in route)
        if key in seen:
            continue
        seen.add(key)
        output.append(tuple((float(a), float(b)) for a, b in route))

    if not output:
        raise RuntimeError("No validated water-only route was found for this port pair.")

    return tuple(output[:3])


def candidates(origin_port: str, destination_port: str) -> list[list[list[float]]]:
    return [[list(pair) for pair in route] for route in _candidate_routes(origin_port, destination_port)]


def route_optimizer(origin_port, destination_port, payload, rate_fn, batch_rate_fn=None):
    routes = candidates(origin_port, destination_port)
    scored = []

    if batch_rate_fn and len(routes) > 1:
        distances = [route_distance_nm(r) for r in routes]
        payloads = [(payload, d) for d in distances]
        rates = batch_rate_fn(payloads)
    else:
        distances = [route_distance_nm(r) for r in routes]
        rates = [rate_fn(payload, route_distance=d) for d in distances]

    quantity = float(payload["quantity_tonnes"])
    fuel_price = float(payload["fuel_price_usd_tonne"])
    for r, dist, rate in zip(routes, distances, rates):
        # ML predicts freight. A small transparent fuel component makes route selection
        # sensitive to distance/fuel without replacing the ML signal.
        fuel_proxy = (dist * fuel_price / 100000.0) * quantity
        total = float(rate) * quantity + fuel_proxy
        scored.append({
            "route": r,
            "distance_nm": dist,
            "predicted_rate": float(rate),
            "estimated_route_cost": total,
        })

    scored.sort(key=lambda x: x["estimated_route_cost"])
    best = scored[0]
    return {
        **best,
        "alternatives": scored,
        "label": f"{origin_port} → {destination_port} · ML-ranked maritime corridor",
        "selection_method": "ML ranking over SeaRoute water-only candidates",
        "validated_against_landmask": True,
        "route_source": "SeaRoute maritime network",
    }
