#!/usr/bin/env python3
"""
Cut a release by propagating one version string through every carrier.

The project version lives in several places that must never drift apart:

    README.md    the shields.io version badge
    index.html   every ?v= cache-buster on local css/js
    404.html     every ?v= cache-buster on local css

Historically v1.1.0 shipped while the cache-busters still read 1.0.1, so
returning visitors kept the previous stylesheet for two months. This script
rewrites every carrier in one pass and then re-runs the verifier, so that
class of drift cannot recur.

    python scripts/release.py --bump patch          # 1.2.1 -> 1.2.2
    python scripts/release.py --bump minor
    python scripts/release.py 2.0.0                 # explicit version
    python scripts/release.py --bump patch --dry-run

It edits the working tree only. Committing and tagging stay with the
maintainer so the release can be reviewed first.
"""

import argparse
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = r"\d+\.\d+\.\d+"

BADGE_RE = re.compile(r"(badge/version-)" + VER + r"(-)")
CACHE_RE = re.compile(r"(\?v=)" + VER)
GENERATOR_RE = re.compile(r"(Template v)" + VER)
TEXT_EXT = (".html", ".css", ".js", ".json", ".md", ".yml", ".yaml", ".svg", ".txt")


def git(args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True,
                          text=True, encoding="utf-8", errors="replace")


def tracked_text_files():
    out = git(["ls-files"]).stdout
    for name in out.splitlines():
        if name and name.lower().endswith(TEXT_EXT):
            yield name


def read(name):
    with open(os.path.join(REPO, name), "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()


def write(name, text):
    with open(os.path.join(REPO, name), "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def bump(kind, ver):
    major, minor, patch = (int(x) for x in ver.split("."))
    if kind == "major":
        return f"{major + 1}.0.0"
    if kind == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def main():
    ap = argparse.ArgumentParser(description="Propagate a version bump")
    ap.add_argument("version", nargs="?", help="explicit x.y.z version")
    ap.add_argument("--bump", choices=["major", "minor", "patch"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    old = None
    for name in tracked_text_files():
        m = BADGE_RE.search(read(name))
        if m:
            old = re.search(VER, m.group(0)).group(0)
            break
    if not old:
        sys.exit("no version badge found in README.md")

    if args.version and args.bump:
        ap.error("pass either an explicit version or --bump, not both")
    new = args.version or (bump(args.bump, old) if args.bump else None)
    if not new:
        ap.error("give a version or --bump {major,minor,patch}")
    if not re.fullmatch(VER, new):
        sys.exit(f"version {new!r} is not x.y.z")
    if new == old:
        sys.exit(f"already at {new}")

    planned, stray = [], []
    for name in tracked_text_files():
        text = read(name)
        hits = (BADGE_RE.findall(text) + CACHE_RE.findall(text)
                + GENERATOR_RE.findall(text))
        if not hits:
            continue
        is_carrier = name in ("README.md", "index.html", "404.html")
        if is_carrier:
            # Only count anchored carriers; a bare x.y.z like a pinned CDN
            # version must not inflate the tally or be rewritten.
            count = (len(BADGE_RE.findall(text)) + len(CACHE_RE.findall(text))
                     + len(GENERATOR_RE.findall(text)))
            planned.append((name, count, text))
        else:
            stray.append((name, len(re.findall(VER, text))))

    if not planned:
        sys.exit("no version carriers found -- aborting")
    if stray:
        print("version string also appears in files this script does not own:")
        for name, n in stray:
            print(f"  {name}  ({n} occurrence)")
        print("Update those by hand or extend the carrier list, then re-run.\n")

    print(f"{old} -> {new}\n")
    for name, count, text in planned:
        text = BADGE_RE.sub(lambda m: m.group(1) + new + m.group(2), text)
        text = CACHE_RE.sub(lambda m: m.group(1) + new, text)
        text = GENERATOR_RE.sub(lambda m: m.group(1) + new, text)
        print(f"  {name:12} {count} occurrence(s)")
        if not args.dry_run:
            write(name, text)

    if args.dry_run:
        print("\n(dry run -- nothing written)")
        return 0

    print("\nverifying...")
    proc = subprocess.run([sys.executable, os.path.join(REPO, "scripts", "verify.py")],
                          cwd=REPO)
    if proc.returncode != 0:
        print("\nverification FAILED -- review before committing")
        return proc.returncode

    print("\nnext steps:")
    print(f"  git add -A && git commit -m '🚀 chore(release): v{new}'")
    print(f"  git tag -a v{new} -m 'v{new}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
