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
routes_src = read("src/lib/routes.ts")
routes = re.findall(r"'(/[a-z:/-]*)'", routes_src.split("export const ROUTES", 1)[1].split("]", 1)[0])
check(len(routes) >= 19, "could not read ROUTES from src/lib/routes.ts")
app = read("src/App.tsx")
all_ui = "".join(ui_files.values())
data_text = "".join(p.read_text(encoding="utf-8") for p in (SRC / "content" / "data").rglob("*.json"))


def route_matches(path: str) -> bool:
    segs = path.split("/")
    for r in routes:
        rs = r.split("/")
        if len(rs) == len(segs) and all(a.startswith(":") or a == b for a, b in zip(rs, segs)):
            return True
    return False


for r in routes:
    check(f"'{r}':" in app, f"route {r} has no page in App.tsx")
    if r != "/" and ":" not in r:
        linked = f"'{r}'" in all_ui or f'"{r}"' in all_ui or f'"path": "{r}"' in data_text
        check(linked, f"route {r} is not linked from anywhere")
for m in re.finditer(r'to="(/[^"]*)"', all_ui):
    check(route_matches(m.group(1)), f"link to unknown route {m.group(1)}")

# External links must be https and on an approved official host.
ALLOWED_HOSTS = (
    "www.irs.gov", "irs.gov", "tax.ohio.gov", "codes.ohio.gov", "www.ssa.gov",
    "www.ritaohio.com", "www.ccaohio.gov",
    "www.paypal.com", "paypal.com", "www.paypal.me", "paypal.me",
    "www.youtube-nocookie.com", "www.youtube.com",
    "www.congress.gov", "www.archives.gov", "home.treasury.gov", "www.treasury.gov",
    "www.eftps.gov", "www.uscis.gov", "jfs.ohio.gov", "info.bwc.ohio.gov",
)
content = read("src/content/site.ts")
link_sources = {"src/content/site.ts": content}
link_sources.update({p.relative_to(ROOT).as_posix(): p.read_text(encoding="utf-8") for p in (SRC / "content" / "data").rglob("*.json")})
link_sources.update({p.relative_to(ROOT).as_posix(): t for p, t in ui_files.items()})
link_sources.update({p.relative_to(ROOT).as_posix(): p.read_text(encoding="utf-8") for p in (SRC / "content").glob("*/*.md")})
for rel, text in link_sources.items():
    for url in re.findall(r"https?://[^'\"\s)`<>]+", text):
        host = re.sub(r"^https?://", "", url).split("/", 1)[0]
        check(url.startswith("https://"), f"{rel}: link is not https: {url}")
        check(host in ALLOWED_HOSTS, f"{rel}: link to unapproved host: {url} (add it to ALLOWED_HOSTS if intended)")

# ------------------------------------------------------- reviewable content --
sys.path.insert(0, str(ROOT / "tools"))
from content_lib import all_items  # noqa: E402

seen_ids: dict[str, str] = {}
draft_count = 0
for path, item in all_items():
    rel = path.relative_to(ROOT).as_posix()
    iid = item["id"]
    check(re.fullmatch(r"[a-z0-9][a-z0-9-]*", iid) is not None, f"{rel}: bad id {iid!r}")
    check(iid not in seen_ids, f"{rel}: duplicate id {iid} (also in {seen_ids.get(iid)})")
    seen_ids[iid] = rel
    check(item["status"] in ("draft", "approved"), f"{rel}: {iid} has unknown status {item['status']!r}")
    if item["status"] == "approved":
        check(bool(item.get("reviewedOn")) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(item.get("reviewedOn"))) is not None, f"{rel}: approved {iid} needs reviewedOn YYYY-MM-DD")
    else:
        draft_count += 1
        check(item.get("reviewedOn") in (None, ""), f"{rel}: draft {iid} should not have reviewedOn")
    check(isinstance(item.get("sources", []), list), f"{rel}: {iid} sources must be a list")
    for src in item.get("sources", []):
        check(isinstance(src, dict) and src.get("title") and str(src.get("url", "")).startswith("https://"), f"{rel}: {iid} has a bad source entry")

# Tax-year figures must always cite a source.
for path, item in all_items():
    if "tax-years" in path.as_posix() and "data" in item:
        check(len(item.get("sources", [])) > 0, f"{item['id']}: tax figures need at least one source")

# An approved calculator may only depend on approved tax data.
calc_doc = json.loads(read("src/content/data/calculators.json"))
status_by_id = {i["id"]: i["status"] for _, i in all_items()}
for c in calc_doc["items"]:
    for dep in c.get("dataIds", []):
        check(dep in status_by_id, f"calculator {c['id']} depends on unknown data {dep}")
        if c["status"] == "approved":
            check(status_by_id.get(dep) == "approved", f"calculator {c['id']} is approved but its data {dep} is still a draft")
impl_text = "".join(p.read_text(encoding="utf-8") for p in (SRC / "calculators" / "impl").glob("*.ts"))
for c in calc_doc["items"]:
    check(f"'{c['id']}':" in impl_text, f"calculator {c['id']} has no formula in src/calculators/impl")

# The calendar file must match the approved due dates.
import subprocess  # noqa: E402

ics = subprocess.run([sys.executable, str(ROOT / "tools" / "build_ics.py"), "--check"], capture_output=True, text=True)
check(ics.returncode == 0, "public/tax-calendar.ics is out of date (run tools/build_ics.py)")

pdfs = subprocess.run([sys.executable, str(ROOT / "tools" / "build_pdfs.py"), "--check"], capture_output=True, text=True)
check(pdfs.returncode == 0, "white-paper PDFs are out of date (run tools/build_pdfs.py): " + pdfs.stdout.strip().replace("\n", "; "))

# Articles and white papers: complete front matter, URL-safe slugs that match the file name.
from content_lib import md_files, md_item  # noqa: E402

ARTICLE_CATEGORIES = {"personal-tax", "business-tax", "personal-tax-planning", "business-tax-planning", "niche", "word-to-the-wise"}
for p in md_files():
    it = md_item(p)
    rel = p.relative_to(ROOT).as_posix()
    check(it["slug"] == p.stem, f"{rel}: slug must match the file name")
    check(re.fullmatch(r"[a-z0-9-]+", p.stem) is not None, f"{rel}: file name must be lowercase-with-dashes")
    check(bool(it["title"]) and bool(it["summary"]), f"{rel}: needs title and summary")
    check(len(it["sources"]) > 0, f"{rel}: needs at least one source line")
    check(len(it["_body"].split()) >= 150, f"{rel}: body looks too short")
    check("<" not in re.sub(r"<(?=\d)", "", it["_body"]), f"{rel}: raw HTML is not allowed in Markdown")
    check(not re.search(r"^\s*\|.*\|\s*$", it["_body"], re.M), f"{rel}: Markdown tables aren't supported; use a list")
    if it["_kind"] == "articles":
        check(it["category"] in ARTICLE_CATEGORIES, f"{rel}: unknown category {it['category']!r}")

videos_doc = json.loads(read("src/content/data/videos.json"))
for v in videos_doc["items"]:
    check(re.fullmatch(r"[A-Za-z0-9_-]{11}", v.get("youtubeId", "")) is not None, f"video {v['id']}: bad youtubeId")
    check(v.get("topic") in {t["id"] for t in videos_doc["topics"]}, f"video {v['id']}: unknown topic")

if draft_count:
    (failures if LAUNCH else warnings).append(f"content: {draft_count} reviewable item(s) still in draft (run tools/review_packet.py)")
env_files = [p for p in ROOT.glob(".env*") if p.is_file()]
if LAUNCH:
    for p in env_files:
        check("VITE_SHOW_DRAFTS" not in p.read_text(encoding="utf-8"), f"{p.name}: remove VITE_SHOW_DRAFTS before launch")

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
