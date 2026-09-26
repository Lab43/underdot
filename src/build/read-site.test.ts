// spec: docs/specs/build.md, Order of work

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { readSite } from './read-site.ts';

const extensions = new Set(['tpl']);

describe('readSite', () => {
  test('the templated fixture yields its pages and templates in classification order, each with its contents', async () => {
    const source = join(fixturePath('templated'), 'source');
    const sourceFiles = classifySource(await walkSource(source), extensions);
    const site = await readSite(source, sourceFiles);

    assert.deepEqual(site.pages.map((page) => page.sourcePath), ['404.tpl', 'about.tpl', 'about/team.tpl', 'blog/hello.tpl', 'index.tpl']);
    assert.deepEqual(site.templates.map((template) => template.sourcePath), ['_.tpl', '_page.tpl', 'blog/_post.tpl']);
    assert.deepEqual(site.staticFiles, sourceFiles.staticFiles);

    const [notFound, about, , hello, home] = site.pages;
    assert.deepEqual(home, {
      ...sourceFiles.pages[4],
      frontmatter: { title: 'Home', date: new Date('2024-01-02T00:00:00Z') },
      template: undefined,
      body: 'The home page.\n',
    });
    assert.deepEqual(hello, { ...sourceFiles.pages[3], frontmatter: { title: 'Hello' }, template: 'post', body: 'The hello post.\n' });
    assert.deepEqual(about, { ...sourceFiles.pages[1], frontmatter: {}, template: undefined, body: 'The about page.\n' });
    assert.equal(notFound?.body, 'The not-found page.\n');

    const [root, , post] = site.templates;
    assert.deepEqual(root, { ...sourceFiles.templates[0], frontmatter: { title: 'Site' }, template: undefined, body: 'The root template.\n' });
    assert.deepEqual(post?.frontmatter, { layout: 'post' });
  });

  // spec: docs/specs/templates.md
  test("a frontmatter error names the file ahead of the parser's message", async () => {
    const source = join(fixturePath('bad-frontmatter'), 'source');
    const sourceFiles = classifySource(['index.tpl'], extensions);
    await assert.rejects(readSite(source, sourceFiles), {
      message: 'index.tpl: The frontmatter key _title starts with an underscore, which is reserved.',
    });
  });
});
