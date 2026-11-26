"""
Shared helpers for the content tools. Standard library only.

Reviewable content lives in JSON files under src/content/data/. Any object with
"id" and "status" keys is a reviewable item.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "content" / "data"
STATUSES = ("draft", "approved")


def data_files() -> list[Path]:
    return sorted(DATA.rglob("*.json"))


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, doc) -> None:
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def walk_items(node):
    """Yield every reviewable dict (has id and status) inside a JSON document."""
    if isinstance(node, dict):
        if "id" in node and "status" in node:
            yield node
        for value in node.values():
            yield from walk_items(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk_items(value)


MD_DIRS = [ROOT / "src" / "content" / "articles", ROOT / "src" / "content" / "white-papers"]
EMAIL_DIR = ROOT / "src" / "content" / "emails"


def md_files() -> list[Path]:
    files = [p for d in MD_DIRS if d.exists() for p in d.glob("*.md")]
    if EMAIL_DIR.exists():
        files += list(EMAIL_DIR.rglob("*.md"))
    return sorted(files)


def parse_md(path: Path):
    """Return (meta, sources, body) for a Markdown file with --- front matter ---."""
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    meta: dict[str, str] = {}
    sources: list[dict] = []
    if not text.startswith("---\n") or text.find("\n---", 4) == -1:
        return meta, sources, text
    end = text.find("\n---", 4)
    for line in text[4:end].split("\n"):
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if key == "source":
            title, _, url = value.partition("|")
            sources.append({"title": title.strip(), "url": url.strip()})
        else:
            meta[key] = value
    return meta, sources, text[end + 4 :].lstrip("\n")


def md_item(path: Path) -> dict:
    meta, sources, body = parse_md(path)
    return {
        "id": meta.get("id", path.stem),
        "status": meta.get("status", "draft"),
        "reviewedOn": meta.get("reviewedOn") or None,
        "title": meta.get("title", path.stem),
        "summary": meta.get("summary", ""),
        "category": meta.get("category", ""),
        "slug": meta.get("slug", path.stem),
        "sources": sources,
        "order": int(meta["order"]) if meta.get("order", "").isdigit() else None,
        "series": meta.get("series", ""),
        "_body": body,
        "_kind": "emails" if EMAIL_DIR in path.parents else path.parent.name,
        "_group": path.parent.name,
    }


def set_md_review(path: Path, status: str, reviewed_on: str | None) -> None:
    """Rewrite the status/reviewedOn lines in a Markdown file's front matter."""
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    end = text.find("\n---", 4)
    head, rest = text[:end], text[end:]
    lines = [l for l in head.split("\n") if not l.startswith(("status:", "reviewedOn:"))]
    lines.insert(1, f"status: {status}")
    lines.insert(2, f"reviewedOn: {reviewed_on or ''}".rstrip())
    path.write_text("\n".join(lines) + rest, encoding="utf-8")


def all_items():
    """Yield (path, item) for every reviewable item in every data file and Markdown file."""
    for path in data_files():
        for item in walk_items(load(path)):
            yield path, item
    for path in md_files():
        yield path, md_item(path)


def describe(item) -> str:
    """A short human label for an item, for review packets."""
    for key in ("title", "term"):
        if item.get(key):
            return str(item[key])
    return item["id"]


LABELS = {
    "single": "Single", "mfj": "Married filing jointly", "mfs": "Married filing separately", "hoh": "Head of household",
}


def _label(key: str) -> str:
    if key in LABELS:
        return LABELS[key]
    words = []
    for part in key.replace("_", " ").split():
        words.append("".join(f" {c.lower()}" if c.isupper() else c for c in part))
    text = " ".join(words).strip()
    return text[:1].upper() + text[1:]


def _value(key: str, v) -> str:
    k = key.lower()
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if "rate" in k and v < 1:
            return f"{v * 100:g}%"
        if "cents" in k:
            return f"{v:g}¢"
        if any(w in k for w in ("factor",)):
            return f"{v:g}"
        if any(w in k for w in ("children", "sqft", "count")) and "max" not in k:
            return f"{v:g}"
        if "sqft" in k:
            return f"{v:,.0f} sq ft"
        return f"${v:,.2f}".replace(".00", "")
    return str(v)


def readable_figures(data, prefix: str = "") -> list[str]:
    """Turn a tax-data dict into plain lines a reviewer can check against the source."""
    lines: list[str] = []
    for key, v in data.items():
        label = f"{prefix}{_label(key)}"
        if isinstance(v, dict):
            lines.extend(readable_figures(v, f"{label}, "))
        elif isinstance(v, list) and v and isinstance(v[0], dict) and "rate" in v[0]:
            parts = [f"{r['rate'] * 100:g}% {'over the last amount' if r.get('upTo') is None else 'up to $' + format(r['upTo'], ',')}" for r in v]
            lines.append(f"{label}: " + "; ".join(parts))
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            for row in v:
                lines.append(f"{label}: " + ", ".join(f"{_label(k)} {_value(k, x)}" for k, x in row.items()))
        else:
            lines.append(f"{label}: {_value(key, v)}")
    return lines


def body_text(item) -> list[str]:
    """The reviewable wording of an item, as lines for a review packet."""
    lines: list[str] = []
    for key in ("intro", "summary", "definition", "situation", "body", "description", "text"):
        if item.get(key):
            lines.append(str(item[key]))
    if item.get("date"):
        lines.insert(0, f"Date: {item['date']}")
    if item.get("url"):
        lines.append(f"Link: {item['url']}")
    for entry in item.get("list") or []:
        lines.append(f"- {entry}")
    if isinstance(item.get("data"), dict):
        lines.extend(readable_figures(item["data"]))
    if item.get("youtubeId"):
        lines.append(f"Video: https://www.youtube.com/watch?v={item['youtubeId']} ({round(item.get('durationSeconds', 0) / 60)} min)")
    if item.get("year"):
        lines.insert(0, f"Year: {item['year']}" + (f" (date {item['monthDay']})" if item.get("monthDay") else ""))
    if item.get("_body"):
        lines.append("Full text:")
        lines.extend(l for l in item["_body"].split("\n") if l.strip())
    for src in item.get("sources") or []:
        lines.append(f"Source: {src.get('title')} ({src.get('url')})")
    return lines
