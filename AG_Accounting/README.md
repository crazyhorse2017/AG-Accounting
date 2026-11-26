# AG Accounting Website

Website for AG Accounting, a local tax and accounting practice. It's a personal
project for one firm, not a product. Planning notes live in
`03_Software_and_Web_Development/Other_Projects/AG Accounting Website/`.

**Status:** draft. Pages, contact form and checks are built. Business details,
services and wording still need the firm's confirmation (the site shows a draft
banner until they're confirmed). Nothing has been deployed.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS v4 (placeholder brand tokens in `src/index.css`)
- Cloudflare Workers (static assets plus a small API) and Cloudflare D1
- Built and deployed remotely with Cloudflare Workers Builds; this machine has no Node or git

## Hard rule: no sensitive data on this site

The site, its Worker and D1 **never** store payment card data, tax returns, Social
Security numbers or bank account numbers.

- **Documents** go through a third-party client portal (provider not chosen yet).
- **Payments** go through PayPal invoices. The site only explains the process and links out.
- **Contact form** rejects messages that look like they contain an SSN or card number,
  never logs submissions, stores a one-way daily hash instead of IP addresses, and
  deletes messages after 90 days (`src/shared/policy.ts`).

`tests/verify_repo.py` enforces this: no sensitive-looking schema columns or form
fields, no file uploads, no logging of submissions, parameterized SQL only.

## Where things are

| Path | What it holds |
|---|---|
| `src/content/site.ts` | All business info, services, resources and payment settings. Edit here first. |
| `src/pages/` | Home, Services, About, Resources, Payments, Contact, Privacy, 404 |
| `src/components/` | Layout (header, footer, draft banner), Logo, shared UI |
| `src/shared/contact.ts` | Contact form validation used by both the browser and the Worker |
| `src/worker/` | `index.ts` (entry, default export only) and `contact.ts` (API handler, cleanup) |
| `migrations/` | D1 schema |
| `public/_headers` | Security headers including the Content Security Policy |
| `tests/` | No-Node verification scripts |

## Filling in content

Every item in `src/content/site.ts` has `confirmed: false` until the firm approves
it, and unknown details are `null` (the UI hides them). The draft banner lists how
many items remain. Business details shown only as reference (an old site's text,
screenshots) must be reworded, not copied.

## Phase 02 content (Tax Center and calculators)

Specs: `03_Software_and_Web_Development/Other_Projects/AG Accounting Website/AG Accounting Phase 02 *.md`.

- **Reviewable content** is JSON under `src/content/data/`. Every item has an `id`,
  a `status` (`draft` or `approved`), `reviewedOn` and `sources`. Only approved items
  show on the live site.
- **Draft preview:** to see drafts on a deployed build, set the Cloudflare build
  variable `VITE_SHOW_DRAFTS=true` (Worker → Settings → Build → Variables). Drafts
  then show a yellow "Draft" label. **Remove it before launch.**
- **Tax-year data:** `src/content/data/tax-years/2026/` (federal, Ohio, due dates),
  read through `src/content/taxYear.ts`. Each figure cites its IRS/Ohio source.
- **Calculators:** metadata in `src/content/data/calculators.json`, formulas in
  `src/calculators/impl/*.ts`, shared math in `src/lib/tax.ts` and `src/lib/finance.ts`.

### Review workflow (grandpa approves everything)

```powershell
uv run --no-project --python 3.12 python tools/review_packet.py            # PDF + email text in review-packets/
uv run --no-project --python 3.12 python tools/approve.py <id> <id> ...    # after his marks come back
uv run --no-project --python 3.12 python tools/build_ics.py                # refresh the calendar if dates changed
uv run --no-project --python 3.12 python tools/check_links.py              # monthly: every official link still works
uv run --no-project --python 3.12 python tools/build_pdfs.py               # approved white papers -> public/white-papers/*.pdf
uv run --no-project --python 3.12 python tools/build_pdfs.py --preview <slug>   # draft PDF for review (review-packets/)
uv run --no-project --python 3.12 python tools/check_videos.py             # every video is a real, official IRS upload
```

- **Articles** (= blog = newsletter archive): `src/content/articles/<slug>.md`
- **White papers:** `src/content/white-papers/<slug>.md` (PDFs are built only once approved)
- **Facts:** `src/content/data/facts/quick-facts.json` and `history-facts.json`
- **Videos:** `src/content/data/videos.json` (official IRS YouTube uploads only)

Markdown files start with front matter (`id`, `status`, `reviewedOn`, `title`, `slug`,
`category`, `summary`, `published`, and one `source: Title | https://...` line per source).
Supported Markdown: `##`/`###` headings, paragraphs, `-` and `1.` lists, `>` callouts,
`**bold**`, `*italic*`, and links to `https://` or site paths. Raw HTML is rejected.

`review-packets/` is git-ignored: packets are for printing or emailing, not the repo.

## Email (newsletter, weekly tips, drip series)

Setup steps: `Other_Projects/AG Accounting Website/AG Accounting Brevo Setup Guide.md`.

- Sign-up: `/newsletter` and the home page → `POST /api/newsletter` → Brevo double opt-in. No subscriber data is stored here.
- Content: `src/content/emails/tips/*.md` (weekly) and `src/content/emails/drips/<series>/*.md` (series), plus shared wording in `src/content/data/emails.json`. Same review workflow as everything else.
- `tools/build_emails.py` builds `src/worker/generated/emails.json` (approved tips and monthly issues only). The Tuesday cron turns them into Brevo campaigns: drafts unless `SEND_MODE=auto`.
- `tools/sync_brevo.py` pushes approved series emails and the confirmation email to Brevo templates (API key from the environment only).
- `tests/test_emails.py` checks every email for the unsubscribe link, postal address, size and forbidden HTML.

## Checks (run after every change)

```powershell
uv run --no-project --python 3.12 python tests/verify_repo.py
uv run --no-project --python 3.12 python tests/run_tests.py
uv run --no-project --python 3.12 python tests/typecheck.py
uv run --no-project --python 3.12 python tests/test_emails.py
```

`typecheck.py` and `run_tests.py` run the TypeScript compiler in headless Chrome or
Edge using the type cache Prizm's type check already downloaded
(`%LOCALAPPDATA%\prizm-typecheck-cache`). They download nothing. Before launch, run
`verify_repo.py --launch`, which fails while any content is unconfirmed.

Tailwind classes and the Vite build itself can only be fully checked by the
Cloudflare build (or any machine with Node).

## Deploying (needs approval first)

Not done yet, and only with explicit approval. The steps mirror Prizm's `DEPLOY.md`:

1. **Done 2026-11-25:** D1 database `ag-accounting-db` (Eastern North America) exists,
   its ID is in `wrangler.jsonc`, and `migrations/0001_init.sql` has been applied.
2. Upload this folder to a GitHub repository and connect it in Cloudflare under
   **Workers & Pages → Create → Import a repository**. In the Worker's
   **Settings → Build**, set:
   - **Build command:** `npm run build` (required: it creates `dist/`)
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** the folder that contains `package.json`

   `wrangler.jsonc` serves only `./dist`. If the build command is missing, the deploy
   fails with a "directory does not exist" error instead of publishing raw source
   files (which shows as a blank page with a MIME-type error for `/src/main.tsx`).
3. After the first deploy, add the secret `RATE_KEY_SALT` (any long random string).
4. Optional email notifications for new messages: set `BREVO_API_KEY` (secret),
   `NOTIFY_TO` and `NOTIFY_FROM`. Without them, messages are only stored in D1.
5. Add the custom domain route in `wrangler.jsonc` once the domain is known.

## Open items

- Business name, phone, email and address are filled in; office hours still waiting on the firm
- Site domain: not chosen. Don't use agaccountingohio.com for the site yet (as of 2026-11-25)
- Services, founder bio, credentials and experience claims: need the firm's wording and approval
- Logo: placeholder book-and-monogram mark drawn from a logo idea, not final
- Client portal provider: check whether his tax software includes one
- PayPal: confirm invoicing setup and fees
- Contact notifications: choose an email service (Brevo is wired in as an option)
- Privacy page: needs review before launch
