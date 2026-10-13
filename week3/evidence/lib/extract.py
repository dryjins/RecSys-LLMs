#!/usr/bin/env python3
"""Pull the JSON result out of a raw harness run.

The harness prints either "@@JSON@@{...}" or "@@ERROR@@...". This turns either
into a pretty-printed JSON file and sets the exit status.

Usage: extract.py <raw-file> <output-json>
"""

import json
import pathlib
import sys


def main():
    raw_path, out_path = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    raw = raw_path.read_text(encoding="utf-8", errors="replace")

    if "@@JSON@@" in raw:
        payload = json.loads(raw.split("@@JSON@@", 1)[1].strip())
        out_path.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")
        summary = payload.get("summary", {})
        return 0 if summary.get("failed", 0) == 0 and "error" not in payload else 1

    message = raw.split("@@ERROR@@", 1)[1].strip() if "@@ERROR@@" in raw else raw.strip()
    out_path.write_text(json.dumps({
        "section": "harness-error",
        "error": message,
        "summary": {"passed": 0, "failed": 1, "total": 1, "checks": []},
    }, indent=1) + "\n", encoding="utf-8")
    print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
