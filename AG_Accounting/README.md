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

## Checks (run after every change)

```powershell
uv run --no-project --python 3.12 python tests/verify_repo.py
uv run --no-project --python 3.12 python tests/run_tests.py
uv run --no-project --python 3.12 python tests/typecheck.py
```

`typecheck.py` and `run_tests.py` run the TypeScript compiler in headless Chrome or
Edge using the type cache Prizm's type check already downloaded
(`%LOCALAPPDATA%\prizm-typecheck-cache`). They download nothing. Before launch, run
`verify_repo.py --launch`, which fails while any content is unconfirmed.

Tailwind classes and the Vite build itself can only be fully checked by the
Cloudflare build (or any machine with Node).

## Deploying (needs approval first)

Not done yet, and only with explicit approval. The steps mirror Prizm's `DEPLOY.md`:

1. Create a D1 database `ag-accounting-db` in the Cloudflare dashboard, put its ID in
   `wrangler.jsonc`, and run `migrations/0001_init.sql` in the D1 console.
2. Upload this folder to a GitHub repository and connect it in Cloudflare under
   **Workers & Pages → Create → Import a repository**. Build command `npm run build`,
   deploy command `npx wrangler deploy`.
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
