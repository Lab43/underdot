import type { Page } from '../../src/build/read-site.ts';
import { renderBody } from './render-body.ts';

export const makePage = (fields: Partial<Page> & { sourcePath: string }): Page => ({
  directory: '',
  extension: 'tpl',
  renderer: { pluginName: 'fixture', render: renderBody },
  outputPath: 'index.html',
  url: '/',
  frontmatter: {},
  template: undefined,
  body: '',
  ...fields,
});
