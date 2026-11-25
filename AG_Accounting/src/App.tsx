import { lazy, Suspense, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { business } from './content/site.ts';
import { Layout } from './components/Layout.tsx';
import { matchRoute, usePathname } from './lib/router.tsx';
import type { RoutePattern } from './lib/router.tsx';
import { AboutPage } from './pages/About.tsx';
import { ContactPage } from './pages/Contact.tsx';
import { HomePage } from './pages/Home.tsx';
import { NotFoundPage } from './pages/NotFound.tsx';
import { PaymentsPage } from './pages/Payments.tsx';
import { PrivacyPage } from './pages/Privacy.tsx';
import { ResourcesPage } from './pages/Resources.tsx';
import { ServicesPage } from './pages/Services.tsx';

// The Tax Center and calculators carry a lot of data, so they load on demand.
const tc = () => import('./pages/TaxCenter.tsx');
const TaxCenterHubPage = lazy(() => tc().then((m) => ({ default: m.TaxCenterHubPage })));
const RatesPage = lazy(() => tc().then((m) => ({ default: m.RatesPage })));
const DueDatesPage = lazy(() => tc().then((m) => ({ default: m.DueDatesPage })));
const FormsPage = lazy(() => tc().then((m) => ({ default: m.FormsPage })));
const RefundsPage = lazy(() => tc().then((m) => ({ default: m.RefundsPage })));
const GlossaryPage = lazy(() => tc().then((m) => ({ default: m.GlossaryPage })));
const TaxpayerRightsPage = lazy(() => tc().then((m) => ({ default: m.TaxpayerRightsPage })));
const RecordRetentionPage = lazy(() => tc().then((m) => ({ default: m.RecordRetentionPage })));
const WithholdingPage = lazy(() => tc().then((m) => ({ default: m.WithholdingPage })));
const AppointmentChecklistPage = lazy(() => tc().then((m) => ({ default: m.AppointmentChecklistPage })));
const calc = () => import('./pages/Calculators.tsx');
const CalculatorsIndexPage = lazy(() => calc().then((m) => ({ default: m.CalculatorsIndexPage })));
const CalculatorPage = lazy(() => calc().then((m) => ({ default: m.CalculatorPage })));

type PageDef = { title: (params: Record<string, string>) => string; render: (params: Record<string, string>) => ReactNode };

const t = (name: string) => () => `${name} | ${business.name}`;

const PAGES: Record<RoutePattern, PageDef> = {
  '/': { title: () => `${business.name} | Tax and accounting services`, render: () => <HomePage /> },
  '/services': { title: t('Services'), render: () => <ServicesPage /> },
  '/about': { title: t('About'), render: () => <AboutPage /> },
  '/resources': { title: t('Helpful links'), render: () => <ResourcesPage /> },
  '/payments': { title: t('Pay an invoice'), render: () => <PaymentsPage /> },
  '/contact': { title: t('Contact'), render: () => <ContactPage /> },
  '/privacy': { title: t('Privacy'), render: () => <PrivacyPage /> },
  '/tax-center': { title: t('Tax Center'), render: () => <TaxCenterHubPage /> },
  '/tax-center/rates': { title: t('2026 tax rates'), render: () => <RatesPage /> },
  '/tax-center/due-dates': { title: t('Tax due dates'), render: () => <DueDatesPage /> },
  '/tax-center/forms': { title: t('IRS forms and publications'), render: () => <FormsPage /> },
  '/tax-center/refunds': { title: t('Refunds and payments'), render: () => <RefundsPage /> },
  '/tax-center/glossary': { title: t('Tax glossary'), render: () => <GlossaryPage /> },
  '/tax-center/taxpayer-rights': { title: t('Taxpayer rights'), render: () => <TaxpayerRightsPage /> },
  '/tax-center/record-retention': { title: t('How long to keep tax records'), render: () => <RecordRetentionPage /> },
  '/tax-center/withholding': { title: t('Check your withholding'), render: () => <WithholdingPage /> },
  '/tax-center/appointment-checklist': { title: t('Tax appointment checklist'), render: () => <AppointmentChecklistPage /> },
  '/calculators': { title: t('Calculators'), render: () => <CalculatorsIndexPage /> },
  '/calculators/:slug': { title: () => `Calculator | ${business.name}`, render: (p) => <CalculatorPage slug={p.slug} /> },
};

function Loading() {
  return <p className="px-5 py-16 text-center text-muted">Loading…</p>;
}

export function App() {
  const pathname = usePathname();
  const match = matchRoute(pathname);
  const page = match ? PAGES[match.pattern] : null;
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = page && match ? page.title(match.params) : `Page not found | ${business.name}`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // On client-side navigation, start at the top and move focus to the new page for screen readers.
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus();
  }, [pathname, page, match]);

  return (
    <Layout pathname={match?.pattern ?? pathname}>
      <Suspense fallback={<Loading />}>{page && match ? page.render(match.params) : <NotFoundPage />}</Suspense>
    </Layout>
  );
}
