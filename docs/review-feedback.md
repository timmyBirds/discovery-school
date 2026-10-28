# Development-site feedback

The GitHub Pages build can include a review toolbar. A reviewer clicks an element,
types feedback, and can search for related wording across all pages. Submitted
feedback becomes an issue in a separate private GitHub repository. The reviewer
does not need a GitHub account. Closing an issue removes its pin from the review
site after refresh.

## Build modes

- `python3 build.py` produces the production site without review code.
- `python3 build.py --review` adds `review.js`, `review.css`, and the page index.
- The GitHub Pages workflow runs the review build when repository variable
  `REVIEW_API_URL` is set. Without it, the workflow builds the production site.
- A review build without an API URL can save browser-local drafts and export them
  as JSON; it cannot send feedback to the designer.

## Connect the feedback endpoint

1. Create a **private** GitHub repository for feedback, with Issues enabled.
   The default name in `feedback-worker/wrangler.toml.example` is
   `timmyBirds/discovery-school-feedback`; change it if needed.
2. Create a fine-grained GitHub token restricted to that feedback repository,
   with **Issues: Read and write**. Do not put the token in the website, GitHub
   Pages variables, or the repository.
3. Create a Cloudflare account and deploy the small Worker in `feedback-worker/`.
   Copy `wrangler.toml.example` to `wrangler.toml`, then run these commands from
   that directory:

   ```sh
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put REVIEW_ACCESS_KEY
   npx wrangler deploy
   ```

   Give the reviewer the access code entered for `REVIEW_ACCESS_KEY` through a
   private channel. The code protects feedback, not the public website itself.
4. In the website repository, set Actions variable `REVIEW_API_URL` to the
   deployed Worker URL (for example, `https://discovery-school-feedback.example.workers.dev`).
   Re-run the Pages workflow or push a commit. The review build will then be live.

The Worker checks the GitHub Pages origin and the access code before accepting
or returning feedback. Its GitHub token stays server-side. The GitHub Pages site
itself remains public. For local development, add the exact local preview origin
(for example, `http://127.0.0.1:4178`) to `ALLOWED_ORIGINS` in `wrangler.toml`
if testing against the deployed Worker.

## Checks

```sh
node --test feedback-worker/index.test.mjs
python3 build.py --review
python3 build.py
```

The final production build should contain no `review.js`, `review.css`, or
`review-pages.json` in `dist/`, and its HTML should not reference them.
