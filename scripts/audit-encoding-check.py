"""Repo-wide UTF-8 validity check.

Written during the Aug 2026 audit after finding 8 truncated em-dashes
(byte pattern ``\xe2\x80\x3f`` -- an em-dash whose 3rd byte was overwritten
with ``?`` by a lossy write) across 7 API source files. Those bytes are not
valid UTF-8, so any tool that strictly decodes the file will crash.

Run: python scripts/audit-encoding-check.py
Exits 1 if any tracked source file fails to decode as UTF-8.
"""

from __future__ import annotations

import pathlib
import sys

SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage", ".workbuddy"}
EXTS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".sql", ".css", ".yml", ".yaml",
}
# Source-code extensions where U+FFFD is ALWAYS corruption (docs/config may
# legitimately quote it in prose, so they are excluded from the SUSPECT scan).
CODE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".css"}
# Known truncated-multibyte signatures worth flagging even if decoding passes.
SUSPECT = [b"\xe2\x80\x3f", b"\xe2\x3f", b"\xef\xbf\xbd"]


def skipped(path: pathlib.Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    invalid: list[tuple[str, str]] = []
    suspicious: list[tuple[str, str]] = []

    for path in root.rglob("*"):
        if not path.is_file() or skipped(path) or path.suffix.lower() not in EXTS:
            continue
        raw = path.read_bytes()
        rel = path.relative_to(root).as_posix()
        try:
            raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            invalid.append((rel, str(exc)))
        if path.suffix.lower() in CODE_EXTS:
            for sig in SUSPECT:
                if sig in raw:
                    suspicious.append((rel, sig.hex()))

    print(f"invalid utf-8 files: {len(invalid)}")
    for rel, err in invalid:
        print(f"  {rel}: {err}")

    print(f"suspicious byte sequences: {len(suspicious)}")
    for rel, sig in suspicious:
        print(f"  {rel}: {sig}")

    return 1 if invalid or suspicious else 0


if __name__ == "__main__":
    sys.exit(main())
