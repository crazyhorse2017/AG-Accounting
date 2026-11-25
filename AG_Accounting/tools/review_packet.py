"""
Build a review packet of draft content for the firm to check.

Writes review-packets/<date>-packet-<n>.html, .pdf (via headless Chrome) and
.txt (plain text to paste into an email). Each item has an ID and checkboxes
for Approve / Change / Reject, so the marked-up printout can be applied with
tools/approve.py.

Usage:
  uv run --no-project --python 3.12 python tools/review_packet.py            # up to 50 drafts
  uv run --no-project --python 3.12 python tools/review_packet.py --limit 30
  uv run --no-project --python 3.12 python tools/review_packet.py --prefix fed-2026   # only IDs starting with a prefix
  uv run --no-project --python 3.12 python tools/review_packet.py --no-pdf
"""

import argparse
import base64
import datetime as dt
import html
import sys
from pathlib import Path

from content_lib import ROOT, all_items, body_text, describe

sys.path.insert(0, str(ROOT / "tests"))

OUT = ROOT / "review-packets"

CSS = """
body { font-family: Georgia, serif; color: #1f2933; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 4pt; color: #152a45; }
.meta { color: #52606d; font-size: 10pt; margin-bottom: 14pt; }
.howto { border: 1pt solid #bccfe2; background: #f2f6fa; padding: 8pt 10pt; font-size: 10pt; margin-bottom: 16pt; }
.item { border-top: 1pt solid #d9e2ec; padding: 10pt 0; page-break-inside: avoid; }
.id { font-family: Consolas, monospace; font-size: 9pt; color: #52606d; }
.title { font-weight: bold; font-size: 12pt; margin: 2pt 0 4pt; }
.line { font-size: 10.5pt; margin: 2pt 0; font-family: Arial, sans-serif; }
.boxes { margin-top: 6pt; font-family: Arial, sans-serif; font-size: 10pt; }
.box { display: inline-block; width: 11pt; height: 11pt; border: 1.2pt solid #1e3a5f; vertical-align: middle; margin: 0 4pt 0 14pt; }
.box:first-child { margin-left: 0; }
.notes { border-bottom: 1pt dotted #9aa5b1; height: 18pt; margin-top: 4pt; }
"""


def build(items, number: int, today: str) -> tuple[str, str]:
    parts = [
        f"<!doctype html><html><head><meta charset='utf-8'><title>AG Accounting review packet {number}</title><style>{CSS}</style></head><body>",
        f"<h1>AG Accounting website: review packet {number}</h1>",
        f"<div class='meta'>{today} · {len(items)} items · Nothing here is on the public website until approved.</div>",
        "<div class='howto'><b>How to review:</b> for each item, check <b>Approve</b> if it's correct, <b>Change</b> and write the fix on the line, "
        "or <b>Reject</b> if it shouldn't be on the site. Check every number, date and claim. Then send the pages back (a phone photo is fine).</div>",
    ]
    text = [
        f"AG Accounting website: review packet {number} ({today}), {len(items)} items",
        "Reply with each ID followed by APPROVE, CHANGE (with the fix), or REJECT.",
        "",
    ]
    for path, item in items:
        rel = path.relative_to(ROOT).as_posix()
        lines = body_text(item)
        parts.append("<div class='item'>")
        parts.append(f"<div class='id' title='{html.escape(rel)}'>ID: {html.escape(item['id'])}</div>")
        parts.append(f"<div class='title'>{html.escape(describe(item))}</div>")
        parts.extend(f"<div class='line'>{html.escape(line)}</div>" for line in lines)
        parts.append("<div class='boxes'><span class='box'></span>Approve<span class='box'></span>Change<span class='box'></span>Reject</div>")
        parts.append("<div class='notes'></div></div>")
        text.append(f"[{item['id']}] {describe(item)}")
        text.extend(f"    {line}" for line in lines)
        text.append("    -> APPROVE / CHANGE / REJECT:")
        text.append("")
    parts.append("</body></html>")
    return "\n".join(parts), "\n".join(text)


def to_pdf(html_path: Path, pdf_path: Path) -> None:
    from chrome_cdp import ChromeCdpSession  # tests/chrome_cdp.py

    session = ChromeCdpSession()
    try:
        session.navigate(html_path.resolve().as_uri(), wait_ms=300)
        res = session.call("Page.printToPDF", {"printBackground": True, "paperWidth": 8.5, "paperHeight": 11,
                                               "marginTop": 0.6, "marginBottom": 0.6, "marginLeft": 0.7, "marginRight": 0.7})
        pdf_path.write_bytes(base64.b64decode(res["data"]))
    finally:
        session.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--prefix", nargs="*", default=[""], help="only IDs starting with any of these")
    ap.add_argument("--no-pdf", action="store_true")
    args = ap.parse_args()

    drafts = [(p, i) for p, i in all_items() if i["status"] == "draft" and any(i["id"].startswith(x) for x in args.prefix)]
    # Keep the order of the prefixes given, so the most important items come first.
    drafts.sort(key=lambda pi: next(n for n, x in enumerate(args.prefix) if pi[1]["id"].startswith(x)))
    if not drafts:
        print("No draft items to review.")
        return 0
    batch = drafts[: args.limit]
    OUT.mkdir(exist_ok=True)
    today = dt.date.today().isoformat()
    number = 1 + len(list(OUT.glob(f"{today}-packet-*.html")))
    stem = OUT / f"{today}-packet-{number}"
    page, text = build(batch, number, today)
    stem.with_suffix(".html").write_text(page, encoding="utf-8")
    stem.with_suffix(".txt").write_text(text, encoding="utf-8")
    if not args.no_pdf:
        to_pdf(stem.with_suffix(".html"), stem.with_suffix(".pdf"))
    print(f"Packet {number}: {len(batch)} of {len(drafts)} draft items")
    for suffix in (".pdf", ".txt", ".html"):
        f = stem.with_suffix(suffix)
        if f.exists():
            print(f"  {f.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
