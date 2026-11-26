/**
 * All site content lives here so it can be filled in as details arrive.
 *
 * Rules:
 * - `confirmed: false` means the wording or fact has not been approved by the
 *   firm yet. While anything is unconfirmed, the site shows a "draft" banner and
 *   `tests/verify_repo.py --launch` fails.
 * - `null` means the detail is not known yet; the UI hides it.
 * - Never put card numbers, tax returns, SSNs or bank details anywhere on the site.
 */

export type Confirmable = { confirmed: boolean };

export type BusinessInfo = {
  name: string;
  legalName: string | null;
  tagline: string;
  phone: string | null;
  email: string | null;
  address: { street: string; city: string; state: string; zip: string } | null;
  hours: string[] | null;
  serviceArea: string | null;
} & Confirmable;

export const business: BusinessInfo = {
  name: 'AG Accounting',
  legalName: 'AG Accounting',
  tagline: 'Tax and accounting help from a local firm that knows your name.',
  phone: '(440) 605-0978',
  email: 'alex@agaccountingohio.com',
  address: { street: '32081 Cedar Road', city: 'Cleveland', state: 'OH', zip: '44124' },
  hours: null,
  serviceArea: 'Greater Cleveland, Ohio',
  confirmed: false,
};

export type Service = {
  id: string;
  title: string;
  summary: string;
  audience: string;
  includes: string[];
} & Confirmable;

export const services: Service[] = [
  {
    id: 'individual-tax',
    title: 'Individual tax returns',
    summary: 'Federal, state, and local returns prepared carefully and explained in plain language.',
    audience: 'Individuals, couples, families, and retirees',
    includes: [
      'Federal and Ohio income tax returns',
      'Local municipal returns where required',
      'A review of last year’s return for anything missed',
      'Answers to IRS and state letters about your return',
    ],
    confirmed: false,
  },
  {
    id: 'business-tax',
    title: 'Business tax returns',
    summary: 'Returns for sole proprietors, partnerships, and corporations, with planning through the year.',
    audience: 'Small businesses and self-employed people',
    includes: [
      'Business and self-employment tax returns',
      'Estimated tax payment planning',
      'Year-end planning conversations',
    ],
    confirmed: false,
  },
  {
    id: 'accounting',
    title: 'Accounting and bookkeeping',
    summary: 'Accurate books so you always know where your business stands.',
    audience: 'Small businesses',
    includes: [
      'Monthly or quarterly bookkeeping',
      'Financial statements',
      'Clean records ready for tax time',
    ],
    confirmed: false,
  },
  {
    id: 'payroll',
    title: 'Payroll',
    summary: 'Payroll and payroll tax filings handled on schedule.',
    audience: 'Employers',
    includes: [
      'Paychecks and payroll records',
      'Quarterly and annual payroll tax filings',
      'Year-end W-2 and 1099 forms',
    ],
    confirmed: false,
  },
];

export type Founder = {
  name: string | null;
  role: string;
  bio: string[];
  credentials: string[];
} & Confirmable;

/** Founder details are left blank until the firm approves exact wording. */
export const founder: Founder = {
  name: null,
  role: 'Founder',
  bio: [
    'AG Accounting has grown the old-fashioned way: through referrals from clients who trust the work.',
    'Every return gets personal attention, and every client can reach the person who prepared it.',
  ],
  credentials: ['Authorized to represent taxpayers before the IRS'],
  confirmed: false,
};

export type Highlight = { title: string; body: string } & Confirmable;

export const highlights: Highlight[] = [
  {
    title: 'Decades of experience',
    body: 'Long experience with individual and small-business taxes, built one client at a time.',
    confirmed: false,
  },
  {
    title: 'IRS representation',
    body: 'If the IRS sends a letter, you have someone authorized to speak for you.',
    confirmed: false,
  },
  {
    title: 'You talk to a person',
    body: 'No call centers. Questions go to the people who know your file.',
    confirmed: false,
  },
];

export type Resource = {
  title: string;
  description: string;
  url: string;
  source: string;
  lastReviewed: string;
} & Confirmable;

export type ResourceGroup = { id: string; title: string; resources: Resource[] };

const REVIEWED = '2026-11-25';

export const resourceGroups: ResourceGroup[] = [
  {
    id: 'refunds-payments',
    title: 'Refunds and payments',
    resources: [
      {
        title: 'Where’s My Refund?',
        description: 'Check the status of your federal tax refund.',
        url: 'https://www.irs.gov/wheres-my-refund',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
      {
        title: 'Pay the IRS',
        description: 'Official ways to make a federal tax payment.',
        url: 'https://www.irs.gov/payments',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
      {
        title: 'Ohio Department of Taxation',
        description: 'Ohio income tax forms, payments, and refund information.',
        url: 'https://tax.ohio.gov/',
        source: 'State of Ohio',
        lastReviewed: REVIEWED,
        confirmed: false,
      },
    ],
  },
  {
    id: 'forms-records',
    title: 'Forms and records',
    resources: [
      {
        title: 'IRS forms and instructions',
        description: 'Current federal forms, instructions, and publications.',
        url: 'https://www.irs.gov/forms-instructions',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
      {
        title: 'Get a tax transcript',
        description: 'Request a copy of your past federal tax return information.',
        url: 'https://www.irs.gov/individuals/get-transcript',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
      {
        title: 'How long should I keep records?',
        description: 'The IRS’s guidance on keeping tax records.',
        url: 'https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
    ],
  },
  {
    id: 'planning',
    title: 'Planning and deadlines',
    resources: [
      {
        title: 'Tax Withholding Estimator',
        description: 'Check whether your paycheck withholding is on track.',
        url: 'https://www.irs.gov/individuals/tax-withholding-estimator',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
      {
        title: 'IRS tax calendar',
        description: 'Federal due dates for individuals and businesses.',
        url: 'https://www.irs.gov/businesses/small-businesses-self-employed/online-tax-calendar',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
    ],
  },
  {
    id: 'protect',
    title: 'Protect yourself',
    resources: [
      {
        title: 'Get an Identity Protection PIN',
        description: 'A PIN that helps stop someone else from filing a return with your SSN.',
        url: 'https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
      {
        title: 'Taxpayer Bill of Rights',
        description: 'Your rights when dealing with the IRS.',
        url: 'https://www.irs.gov/taxpayer-bill-of-rights',
        source: 'IRS',
        lastReviewed: REVIEWED,
        confirmed: true,
      },
    ],
  },
];

export type PaymentsInfo = {
  provider: 'PayPal';
  /** A general PayPal payment link, if the firm wants one. Invoices carry their own links. */
  paymentUrl: string | null;
} & Confirmable;

export const payments: PaymentsInfo = {
  provider: 'PayPal',
  paymentUrl: null,
  confirmed: false,
};

export type PortalInfo = {
  /** Provider's product name, e.g. as it appears on its sign-in page. */
  name: string | null;
  /** The provider's sign-in page for AG Accounting clients. */
  url: string | null;
  /**
   * Security features to list on the portal page. Only what the provider's own
   * documentation states (no "bank-level" or compliance claims), confirmed by the firm.
   */
  features: string[];
  /** Short how-to steps for clients, from the provider's instructions. */
  steps: string[];
} & Confirmable;

/** Client file portal: a third-party provider, not part of this site. Not chosen yet. */
export const portal: PortalInfo = { name: null, url: null, features: [], steps: [], confirmed: false };

/** Collects every unconfirmed or missing item, used for the draft banner and launch checks. */
export function draftItems(): string[] {
  const items: string[] = [];
  if (!business.confirmed) items.push('Business details');
  if (!business.phone) items.push('Phone number');
  if (!business.email) items.push('Email address');
  if (!business.address) items.push('Office address');
  if (!business.hours) items.push('Office hours');
  for (const s of services) if (!s.confirmed) items.push(`Service: ${s.title}`);
  if (!founder.confirmed || !founder.name) items.push('About / founder details');
  for (const h of highlights) if (!h.confirmed) items.push(`Highlight: ${h.title}`);
  for (const g of resourceGroups) {
    for (const r of g.resources) if (!r.confirmed) items.push(`Resource: ${r.title}`);
  }
  if (!payments.confirmed) items.push('Payment instructions');
  if (!portal.confirmed || !portal.url) items.push('Client portal provider');
  return items;
}
