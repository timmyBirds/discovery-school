# Discovery School website: current status

Updated 2026-10-29. This is the temporary review website for Discovery School
Burundi. The source is in this repository; GitHub Pages serves
<https://timmybirds.github.io/discovery-school/>. A push to `main` starts the
deployment in [`.github/workflows/pages.yml`](../.github/workflows/pages.yml).

## What the site does now

- The school pages, navigation, and images are built from `src/` by `build.py`.
  `dist/` is generated output; make lasting website changes in `src/`.
- The GitHub Pages repository variable `GOOGLE_SCRIPT_URL` enables the review
  build. It points to a Google Apps Script web app bound to the owner's private
  feedback Sheet. The Sheet remains restricted; reviewers need only the site
  link. There is no access code.
- **Leave feedback** lets a reviewer select a page section, text, or image,
  write a comment, and submit it to the Sheet's **Feedback** tab. The **Find**
  control searches related wording across pages. Opening a result navigates
  to its passage and highlights matching text so the reviewer can decide
  whether to include it. Feedback can be edited or deleted in the browser
  that submitted it.
- **Edit page text** lets any visitor to the temporary GitHub Pages review site
  publish replacement text immediately. Published values live in the Sheet's
  **Published Content** tab and are loaded by other review visitors. Images
  can be selected for feedback but cannot be edited through the page editor.
  Published text is an overlay: it does not modify `src/pages/`.
- If a feedback submission fails, it stays as a draft in that browser for
  retry. The browser also keeps its own list and pins for submitted feedback;
  it does not load other browsers' submissions from the Sheet. The Sheet is
  the shared feedback work list.

## Local preview

Build and serve with:

```sh
GOOGLE_SCRIPT_URL="<deployed Apps Script /exec URL>" python3 build.py --review
python3 tools/dev_server.py --port 4183
```

Open <http://127.0.0.1:4183/>. The Apps Script `ALLOWED_ORIGINS` property must
include `http://127.0.0.1:4183` for local feedback to reach the Sheet. Local
**text edits stay in that browser** for preview; local feedback submissions do
reach the Sheet. The server disables browser caching so rebuilt code appears
on refresh. To rebuild without a Sheet connection, omit `GOOGLE_SCRIPT_URL`;
feedback then remains in browser drafts.

## Status and remaining work

- The reviewer confirmed the local feedback delete fix works. It removes a
  stale browser item when the matching Sheet row was already deleted, even
  when the Apps Script error includes an `Error:` prefix.
- `google-feedback/Code.gs` also makes repeated deletes harmless and rejects
  image content edits. These server changes are **live**: the repository copy
  was deployed to the bound Apps Script project as **Version 5** on
  2026-10-29. The deployment ID did not change, so the `GOOGLE_SCRIPT_URL`
  repository variable still points at it and needed no update. The website UI
  independently prevents image editing and still handles the older delete
  response. **Apps Script deployments are separate from GitHub:** a later edit
  to `Code.gs` in this repository is not live until it is pasted into the Apps
  Script editor and a new web app version is deployed. See
  [review-feedback.md](review-feedback.md) for the steps.
- Before moving to the permanent site, review the Sheet, copy approved text
  into `src/pages/`, and remove the public review build by clearing
  `GOOGLE_SCRIPT_URL` (and `REVIEW_API_URL` if present) in repository variables.
  Push a new build and confirm `review.js` is absent. The temporary review
  site currently permits any visitor to submit feedback and publish text.
- School content still awaiting confirmation is listed in the
  [README](../README.md#things-the-school-still-needs-to-supply).

## Checks

The [website checks workflow](../.github/workflows/checks.yml) runs backend
unit tests, JavaScript syntax validation, and both review and production builds.
For local checks:

```sh
node --test feedback-worker/index.test.mjs google-feedback/Code.test.mjs
node --check src/review.js
python3 -m py_compile build.py tools/dev_server.py
python3 build.py --review
```

`python3 build.py` makes a production build and removes review assets from
`dist/`. Rebuild with `--review` afterward to continue using the local review
preview. GitHub Actions rebuilds `dist/` on deployment.
