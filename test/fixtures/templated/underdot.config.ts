import type { Configuration } from 'underdot';
import { annotate, transform } from './fixture-handlers.ts';
import { helpers } from './fixture-helpers.ts';
import { listing } from './fixture-hooks.ts';
import { fixtureRenderer } from './fixture-renderer.ts';

export default {
  plugins: [fixtureRenderer(), transform(), annotate(), helpers(), listing()],
  globals: { siteName: 'Templated', title: 'Global' },
} satisfies Configuration;
