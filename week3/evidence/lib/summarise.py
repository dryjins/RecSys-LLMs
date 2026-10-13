#!/usr/bin/env python3
"""One-line pass/fail summary for a result file.

Usage: summarise.py <result.json>
Prints e.g. "PASS  18/18" or "FAIL  10/11 (1 failed)".
The E cross-check file has no `checks` array, so it is summarised from
`checkedPairs` and `failures` instead.
"""

import json
import pathlib
import sys


def main():
    path = pathlib.Path(sys.argv[1])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"UNREADABLE ({error})")
        return 1

    if data.get("error") and "summary" not in data:
        print("ERROR")
        return 1

    summary = data.get("summary", {})
    total = summary.get("total", 0)
    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0)

    if total == 0 and "checkedPairs" in data:
        pairs = data["checkedPairs"]
        failures = data.get("failures", [])
        state = "PASS" if data.get("passed") else "FAIL"
        extra = f" worst delta {max(data['worstUserBasedDelta'], data['worstItemBasedDelta']):.1e}" if pairs else ""
        print(f"{state}  {pairs} fixed pairs, tolerance {data['tolerance']:g},{extra}"
              + (f" {len(failures)} mismatch(es)" if failures else ""))
        return 0 if data.get("passed") else 1

    if total == 0:
        print("FAIL  0/0")
        return 1

    state = "PASS" if failed == 0 else "FAIL"
    print(f"{state}  {passed}/{total}" + (f" ({failed} failed)" if failed else ""))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
