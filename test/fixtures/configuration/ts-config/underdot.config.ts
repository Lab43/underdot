import type { Configuration } from 'underdot';

export default {
  source: 'content',
  destination: 'public',
  exclude: ['**/*.draft'],
} satisfies Configuration;
