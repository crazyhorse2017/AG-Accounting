"""
Shared helpers for the no-Node verification scripts.

TypeScript and the type definitions come from an existing local cache:
  1. %LOCALAPPDATA%/ag-typecheck-cache/node_modules   (this project's own, if created)
  2. %LOCALAPPDATA%/prizm-typecheck-cache/node_modules (filled by Prizm's tests/typecheck.py)

Nothing is downloaded here. If neither cache has the packages, the scripts stop
and explain how to fill one.
"""

import http.server
import json
import os
import threading
from pathlib import Path

from chrome_cdp import ChromeCdpSession

ROOT = Path(__file__).resolve().parent.parent
LOCAL = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / ".cache"))
CACHE_CANDIDATES = [LOCAL / "ag-typecheck-cache", LOCAL / "prizm-typecheck-cache"]
REQUIRED = [
    "typescript",
    "@types/react",
    "@types/react-dom",
    "csstype",
    "@cloudflare/workers-types",
    "vite",
]


def find_cache() -> Path:
    for cache in CACHE_CANDIDATES:
        modules = cache / "node_modules"
        if all((modules / name / "package.json").exists() for name in REQUIRED) and (
            modules / "typescript" / "lib" / "typescript.js"
        ).exists():
            return cache
    raise SystemExit(
        "No TypeScript cache found. Run Prizm's type check once to fill it:\n"
        "  uv run --no-project --python 3.12 python tests/typecheck.py   (inside the Prizm project)\n"
        f"Looked in: {', '.join(str(c) for c in CACHE_CANDIDATES)}"
    )


def typescript_js(cache: Path) -> bytes:
    return (cache / "node_modules" / "typescript" / "lib" / "typescript.js").read_bytes()


def project_sources(include_tests: bool = False) -> dict[str, str]:
    files: dict[str, str] = {}
    dirs = [ROOT / "src"] + ([ROOT / "tests"] if include_tests else [])
    for base in dirs:
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in (".ts", ".tsx", ".json"):
                files["/" + path.relative_to(ROOT).as_posix()] = path.read_text(encoding="utf-8")
    return files


def run_in_browser(payloads: dict[str, tuple[str, bytes]], result_expr: str, timeout_s: float = 300):
    """Serve `payloads` on 127.0.0.1, open /index.html headless, wait for `result_expr`, return its value."""

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            entry = payloads.get(self.path.split("?", 1)[0])
            if not entry:
                self.send_error(404)
                return
            ctype, body = entry
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    session = None
    try:
        session = ChromeCdpSession()
        session.ws.sock.settimeout(timeout_s)
        session.navigate(f"http://127.0.0.1:{server.server_address[1]}/index.html", wait_ms=200)
        session.wait_for(result_expr, timeout_s=timeout_s)
        value = session.evaluate(result_expr)
        return value, list(session.console_errors)
    finally:
        if session:
            session.close()
        server.shutdown()
        server.server_close()


def as_json_payload(value) -> tuple[str, bytes]:
    return ("application/json", json.dumps(value).encode("utf-8"))
