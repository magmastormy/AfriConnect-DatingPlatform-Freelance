"""
Audit helper: cross-check every web-side API call against the routes actually
registered by the API modules.

Run: python scripts/audit-route-xcheck.py

Catches the class of bug where the frontend calls an endpoint that was renamed,
never implemented, or mounted under a different segment — which surfaces at
runtime as a 404 rather than a compile error.
"""

import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def api_routes() -> set[tuple[str, str]]:
    """(METHOD, /segment/path) for every route registered by an API module."""
    per_module: dict[str, set[tuple[str, str]]] = {}
    pattern = os.path.join(ROOT, "packages", "api", "src", "modules", "*", "*.routes.ts")
    for path in glob.glob(pattern):
        module = os.path.basename(os.path.dirname(path))
        # errors="replace": a few files carry legacy non-UTF-8 bytes in comments;
        # they must not abort the scan.
        with open(path, encoding="utf-8", errors="replace") as fh:
            src = fh.read()
        # re.S so multi-line `router.get(\n  '/audit',` is captured too.
        for match in re.finditer(
            r"router\.(get|post|patch|put|delete)\s*\(\s*'([^']*)'", src, re.S
        ):
            per_module.setdefault(module, set()).add(
                (match.group(1).upper(), match.group(2))
            )

    with open(os.path.join(ROOT, "packages", "api", "src", "app.ts"), encoding="utf-8", errors="replace") as fh:
        app_src = fh.read()
    # app.use(`${mount}/profile`, buildProfileModule())  ->  profile: Profile
    mounts = re.findall(
        r"app\.use\(`\$\{mount\}/([A-Za-z]+)`,\s*build(\w+?)Module\(\)\)", app_src
    )
    segment_by_module = {builder.lower(): segment for segment, builder in mounts}

    routes: set[tuple[str, str]] = set()
    for module, entries in per_module.items():
        segment = segment_by_module.get(module, module)
        for method, sub in entries:
            routes.add((method, f"/{segment}" + ("" if sub == "/" else sub)))
    return routes


def web_calls() -> set[tuple[str, str, str]]:
    """(METHOD, path, file) for every api.<verb>('...') call in the web app."""
    calls: set[tuple[str, str, str]] = set()
    for ext in ("ts", "tsx"):
        pattern = os.path.join(ROOT, "apps", "web", "src", "**", f"*.{ext}")
        for path in glob.glob(pattern, recursive=True):
            with open(path, encoding="utf-8", errors="replace") as fh:
                src = fh.read()
            for match in re.finditer(
                r"api\.(get|post|patch|put|del|delete)\s*(?:<[^>]*>)?\s*\(\s*[`']([^`']+)[`']",
                src,
            ):
                method = match.group(1).upper()
                method = "DELETE" if method == "DEL" else method
                endpoint = match.group(2).split("?")[0]
                endpoint = re.sub(r"\$\{[^}]*\}", ":p", endpoint)
                calls.add((method, endpoint, os.path.relpath(path, ROOT)))
    return calls


def segments(path: str) -> list[str]:
    return [s for s in path.split("/") if s]


def is_param(seg: str) -> bool:
    return seg.startswith(":")


def matches(web: str, api: str) -> bool:
    """
    Segment-wise match.

    A web segment built from a template expression (normalised to ':p') is a
    runtime value, so it legitimately matches EITHER an API param (`:id`) or an
    API literal. That second case is why `/matches/${userId}/${action}` must be
    accepted against `/matches/:id/like` - the action is chosen at runtime from a
    closed union ('like' | 'pass' | 'superlike').
    """
    w, a = segments(web), segments(api)
    if len(w) != len(a):
        return False
    for ws, as_ in zip(w, a):
        if is_param(ws) or is_param(as_):
            continue
        if ws != as_:
            return False
    return True


def main() -> int:
    registered = sorted(api_routes())
    calls = sorted(web_calls())

    missing: list[tuple[str, str, str]] = []
    for method, path, src in calls:
        if not any(m == method and matches(path, p) for m, p in registered):
            missing.append((method, path, src))

    print("=== WEB CALLS WITH NO MATCHING API ROUTE ===")
    if missing:
        for method, path, src in missing:
            print(f"  MISSING: {method:6} {path}   <- {src}")
    else:
        print("  (none - every web call maps to a registered API route)")

    print(f"\nweb call sites: {len(calls)} | api routes: {len(registered)}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
