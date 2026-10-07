import type { Configuration } from 'underdot';
import { ejs } from 'underdot-ejs';
import { srcset } from 'underdot-srcset';

export default {
  plugins: [
    ejs(),
    srcset({
      presets: {
        wide: { sizes: '100vw', widths: [300, 450, 900], webp: false },
        hero: { sizes: '(min-width: 600px) 600px, 100vw', widths: [300, 600] },
      },
    }),
  ],
} satisfies Configuration;
