// spec: q-docs/specs/helpers.md

import type { Plugin } from 'underdot';
import { fileExists } from './file-exists.ts';
import { formatDate } from './format-date.ts';
import { renderActiveLink } from './render-active-link.ts';

export const helpers = (): Plugin => ({
  name: 'helpers',
  helpers: { activeLink: renderActiveLink, formatDate, fileExists },
});
