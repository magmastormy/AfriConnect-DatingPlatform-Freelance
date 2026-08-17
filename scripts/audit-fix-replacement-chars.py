"""One-shot repair for U+FFFD corruption found in the Aug 2026 audit.

Two distinct damage patterns, both originating from the same lossy write that
truncated multi-byte UTF-8 characters and then re-decoded them with
``errors='replace'``:

1. ``U+FFFD`` + ``?``  -> an em-dash ``e2 80 94`` whose 3rd byte became ``?``.
   The following space was also eaten, so it is restored: ``"— "``.
2. ``U+FFFD`` x2       -> a 3-byte char whose 3rd byte was dropped entirely;
   the surviving 2 bytes each decoded to one replacement char. The intended
   character depends on the file (em-dash in prose, box-drawing in rules).

Idempotent: running it again is a no-op once the files are clean.
"""

from __future__ import annotations

import pathlib
import sys

FFFD = "\ufffd"
EM_DASH = "\u2014"  # —
BOX_H = "\u2500"  # ─

# Which character a doubled U+FFFD should collapse back into, per file.
DOUBLE_TARGET = {
    "packages/api/scripts/migrate-to-r2.ts": BOX_H,
    "packages/api/src/modules/match/match.service.ts": EM_DASH,
}

TARGETS = [
    "packages/api/scripts/migrate-to-r2.ts",
    "packages/api/src/modules/admin/admin.repository.ts",
    "packages/api/src/modules/admin/admin.types.ts",
    "packages/api/src/modules/auth/auth.service.ts",
    "packages/api/src/modules/auth/clerkVerify.ts",
    "packages/api/src/modules/billing/billing.service.ts",
    "packages/api/src/modules/event/event.service.ts",
    "packages/api/src/modules/match/match.routes.ts",
    "packages/api/src/modules/match/match.service.ts",
    "packages/api/src/modules/match/scoring.ts",
]


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    total = 0

    for rel in TARGETS:
        path = root / rel
        if not path.is_file():
            print(f"  SKIP (missing): {rel}")
            continue

        original = path.read_text(encoding="utf-8")
        fixed = original.replace(FFFD + "?", EM_DASH + " ")
        fixed = fixed.replace(FFFD * 2, DOUBLE_TARGET.get(rel, EM_DASH))
        # Any stray single survivor in prose is an em-dash too.
        fixed = fixed.replace(FFFD, DOUBLE_TARGET.get(rel, EM_DASH))

        if fixed == original:
            print(f"  clean: {rel}")
            continue

        repaired = original.count(FFFD)
        total += repaired
        path.write_text(fixed, encoding="utf-8", newline="")
        print(f"  fixed {repaired} replacement char(s): {rel}")

    print(f"\ntotal replacement characters repaired: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
