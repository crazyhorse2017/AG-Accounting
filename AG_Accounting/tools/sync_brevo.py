"""
Push APPROVED email templates to Brevo: the sign-up confirmation (double opt-in)
email and the four drip series. Drafts are never pushed.

Templates are matched by name, so running it again updates them instead of making
duplicates. The drip automations themselves are wired once in Brevo's editor (see
the setup guide); this tool only keeps the email content in sync with the repo.

The API key is read from the BREVO_API_KEY environment variable for this run only.
Never put it in a file. Set it in PowerShell for the current window:
  $env:BREVO_API_KEY = "<paste key>"
  $env:NEWSLETTER_FROM = "AG Accounting <alex@agaccountingohio.com>"

Usage:
  uv run --no-project --python 3.12 python tools/sync_brevo.py            # dry run: shows what would change
  uv run --no-project --python 3.12 python tools/sync_brevo.py --apply    # create/update templates in Brevo
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

from content_lib import md_files, md_item
from email_lib import GOLD, NAVY, SANS, doi_template, email_settings, markdown_to_email, wrap

API = "https://api.brevo.com/v3"
SERIES_NAMES = {"personal": "Personal tax series", "business": "Small business series", "niche": "Special situations series", "wise": "Word to the Wise"}


def call(method: str, path: str, key: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={"api-key": key, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "ag-accounting-sync/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        raise SystemExit(f"Brevo returned {e.code} for {method} {path}: {detail}") from None


def parse_sender(value: str | None) -> dict | None:
    if not value:
        return None
    m = re.match(r"^\s*(.*?)\s*<([^>\s]+@[^>\s]+)>\s*$", value)
    if m:
        return {"name": m.group(1) or "AG Accounting", "email": m.group(2)}
    return {"name": "AG Accounting", "email": value.strip()} if "@" in value else None


def wanted_templates() -> list[dict]:
    settings = email_settings()
    footer = settings["items"]["email-footer"]
    doi = settings["items"]["email-doi-confirmation"]
    out = []
    if doi.get("status") == "approved":
        out.append({"name": "AG: Sign-up confirmation", "subject": doi["subject"], "html": doi_template(doi), "tag": "optin"})
    if footer.get("status") != "approved":
        return out
    for path in md_files():
        if "drips" not in path.parts:
            continue
        item = md_item(path)
        if item["status"] != "approved":
            continue
        series = item["series"]
        inner = (
            f'<p style="margin:0 0 6px;font-family:{SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:{GOLD};">{SERIES_NAMES.get(series, series)}</p>'
            f'<h1 style="margin:0 0 14px;font-family:Georgia, serif;font-size:24px;color:{NAVY};">{item["title"]}</h1>'
            + markdown_to_email(item["_body"], settings["siteUrl"])
        )
        out.append({
            "name": f"AG drip: {series} {item['order']:02d}: {item['title']}",
            "subject": item["title"],
            "html": wrap(item["title"], item["summary"], inner, footer),
            "tag": f"ag-drip-{series}",
        })
    return out


def existing_templates(key: str) -> dict[str, int]:
    found: dict[str, int] = {}
    offset = 0
    while True:
        page = call("GET", f"/smtp/templates?limit=100&offset={offset}", key)
        items = page.get("templates") or []
        for t in items:
            found[t.get("name", "")] = int(t["id"])
        if len(items) < 100:
            return found
        offset += 100


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    templates = wanted_templates()
    if not templates:
        print("Nothing approved to sync yet (the footer, confirmation email and drip emails need approval first).")
        return 0
    for t in templates:
        if "{{ unsubscribe }}" not in t["html"] and t["tag"] != "optin":
            raise SystemExit(f"{t['name']}: missing the unsubscribe link")
        if "{#" in t["html"]:
            raise SystemExit(f"{t['name']}: contains '{{#', which Brevo treats as a comment")

    key = os.environ.get("BREVO_API_KEY", "").strip()
    sender = parse_sender(os.environ.get("NEWSLETTER_FROM"))
    if not args.apply:
        print(f"Dry run: {len(templates)} approved template(s) would be synced:")
        for t in templates:
            print(f"  {t['name']}")
        print("Run again with --apply (and BREVO_API_KEY and NEWSLETTER_FROM set) to sync.")
        return 0
    if not key or not sender:
        raise SystemExit("Set BREVO_API_KEY and NEWSLETTER_FROM in this PowerShell window first (see the top of this file).")

    have = existing_templates(key)
    for t in templates:
        body = {"templateName": t["name"], "subject": t["subject"], "htmlContent": t["html"], "sender": sender, "isActive": True, "tag": t["tag"]}
        if t["name"] in have:
            call("PUT", f"/smtp/templates/{have[t['name']]}", key, body)
            print(f"Updated  #{have[t['name']]}  {t['name']}")
        else:
            created = call("POST", "/smtp/templates", key, body)
            print(f"Created  #{created.get('id')}  {t['name']}")
    print("Done. Put the sign-up confirmation template's number in the BREVO_DOI_TEMPLATE_ID setting.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
