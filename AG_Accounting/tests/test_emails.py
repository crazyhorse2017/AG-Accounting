"""
Checks the email HTML produced by tools/email_lib.py against Brevo's rules and
US anti-spam requirements. Standard library only.

Usage:
  uv run --no-project --python 3.12 python tests/test_emails.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from content_lib import md_files, md_item  # noqa: E402
from email_lib import doi_template, email_settings, markdown_to_email, wrap  # noqa: E402

failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        failures.append(msg)


settings = email_settings()
footer = settings["items"]["email-footer"]
FORBIDDEN = ["<script", "<iframe", "<form", "<video", "<svg", "display:flex", "{#", "{{ company.", "javascript:"]

# Every email file renders to valid, compliant marketing HTML.
count = 0
for path in md_files():
    if "emails" not in path.parts:
        continue
    item = md_item(path)
    page = wrap(item["title"], item["summary"], markdown_to_email(item["_body"], None), footer)
    rel = path.name
    check(page.startswith("<!DOCTYPE html>"), f"{rel}: doctype")
    check('name="viewport"' in page, f"{rel}: viewport")
    check("{{ unsubscribe }}" in page, f"{rel}: unsubscribe link")
    check(footer["postalAddress"] in page, f"{rel}: postal address")
    check(len(page.encode("utf-8")) < 100_000, f"{rel}: over 100 KB")
    check(page.count("{{") == page.count("}}"), f"{rel}: unbalanced template braces")
    for bad in FORBIDDEN:
        check(bad not in page, f"{rel}: contains {bad!r}")
    count += 1
check(count >= 66, f"expected 66+ emails, found {count}")

# Markdown: escaping, links, internal links without a site URL.
html = markdown_to_email("Hello <b>x</b> & [IRS](https://www.irs.gov/) and [ours](/tax-center).", None)
check("&lt;b&gt;" in html, "raw HTML is escaped")
check('href="https://www.irs.gov/"' in html, "external link kept")
check("/tax-center" not in html and "ours" in html, "internal link becomes text without siteUrl")
html2 = markdown_to_email("See [ours](/tax-center).", "https://example.test")
check('href="https://example.test/tax-center"' in html2, "internal link made absolute with siteUrl")

# Double opt-in confirmation.
doi = doi_template(settings["items"]["email-doi-confirmation"])
check("{{ doubleoptin }}" in doi, "confirmation email has the {{ doubleoptin }} link")
check("{{ unsubscribe }}" not in doi, "confirmation email is transactional (no unsubscribe link needed)")

for f in failures:
    print("FAIL ", f)
print(f"\nEmail HTML checks: {count} emails rendered, {len(failures)} failure(s).")
sys.exit(1 if failures else 0)
