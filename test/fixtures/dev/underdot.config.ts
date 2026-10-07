import type { Configuration } from 'underdot';

export default {
  rewrites: { '/cart': '/store/', '/cart/**': '/store/' },
} satisfies Configuration;
