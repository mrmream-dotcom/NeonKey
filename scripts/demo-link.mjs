#!/usr/bin/env node
// Build a personalized link to the Front Office demo (/lab/front-office/) for one lead.
//   node scripts/demo-link.mjs --biz "Acme Plumbing" --type home --owner Pat --domain acmeplumbing.com
// --type is one of: home, office, salon, shop (default home). Every flag is optional.
// The page cleans the values again in the browser and shows the lead's name only as text.
const TYPES = ['home', 'office', 'salon', 'shop'];
const args = process.argv.slice(2);
const get = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] || '').trim() : ''; };
const base = (get('site') || 'https://neonkey.tech').replace(/\/+$/, '');
const type = get('type') || 'home';
if (!TYPES.includes(type)) { console.error(`--type must be one of: ${TYPES.join(', ')}`); process.exit(1); }
const domain = get('domain').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const params = new URLSearchParams({ type });
for (const [k, v] of [['biz', get('biz').slice(0, 60)], ['owner', get('owner').slice(0, 30)], ['domain', domain.slice(0, 80)]]) if (v) params.set(k, v);
params.set('utm_source', 'outreach'); params.set('utm_medium', 'email'); params.set('utm_campaign', 'front-office-demo');
console.log(`${base}/lab/front-office/?${params}`);
