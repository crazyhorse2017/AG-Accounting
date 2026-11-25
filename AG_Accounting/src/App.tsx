import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { business } from './content/site.ts';
import { Layout } from './components/Layout.tsx';
import { matchRoute, usePathname } from './lib/router.tsx';
import type { RoutePath } from './lib/router.tsx';
import { AboutPage } from './pages/About.tsx';
import { ContactPage } from './pages/Contact.tsx';
import { HomePage } from './pages/Home.tsx';
import { NotFoundPage } from './pages/NotFound.tsx';
import { PaymentsPage } from './pages/Payments.tsx';
import { PrivacyPage } from './pages/Privacy.tsx';
import { ResourcesPage } from './pages/Resources.tsx';
import { ServicesPage } from './pages/Services.tsx';

const PAGES: Record<RoutePath, { title: string; render: () => ReactNode }> = {
  '/': { title: `${business.name} | Tax and accounting services`, render: () => <HomePage /> },
  '/services': { title: `Services | ${business.name}`, render: () => <ServicesPage /> },
  '/about': { title: `About | ${business.name}`, render: () => <AboutPage /> },
  '/resources': { title: `Tax resources | ${business.name}`, render: () => <ResourcesPage /> },
  '/payments': { title: `Pay an invoice | ${business.name}`, render: () => <PaymentsPage /> },
  '/contact': { title: `Contact | ${business.name}`, render: () => <ContactPage /> },
  '/privacy': { title: `Privacy | ${business.name}`, render: () => <PrivacyPage /> },
};

export function App() {
  const pathname = usePathname();
  const route = matchRoute(pathname);
  const page = route ? PAGES[route] : null;
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = page ? page.title : `Page not found | ${business.name}`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // On client-side navigation, start at the top and move focus to the new page for screen readers.
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus();
  }, [pathname, page]);

  return <Layout pathname={route ?? pathname}>{page ? page.render() : <NotFoundPage />}</Layout>;
}
