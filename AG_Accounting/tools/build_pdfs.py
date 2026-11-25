"""
Build PDFs of APPROVED white papers into public/white-papers/<slug>.pdf, using the
headless Chrome the tests already use. Draft papers never become public PDFs.

public/white-papers/manifest.json records a hash of each source file, so
`--check` can tell whether any PDF is missing, stale, or no longer approved.

Usage:
  uv run --no-project --python 3.12 python tools/build_pdfs.py
  uv run --no-project --python 3.12 python tools/build_pdfs.py --check
  uv run --no-project --python 3.12 python tools/build_pdfs.py --preview <slug>   # draft preview into review-packets/
"""

import argparse
import base64
import hashlib
import html
import json
import re
import sys
from pathlib import Path

from content_lib import ROOT, md_files, md_item

sys.path.insert(0, str(ROOT / "tests"))

OUT = ROOT / "public" / "white-papers"
MANIFEST = OUT / "manifest.json"

CSS = """
@page { size: Letter; margin: 0.8in 0.85in; }
body { font-family: Georgia, 'Times New Roman', serif; color: #1f2933; font-size: 11.5pt; line-height: 1.5; }
.cover { border-bottom: 3pt solid #b08d4f; padding-bottom: 14pt; margin-bottom: 18pt; }
.brand { font-weight: bold; letter-spacing: 1pt; text-transform: uppercase; color: #1e3a5f; font-size: 11pt; }
h1 { font-size: 24pt; color: #152a45; margin: 6pt 0; line-height: 1.2; }
.summary { font-size: 12.5pt; color: #52606d; margin: 0; }
.meta { font-family: Arial, sans-serif; font-size: 9pt; color: #52606d; margin-top: 8pt; }
h2 { font-size: 15pt; color: #152a45; margin: 18pt 0 6pt; page-break-after: avoid; }
h3 { font-size: 12.5pt; color: #152a45; margin: 12pt 0 4pt; page-break-after: avoid; }
p, li { margin: 0 0 7pt; }
ul, ol { padding-left: 18pt; }
.callout { border-left: 3pt solid #b08d4f; background: #f2f6fa; padding: 7pt 10pt; }
a { color: #24456e; }
.sources { margin-top: 20pt; border-top: 1pt solid #d9e2ec; padding-top: 8pt; font-family: Arial, sans-serif; font-size: 9pt; color: #52606d; }
.disclaimer { font-family: Arial, sans-serif; font-size: 9pt; color: #52606d; margin-top: 10pt; }
"""


def inline(text: str) -> str:
    out = html.escape(text, quote=False)
    out = re.sub(r"\[([^\]]+)\]\((https://[^\s)]+)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', out)
    out = re.sub(r"\[([^\]]+)\]\((/[^\s)]*)\)", r"\1", out)  # site-internal links become plain text in print
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<![*\w])\*(?!\s)(.+?)\*", r"<em>\1</em>", out)
    return out


def md_to_html(body: str) -> str:
    parts: list[str] = []
    para: list[str] = []
    lst: tuple[str, list[str]] | None = None

    def flush_para():
        nonlocal para
        if para:
            parts.append(f"<p>{inline(' '.join(para))}</p>")
        para = []

    def flush_list():
        nonlocal lst
        if lst:
            tag, items = lst
            parts.append(f"<{tag}>" + "".join(f"<li>{inline(i)}</li>" for i in items) + f"</{tag}>")
        lst = None

    for raw in body.split("\n"):
        line = raw.strip()
        if not line:
            flush_para(); flush_list()
        elif m := re.match(r"^(#{2,3})\s+(.*)$", line):
            flush_para(); flush_list()
            level = len(m.group(1))
            parts.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
        elif m := re.match(r"^(?:[-*]|\d+[.)])\s+(.*)$", line):
            flush_para()
            tag = "ol" if re.match(r"^\d", line) else "ul"
            if lst and lst[0] != tag:
                flush_list()
            if not lst:
                lst = (tag, [])
            lst[1].append(m.group(1))
        elif line.startswith(">"):
            flush_para(); flush_list()
            parts.append(f"<p class='callout'>{inline(line.lstrip('> '))}</p>")
        elif lst and raw.startswith("  "):
            lst[1][-1] += " " + line
        else:
            flush_list()
            para.append(line)
    flush_para(); flush_list()
    return "\n".join(parts)


def paper_html(item: dict) -> str:
    reviewed = f"Last reviewed {item['reviewedOn']}" if item.get("reviewedOn") else "DRAFT: not yet reviewed"
    sources = "".join(f"<div>{html.escape(s['title'])}: {html.escape(s['url'])}</div>" for s in item["sources"])
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(item['title'])}</title><style>{CSS}</style></head><body>
<div class="cover"><div class="brand">AG Accounting</div><h1>{html.escape(item['title'])}</h1>
<p class="summary">{html.escape(item['summary'])}</p><div class="meta">{reviewed}</div></div>
{md_to_html(item['_body'])}
<div class="sources"><b>Sources</b>{sources}</div>
<p class="disclaimer">This guide is general information, not tax, legal or financial advice for your situation. Tax rules change; contact AG Accounting before acting on it.</p>
</body></html>"""


def source_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def print_pdf(page: str, out: Path) -> None:
    from chrome_cdp import ChromeCdpSession  # tests/chrome_cdp.py

    tmp = out.with_suffix(".tmp.html")
    tmp.write_text(page, encoding="utf-8")
    session = ChromeCdpSession()
    try:
        session.navigate(tmp.resolve().as_uri(), wait_ms=300)
        res = session.call("Page.printToPDF", {"printBackground": True, "preferCSSPageSize": True})
        out.write_bytes(base64.b64decode(res["data"]))
    finally:
        session.close()
        tmp.unlink(missing_ok=True)


def papers():
    return [(p, md_item(p)) for p in md_files() if p.parent.name == "white-papers"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--preview")
    args = ap.parse_args()

    if args.preview:
        match = [(p, i) for p, i in papers() if i["slug"] == args.preview]
        if not match:
            print(f"No white paper with slug {args.preview}")
            return 1
        out = ROOT / "review-packets" / f"DRAFT-{args.preview}.pdf"
        out.parent.mkdir(exist_ok=True)
        print_pdf(paper_html(match[0][1]), out)
        print(f"Wrote {out.relative_to(ROOT)}")
        return 0

    approved = {i["slug"]: (p, i) for p, i in papers() if i["status"] == "approved"}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}

    if args.check:
        problems = []
        for slug, (p, _) in approved.items():
            if manifest.get(slug) != source_hash(p) or not (OUT / f"{slug}.pdf").exists():
                problems.append(f"{slug}: PDF missing or out of date")
        for slug in manifest:
            if slug not in approved:
                problems.append(f"{slug}: PDF exists but the paper isn't approved (or was removed)")
        for pdf in OUT.glob("*.pdf") if OUT.exists() else []:
            if pdf.stem not in approved:
                problems.append(f"{pdf.name}: unexpected PDF in public/white-papers")
        for line in problems:
            print(line)
        print("White-paper PDFs are up to date." if not problems else "Run tools/build_pdfs.py.")
        return 1 if problems else 0

    OUT.mkdir(parents=True, exist_ok=True)
    new_manifest = {}
    built = 0
    for slug, (p, item) in sorted(approved.items()):
        h = source_hash(p)
        new_manifest[slug] = h
        if manifest.get(slug) == h and (OUT / f"{slug}.pdf").exists():
            continue
        print_pdf(paper_html(item), OUT / f"{slug}.pdf")
        built += 1
    for pdf in OUT.glob("*.pdf"):
        if pdf.stem not in approved:
            pdf.unlink()
            print(f"Removed {pdf.name} (not approved)")
    MANIFEST.write_text(json.dumps(new_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{built} PDF(s) built, {len(approved)} approved white paper(s) total.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
