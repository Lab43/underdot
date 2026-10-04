import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';

export default {
  plugins: [ejs({ views: ['_includes'] })],
} satisfies Configuration;
