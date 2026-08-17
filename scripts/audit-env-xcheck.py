"""Cross-check every env var referenced in source against the .env files.

Audit item #2. Reports three classes:
  MISSING  - referenced in code but declared in no .env/.env.example
  UNUSED   - declared in a .env file but never read by any source file
  OK       - referenced and declared

Scope note: the API reads root `.env`; Next.js reads `apps/web/.env` (the app
directory, NOT the monorepo root). Vars prefixed NEXT_PUBLIC_ are therefore
checked against the web env files, everything else against the root ones.

Run: python scripts/audit-env-xcheck.py
"""

from __future__ import annotations

import pathlib
import re
import sys

SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage"}
SRC_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}

ENV_REF = re.compile(r"process\.env\.([A-Z0-9_]+)|process\.env\[['\"]([A-Z0-9_]+)['\"]\]")
ENV_DECL = re.compile(r"^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=")

ROOT_ENVS = [".env", ".env.example"]
WEB_ENVS = ["apps/web/.env", "apps/web/.env.example"]

# Declared on purpose but read by something other than our TS/JS source, so a
# "never read" report on these is noise, not a finding.
EXTERNALLY_CONSUMED = {
    # Read internally by the @clerk/nextjs SDK / clerkMiddleware, not by our code.
    "CLERK_SECRET_KEY": "consumed by @clerk/nextjs SDK",
    # Reference-only leftovers from the removed docker-compose `db` service. The
    # project now uses Aiven PostgreSQL via DATABASE_URL; commented out in
    # .env.example but still uncommented in some local .env files. Harmless.
    "POSTGRES_USER": "legacy local-Postgres reference (unused since Aiven)",
    "POSTGRES_PASSWORD": "legacy local-Postgres reference (unused since Aiven)",
    "POSTGRES_DB": "legacy local-Postgres reference (unused since Aiven)",
}

# Injected by the platform/toolchain, never declared by us.
BUILTIN = {
    "NODE_ENV",
    "PORT",
    "CI",
    "npm_package_version",
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "RENDER",
    "LOG_LEVEL",
    "TZ",
}


def skipped(path: pathlib.Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def collect_refs(root: pathlib.Path) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    for path in root.rglob("*"):
        if not path.is_file() or skipped(path) or path.suffix.lower() not in SRC_EXTS:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = path.relative_to(root).as_posix()
        for match in ENV_REF.finditer(text):
            name = match.group(1) or match.group(2)
            refs.setdefault(name, [])
            if rel not in refs[name]:
                refs[name].append(rel)
    return refs


def collect_decls(root: pathlib.Path, files: list[str]) -> set[str]:
    names: set[str] = set()
    for rel in files:
        path = root / rel
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.lstrip().startswith("#"):
                continue
            match = ENV_DECL.match(line)
            if match:
                names.add(match.group(1))
    return names


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    refs = collect_refs(root)
    root_decls = collect_decls(root, ROOT_ENVS)
    web_decls = collect_decls(root, WEB_ENVS)
    all_decls = root_decls | web_decls

    missing: list[tuple[str, list[str]]] = []
    for name, where in sorted(refs.items()):
        if name in BUILTIN:
            continue
        declared = web_decls if name.startswith("NEXT_PUBLIC_") else all_decls
        if name not in declared:
            missing.append((name, where))

    unused = sorted(
        n
        for n in all_decls
        if n not in refs and n not in BUILTIN and n not in EXTERNALLY_CONSUMED
    )
    explained = sorted(n for n in all_decls if n not in refs and n in EXTERNALLY_CONSUMED)

    print(f"env vars referenced in code : {len(refs)}")
    print(f"declared in root .env files : {len(root_decls)}")
    print(f"declared in web  .env files : {len(web_decls)}")

    print(f"\n=== MISSING (referenced, never declared) : {len(missing)} ===")
    for name, where in missing:
        print(f"  {name}")
        for w in where[:3]:
            print(f"      <- {w}")
    if not missing:
        print("  (none)")

    print(f"\n=== UNUSED (declared, never read) : {len(unused)} ===")
    for name in unused:
        print(f"  {name}")
    if not unused:
        print("  (none)")

    print(f"\n=== NOT READ BY OUR SOURCE, BUT EXPLAINED : {len(explained)} ===")
    for name in explained:
        print(f"  {name}  <- {EXTERNALLY_CONSUMED[name]}")
    if not explained:
        print("  (none)")

    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
