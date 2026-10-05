import type { Configuration } from 'underdot';
import { bust } from 'underdot-bust';
import { ejs } from 'underdot-ejs';
import { collapse } from './fixture-handlers.ts';

export default {
  // bust is listed first because its position never matters: every handler
  // finishes before any helper runs.
  plugins: [bust(), ejs(), collapse()],
} satisfies Configuration;
