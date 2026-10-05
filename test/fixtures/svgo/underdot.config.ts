import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { svgo } from 'underdot-svgo';

export default {
  plugins: [ejs(), svgo()],
} satisfies Configuration;
