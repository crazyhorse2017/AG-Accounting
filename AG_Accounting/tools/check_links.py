"""
Check every external link in the site content: it must load (HTTP 200) and not be
a generic "not found" page. Run monthly (see the maintenance checklist).

Usage:
  uv run --no-project --python 3.12 python tools/check_links.py
"""

import re
import sys
import urllib.request

from content_lib import ROOT

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
# Some government sites block automated requests; they're checked by hand instead.
SKIP_HOSTS = {"www.ssa.gov", "www.youtube-nocookie.com"}  # youtube: embed template, checked by check_videos.py
SOFT_404 = re.compile(r"page not found|not found|404|^resources for\s*$", re.I)


def collect() -> list[str]:
    urls: set[str] = set()
    src = ROOT / "src"
    for path in [p for ext in ("*.ts", "*.tsx", "*.json", "*.md") for p in src.rglob(ext)]:
        if "worker" in path.relative_to(ROOT / "src").parts:
            continue  # API endpoints, not pages visitors open
        urls |= set(re.findall(r"https://[A-Za-z0-9-]+\.[A-Za-z0-9.-]+[^\s'\"`)<>|\\]*", path.read_text(encoding="utf-8")))
    return sorted(u.rstrip(".,") for u in urls)


def check(url: str) -> str | None:
    host = url.split("/")[2]
    if host in SKIP_HOSTS:
        return None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
            if r.status != 200:
                return f"HTTP {r.status}"
            if "html" in (r.headers.get("Content-Type") or ""):
                page = r.read(200_000).decode("utf-8", "replace")
                title = re.search(r"<title[^>]*>(.*?)</title>", page, re.S | re.I)
                if title and SOFT_404.search(title.group(1).strip()):
                    return f"looks like a not-found page (title: {title.group(1).strip()[:60]!r})"
            return None
    except Exception as e:  # noqa: BLE001 - report every failure
        return str(getattr(e, "code", "") or e)[:100]


def main() -> int:
    urls = collect()
    bad = 0
    for url in urls:
        problem = check(url)
        if problem:
            bad += 1
            print(f"BROKEN  {url}  ({problem})")
    skipped = sum(1 for u in urls if u.split('/')[2] in SKIP_HOSTS)
    print(f"\n{len(urls)} link(s) checked, {bad} broken, {skipped} skipped (check by hand: {', '.join(sorted(SKIP_HOSTS))}).")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
