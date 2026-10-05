// spec: docs/specs/plugins.md, File handlers

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { renderBody } from '../../test/helpers/render-body.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { handleFiles } from './handle-files.ts';
import type { Output } from './handle-files.ts';
import type { RegisteredHandler } from './register-plugins.ts';

const source = join(fixturePath('templated'), 'source');
const renderers = new Map([['tpl', { render: renderBody }]]);

const copy = (sourcePath: string): Output => ({ sourcePath, outputPath: sourcePath, contents: undefined });
const handled = (sourcePath: string, outputPath: string, text: string): Output => ({ sourcePath, outputPath, contents: Buffer.from(text) });

const upper: RegisteredHandler = {
  pluginName: 'transform',
  glob: '**/*.txt',
  handle: ({ outputPath, contents }) => [{ outputPath: outputPath.replace(/\.txt$/, '.text'), contents: contents.toString().toUpperCase() }],
};
const split: RegisteredHandler = {
  pluginName: 'transform',
  glob: '**/*.css',
  handle: ({ outputPath, contents }) => [{ outputPath, contents }, { outputPath: `${outputPath}.map`, contents: '{}' }],
};

describe('handleFiles', () => {
  test("with no handlers, every static file of the templated fixture yields a copy output at its own path, in the static files' order", async () => {
    const { staticFiles } = classifySource(await walkSource(source), renderers);
    await expect(handleFiles(source, staticFiles, [])).resolves.toStrictEqual([
      copy('_data/site.json'),
      copy('_data/team/leads.json'),
      copy('_data/team/motto.ts'),
      copy('_data/team/size.js'),
      copy('_includes/header.tpl'),
      copy('_partial.txt'),
      copy('_snippets/aside.txt'),
      copy('extra/plain.html'),
      copy('notes.txt'),
      copy('scratch.drop'),
      copy('styles/site.css'),
    ]);
  });

  test("a matched file is read and yields its handled outputs carrying its source path, an unmatched one a copy, in the static files' order", async () => {
    const staticFiles = [{ sourcePath: 'styles/site.css' }, { sourcePath: 'notes.txt' }, { sourcePath: 'extra/plain.html' }, { sourcePath: '_snippets/aside.txt' }];
    await expect(handleFiles(source, staticFiles, [upper, split])).resolves.toStrictEqual([
      handled('styles/site.css', 'styles/site.css', 'body { margin: 0; }\n'),
      handled('styles/site.css', 'styles/site.css.map', '{}'),
      handled('notes.txt', 'notes.text', 'THE NOTES FILE.\n'),
      copy('extra/plain.html'),
      handled('_snippets/aside.txt', '_snippets/aside.text', 'THE ASIDE SNIPPET.\n'),
    ]);
  });
});
