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
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, DIST = ROOT / "src", ROOT / "dist"
NAV_KEYS = ["about", "academics", "admissions", "student-life", "families", "partner", "careers", "staff"]

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
    (DIST / page.name).write_text(html)
    print("built", page.name)

for asset in ["site.css", "site.js"]:
    shutil.copy(SRC / asset, DIST / asset)
(DIST / "assets").mkdir(exist_ok=True)
shutil.copy(SRC / "assets" / "favicon.svg", DIST / "assets" / "favicon.svg")
print("copied site.css, site.js, favicon.svg")
