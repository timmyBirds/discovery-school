# Development-site feedback with Google Sheets

The review build lets a reviewer click a page section or image, select text, and
comment on one spot or related wording across the site. Each submitted comment
is saved as a row in a private Google Sheet. The reviewer does not need email,
a Google account, or a GitHub account. The site keeps a browser-local draft if
Google does not confirm the save.

On the temporary review site, **Edit page text** lets any visitor replace
text and publish it immediately. Images can be selected for feedback, but cannot
be replaced by the editor. Published text is stored in
the private Sheet's **Published Content** tab and loaded by review pages for all
visitors. Edits do not change the repository's source files; remove this
temporary feature and incorporate approved wording into `src/pages/` before
the permanent site launches.

Unsent drafts stay in the browser where they were created. The reviewer can
edit, delete, or retry them there. Submitted feedback can be edited or deleted
from that same browser; its private random ID identifies the Sheet row.
Tabs in the same browser sync their saved feedback. If a Sheet row has already
been removed, deleting the remaining browser copy clears that stale item.

## One-time Google setup

1. Create a new Google Sheet called **Discovery School website feedback**. Keep
   its sharing set to **Restricted**. The reviewer does not need access to it.
2. In that Sheet, open **Extensions → Apps Script**. Replace `Code.gs` with the
   contents of [`google-feedback/Code.gs`](../google-feedback/Code.gs). Add an
   HTML file named `Bridge` and paste in
   [`google-feedback/Bridge.html`](../google-feedback/Bridge.html). Save.
3. Select `setupFeedback` in the Apps Script editor and run it once. Authorize
   the script under the Google account that owns the Sheet. This creates the
   **Feedback** tab and stores its ID in Apps Script Properties.
4. Select **Deploy → New deployment → Web app**. Set **Execute as: Me** and
   **Who has access: Anyone**. Deploy and copy the URL ending in `/exec`.
   "Anyone" lets visitors submit without a Google login or access code. Anyone
   who can reach the public review site can submit comments, so share the link
   with the intended reviewer and check the Sheet for unwanted submissions.
   The Sheet itself stays restricted.
5. In the website repository, set the Actions variable `GOOGLE_SCRIPT_URL` to
   that `/exec` URL. Leave `REVIEW_API_URL` unset. Re-run the GitHub Pages
   deployment, or push a commit. This activates the review toolbar at
   `https://timmybirds.github.io/discovery-school/`.
6. Submit a test comment from the hosted site and verify a new row in the
   **Feedback** tab before sharing the review link.

When changing Apps Script code later, select **Deploy → Manage deployments →
Edit → New version**. Saving source alone does not update the `/exec` version.

The script needs Google Sheets authorization to write to the feedback file.
Google may ask for access to your spreadsheets because Apps Script web apps
cannot use the bound file's `getActiveSpreadsheet()` method. This code only
opens the saved feedback Sheet ID. It does not use Gmail or Drive APIs. The
Google Drive connector in Codex is not needed.

## Review and tracking

The Sheet puts the comment in the first **Feedback** column, followed by
**Status**, page, section, selected text, assignee, approval, and notes. The
random ID and location data are hidden at the right. A simple workflow is:
New → In progress → Ready for review → Approved. A GitHub Issue is optional;
the Sheet can be the work list.

After a confirmed save, the reviewer's browser keeps its own sent pins. Google
Sheets is the shared source of truth; submitted pins from other browsers are
not loaded back onto the page. Anyone who can reach the public review website
can submit comments. Do not put student information or other private data in
comments.

## Build modes

- `python3 build.py` produces the production site without review code.
- `python3 build.py --review` includes the review toolbar.
- GitHub Pages runs the review build only when `GOOGLE_SCRIPT_URL` or the older
  `REVIEW_API_URL` repository variable is set. Both must not be set together.
- A review build without a storage URL can save only browser-local drafts.
- To test against the Google script from localhost, add the exact localhost
  origin to its `ALLOWED_ORIGINS` Script Property, separated by a comma. With
  the Google script configured, local feedback goes to the Sheet while local
  text edits remain visible only in that browser. Unsent drafts can be retried
  with **Send draft** after the connection is ready.

The current GitHub Pages URL is the review environment once the variable is
set. A separate deployment is needed if the final production site and review
site must be available at different URLs at the same time.

## Checks

```sh
node --test google-feedback/Code.test.mjs
node --check src/review.js
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/test-deployment/exec python3 build.py --review
python3 build.py
```
