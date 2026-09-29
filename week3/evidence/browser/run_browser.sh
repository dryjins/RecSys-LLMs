#!/usr/bin/env bash
# Section H driver: runs the real index.html in headless Chrome and records the
# DOM-level result. No webdriver, chromedriver or selenium required.
#
# Usage: run_browser.sh <week3-dir> <output-json> [width] [height]
set -u

WEEK3="${1:?week3 directory required}"
OUT="${2:?output json required}"
WIDTH="${3:-1280}"
HEIGHT="${4:-1000}"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ ! -x "$CHROME" ]; then
    echo "Chrome not found at $CHROME" >&2
    exit 127
fi

rm -f "$OUT"
PROFILE="$(mktemp -d)"
SERVER_LOG="$(mktemp)"

python3 "$HERE/serve.py" --root "$WEEK3" --out "$OUT" --port 0 > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

PORT=""
for _ in $(seq 1 100); do
    PORT="$(head -n 1 "$SERVER_LOG" 2>/dev/null | tr -d '[:space:]')"
    if [ -n "$PORT" ]; then
        break
    fi
    sleep 0.1
done

if [ -z "$PORT" ]; then
    echo "server did not start" >&2
    cat "$SERVER_LOG" >&2
    kill "$SERVER_PID" 2>/dev/null
    exit 1
fi

"$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-first-run \
    --no-default-browser-check \
    --disable-extensions \
    --disable-background-networking \
    --disable-sync \
    --user-data-dir="$PROFILE" \
    --window-size="$WIDTH,$HEIGHT" \
    "http://127.0.0.1:$PORT/evidence/browser/driver.html" \
    > "$SERVER_LOG.chrome" 2>&1 &
CHROME_PID=$!

REPORTED=0
for _ in $(seq 1 600); do
    if [ -s "$OUT" ]; then
        REPORTED=1
        break
    fi
    sleep 0.5
done

kill "$CHROME_PID" 2>/dev/null
kill "$SERVER_PID" 2>/dev/null
rm -rf "$PROFILE"

if [ "$REPORTED" -ne 1 ]; then
    echo "driver did not report within the timeout" >&2
    tail -n 40 "$SERVER_LOG.chrome" >&2 2>/dev/null
    exit 1
fi

cat "$OUT"
