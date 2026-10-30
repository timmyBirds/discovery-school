#!/usr/bin/env python3
"""Assemble dist/ from src/.

    python3 build.py            # build pages, copy css/js/favicon
    python3 tools/images.py     # (only when photos/logo change) rebuild optimised images

Each file in src/pages/ is a page: a few `key: value` header lines, a line with `---`,
then the page body (HTML placed inside <main>). Keys: title, description, and optionally
head_extra. `{{include:file}}` in a body pastes src/partials/<file> (e.g. the values tree). The page's file name (minus .html) is used to highlight the current nav item.
No dependencies beyond the Python standard library.
"""
import re
import shutil
import argparse
import json
import os
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, DIST = ROOT / "src", ROOT / "dist"
NAV_KEYS = ["about", "academics", "admissions", "student-life", "families", "partner", "careers", "staff"]

parser = argparse.ArgumentParser()
parser.add_argument("--review", action="store_true", help="include the development feedback tool")
args = parser.parse_args()

layout = (SRC / "layout.html").read_text()
DIST.mkdir(exist_ok=True)

for page in sorted((SRC / "pages").glob("*.html")):
    head, _, body = page.read_text().partition("\n---\n")
    meta = dict(line.split(":", 1) for line in head.strip().splitlines())
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    slug = page.stem

    html = layout
    html = html.replace("{{title}}", meta["title"])
    html = html.replace("{{description}}", meta["description"])
    html = html.replace("{{head_extra}}", meta.get("head_extra", ""))
    for inc in set(re.findall(r"{{include:([\w.-]+)}}", body)):
        body = body.replace("{{include:%s}}" % inc, (SRC / "partials" / inc).read_text())
    html = html.replace("{{body}}", body.rstrip() + "\n")
    for key in NAV_KEYS:
        html = html.replace("{{cur:%s}}" % key, ' aria-current="page"' if key == slug else "")
    if args.review:
        api_url = os.environ.get("REVIEW_API_URL", "").rstrip("/")
        google_script_url = os.environ.get("GOOGLE_SCRIPT_URL", "").strip()
        version = os.environ.get("GITHUB_SHA") or hashlib.sha1((SRC / "review.js").read_bytes()).hexdigest()
        if api_url and not re.fullmatch(r"https://[A-Za-z0-9._:/-]+", api_url):
            parser.error("REVIEW_API_URL must be an HTTPS URL")
        if google_script_url and not re.fullmatch(r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec", google_script_url):
            parser.error("GOOGLE_SCRIPT_URL must be a deployed Apps Script /exec URL")
        if api_url and google_script_url:
            parser.error("Set only one of REVIEW_API_URL and GOOGLE_SCRIPT_URL")
        if version and not re.fullmatch(r"[0-9a-f]{40}", version):
            parser.error("GITHUB_SHA must be a 40-character commit hash")
        review_assets = (
            '<link rel="stylesheet" href="review.css">\n'
            '<script src="review.js?v=%s" defer data-api="%s" data-google-script="%s" data-version="%s"></script>\n' % (version, api_url, google_script_url, version)
        )
    else:
        review_assets = ""
    html = html.replace("{{review_assets}}", review_assets)
    (DIST / page.name).write_text(html)
    print("built", page.name)

for asset in ["site.css", "site.js"]:
    shutil.copy(SRC / asset, DIST / asset)
if args.review:
    for asset in ["review.css", "review.js"]:
        shutil.copy(SRC / asset, DIST / asset)
    (DIST / "review-pages.json").write_text(json.dumps([
        page.name for page in sorted((SRC / "pages").glob("*.html"))
    ]))
else:
    for asset in ["review.css", "review.js", "review-pages.json"]:
        (DIST / asset).unlink(missing_ok=True)
(DIST / "assets").mkdir(exist_ok=True)
shutil.copy(SRC / "assets" / "favicon.svg", DIST / "assets" / "favicon.svg")
(DIST / ".nojekyll").touch()   # tell GitHub Pages to serve dist/ as-is
print("copied site.css, site.js, favicon.svg")
