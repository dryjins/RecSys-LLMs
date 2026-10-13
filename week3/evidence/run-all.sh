#!/usr/bin/env bash
# Runs the complete A03 verification suite against the real week3 sources.
#
#   ./run-all.sh
#
# Results are written to week3/evidence/results/. Nothing is committed and no
# dataset is copied. Exit status is 0 only when every section passes.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
WEEK3="$(cd "$HERE/.." && pwd)"
RESULTS="$HERE/results"
WORK="$(mktemp -d)"
JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"

trap 'rm -rf "$WORK"' EXIT
mkdir -p "$RESULTS"
rm -f "$RESULTS"/*.json

FAILED=0
declare -a SUMMARY=()

note() { printf '%s\n' "$*"; }

section_header() {
    note ""
    note "=== $1 ==="
}

# Records one result file in the consolidated table.
record() {
    local label="$1" file="$2"
    local line
    line="$(python3 "$HERE/lib/summarise.py" "$file" 2>/dev/null || echo 'unreadable')"
    SUMMARY+=("$(printf '%-34s %s' "$label" "$line")")
    case "$line" in
        *"FAIL"*|*"unreadable"*|*"0/0"*) FAILED=1 ;;
    esac
}

# ---------------------------------------------------------------------------
# 0. JavaScript runtime
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
    JS=(node)
    JS_NAME="node $(node --version)"
elif [ -x "$JSC" ]; then
    JS=("$JSC")
    JS_NAME="JavaScriptCore ($JSC)"
else
    note "No JavaScript runtime found (need node or $JSC)."
    exit 127
fi
note "Runtime: $JS_NAME"
note "Week3:   $WEEK3"

run_section() {
    # run_section <result-name> <section.js> [extra-section.js ...]
    local name="$1"; shift
    python3 "$HERE/lib/build_harness.py" "$HERE/lib/common.js" "$@" > "$WORK/$name.js" \
        || { note "build failed for $name"; FAILED=1; return; }
    "${JS[@]}" "$WORK/$name.js" > "$WORK/$name.raw" 2>&1
    python3 "$HERE/lib/extract.py" "$WORK/$name.raw" "$RESULTS/$name.json" >/dev/null 2>&1
    record "$name" "$RESULTS/$name.json"
}

# ---------------------------------------------------------------------------
# 1. Data integrity, unit and regression, professor fixture
# ---------------------------------------------------------------------------
section_header "A. Dataset integrity"
run_section A-data-integrity verify_data.js

section_header "B. Unit and regression suite"
run_section B-unit-and-regression verify_units.js

section_header "C. Professor worked example"
run_section C-professor-worked-example verify_professor.js

# ---------------------------------------------------------------------------
# 2. Holdout evaluation, then the independent Python cross-check
# ---------------------------------------------------------------------------
section_header "D. Holdout evaluation (leave-one-out)"
run_section D-holdout-evaluation holdout.js

section_header "E. Independent Python cross-check"
if [ -s "$RESULTS/D-holdout-evaluation.json" ]; then
    python3 "$HERE/crosscheck.py" "$RESULTS/D-holdout-evaluation.json" 1e-9 \
        > "$RESULTS/E-crosscheck.json" 2>"$WORK/e.err"
    if [ $? -ne 0 ]; then
        note "cross-check reported differences (see E-crosscheck.json)"
    fi
    record E-crosscheck "$RESULTS/E-crosscheck.json"
else
    note "skipped: D produced no result"
    FAILED=1
fi

# ---------------------------------------------------------------------------
# 3. Efficiency, cold start, browser, static checks
# ---------------------------------------------------------------------------
section_header "F. Efficiency"
run_section F-efficiency verify_efficiency.js

section_header "G. Cold start and sparsity"
run_section G-cold-start-and-sparsity verify_coldstart.js

section_header "H. Browser verification (headless Chrome)"
if [ -d "/Applications/Google Chrome.app" ]; then
    for spec in "desktop:1280:1000" "mobile:375:900"; do
        label="${spec%%:*}"; rest="${spec#*:}"
        width="${rest%%:*}"; height="${rest##*:}"
        if bash "$HERE/browser/run_browser.sh" "$WEEK3" "$RESULTS/H-browser-$label.json" \
                "$width" "$height" > "$WORK/browser-$label.log" 2>&1; then
            record "H-browser-$label" "$RESULTS/H-browser-$label.json"
        else
            note "browser run failed ($label):"
            tail -n 20 "$WORK/browser-$label.log" | sed 's/^/    /'
            printf '{\n "section": "H-browser-%s",\n "summary": {"passed": 0, "failed": 1, "total": 1, "checks": []}\n}\n' \
                "$label" > "$RESULTS/H-browser-$label.json"
            FAILED=1
        fi
    done
else
    note "Chrome not found; recording the manual browser steps instead."
    printf '{\n "section": "H-browser-manual",\n "summary": {"passed": 0, "failed": 1, "total": 1, "checks": []}\n}\n' \
        > "$RESULTS/H-browser-manual.json"
    FAILED=1
fi

section_header "I. Static source and dataset integrity"
if python3 "$HERE/static_checks.py" "$WEEK3" > "$RESULTS/I-static-checks.json" 2>"$WORK/i.err"; then
    record I-static-checks "$RESULTS/I-static-checks.json"
else
    cat "$WORK/i.err"
    record I-static-checks "$RESULTS/I-static-checks.json"
fi

# ---------------------------------------------------------------------------
# 4. Consolidated summary
# ---------------------------------------------------------------------------
note ""
note "================ CONSOLIDATED SUMMARY ================"
for line in "${SUMMARY[@]}"; do
    note "$line"
done
note "======================================================"
note "Full results: $RESULTS"

if [ "$FAILED" -ne 0 ]; then
    note "RESULT: FAIL"
    exit 1
fi
note "RESULT: PASS"
