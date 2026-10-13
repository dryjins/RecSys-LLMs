#!/usr/bin/env python3
"""Static checks on the shipped files plus dataset integrity hashes.

These do not execute the application; they assert properties of the source
text and of the two data files, so a regression in wiring or in the raw data is
caught even if every behavioural test still passes.

Usage: static_checks.py <week3-dir>
"""

import hashlib
import json
import pathlib
import re
import sys

EXPECTED_HASHES = {
    "u.data": "06416e597f82b7342361e41163890c81036900f418ad91315590814211dca490",
    "u.item": "553841ebc7de3a0fd0d6b62a204ea30c1e651aacfb2814c7a6584ac52f2c5701",
}

SHIPPED = ["data.js", "script.js", "index.html", "style.css"]


def main():
    week3 = pathlib.Path(sys.argv[1]).resolve()
    checks = []
    hashes = {}

    def check(name, condition, detail=""):
        checks.append({"name": name, "passed": bool(condition), "detail": str(detail)})

    for filename, expected in EXPECTED_HASHES.items():
        digest = hashlib.sha256((week3 / filename).read_bytes()).hexdigest()
        hashes[filename] = digest
        check(f"{filename} is unmodified", digest == expected, digest)

    index_html = (week3 / "index.html").read_text(encoding="utf-8")
    script_js = (week3 / "script.js").read_text(encoding="utf-8")
    data_js = (week3 / "data.js").read_text(encoding="utf-8")
    style_css = (week3 / "style.css").read_text(encoding="utf-8")

    check("production page does not load tests.js",
          "tests.js" not in index_html, "no reference")
    check("tests.js exists but is harness-only",
          (week3 / "tests.js").is_file(), "week3/tests.js")
    check("page loads only local application scripts",
          re.findall(r'src="([^"]+)"', index_html) == ["data.js", "script.js"],
          re.findall(r'src="([^"]+)"', index_html))
    check("no remote script or stylesheet is referenced",
          not re.search(r'(src|href)="https?://', index_html), "none")

    inner_html = re.findall(r'\.innerHTML\s*=', script_js)
    check("script.js never assigns innerHTML", not inner_html, f"{len(inner_html)} assignments")
    check("script.js inserts text via textContent",
          ".textContent" in script_js, "textContent used")

    check("script.js has no import or require statements",
          not re.search(r'^\s*(import\s|const\s+.*=\s*require\()', script_js, re.M), "none")
    check("no CDN or vendor library is referenced",
          not re.search(r'https?://', script_js + data_js + style_css), "none")

    check("u.item is decoded as windows-1252",
          "windows-1252" in data_js,
          re.search(r"TextDecoder\('([^']+)'\)", data_js).group(1))
    check("similarity lambda is 25",
          re.search(r"SIMILARITY_LAMBDA\s*=\s*25\b", script_js) is not None, "SIMILARITY_LAMBDA = 25")
    check("neighbour limit is 20",
          re.search(r"NEIGHBOUR_LIMIT\s*=\s*20\b", script_js) is not None, "NEIGHBOUR_LIMIT = 20")
    check("significance weight is n/(n+lambda)",
          re.search(r"overlap\s*/\s*\(\s*overlap\s*\+\s*SIMILARITY_LAMBDA\s*\)", script_js) is not None,
          "similarityFromTotals")
    check("ratings are clamped to the 1..5 scale",
          re.search(r"clampRating", script_js) is not None, "clampRating used")

    # Count the double-quoted entries. An apostrophe count would be wrong
    # because "Children's" contains one inside the string.
    genre_block = re.search(r"const genreNames = \[(.*?)\];", data_js, re.S).group(1)
    genre_entries = re.findall(r'"[^"]*"', genre_block)
    check("genre list has exactly 18 named genres", len(genre_entries) == 18, f"{len(genre_entries)} entries")
    check("no genre is named 'unknown'",
          "unknown" not in [entry.strip('"') for entry in genre_entries], "flag is separate")
    check("unknown is carried as a separate flag, not a genre",
          "unknownGenre" in data_js and "UNKNOWN_FLAG_FIELD" in data_js, "separate field")

    check("style.css defines focus styles for every control",
          all(selector in style_css for selector in
              ["#user-select:focus", "#movie-select:focus", "#recommend-btn:focus"]),
          "focus rules present")
    check("style.css has a small-viewport media query",
          "@media (max-width: 640px)" in style_css, "640px breakpoint")
    check("style.css has a print or reduced-motion or contrast affordance",
          any(token in style_css for token in ["@media print", "prefers-reduced-motion", "prefers-color-scheme"]),
          "checked")

    passed = sum(1 for entry in checks if entry["passed"])
    json.dump({
        "section": "I-static-and-data-integrity",
        "hashes": hashes,
        "expectedHashes": EXPECTED_HASHES,
        "summary": {"passed": passed, "failed": len(checks) - passed, "total": len(checks), "checks": checks},
    }, sys.stdout, indent=1)
    print()
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
