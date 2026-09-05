from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from heapq import heappush, heappop

from shapely.geometry import Point, LineString, Polygon
from shapely.strtree import STRtree
from shapely import union_all, contains_xy

from .ports import PORT_COORDS

BASE = Path(__file__).resolve().parents[1]
LAND_PATH = BASE / 'data' / 'landmask.geojson'

# 1-degree grid gives a good global planning resolution while keeping routing fast.
GRID_STEP = 1.0
LAT_MIN, LAT_MAX = -60.0, 75.0
LON_MIN, LON_MAX = -180.0, 180.0

LAND_TREE: STRtree | None = None
LAND_GEOMS = []
LAND_UNION = None
WATER_NODES: dict[tuple[int, int], tuple[float, float]] = {}
GRID_READY = False


def _load_land() -> None:
    global LAND_TREE, LAND_GEOMS
    if LAND_TREE is not None:
        return
    data = json.loads(LAND_PATH.read_text(encoding='utf-8'))
    geoms = []
    for feat in data.get('features', []):
        g = feat.get('geometry') or {}
        if g.get('type') == 'Polygon':
            for ring in g.get('coordinates', []):
                if ring:
                    try:
                        geoms.append(Polygon(ring))
                    except Exception:
                        pass
        elif g.get('type') == 'MultiPolygon':
            for poly in g.get('coordinates', []):
                if poly and poly[0]:
                    try:
                        geoms.append(Polygon(poly[0]))
                    except Exception:
                        pass
    LAND_GEOMS = geoms
    LAND_TREE = STRtree(LAND_GEOMS)
    global LAND_UNION
    LAND_UNION = union_all(LAND_GEOMS)


def _norm_lon(lon: float) -> float:
    return ((float(lon) + 180.0) % 360.0) - 180.0


def _point_on_land(lat: float, lon: float) -> bool:
    _load_land()
    return bool(contains_xy(LAND_UNION, _norm_lon(lon), float(lat)))


def _segment_clear(a: tuple[float, float], b: tuple[float, float]) -> bool:
    """Fast water check for a grid edge using dense interior samples."""
    # Grid edges are short (about 1 degree), so dense sampling is both fast and robust.
    for t in (0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875):
        lat = a[0] + (b[0]-a[0])*t
        lon = _norm_lon(a[1] + _norm_lon(b[1]-a[1])*t)
        if _point_on_land(lat, lon):
            return False
    return True


def _port_access_clear(a: tuple[float,float], b: tuple[float,float]) -> bool:
    """Check a port-to-sea segment; the port endpoint itself may lie inside the land polygon."""
    for t in (0.12,0.24,0.36,0.5,0.64,0.76,0.88):
        lat = a[0] + (b[0]-a[0])*t
        lon = _norm_lon(a[1] + _norm_lon(b[1]-a[1])*t)
        if _point_on_land(lat, lon):
            return False
    return True

def _haversine_nm(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = math.radians(_norm_lon(math.degrees(lon2-lon1)))
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 3440.065 * 2 * math.asin(min(1.0, math.sqrt(h)))


def _grid_index(lat: float, lon: float) -> tuple[int, int]:
    i = round((lat - LAT_MIN) / GRID_STEP)
    j = round((_norm_lon(lon) - LON_MIN) / GRID_STEP)
    j %= int((LON_MAX-LON_MIN)/GRID_STEP) + 1
    return i, j


def _grid_coord(i: int, j: int) -> tuple[float, float]:
    lat = LAT_MIN + i * GRID_STEP
    width = int((LON_MAX-LON_MIN)/GRID_STEP) + 1
    j %= width
    lon = LON_MIN + j * GRID_STEP
    if lon >= 180:
        lon = -180.0
    return lat, lon


def _build_grid() -> None:
    global GRID_READY, WATER_NODES
    if GRID_READY:
        return
    _load_land()
    nlat = int(round((LAT_MAX-LAT_MIN)/GRID_STEP)) + 1
    nlon = int(round((LON_MAX-LON_MIN)/GRID_STEP))
    coords = [(i,j,LAT_MIN+i*GRID_STEP,LON_MIN+j*GRID_STEP) for i in range(nlat) for j in range(nlon)]
    xs = [c[3] for c in coords]
    ys = [c[2] for c in coords]
    mask = contains_xy(LAND_UNION, xs, ys)
    for c, is_land in zip(coords, mask):
        if not bool(is_land):
            WATER_NODES[(c[0],c[1])] = (c[2],c[3])
    GRID_READY = True


@lru_cache(maxsize=2048)
def _nearest_water(port: str) -> tuple[int, int]:
    _build_grid()
    lat, lon = PORT_COORDS[port]
    base_i, base_j = _grid_index(lat, lon)
    # Expand search rings, prioritizing direct water access from the port.
    best = None
    best_score = float('inf')
    for radius in range(1, 16):
        for di in range(-radius, radius+1):
            for dj in range(-radius, radius+1):
                if max(abs(di), abs(dj)) != radius:
                    continue
                i = base_i + di
                j = (base_j + dj) % int((LON_MAX-LON_MIN)/GRID_STEP)
                if (i,j) not in WATER_NODES:
                    continue
                c = WATER_NODES[(i,j)]
                d = _haversine_nm((lat,lon), c)
                if d >= best_score:
                    continue
                if _port_access_clear((lat,lon), c):
                    best_score = d
                    best = (i,j)
        if best is not None and best_score < 350:
            return best
    if best is None:
        # fallback: nearest water node by distance only (route validator will still reject crossings)
        for key, c in WATER_NODES.items():
            d = _haversine_nm((lat,lon), c)
            if d < best_score:
                best_score, best = d, key
    return best


def _neighbors(node: tuple[int,int]):
    i,j = node
    max_i = int(round((LAT_MAX-LAT_MIN)/GRID_STEP))
    width = int(round((LON_MAX-LON_MIN)/GRID_STEP))
    for di in (-1,0,1):
        for dj in (-1,0,1):
            if di == 0 and dj == 0:
                continue
            ni = i + di
            if ni < 0 or ni > max_i:
                continue
            nj = (j + dj) % width
            if (ni,nj) not in WATER_NODES:
                continue
            yield (ni,nj)


@lru_cache(maxsize=200000)
def _edge_ok(a: tuple[int,int], b: tuple[int,int]) -> bool:
    p = WATER_NODES[a]; q = WATER_NODES[b]
    for t in (0.25, 0.5, 0.75):
        lat = p[0] + (q[0]-p[0])*t
        lon = _norm_lon(p[1] + _norm_lon(q[1]-p[1])*t)
        if _point_on_land(lat, lon):
            return False
    return True


def _astar(start: tuple[int,int], goal: tuple[int,int], mode: str = 'distance') -> list[tuple[int,int]]:
    goal_c = WATER_NODES[goal]
    open_heap = []
    heappush(open_heap, (0.0, 0, start))
    came = {}
    gscore = {start: 0.0}
    counter = 0

    while open_heap:
        _, _, cur = heappop(open_heap)
        if cur == goal:
            path = [cur]
            while cur in came:
                cur = came[cur]
                path.append(cur)
            path.reverse()
            return path
        cc = WATER_NODES[cur]
        for nb in _neighbors(cur):
            if not _edge_ok(cur, nb):
                continue
            nc = WATER_NODES[nb]
            step = _haversine_nm(cc, nc)
            extra = 0.0
            if mode == 'offshore':
                extra += 2.5 if abs(nc[0]) < 2 else 0.0
            elif mode == 'southern':
                # Generates a genuinely different candidate for long east-west voyages.
                extra += max(0.0, 18.0 - abs(nc[0])) * 0.7
            tentative = gscore[cur] + step + extra
            if tentative < gscore.get(nb, float('inf')):
                came[nb] = cur
                gscore[nb] = tentative
                counter += 1
                h = _haversine_nm(nc, goal_c)
                heappush(open_heap, (tentative+h, counter, nb))
    return []


def _path_to_points(path: list[tuple[int,int]], origin: str, destination: str) -> list[list[float]]:
    origin_c = PORT_COORDS[origin]
    dest_c = PORT_COORDS[destination]
    pts = [[float(origin_c[0]), float(origin_c[1])]]
    for n in path:
        c = WATER_NODES[n]
        if not pts or abs(pts[-1][0]-c[0]) > 0.001 or abs(_norm_lon(pts[-1][1]-c[1])) > 0.001:
            pts.append([c[0], c[1]])
    pts.append([float(dest_c[0]), float(dest_c[1])])
    return pts


def _route_valid(points: list[list[float]]) -> bool:
    if len(points) < 2:
        return False
    # Endpoints can be on land because they represent port terminals.
    for i in range(len(points)-1):
        a=tuple(points[i]); b=tuple(points[i+1])
        samples = (0.05,0.12,0.24,0.36,0.5,0.64,0.76,0.88,0.95) if i in (0,len(points)-2) else (0.125,0.25,0.375,0.5,0.625,0.75,0.875)
        for t in samples:
            lat=a[0]+(b[0]-a[0])*t
            lon=_norm_lon(a[1]+_norm_lon(b[1]-a[1])*t)
            if _point_on_land(lat,lon):
                return False
    return True


@lru_cache(maxsize=2048)
def candidate_routes(origin_port: str, destination_port: str):
    if origin_port == destination_port:
        raise ValueError('Origin and destination ports must be different.')
    if origin_port not in PORT_COORDS or destination_port not in PORT_COORDS:
        raise ValueError('Unknown origin or destination port.')
    _build_grid()
    s = _nearest_water(origin_port)
    g = _nearest_water(destination_port)
    if not s or not g:
        raise RuntimeError('Unable to connect selected ports to the maritime grid.')
    modes = ('distance','offshore','southern')
    out = []
    seen = set()
    for mode in modes:
        path = _astar(s,g,mode)
        if not path:
            continue
        pts = _path_to_points(path, origin_port, destination_port)
        if not _route_valid(pts):
            continue
        # extra safety: sample segments densely
        key = tuple((round(p[0],2), round(p[1],2)) for p in pts)
        if key in seen:
            continue
        seen.add(key)
        out.append(tuple((float(a),float(b)) for a,b in pts))
    if not out:
        raise RuntimeError('No water-only route could be found for this port pair.')
    return tuple(out)


def route_distance_nm(route):
    return sum(_haversine_nm(tuple(a), tuple(b)) for a,b in zip(route, route[1:]))


def route_optimizer(origin_port, destination_port, payload, rate_fn, batch_rate_fn=None):
    routes = candidate_routes(origin_port, destination_port)
    distances = [route_distance_nm(r) for r in routes]
    if batch_rate_fn:
        rates = batch_rate_fn([(payload,d) for d in distances])
    else:
        rates = [rate_fn(payload, route_distance=d) for d in distances]
    quantity = float(payload['quantity_tonnes'])
    fuel_price = float(payload['fuel_price_usd_tonne'])
    scored = []
    for route, dist, rate in zip(routes, distances, rates):
        # Keep ML as the decision signal, with a small physical cost proxy.
        fuel_proxy = dist * fuel_price * quantity / 100000.0
        total = float(rate) * quantity + fuel_proxy
        scored.append({
            'route': route,
            'distance_nm': dist,
            'predicted_rate': float(rate),
            'estimated_route_cost': total,
        })
    scored.sort(key=lambda x: x['estimated_route_cost'])
    best = scored[0]
    return {
        **best,
        'alternatives': scored,
        'label': f"{origin_port} → {destination_port} · ML-ranked maritime corridor",
        'selection_method': 'ML ranking over validated water-only candidates',
        'validated_against_landmask': True,
        'route_source': 'Local water-grid routing with land-mask validation',
    }
