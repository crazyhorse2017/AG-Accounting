import { historyFacts, quickFacts } from '../content/extras.ts';
import { articles, categoryTitle } from '../content/library.ts';
import { visibleItems } from '../content/status.ts';
import { onThisDay, pickForDay } from '../lib/daily.ts';
import { Container, DraftBadge, LinkCard } from './ui.tsx';
import { Link } from '../lib/router.tsx';

/** Home-page "daily content changes": a new fact, history item and featured article each day (Eastern Time). */
export default function DailyContent() {
  const fact = pickForDay(visibleItems(quickFacts));
  const visibleHistory = visibleItems(historyFacts);
  const today = onThisDay(visibleHistory);
  const history = today.length > 0 ? pickForDay(today) : pickForDay(visibleHistory, new Date(), 3);
  const article = pickForDay(visibleItems(articles), new Date(), 1);

  if (!fact && !history && !article) return null;

  return (
    <section className="border-y border-line bg-white py-12 sm:py-16" aria-labelledby="daily-heading">
      <Container>
        <h2 id="daily-heading" className="mb-6 text-2xl sm:text-3xl">
          Today at AG Accounting
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {fact && (
            <div className="rounded-lg border border-line bg-brand-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Tax fact of the day</p>
              <p className="mt-2">
                {fact.text}
                <DraftBadge status={fact.status} />
              </p>
              <p className="mt-3 text-sm">
                <Link to="/resources/facts" className="text-brand-800">
                  More tax facts
                </Link>
              </p>
            </div>
          )}
          {history && (
            <div className="rounded-lg border border-line bg-brand-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{today.length > 0 ? 'This day in tax history' : 'From tax history'}</p>
              {history.year !== null && <p className="mt-2 font-serif text-xl font-bold text-brand-900">{history.year}</p>}
              <p className="mt-1">
                {history.text}
                <DraftBadge status={history.status} />
              </p>
            </div>
          )}
          {article && (
            <LinkCard to={`/articles/${article.slug}`} title={<>{article.title}<DraftBadge status={article.status} /></>}>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Featured article · {categoryTitle(article.category)}</p>
              <p className="mt-1">{article.summary}</p>
            </LinkCard>
          )}
        </div>
      </Container>
    </section>
  );
}
