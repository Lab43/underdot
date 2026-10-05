// spec: docs/specs/bust.md

import type { Plugin } from 'underdot';
import { bustReference } from './bust-reference.ts';

export const bust = (): Plugin => ({
  name: 'bust',
  helpers: { bust: bustReference },
});
