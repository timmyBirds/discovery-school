# Development-site feedback

The GitHub Pages build can include a review toolbar. A reviewer clicks an element,
types feedback, and can search for related wording across all pages. Submitted
feedback becomes an issue in a separate private GitHub repository. The reviewer
does not need a GitHub account. Closing an issue removes its pin from the review
site after refresh.

The two browser-local drafts from the first preview are not shared automatically
with GitHub Pages: browser storage is separate for `localhost` and `github.io`.
On the local page, use **Export drafts**. On the hosted page, use **Import drafts**,
then connect with the access code and use **Send draft** on each item. Importing
never submits feedback automatically, and importing the same file again skips
duplicate drafts. Keep the export file private because it contains unpublished
comments.

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
3. Create a Cloudflare account and a scoped account API token for Workers.
   To create this Worker with Wrangler, the token needs Workers product `Admin`;
   after creation, a token scoped to this Worker with `Editor` is enough for
   subsequent deployments. Set `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` in your shell, not in this repository. The default
   `wrangler login` OAuth flow requests broader access than this task needs.
   Deploy the small Worker in `feedback-worker/`: copy
   `wrangler.toml.example` to `wrangler.toml`, then run these commands from
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

## Ticket to approved change

Each submitted comment creates one issue in the private feedback repository,
including its page locations and a delivery checklist. For each issue:

1. Agree on the requested wording or layout and acceptance criteria in the issue.
2. Make the website change in a branch and open a pull request in the website repository. Link that PR in the feedback issue; avoid copying private comments into a public PR.
3. The `Website checks` GitHub Action runs the Worker tests and checks both site build modes on the PR.
4. Have the site owner review the PR and a page preview. The current Pages workflow only publishes `main`; a pre-merge visual preview needs a separate preview host or a downloaded build artifact.
5. Merge after approval. The Pages workflow publishes `main`; verify the hosted page and close the feedback issue. Closing it removes the comment pin after the reviewer refreshes.

To enforce the gate, configure a `main` branch ruleset on GitHub requiring a pull
request and the `test` job from `Website checks` to pass. Add a required approving
reviewer if the website repository has another collaborator with write access.
The person leaving feedback does not need a GitHub account, but approving a PR
*in GitHub* does require a GitHub account with repository access.

The GitHub Pages URL is currently the review environment when `REVIEW_API_URL`
is set. Do not point the production domain at the same Pages deployment unless
the feedback tool is intentionally allowed there. A separate preview deployment
is needed to keep review and production versions live at the same time.

## Checks

```sh
node --test feedback-worker/index.test.mjs
python3 build.py --review
python3 build.py
```

The final production build should contain no `review.js`, `review.css`, or
`review-pages.json` in `dist/`, and its HTML should not reference them.
