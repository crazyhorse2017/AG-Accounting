"""
Generate public/tax-calendar.ics from the due-dates data (approved items only).

Usage:
  uv run --no-project --python 3.12 python tools/build_ics.py
  uv run --no-project --python 3.12 python tools/build_ics.py --check   # exit 1 if the file is out of date
"""

import argparse
import datetime as dt
import sys

from content_lib import DATA, ROOT, load

YEAR_DIR = DATA / "tax-years"
OUT = ROOT / "public" / "tax-calendar.ics"
STAMP = "20260101T000000Z"  # fixed so the file only changes when the dates change


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line: str) -> str:
    """Fold lines longer than 75 octets, as the iCalendar spec requires."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    chunks, current = [], b""
    for ch in line:
        b = ch.encode("utf-8")
        if len(current) + len(b) > (75 if not chunks else 74):
            chunks.append(current.decode("utf-8"))
            current = b""
        current += b
    chunks.append(current.decode("utf-8"))
    return "\r\n ".join(chunks)


def build() -> str:
    events = []
    for path in sorted(YEAR_DIR.glob("*/due-dates.json")):
        for item in load(path)["items"]:
            if item["status"] != "approved":
                continue
            day = dt.date.fromisoformat(item["date"])
            nxt = day + dt.timedelta(days=1)
            events += [
                "BEGIN:VEVENT",
                f"UID:{item['id']}@ag-accounting",
                f"DTSTAMP:{STAMP}",
                f"DTSTART;VALUE=DATE:{day:%Y%m%d}",
                f"DTEND;VALUE=DATE:{nxt:%Y%m%d}",
                f"SUMMARY:{esc(item['title'])}",
                f"DESCRIPTION:{esc(item['description'] + ' General information only; ask AG Accounting what applies to you.')}",
                "TRANSP:TRANSPARENT",
                "END:VEVENT",
            ]
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AG Accounting//Tax Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AG Accounting tax dates",
        *events,
        "END:VCALENDAR",
    ]
    return "\r\n".join(fold(l) for l in lines) + "\r\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    content = build()
    if args.check:
        current = OUT.read_bytes().decode("utf-8") if OUT.exists() else ""
        if current != content:
            print("public/tax-calendar.ics is out of date. Run tools/build_ics.py.")
            return 1
        print("public/tax-calendar.ics is up to date.")
        return 0
    OUT.write_bytes(content.encode("utf-8"))
    print(f"Wrote {OUT.relative_to(ROOT)} with {content.count('BEGIN:VEVENT')} approved event(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
