# USLK Jal Foundation website

Website for [Uttam Saraswat Lok Kalyan (USLK) Jal Foundation](https://uslkfoundation.com), migrated from Framer to **Astro** with **Keystatic** as the CMS, hosted on **Cloudflare Workers** (free tier).

| Part | What it does |
| --- | --- |
| [Astro 7](https://astro.build) | Builds every page to static HTML at deploy time (fast, SEO-friendly). |
| [Keystatic](https://keystatic.com) | Free, open-source CMS at `/keystatic`. Content is stored as files in this repo; each save is a Git commit. No database. |
| Cloudflare Workers | Serves the static site, plus two small on-demand routes: the CMS admin and the form handler. |
| [Resend](https://resend.com) | Sends contact / donation form submissions to the foundation’s inbox (free tier: 3,000 emails/month). |

**Cost: ₹0.** Every service above has a free tier that comfortably covers this site.

## How content editing works

1. An editor opens `https://uslkfoundation.com/keystatic` and signs in with GitHub.
2. They edit a project, blog post, the home page or site settings, and click **Save**.
3. Keystatic commits the change to `main` → Cloudflare rebuilds → the site is updated in about a minute.

Editors need a GitHub account with write access to this repository.

## Project structure

```
keystatic.config.ts      CMS fields (what editors see)
src/content.config.ts    Build-time validation of the same content
src/content/
  projects/*.mdoc        Projects (title, date, category, thumbnail, gallery, body)
  blog/*.mdoc            Blog posts
  legal/*.mdoc           Terms / Privacy (hidden while "draft: true")
  settings/site.yaml     Contact details, social links, footer, volunteer banner, donation causes
  settings/home.yaml     Home page copy and numbers
src/assets/images/       All images (optimised to WebP at build time)
src/pages/               Routes; api/forms.ts is the form handler
src/lib/forms.ts         Form validation, spam checks, email building (unit-tested)
scripts/                 One-off Framer → Keystatic migration
```

## Local development

Requires Node 22+ and pnpm 10.

```bash
pnpm install
```

```bash
pnpm dev
```

- Site: http://localhost:4321
- CMS: http://localhost:4321/keystatic (edits files on your disk; commit them as usual)
- Forms log to the terminal instead of sending email unless you copy `.env.example` to `.env` and fill in the Resend values.

Other commands:

```bash
pnpm build     # production build (Cloudflare)
pnpm preview   # serve the production build locally in the Workers runtime
pnpm check     # TypeScript / Astro diagnostics
pnpm test      # unit tests
```

## Deploying to Cloudflare (one-time setup)

### 1. Create the Worker

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → pick `dinkarhere/uslk-website`.
2. Build command: `pnpm build` · Deploy command: `pnpm exec wrangler deploy` · Root: `/`.
3. Deploy. You get a `*.workers.dev` URL to review the site before switching the domain.

The `SESSION` KV namespace and the form rate limiter are created automatically from `wrangler.jsonc`.

### 2. Form email (Resend)

1. Create a free account at resend.com and an API key.
2. Add these as **secrets** on the Worker (Settings → Variables and Secrets):
   - `RESEND_API_KEY`
   - `CONTACT_TO_EMAIL` — e.g. `uslkjalfoundation@gmail.com` (comma-separate several)
   - `CONTACT_FROM_EMAIL` — `USLK Website <onboarding@resend.dev>` works for testing; for production verify `uslkfoundation.com` in Resend and use e.g. `USLK Website <website@uslkfoundation.com>`.

Until these are set the forms show “temporarily unavailable, please email us”.

### 3. Keystatic GitHub sign-in

Keystatic needs a GitHub App so editors can log in and commit. Create it once from a laptop:

```bash
PUBLIC_KEYSTATIC_STORAGE=github pnpm dev
```

Open http://localhost:4321/keystatic, follow **Create GitHub App**, and when asked for the deployed URL use `https://uslkfoundation.com` (add the `workers.dev` URL as an extra callback URL in the GitHub App settings if you want to edit before the domain switch). Keystatic writes four values to `.env`. Copy them to the Worker:

- Secrets: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`
- **Build** variable (needed at build time): `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`

Then install the GitHub App on the `uslk-website` repository and redeploy. Never commit `.env`.

### 4. Switch the domain

1. Check the `workers.dev` preview page by page against the Framer site.
2. Worker → Settings → **Domains & Routes** → add `uslkfoundation.com` and `www.uslkfoundation.com`. (The domain’s DNS must be on Cloudflare; Cloudflare walks you through moving it.)
3. Remove the custom domain from the Framer project.

**Rollback:** re-attach the domain in Framer and remove it from the Worker. Keep the Framer project until the new site has been live for a while.

URLs are unchanged from Framer (`/projects/<slug>`, `/blog/<slug>`, `/contact`, `/donate-now`), so existing links and search rankings carry over.

## Re-running the Framer migration

`scripts/migration/framer-cms.json` is the Framer CMS export. To regenerate content (overwrites existing files):

```bash
pnpm migrate:framer --force
```

## Content to review (carried over from the Framer template)

These were on the live Framer site and need the foundation’s input:

- **Blog posts are template placeholders** (e.g. “The Universe is all of time and space…”, authors like “Denish Paul”). Replace or delete them in the CMS.
- **Terms & Privacy pages were empty** in Framer. They are drafts here (not published, not linked) until written.
- **Donation causes** in Framer were template values (“Cancer Funding”, “Child Walfare”…). They were replaced with the foundation’s project categories — edit under *Site settings → Donation form causes*.
- **The donation form takes pledges only** (it emails the team; no online payment), same as before. The currency shown is now ₹ (Framer showed $).
- **Fixed broken links:** header/footer phone links dialled `359 (0) 456 316` and email links went to `info@endeavor.com` (template values). They now use the real number and email.
- **Social links:** Facebook/Instagram/X pointed to the bare homepages; they are hidden until real URLs are added in *Site settings*. LinkedIn is kept.
- **Map** pointed to Ahmedabad coordinates; it now searches for the Badnapur office address.
- **Home “Recent Projects” intro** mentions “healthcare, education, hunger relief” — likely template copy.
- Several projects are tagged “Education” although they are plantation drives; adjust the category in the CMS if needed.
