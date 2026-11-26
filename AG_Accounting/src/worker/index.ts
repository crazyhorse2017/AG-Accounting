/**
 * AG Accounting Worker entry point.
 *
 * Serves the static site (via the ASSETS binding) and a small API:
 *   POST /api/contact     - contact form submissions
 *   POST /api/newsletter  - newsletter sign-up (Brevo double opt-in)
 *   GET  /api/health      - liveness check
 *
 * Scheduled jobs (wrangler.jsonc "triggers"):
 *   daily     - delete old contact messages and rate-limit keys
 *   Tuesdays  - weekly tip and (first week) monthly newsletter
 *
 * Keep this file to the default export only; helpers live in other files.
 */

import { handleContact, json, purgeOldContactRequests } from './contact.ts';
import type { Env } from './contact.ts';
import { handleNewsletter, purgeOldRateEvents } from './newsletter.ts';
import { runWeeklyEmails } from './emailJobs.ts';

const WEEKLY_CRON = '0 14 * * 2';

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const route = url.pathname;
    try {
      if (route === '/api/contact') return await handleContact(request, env, ctx);
      if (route === '/api/newsletter') return await handleNewsletter(request, env);
    } catch {
      console.error(`Unhandled error in ${route}`);
      return json({ ok: false, error: 'Something went wrong. Please try again or call us.' }, 500);
    }
    if (url.pathname === '/api/health') return json({ ok: true });
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === WEEKLY_CRON) {
      ctx.waitUntil(runWeeklyEmails(env, new Date(controller.scheduledTime)).then(() => undefined));
      return;
    }
    if (env.DB) {
      ctx.waitUntil(Promise.all([purgeOldContactRequests(env.DB), purgeOldRateEvents(env.DB)]).then(() => undefined));
    }
  },
} satisfies ExportedHandler<Env>;
