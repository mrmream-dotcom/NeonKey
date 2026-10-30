// @ts-check
import { defineConfig } from 'astro/config';

// Static output. Set `site` to the real domain (e.g. https://neonkey.tech) before going live.
export default defineConfig({
  output: 'static',
  site: 'https://example.invalid',
  trailingSlash: 'ignore',
});
