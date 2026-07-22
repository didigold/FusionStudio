"""
Gaze Analysis (GA) marks model and helpers.

GA_marks.json v2 stores, per file key, a structured payload:

    {
        "version": 2,
        "periods": [
            {"move_start": 5.82, "gaze_on": 6.30, "move_end": 9.51, "road_on": 9.95},
            ...
        ]
    }

Semantics of each mark within a distraction period:
    move_start : eyes start moving away from the road (transition away begins)
    gaze_on    : gaze fixates on the distraction target (start of VATS time)
    move_end   : eyes start moving back to the road (end of VATS time)
    road_on    : gaze fixates back on the road

Legacy files store a flat list of floats [t0, t1, t2, ...] where each pair
(t0, t1) corresponds to (gaze_on, move_end) of a period. All helpers accept
both formats transparently.
"""

GA_MARKS_VERSION = 2

PERIOD_KEYS = ("move_start", "gaze_on", "move_end", "road_on")

# Order in which marks are placed within a period (used by the UI cycle)
PERIOD_SEQUENCE = ("move_start", "gaze_on", "move_end", "road_on")


def _to_float(value):
    """Best-effort conversion to float, rejecting None/NaN/non-numeric."""
    if value is None or isinstance(value, bool):
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def _period_sort_key(period: dict) -> float:
    for key in ("gaze_on", "move_start", "move_end", "road_on"):
        v = period.get(key)
        if v is not None:
            return v
    return 0.0


def normalize_periods(entry) -> list:
    """Normalize any stored marks entry to the canonical periods list.

    Accepts:
        - legacy flat list [t0, t1, ...] -> pairs become (gaze_on, move_end)
        - v2 dict {"version": 2, "periods": [...]}
        - already-canonical list of period dicts
    Returns a list of dicts with float|None values for PERIOD_KEYS,
    sorted chronologically by each period's reference time.
    """
    periods: list = []

    if isinstance(entry, dict):
        raw_periods = entry.get("periods") or []
        for rp in raw_periods:
            if not isinstance(rp, dict):
                continue
            p = {k: _to_float(rp.get(k)) for k in PERIOD_KEYS}
            if any(v is not None for v in p.values()):
                periods.append(p)
    elif isinstance(entry, list):
        if entry and all(isinstance(item, dict) for item in entry):
            for rp in entry:
                p = {k: _to_float(rp.get(k)) for k in PERIOD_KEYS}
                if any(v is not None for v in p.values()):
                    periods.append(p)
        else:
            floats = [f for f in (_to_float(v) for v in entry) if f is not None]
            for i in range(0, len(floats) - 1, 2):
                periods.append({
                    "move_start": None,
                    "gaze_on": floats[i],
                    "move_end": floats[i + 1],
                    "road_on": None,
                })
            if len(floats) % 2 == 1:
                periods.append({
                    "move_start": None,
                    "gaze_on": floats[-1],
                    "move_end": None,
                    "road_on": None,
                })

    periods.sort(key=_period_sort_key)
    return periods


def flatten_middle_marks(periods: list) -> list:
    """Legacy-equivalent flat list [gaze_on, move_end, gaze_on, move_end, ...].

    Preserves the exact semantics consumed today by report config builders
    (tgaze = first element, visual phases = second element, short-distraction
    accumulation over consecutive pairs).
    """
    out: list = []
    for p in periods or []:
        g = p.get("gaze_on")
        e = p.get("move_end")
        if g is not None:
            out.append(g)
        if e is not None:
            out.append(e)
    return out


def to_storage(periods: list):
    """Canonical v2 payload for GA_marks.json, or None if there is nothing to store."""
    cleaned: list = []
    for p in periods or []:
        if not isinstance(p, dict):
            continue
        cp = {k: _to_float(p.get(k)) for k in PERIOD_KEYS}
        if any(v is not None for v in cp.values()):
            cleaned.append(cp)
    if not cleaned:
        return None
    return {"version": GA_MARKS_VERSION, "periods": cleaned}


def period_metrics(period: dict) -> dict:
    """Derived durations (seconds) for a single period; None when not computable."""
    ms, g = period.get("move_start"), period.get("gaze_on")
    me, ro = period.get("move_end"), period.get("road_on")
    return {
        "t_trans_away": (g - ms) if (g is not None and ms is not None) else None,
        "t_vats": (me - g) if (me is not None and g is not None) else None,
        "t_trans_back": (ro - me) if (ro is not None and me is not None) else None,
    }


def accumulated_distraction_up_to(periods: list, warn_time) -> float:
    """Accumulated gaze-away (VATS) time up to warn_time.

    Mirrors the legacy short-distraction algorithm operating on flat pairs.
    """
    if warn_time is None:
        return 0.0
    try:
        warn_time = float(warn_time)
    except (TypeError, ValueError):
        return 0.0
    total = 0.0
    for p in periods or []:
        g, e = p.get("gaze_on"), p.get("move_end")
        if g is None:
            continue
        if warn_time < g:
            break
        if e is None or warn_time <= e:
            total += warn_time - g
            break
        total += e - g
    return total
