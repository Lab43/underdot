import type { Configuration } from 'underdot';
import { fixtureRenderer } from './fixture-renderer.ts';

export default {
  plugins: [fixtureRenderer()],
  globals: { siteName: 'Templated', title: 'Global' },
} satisfies Configuration;
