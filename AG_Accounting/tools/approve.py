"""
Mark reviewed content as approved (or back to draft).

Only run this with the firm's own review marks in hand. Approving is what makes
content public on the next deploy.

Usage:
  uv run --no-project --python 3.12 python tools/approve.py fed-2026-brackets glossary-tax-year
  uv run --no-project --python 3.12 python tools/approve.py --file approved-ids.txt      # one ID per line
  uv run --no-project --python 3.12 python tools/approve.py --date 2026-12-10 <ids...>   # review date (default: today)
  uv run --no-project --python 3.12 python tools/approve.py --revert <ids...>            # back to draft
"""

import argparse
import datetime as dt
import sys

from content_lib import data_files, load, md_files, md_item, save, set_md_review, walk_items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--file")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    ap.add_argument("--revert", action="store_true")
    args = ap.parse_args()

    wanted = set(args.ids)
    if args.file:
        wanted |= {line.strip() for line in open(args.file, encoding="utf-8") if line.strip() and not line.startswith("#")}
    if not wanted:
        ap.error("give at least one ID")
    try:
        dt.date.fromisoformat(args.date)
    except ValueError:
        ap.error("--date must be YYYY-MM-DD")

    found: set[str] = set()
    for path in data_files():
        doc = load(path)
        changed = False
        for item in walk_items(doc):
            if item["id"] in wanted:
                found.add(item["id"])
                item["status"] = "draft" if args.revert else "approved"
                item["reviewedOn"] = None if args.revert else args.date
                changed = True
        if changed:
            save(path, doc)
    for path in md_files():
        iid = md_item(path)["id"]
        if iid in wanted:
            found.add(iid)
            set_md_review(path, "draft" if args.revert else "approved", None if args.revert else args.date)

    action = "Reverted to draft" if args.revert else f"Approved (reviewed {args.date})"
    print(f"{action}: {len(found)} item(s)")
    missing = sorted(wanted - found)
    for m in missing:
        print(f"  NOT FOUND: {m}")
    print("Next: build_ics.py (due dates) and build_pdfs.py (white papers), run the checks, then deploy.")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
