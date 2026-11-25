"""
Verify every video in src/content/data/videos.json is an official IRS video.

Default check (works from any network): each video ID must appear on the IRS's own
video list at https://www.irs.gov/newsroom/videos (or its ASL list). A video the IRS
links from IRS.gov is an official IRS upload. Running times are compared too.

Optional --youtube check: also asks YouTube's public oEmbed endpoint that the video
exists and is published by the IRS channel. (This machine blocks youtube.com, so
--youtube only works from a network that allows it.)

Usage:
  uv run --no-project --python 3.12 python tools/check_videos.py
  uv run --no-project --python 3.12 python tools/check_videos.py --youtube
  uv run --no-project --python 3.12 python tools/check_videos.py --ids VIDEO_ID VIDEO_ID
"""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request

from content_lib import DATA, load

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"
IRS_LISTS = ["https://www.irs.gov/newsroom/videos", "https://www.irs.gov/newsroom/videos-american-sign-language-asl"]
OFFICIAL_AUTHORS = {"IRSvideos", "IRS", "Internal Revenue Service", "irsvideos", "IRSvideosASL"}
ID_RE = r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})"


def fetch(url: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def seconds(text: str) -> int:
    p = [int(x) for x in re.findall(r"\d+", text)]
    if len(p) == 3:
        return p[0] * 3600 + p[1] * 60 + p[2]
    if len(p) == 2:
        return p[0] * 60 + p[1]
    return p[0] if p else 0


def irs_listing() -> dict[str, int]:
    """Video ID -> running time in seconds, from the IRS.gov video tables."""
    found: dict[str, int] = {}
    for url in IRS_LISTS:
        page = fetch(url)
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
            if len(cells) < 2:
                continue
            m = re.search(ID_RE, cells[0])
            if m:
                found[m.group(1)] = seconds(re.sub(r"<[^>]+>", "", cells[-1]))
    return found


def oembed(video_id: str) -> dict | None:
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe="")
    try:
        return json.loads(fetch(url))
    except Exception:  # noqa: BLE001
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*")
    ap.add_argument("--youtube", action="store_true")
    args = ap.parse_args()

    videos = load(DATA / "videos.json")["items"]
    wanted = {v["youtubeId"]: v for v in videos}
    ids = args.ids or list(wanted)
    listing = irs_listing()
    print(f"IRS.gov lists {len(listing)} official videos.")

    bad = 0
    for vid in ids:
        if vid not in listing:
            bad += 1
            print(f"NOT ON IRS.GOV  {vid}  {wanted.get(vid, {}).get('title', '')}")
            continue
        ours = wanted.get(vid, {}).get("durationSeconds")
        if ours is not None and abs(ours - listing[vid]) > 5:
            print(f"LENGTH CHANGED  {vid}  ours {ours}s, IRS.gov {listing[vid]}s")
        if args.youtube:
            info = oembed(vid)
            if not info:
                bad += 1
                print(f"MISSING ON YOUTUBE  {vid}")
            elif info.get("author_name") not in OFFICIAL_AUTHORS:
                bad += 1
                print(f"NOT IRS CHANNEL  {vid}  ({info.get('author_name')})")
    total = sum(v["durationSeconds"] for v in videos) / 3600
    print(f"\n{len(ids)} checked, {bad} problem(s). Library total: {len(videos)} videos, {total:.1f} hours.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
