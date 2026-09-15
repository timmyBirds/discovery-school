# Discovery School Burundi — website

A static, no-database website. Everything the browser needs is in `dist/`; that folder is what gets hosted.

## Layout

```
src/
  layout.html      shared header, nav and footer (edit nav/contact details here, once)
  pages/*.html     one file per page: a few "key: value" lines, a "---" line, then the page body
  site.css         all styles, readable, with comments
  site.js          mobile menu only — the site works with JavaScript off
  assets/          original photos, logo, seal, favicon (never served directly)
tools/images.py    turns src/assets photos into resized WebP + JPEG, strips EXIF/GPS
tools/tree.py      generates the values-tree SVG (src/partials/tree.svg)
build.py           assembles dist/ from src/
dist/              the built site — do not edit by hand, it is overwritten by build.py
```

## Hosting

The site is published free on GitHub Pages by `.github/workflows/pages.yml`: every push to `main` deploys `dist/`. One-time setup on GitHub: **Settings → Pages → Source: GitHub Actions**. The site then lives at `https://timmybirds.github.io/discovery-school/` (a custom domain such as discoveryschoolburundi.org can be added on the same settings page).

## Editing

1. Change a page in `src/pages/` (or the header/footer in `src/layout.html`, or styles in `src/site.css`).
2. Run `python3 build.py`.
3. Upload `dist/`.

Only Python 3 (already on macOS/Linux) is needed for `build.py`. `tools/images.py` also needs Pillow (`pip install pillow`) and is only run when photos change:

1. Put the original photo in `src/assets/`.
2. Add a line to `PHOTOS` in `tools/images.py`.
3. Run `python3 tools/images.py`, then reference `assets/img/<name>-<width>.webp/.jpg` from a page (copy an existing `<picture>` block).

## Things the school still needs to supply

Every one of these is marked on the live page with an orange dashed "To complete" box, so they are easy to find:

- **Tuition & bus fees** — transcribed from the 2025–26 fee sheets into `src/pages/admissions.html` (`#fees`, `#payment`); update each school year.
- **School calendar** — `src/pages/families.html`, section `#calendar` (currently shows 2025–26 term 1, the last one published).
- **Student handbook PDF** → `dist/assets/docs/student-handbook.pdf`; lunch/boarding menus.
- **Job board** — `src/pages/careers.html` reflects the closed 2026–27 round; update the board and status pill when the next recruitment notice is issued.
- **Volunteer travel information** — `src/pages/partner.html`, section `#visit`.
- **Contact form** — create a free form at formspree.io and replace `YOUR_FORM_ID` in `src/pages/contact.html`.
- **More photos** — 23 photos from the old site are in `src/assets/`; add new ones the same way (see Editing above).
- **Original logo file** (SVG or high-resolution transparent PNG) — the current `logo.png` is recovered from a 960px JPEG.
- **Staff page** — placeholder only; requirements still to be gathered (see the comment in `src/pages/staff.html`).
- **Values tree** — `tools/tree.py` generates `src/partials/tree.svg` in the style of the school's artwork; replace with the original file if the school can supply it (SVG or a large transparent PNG).
