import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { markdown } from 'underdot-md';

export default {
  plugins: [ejs(), markdown()],
} satisfies Configuration;
