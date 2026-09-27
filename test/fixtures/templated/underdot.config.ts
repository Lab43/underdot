import type { Configuration } from 'underdot';
import { fixtureRenderer } from './fixture-renderer.ts';

export default { plugins: [fixtureRenderer()] } satisfies Configuration;
