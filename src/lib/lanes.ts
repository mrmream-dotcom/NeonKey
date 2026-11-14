// The three customer entrances (Michael, Nov 14 2026: full overhaul). Lane ids match the Lane type in
// src/lib/checkout-ref.ts (they are also in every checkout client_reference_id, so never rename the ids).
// Display names are exact; use them everywhere a visitor reads a lane: nav, doors, breadcrumbs, headers, titles.
import type { Lane } from './checkout-ref';
export const LANE_NAMES: Record<Lane, string> = {
  family: 'Protect Yourself',
  founders: 'Build Your Business',
  smb: 'Run Your Business',
};
/** Hub page for each lane. */
export const LANE_HUBS: Record<Lane, string> = {
  family: '/protect/',
  founders: '/founders/',
  smb: '/services/',
};
/** Who each lane is for, in a few words (nav descriptions, footer). */
export const LANE_AUDIENCE: Record<Lane, string> = {
  family: 'For you and your family',
  founders: 'For founders and new launches',
  smb: 'For small businesses',
};
