import { activeLink, isActivePath, NAV_GROUPS } from '../src/content/navigation.ts';
import { matchRoute, ROUTES } from '../src/lib/routes.ts';
import { SHOW_DRAFTS } from '../src/content/status.ts';
import { PREVIEW_DRAFTS } from '../src/content/preview.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const allTargets = NAV_GROUPS.flatMap((g) => (g.links ? g.links.map((l) => l.to) : [g.to ?? '']));

export const tests = [
  {
    name: 'every menu link goes to a real page',
    run() {
      for (const to of allTargets) assert(matchRoute(to) !== null, `menu link ${to} is a 404`);
      assert(new Set(allTargets).size === allTargets.length, 'a page is listed twice in the menus');
    },
  },
  {
    name: 'every static page is in the menus',
    run() {
      for (const route of ROUTES) {
        if (route.includes(':') || route === '/' || route === '/newsletter/confirmed') continue;
        assert(allTargets.includes(route), `${route} is missing from the menus`);
      }
    },
  },
  {
    name: 'only the most specific menu link is marked current',
    run() {
      assert(activeLink('/resources/videos') === '/resources/videos', 'videos page');
      assert(activeLink('/resources') === '/resources', 'helpful links page');
      assert(activeLink('/tax-center/rates') === '/tax-center/rates', 'tax center sub-page');
      assert(activeLink('/articles/some-article') === '/articles', 'article under Articles');
      assert(activeLink('/calculators/mortgage/') === '/calculators', 'trailing slash');
      assert(activeLink('/') === null, 'home has no menu item');
      assert(!isActivePath('/articles-old', '/articles'), 'prefix without slash does not match');
    },
  },
  {
    name: 'draft preview follows the preview switch',
    run() {
      assert(SHOW_DRAFTS === (PREVIEW_DRAFTS || SHOW_DRAFTS), 'SHOW_DRAFTS includes PREVIEW_DRAFTS');
      if (PREVIEW_DRAFTS) assert(SHOW_DRAFTS, 'preview switch on means drafts show');
    },
  },
];
