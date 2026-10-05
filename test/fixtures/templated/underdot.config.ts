import type { Configuration } from 'underdot';
import { annotate, transform } from './fixture-handlers.ts';
import { helpers } from './fixture-helpers.ts';
import { fixtureRenderer } from './fixture-renderer.ts';

export default {
  plugins: [fixtureRenderer(), transform(), annotate(), helpers()],
  globals: { siteName: 'Templated', title: 'Global' },
} satisfies Configuration;
