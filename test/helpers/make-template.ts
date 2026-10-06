import type { Template } from '../../src/build/read-site.ts';
import { renderBody } from './render-body.ts';

export const makeTemplate = (fields: Partial<Template> & { sourcePath: string }): Template => ({
  directory: '',
  extension: 'tpl',
  renderer: { pluginName: 'fixture', render: renderBody },
  name: '_',
  frontmatter: {},
  template: undefined,
  body: '',
  ...fields,
});
