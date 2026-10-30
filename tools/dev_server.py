#!/usr/bin/env python3
"""Serve the local review build without browser caching."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=4183)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / "dist"
server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(NoCacheHandler, directory=str(root)))
print(f"Serving {root} at http://127.0.0.1:{args.port}/", flush=True)
server.serve_forever()
