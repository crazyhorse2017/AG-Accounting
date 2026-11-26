"""
Build src/worker/generated/emails.json: the APPROVED weekly tips and monthly
newsletter issues the Worker's Tuesday job can send. Drafts never get in.

A newsletter issue for a month is built only when the shared footer and newsletter
opening are approved and there's at least one approved article from the previous
month or an approved due date coming up. Issues are built for a fixed range of months
so the output only changes when content changes (extend the range each year).

Usage:
  uv run --no-project --python 3.12 python tools/build_emails.py
  uv run --no-project --python 3.12 python tools/build_emails.py --check
"""

import argparse
import datetime as dt
import html
import json
import sys

from content_lib import DATA, ROOT, all_items, load, md_files, md_item
from email_lib import GOLD, INK, MUTED, NAVY, SANS, email_settings, markdown_to_email, wrap

OUT = ROOT / "src" / "worker" / "generated" / "emails.json"
FIRST_MONTH = (2027, 1)
LAST_MONTH = (2028, 12)


def approved(item: dict) -> bool:
    return item.get("status") == "approved"


def months():
    y, m = FIRST_MONTH
    while (y, m) <= LAST_MONTH:
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def month_name(y: int, m: int) -> str:
    return dt.date(y, m, 1).strftime("%B %Y")


def build_tips(settings: dict) -> list[dict]:
    footer = settings["items"]["email-footer"]
    tips = [md_item(p) for p in md_files() if p.parent.name == "tips"]
    tips = sorted((t for t in tips if approved(t)), key=lambda t: (t["order"] or 9999, t["id"]))
    out = []
    for t in tips:
        inner = (
            f'<p style="margin:0 0 6px;font-family:{SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:{GOLD};">Weekly tax tip</p>'
            f'<h1 style="margin:0 0 14px;font-family:Georgia, serif;font-size:24px;color:{NAVY};">{html.escape(t["title"])}</h1>'
            + markdown_to_email(t["_body"], settings["siteUrl"])
        )
        out.append({"id": t["id"], "subject": t["title"], "preheader": t["summary"], "html": wrap(t["title"], t["summary"], inner, footer)})
    return out


def build_newsletters(settings: dict) -> dict:
    footer = settings["items"]["email-footer"]
    intro = settings["items"]["email-newsletter-intro"]
    site = settings["siteUrl"]
    articles = [md_item(p) for p in md_files() if p.parent.name == "articles"]
    articles = [a for a in articles if approved(a)]
    pub = {a["id"]: load_meta_published(a) for a in articles}
    dates = []
    for path in sorted((DATA / "tax-years").glob("*/due-dates.json")):
        dates += [d for d in load(path)["items"] if approved(d)]
    issues = {}
    for y, m in months():
        start = dt.date(y, m, 1)
        prev_start = dt.date(y - 1, 12, 1) if m == 1 else dt.date(y, m - 1, 1)
        new_articles = [a for a in articles if pub[a["id"]] and prev_start <= pub[a["id"]] < start]
        upcoming = sorted((d for d in dates if start <= dt.date.fromisoformat(d["date"]) <= start + dt.timedelta(days=45)), key=lambda d: d["date"])
        if not (new_articles or upcoming):
            continue
        body = [f'<p style="margin:0 0 16px;font-family:{SANS};font-size:16px;line-height:1.55;color:{INK};">{html.escape(intro["text"])}</p>']
        if new_articles:
            body.append(f'<h2 style="margin:18px 0 8px;font-family:Georgia, serif;font-size:20px;color:{NAVY};">New on our website</h2>')
            for a in new_articles:
                title = html.escape(a["title"])
                link = f'<a href="{html.escape(site.rstrip("/") + "/articles/" + a["slug"])}" style="color:{NAVY};">{title}</a>' if site else title
                body.append(f'<p style="margin:0 0 12px;font-family:{SANS};font-size:16px;line-height:1.5;color:{INK};"><strong>{link}</strong><br>{html.escape(a["summary"])}</p>')
        if upcoming:
            body.append(f'<h2 style="margin:18px 0 8px;font-family:Georgia, serif;font-size:20px;color:{NAVY};">Tax dates coming up</h2>')
            for d in upcoming:
                when = dt.date.fromisoformat(d["date"]).strftime("%A, %B %-d" if sys.platform != "win32" else "%A, %B %#d")
                body.append(f'<p style="margin:0 0 10px;font-family:{SANS};font-size:16px;line-height:1.5;color:{INK};"><strong>{html.escape(when)}:</strong> {html.escape(d["title"])}</p>')
        body.append(f'<p style="margin:18px 0 0;font-family:{SANS};font-size:14px;color:{MUTED};">Not every date applies to everyone. Questions? Reply to this email or give us a call.</p>')
        key = f"{y}-{m:02d}"
        subject = f"AG Accounting newsletter: {month_name(y, m)}"
        preheader = "New articles and the tax dates coming up."
        issues[key] = {"id": f"newsletter-{key}", "subject": subject, "preheader": preheader, "html": wrap(subject, preheader, "\n".join(body), footer)}
    return issues


def load_meta_published(article: dict):
    path = ROOT / "src" / "content" / "articles" / f"{article['slug']}.md"
    for line in path.read_text(encoding="utf-8").split("\n")[:20]:
        if line.startswith("published:"):
            value = line.split(":", 1)[1].strip()
            try:
                return dt.date.fromisoformat(value)
            except ValueError:
                return None
    return None


def build() -> str:
    settings = email_settings()
    footer = settings["items"]["email-footer"]
    if not approved(footer):
        bundle = {"tips": [], "newsletters": {}}
    else:
        bundle = {"tips": build_tips(settings), "newsletters": build_newsletters(settings) if approved(settings["items"]["email-newsletter-intro"]) else {}}
    return json.dumps(bundle, indent=1, ensure_ascii=False, sort_keys=True) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    content = build()
    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != content:
            print("src/worker/generated/emails.json is out of date. Run tools/build_emails.py.")
            return 1
        print("emails.json is up to date.")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(content, encoding="utf-8")
    data = json.loads(content)
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(data['tips'])} approved tip(s), {len(data['newsletters'])} newsletter issue(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
