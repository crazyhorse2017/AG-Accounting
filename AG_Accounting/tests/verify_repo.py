"""
Static audit of the AG Accounting project. No Node.js and no network needed.

Checks configuration, the D1 schema, the no-sensitive-data rule, links and
routing, and reports content that still needs the firm's confirmation.

Usage:
  uv run --no-project --python 3.12 python tests/verify_repo.py            # draft items are warnings
  uv run --no-project --python 3.12 python tests/verify_repo.py --launch   # draft items fail (pre-launch gate)
"""

import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
LAUNCH = "--launch" in sys.argv

failures: list[str] = []
warnings: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def strip_jsonc(text: str) -> str:
    out, i, in_str = [], 0, False
    while i < len(text):
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\":
                out.append(text[i + 1])
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
            out.append(c)
        elif text.startswith("//", i):
            while i < len(text) and text[i] != "\n":
                i += 1
            continue
        elif text.startswith("/*", i):
            i = text.index("*/", i) + 2
            continue
        else:
            out.append(c)
        i += 1
    return re.sub(r",(\s*[}\]])", r"\1", "".join(out))


# ------------------------------------------------------------------ files --
REQUIRED_FILES = [
    "package.json", "tsconfig.json", "vite.config.ts", "wrangler.jsonc", "index.html", ".gitignore",
    "public/_headers", "public/robots.txt", "public/favicon.svg", "migrations/0001_init.sql",
    "src/main.tsx", "src/App.tsx", "src/index.css", "src/content/site.ts", "src/shared/contact.ts",
    "src/worker/index.ts", "src/worker/contact.ts", "README.md",
]
for rel in REQUIRED_FILES:
    check((ROOT / rel).is_file(), f"missing file: {rel}")

# ----------------------------------------------------------------- config --
pkg = json.loads(read("package.json"))
check(pkg.get("scripts", {}).get("build") == "vite build", "package.json build script must be 'vite build'")

wrangler = json.loads(strip_jsonc(read("wrangler.jsonc")))
check(wrangler.get("main") == "./src/worker/index.ts", "wrangler main must be ./src/worker/index.ts")
check("/api/*" in wrangler.get("assets", {}).get("run_worker_first", []), "wrangler assets.run_worker_first must include /api/*")
# Only the build output may be public. Serving the project root once published raw
# source (index.html -> /src/main.tsx) and produced a blank page.
check(wrangler.get("assets", {}).get("directory") == "./dist", "wrangler assets.directory must be ./dist (the Vite build output)")
vite_config = read("vite.config.ts")
check("@cloudflare/vite-plugin" not in vite_config, "vite.config.ts must not use @cloudflare/vite-plugin (wrangler.jsonc serves ./dist directly)")
check("outDir: 'dist'" in vite_config, "vite.config.ts must build into dist")
d1 = wrangler.get("d1_databases", [])
check(len(d1) == 1 and d1[0].get("binding") == "DB", "wrangler needs exactly one D1 binding named DB")
if d1 and d1[0].get("database_id", "").startswith("REPLACE_"):
    (failures if LAUNCH else warnings).append("wrangler.jsonc: D1 database_id is still a placeholder")
if "routes" not in wrangler:
    (failures if LAUNCH else warnings).append("wrangler.jsonc: no custom domain route yet")

worker_index = read("src/worker/index.ts")
check(
    not re.search(r"^export\s+(?!default\b)", worker_index, re.M),
    "src/worker/index.ts may only have a default export (put helpers in other files)",
)

headers = read("public/_headers")
for name in ("Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "frame-ancestors 'none'"):
    check(name in headers, f"public/_headers missing {name}")

# ------------------------------------------------------------------ schema --
SENSITIVE_COLUMN = re.compile(r"ssn|social|tin\b|itin|card|cvv|cvc|routing|account_?num|bank|tax_?return|dob|birth|password", re.I)
migrations = sorted((ROOT / "migrations").glob("*.sql"))
check(bool(migrations), "no migrations found")
db = sqlite3.connect(":memory:")
for m in migrations:
    try:
        db.executescript(m.read_text(encoding="utf-8"))
    except sqlite3.Error as e:
        failures.append(f"{m.name}: SQL error: {e}")
for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
    for col in db.execute(f"PRAGMA table_info({table})"):
        check(not SENSITIVE_COLUMN.search(col[1]), f"schema: column {table}.{col[1]} looks like sensitive data (hard rule)")

# Every SQL statement in the Worker must use bound parameters, not string building.
worker_sources = {p: p.read_text(encoding="utf-8") for p in (SRC / "worker").rglob("*.ts")}
for path, text in worker_sources.items():
    for m in re.finditer(r"prepare\(\s*`([^`]*)`", text):
        check("${" not in m.group(1), f"{path.relative_to(ROOT)}: SQL built with template interpolation")
    check(not re.search(r"console\.(log|info|debug)\(", text), f"{path.relative_to(ROOT)}: no console.log in the Worker (never log submissions)")
    for m in re.finditer(r"console\.(error|warn)\(([^)]*)\)", text):
        check(not re.search(r"submission|message|body|input|email|name", m.group(2)), f"{path.relative_to(ROOT)}: console.{m.group(1)} must not include user data")

# ------------------------------------------------------------- frontend --
ui_files = {p: p.read_text(encoding="utf-8") for p in SRC.rglob("*.tsx")}
for path, text in ui_files.items():
    rel = path.relative_to(ROOT)
    check('type="file"' not in text, f"{rel}: file uploads are not allowed on this site (use the client portal)")
    check("dangerouslySetInnerHTML" not in text, f"{rel}: dangerouslySetInnerHTML is not allowed")
    check(not re.search(r"\bstyle=\{", text), f"{rel}: inline style attributes break the CSP (style-src 'self')")
    check(not re.search(r"\b(alert|confirm|prompt)\(", text), f"{rel}: native browser dialogs are not allowed")
    for m in re.finditer(r'target="_blank"', text):
        window = text[m.start() - 200 : m.end() + 200]
        check('rel="noopener noreferrer"' in window, f"{rel}: target=_blank without rel=noopener noreferrer")
    check(not re.search(r"(?i)name=\"(ssn|social|card|cvv|routing|account)", text), f"{rel}: form field looks like sensitive data (hard rule)")

# Every route renders a page and is reachable from somewhere.
router = read("src/lib/router.tsx")
routes = re.findall(r"'(/[a-z-]*)'", router.split("export const ROUTES", 1)[1].split("]", 1)[0])
app = read("src/App.tsx")
layout = read("src/components/Layout.tsx")
for r in routes:
    check(f"'{r}':" in app, f"route {r} has no page in App.tsx")
    if r != "/":
        check(f"'{r}'" in layout or f'"{r}"' in layout, f"route {r} is not linked from the header or footer")
for m in re.finditer(r'to="(/[^"]*)"', "".join(ui_files.values())):
    check(m.group(1) in routes, f"link to unknown route {m.group(1)}")

# External links must be https and on an approved host.
ALLOWED_HOSTS = ("www.irs.gov", "irs.gov", "tax.ohio.gov", "www.paypal.com", "paypal.com", "www.paypal.me", "paypal.me")
content = read("src/content/site.ts")
for url in re.findall(r"https?://[^'\"\s)]+", content):
    host = re.sub(r"^https?://", "", url).split("/", 1)[0]
    check(url.startswith("https://"), f"content link is not https: {url}")
    check(host in ALLOWED_HOSTS, f"content link to unapproved host: {url} (add it to ALLOWED_HOSTS if intended)")

# ---------------------------------------------------------------- content --
drafts = len(re.findall(r"confirmed:\s*false", content))
nulls = [k for k in ("phone", "email", "address", "hours") if re.search(rf"^\s*{k}:\s*null", content, re.M)]
if drafts or nulls:
    msg = f"content: {drafts} unconfirmed item(s); missing business details: {', '.join(nulls) or 'none'}"
    (failures if LAUNCH else warnings).append(msg)
check("Draft:" not in read("src/pages/Privacy.tsx") or not LAUNCH, "privacy page is still marked Draft")

# ------------------------------------------------------------------ report --
for w in warnings:
    print(f"WARN  {w}")
for f in failures:
    print(f"FAIL  {f}")
print(f"\n{len(failures)} failure(s), {len(warnings)} warning(s){' [launch mode]' if LAUNCH else ''}.")
sys.exit(1 if failures else 0)
