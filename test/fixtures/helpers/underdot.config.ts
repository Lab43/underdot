import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { helpers } from 'underdot-helpers';

export default {
  plugins: [ejs(), helpers()],
} satisfies Configuration;
