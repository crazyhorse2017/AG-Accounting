import { useState } from 'react';
import { ARTICLE_CATEGORIES, articles, categoryTitle, whitePapers } from '../content/library.ts';
import { historyFacts, quickFacts, VIDEO_TOPICS, videos } from '../content/extras.ts';
import type { Video } from '../content/extras.ts';
import { isVisible, visibleItems } from '../content/status.ts';
import { MarkdownBlocks } from '../components/Markdown.tsx';
import { ButtonLink, DraftBadge, LinkCard, Notice, PageHeader, Section, SourceList } from '../components/ui.tsx';
import { longDate } from '../lib/format.ts';
import { NotFoundPage } from './NotFound.tsx';

const GENERAL_INFO = 'General information only, not advice for your situation. Tax rules change; check the date this was last reviewed.';

function monthLabel(iso: string | null): string {
  if (!iso) return 'Undated';
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* ------------------------------------------------------------------ Articles */

export function ArticlesIndexPage() {
  const [category, setCategory] = useState<string>('all');
  const visible = visibleItems(articles);
  const shown = category === 'all' ? visible : visible.filter((a) => a.category === category);
  const months = [...new Set(shown.map((a) => monthLabel(a.published)))];

  return (
    <>
      <PageHeader
        eyebrow="Articles"
        title="Articles and tax tips"
        intro="Plain-language explanations of tax topics for individuals and small businesses. This is also the archive of our newsletter."
      />
      <Section>
        {visible.length === 0 ? (
          <Notice>Our first articles are being reviewed and will be published soon.</Notice>
        ) : (
          <>
            <div role="group" aria-label="Filter by category" className="mb-8 flex flex-wrap gap-2">
              {[{ id: 'all', title: 'All' }, ...ARTICLE_CATEGORIES].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={`select-none rounded-full border px-3 py-1 text-sm font-medium ${
                    category === c.id ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-white text-ink hover:border-brand-600'
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
            {shown.length === 0 && <p className="text-muted">No articles in this category yet.</p>}
            {months.map((month) => (
              <section key={month} className="mb-10" aria-labelledby={`m-${month}`}>
                <h2 id={`m-${month}`} className="mb-4 text-xl text-muted">
                  {month}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {shown
                    .filter((a) => monthLabel(a.published) === month)
                    .map((a) => (
                      <li key={a.id}>
                        <LinkCard
                          to={`/articles/${a.slug}`}
                          title={
                            <>
                              {a.title}
                              <DraftBadge status={a.status} />
                            </>
                          }
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{categoryTitle(a.category)}</p>
                          <p className="mt-1">{a.summary}</p>
                        </LinkCard>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </Section>
    </>
  );
}

export function ArticlePage({ slug }: { slug: string }) {
  const article = articles.find((a) => a.slug === slug);
  if (!article || !isVisible(article)) return <NotFoundPage />;
  const minutes = Math.max(1, Math.round(article.wordCount / 220));
  return (
    <>
      <PageHeader
        eyebrow={categoryTitle(article.category)}
        title={article.title}
        intro={
          <>
            {article.summary}
            <DraftBadge status={article.status} />
          </>
        }
      />
      <Section>
        <article className="mx-auto max-w-2xl">
          <p className="mb-8 text-sm text-muted">
            {article.published ? `Published ${longDate(article.published)} · ` : ''}
            {minutes} min read · By AG Accounting
          </p>
          <MarkdownBlocks blocks={article.blocks} />
          <div className="mt-10">
            <Notice>{GENERAL_INFO}</Notice>
            <SourceList sources={article.sources} reviewedOn={article.reviewedOn} />
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink to="/articles" variant="secondary">
              All articles
            </ButtonLink>
            <ButtonLink to="/contact">Ask us about your situation</ButtonLink>
          </div>
        </article>
      </Section>
    </>
  );
}

/* --------------------------------------------------------------- White papers */

export function WhitePapersPage() {
  const papers = visibleItems(whitePapers);
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="White papers"
        intro="In-depth guides you can download as PDFs, print, or save for later."
      />
      <Section>
        {papers.length === 0 ? (
          <Notice>Our first guides are being reviewed and will be available soon.</Notice>
        ) : (
          <ol className="divide-y divide-line rounded-lg border border-line bg-white">
            {papers.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">No. {String(i + 1).padStart(3, '0')}</p>
                  <h2 className="text-lg">
                    {p.title}
                    <DraftBadge status={p.status} />
                  </h2>
                  <p className="mt-1 text-sm text-muted">{p.summary}</p>
                  <p className="mt-1 text-xs text-muted">{p.reviewedOn ? `Last reviewed ${p.reviewedOn}` : 'Not yet reviewed'}</p>
                </div>
                {p.status === 'approved' ? (
                  <a
                    href={`/white-papers/${p.slug}.pdf`}
                    download
                    className="select-none rounded-md bg-brand-800 px-4 py-2 font-semibold text-white no-underline hover:bg-brand-700"
                  >
                    Download PDF
                  </a>
                ) : (
                  <span className="text-sm text-muted">PDF available after review</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

/* --------------------------------------------------------------------- Videos */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Nothing loads from YouTube until the visitor chooses to play (privacy-enhanced player). */
function VideoCard({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="aspect-video bg-brand-900">
        {playing ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeId)}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="flex h-full w-full select-none flex-col items-center justify-center gap-3 text-white hover:bg-brand-800"
          >
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-2xl text-brand-900">
              ▶
            </span>
            <span className="px-4 text-center text-sm">Play video (loads from YouTube)</span>
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base">
          {video.title}
          <DraftBadge status={video.status} />
        </h3>
        <p className="mt-1 text-xs text-muted">
          {formatDuration(video.durationSeconds)} · Internal Revenue Service
        </p>
        {video.description && <p className="mt-2 text-sm text-muted">{video.description}</p>}
      </div>
    </li>
  );
}

export function VideosPage() {
  const list = visibleItems(videos);
  const totalHours = list.reduce((s, v) => s + v.durationSeconds, 0) / 3600;
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Tax videos"
        intro="Short explainers from the Internal Revenue Service, grouped by topic. Videos play from YouTube’s privacy-enhanced player only when you choose to watch."
      />
      <Section>
        {list.length === 0 ? (
          <Notice>Our video library is being put together and will be available soon.</Notice>
        ) : (
          <>
            <p className="mb-8 text-sm text-muted">
              {list.length} videos · about {totalHours.toFixed(1)} hours
            </p>
            {VIDEO_TOPICS.map((t) => {
              const items = list.filter((v) => v.topic === t.id);
              if (items.length === 0) return null;
              return (
                <section key={t.id} className="mb-12" aria-labelledby={`vt-${t.id}`}>
                  <h2 id={`vt-${t.id}`} className="mb-4 text-2xl">
                    {t.title}
                  </h2>
                  <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((v) => (
                      <VideoCard key={v.id} video={v} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </Section>
    </>
  );
}

/* ---------------------------------------------------------------------- Facts */

export function FactsPage() {
  const quick = visibleItems(quickFacts);
  const history = visibleItems(historyFacts);
  return (
    <>
      <PageHeader eyebrow="Resources" title="Tax facts and history" intro="Quick tax facts and moments from the history of taxes in America. A new one appears on our home page every day." />
      <Section>
        {quick.length === 0 && history.length === 0 ? (
          <Notice>Our tax facts are being reviewed and will be available soon.</Notice>
        ) : (
          <div className="grid gap-12 lg:grid-cols-2">
            <section aria-labelledby="quick-facts">
              <h2 id="quick-facts" className="mb-4 text-2xl">
                Quick tax facts
              </h2>
              <ul className="space-y-3">
                {quick.map((f) => (
                  <li key={f.id} className="rounded-md border border-line bg-white p-4">
                    {f.text}
                    <DraftBadge status={f.status} />
                    {f.sources[0] && <SourceList sources={f.sources} reviewedOn={f.reviewedOn} />}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="history-facts">
              <h2 id="history-facts" className="mb-4 text-2xl">
                Tax history
              </h2>
              <ol className="space-y-3">
                {history.map((f) => (
                  <li key={f.id} className="rounded-md border border-line bg-white p-4">
                    {f.year !== null && <p className="font-serif text-lg font-bold text-brand-900">{f.year}</p>}
                    <p>
                      {f.text}
                      <DraftBadge status={f.status} />
                    </p>
                    {f.sources[0] && <SourceList sources={f.sources} reviewedOn={f.reviewedOn} />}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Section>
    </>
  );
}
