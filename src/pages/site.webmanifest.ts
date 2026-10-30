import type { APIRoute } from 'astro';
import { url } from '../config';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: 'NeonKey',
        short_name: 'NeonKey',
        description: 'Unlock tech, whatever your level.',
        start_url: url('/'),
        scope: url('/'),
        display: 'standalone',
        background_color: '#0b0d17',
        theme_color: '#0b0d17',
        icons: [
          { src: url('/icon-192.png'), sizes: '192x192', type: 'image/png' },
          { src: url('/icon-512.png'), sizes: '512x512', type: 'image/png' },
          { src: url('/icon-512-maskable.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: url('/favicon.svg'), sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
