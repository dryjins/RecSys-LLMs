#!/usr/bin/env python3
"""Tiny static server for the A03 browser check.

Serves week3/ so that index.html and the driver page share an origin, and
accepts a POST to /__report from the driver with the finished JSON results.
Standard library only.

Usage: serve.py --root <dir> --out <report.json> [--port 0]
Prints the bound port on stdout, then "READY".
"""

import argparse
import http.server
import json
import pathlib
import socketserver
import sys
import threading


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()

    root = pathlib.Path(args.root).resolve()
    out_path = pathlib.Path(args.out).resolve()
    done = threading.Event()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def log_message(self, *a):
            pass

        def do_POST(self):
            if self.path != "/__report":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(body)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    with Server(("127.0.0.1", args.port), Handler) as httpd:
        print(httpd.server_address[1], flush=True)
        print("READY", flush=True)
        try:
            httpd.serve_forever(poll_interval=0.1)
        except KeyboardInterrupt:
            pass
    if not done.wait(0.1):
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
