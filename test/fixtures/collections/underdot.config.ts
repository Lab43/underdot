import type { Configuration } from 'underdot';
import { collections } from 'underdot-collections';
import { ejs } from 'underdot-ejs';

export default {
  plugins: [ejs(), collections({ posts: 'posts' })],
} satisfies Configuration;
