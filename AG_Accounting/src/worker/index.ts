/**
 * AG Accounting Worker entry point.
 *
 * Serves the static site (via the ASSETS binding) and a tiny API:
 *   POST /api/contact  - contact form submissions
 *   GET  /api/health   - liveness check
 *
 * Keep this file to the default export only; helpers live in ./contact.ts.
 */

import { handleContact, json, purgeOldContactRequests } from './contact.ts';
import type { Env } from './contact.ts';

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      try {
        return await handleContact(request, env, ctx);
      } catch {
        console.error('Unhandled error in /api/contact');
        return json({ ok: false, error: 'Something went wrong. Please try again or call us.' }, 500);
      }
    }
    if (url.pathname === '/api/health') return json({ ok: true });
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.DB) ctx.waitUntil(purgeOldContactRequests(env.DB));
  },
} satisfies ExportedHandler<Env>;
