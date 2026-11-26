"""
Email HTML for AG Accounting (newsletters, weekly tips, drip series, confirmation).

Follows Brevo's template rules: doctype and viewport, table layout with inline
styles, no scripts/forms/flex, a {{ unsubscribe }} link in every marketing email,
the postal address as plain text (no {{ company.* }} tags), and no "{#" anywhere.
"""

import html
import re

from content_lib import DATA, load

NAVY = "#1e3a5f"
INK = "#1f2933"
MUTED = "#52606d"
GOLD = "#b08d4f"
PAPER = "#fbfaf7"
LINE = "#d9e2ec"
FONT = "Georgia, 'Times New Roman', serif"
SANS = "Arial, Helvetica, sans-serif"


def email_settings() -> dict:
    doc = load(DATA / "emails.json")
    return {"siteUrl": doc.get("siteUrl"), "items": {i["id"]: i for i in doc["items"]}}


def _inline(text: str, site_url: str | None) -> str:
    out = html.escape(text, quote=False)

    def link(m: re.Match) -> str:
        label, href = m.group(1), m.group(2)
        if href.startswith("/"):
            if not site_url:
                return label
            href = site_url.rstrip("/") + href
        return f'<a href="{html.escape(href)}" style="color:{NAVY};">{label}</a>'

    out = re.sub(r"\[([^\]]+)\]\(((?:https://|/)[^\s)]*)\)", link, out)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<![*\w])\*(?!\s)(.+?)\*", r"<em>\1</em>", out)
    return out.replace("{#", "{ #")


def markdown_to_email(body: str, site_url: str | None) -> str:
    p_style = f"margin:0 0 14px;font-family:{SANS};font-size:16px;line-height:1.55;color:{INK};"
    parts: list[str] = []
    para: list[str] = []
    lst: tuple[str, list[str]] | None = None

    def flush_para():
        nonlocal para
        if para:
            parts.append(f'<p style="{p_style}">{_inline(" ".join(para), site_url)}</p>')
        para = []

    def flush_list():
        nonlocal lst
        if lst:
            tag, items = lst
            lis = "".join(f'<li style="margin:0 0 6px;">{_inline(i, site_url)}</li>' for i in items)
            parts.append(f'<{tag} style="margin:0 0 14px 20px;padding:0;font-family:{SANS};font-size:16px;line-height:1.55;color:{INK};">{lis}</{tag}>')
        lst = None

    for raw in body.split("\n"):
        line = raw.strip()
        if not line:
            flush_para(); flush_list()
        elif m := re.match(r"^(#{2,3})\s+(.*)$", line):
            flush_para(); flush_list()
            size = 20 if len(m.group(1)) == 2 else 17
            parts.append(f'<h{len(m.group(1))} style="margin:18px 0 8px;font-family:{FONT};font-size:{size}px;color:{NAVY};">{_inline(m.group(2), site_url)}</h{len(m.group(1))}>')
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
            parts.append(
                f'<p style="{p_style}border-left:3px solid {GOLD};background:#f2f6fa;padding:10px 12px;">{_inline(line.lstrip("> "), site_url)}</p>'
            )
        elif lst and raw.startswith("  "):
            lst[1][-1] += " " + line
        else:
            flush_list()
            para.append(line)
    flush_para(); flush_list()
    return "\n".join(parts)


def wrap(subject: str, preheader: str, inner_html: str, footer: dict | None, *, unsubscribe: bool = True) -> str:
    """Full email document. Marketing emails include the {{ unsubscribe }} link and postal address."""
    footer_html = ""
    if footer:
        unsub = f' · <a href="{{{{ unsubscribe }}}}" style="color:{MUTED};">Unsubscribe</a>' if unsubscribe else ""
        footer_html = (
            f'<tr><td style="padding:18px 28px 26px;border-top:1px solid {LINE};font-family:{SANS};font-size:12px;line-height:1.5;color:{MUTED};">'
            f"{html.escape(footer['text'])}<br>{html.escape(footer['postalAddress'])}{unsub}</td></tr>"
        )
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(subject)}</title></head>
<body style="margin:0;padding:0;background:{PAPER};">
<div style="display:none;max-height:0;overflow:hidden;">{html.escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid {LINE};">
<tr><td style="padding:22px 28px;border-bottom:3px solid {GOLD};font-family:{FONT};font-size:22px;font-weight:bold;letter-spacing:1px;color:{NAVY};">AG ACCOUNTING</td></tr>
<tr><td style="padding:24px 28px 10px;">
{inner_html}
</td></tr>
{footer_html}
</table>
</td></tr></table>
</body></html>"""


def doi_template(item: dict) -> str:
    """Double opt-in confirmation (Brevo replaces {{ doubleoptin }} with the confirm link)."""
    inner = (
        f'<p style="margin:0 0 18px;font-family:{SANS};font-size:16px;line-height:1.55;color:{INK};">{html.escape(item["text"])}</p>'
        f'<p style="margin:0 0 18px;"><a href="{{{{ doubleoptin }}}}" style="display:inline-block;background:{NAVY};color:#ffffff;'
        f'font-family:{SANS};font-size:16px;font-weight:bold;text-decoration:none;padding:12px 22px;border:1px solid {NAVY};">'
        f'{html.escape(item["button"])}</a></p>'
    )
    return wrap(item["subject"], item["text"][:90], inner, None, unsubscribe=False)
