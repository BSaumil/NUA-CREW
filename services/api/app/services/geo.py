"""Approximate suburb centroids for "near me" search.

DATA QUALITY: these are rounded, hand-entered centroids for common Melbourne suburbs (plus a few
capital CBDs) to make distance sorting demonstrable. They are NOT a licensed gazetteer. Replace with
an authoritative source (e.g. ABS/PSMA localities) before relying on distances. Distances are
straight-line, never travel time. Device coordinates are used only for the request, never stored.
"""

import math

_CENTROIDS: dict[tuple[str, str], tuple[float, float]] = {
    ("melbourne", "VIC"): (-37.814, 144.963),
    ("fitzroy", "VIC"): (-37.799, 144.978),
    ("collingwood", "VIC"): (-37.804, 144.988),
    ("abbotsford", "VIC"): (-37.803, 145.001),
    ("richmond", "VIC"): (-37.818, 144.999),
    ("cremorne", "VIC"): (-37.829, 144.992),
    ("carlton", "VIC"): (-37.800, 144.967),
    ("parkville", "VIC"): (-37.784, 144.958),
    ("north melbourne", "VIC"): (-37.797, 144.949),
    ("kensington", "VIC"): (-37.793, 144.930),
    ("flemington", "VIC"): (-37.787, 144.930),
    ("brunswick", "VIC"): (-37.767, 144.960),
    ("coburg", "VIC"): (-37.744, 144.964),
    ("northcote", "VIC"): (-37.770, 145.002),
    ("thornbury", "VIC"): (-37.756, 145.012),
    ("preston", "VIC"): (-37.742, 145.003),
    ("fairfield", "VIC"): (-37.779, 145.018),
    ("heidelberg", "VIC"): (-37.757, 145.067),
    ("essendon", "VIC"): (-37.752, 144.917),
    ("moonee ponds", "VIC"): (-37.766, 144.920),
    ("footscray", "VIC"): (-37.800, 144.900),
    ("yarraville", "VIC"): (-37.815, 144.889),
    ("williamstown", "VIC"): (-37.857, 144.896),
    ("docklands", "VIC"): (-37.815, 144.945),
    ("southbank", "VIC"): (-37.823, 144.964),
    ("south melbourne", "VIC"): (-37.833, 144.959),
    ("port melbourne", "VIC"): (-37.838, 144.940),
    ("south yarra", "VIC"): (-37.838, 144.993),
    ("prahran", "VIC"): (-37.850, 144.993),
    ("st kilda", "VIC"): (-37.867, 144.981),
    ("elwood", "VIC"): (-37.882, 144.984),
    ("brighton", "VIC"): (-37.906, 144.998),
    ("hawthorn", "VIC"): (-37.822, 145.036),
    ("kew", "VIC"): (-37.806, 145.031),
    ("camberwell", "VIC"): (-37.836, 145.058),
    ("box hill", "VIC"): (-37.819, 145.122),
    ("glen waverley", "VIC"): (-37.878, 145.165),
    ("clayton", "VIC"): (-37.925, 145.121),
    ("dandenong", "VIC"): (-37.987, 145.215),
    ("frankston", "VIC"): (-38.144, 145.123),
    ("geelong", "VIC"): (-38.150, 144.361),
    ("sydney", "NSW"): (-33.869, 151.209),
    ("brisbane", "QLD"): (-27.470, 153.026),
}


def centroid(suburb: str | None, state: str | None) -> tuple[float, float] | None:
    if not suburb or not state:
        return None
    return _CENTROIDS.get((suburb.strip().lower(), state.strip().upper()))


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(min(1.0, math.sqrt(a)))
