// Timed Learn guides (see src/data/learn-schedule.json). Shared by the Learn hub, the sitemap filter and the
// scheduled-pages integration so all three agree on what is live in a given build.
import schedule from '../data/learn-schedule.json' with { type: 'json' };

/** Build date as YYYY-MM-DD in Alaska time. PUBLISH_DATE=YYYY-MM-DD overrides it (for previews and tests). */
export function buildDate() {
  if (process.env.PUBLISH_DATE) return process.env.PUBLISH_DATE;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Anchorage', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Slugs of Learn guides whose go-live date is after the build date. */
export function unpublishedLearnSlugs() {
  const today = buildDate();
  return Object.entries(schedule).filter(([k, d]) => !k.startsWith('_') && d > today).map(([k]) => k);
}

/** True when the Learn page at this path (e.g. "/learn/spot-a-scam/") is live in this build. */
export function isLearnPathLive(path) {
  const slug = String(path).replace(/^.*\/learn\//, '').replace(/\/$/, '');
  return !unpublishedLearnSlugs().includes(slug);
}
