import postcssImport from 'postcss-import';
import type { Configuration } from 'underdot';
import { postcss } from 'underdot-postcss';
import { sass } from 'underdot-sass';

export default {
  plugins: [sass(), postcss({ plugins: [postcssImport()] })],
} satisfies Configuration;
