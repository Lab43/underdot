import type { Configuration } from 'underdot';
import { sass } from 'underdot-sass';

export default {
  plugins: [sass()],
} satisfies Configuration;
