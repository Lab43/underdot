// spec: docs/specs/build.md, Order of work

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
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

    expect(site.pages.map((page) => page.sourcePath)).toStrictEqual(['404.tpl', 'about.tpl', 'about/team.tpl', 'blog/hello.tpl', 'index.tpl']);
    expect(site.templates.map((template) => template.sourcePath)).toStrictEqual(['_.tpl', '_page.tpl', 'blog/_post.tpl']);
    expect(site.staticFiles).toStrictEqual(sourceFiles.staticFiles);

    const [notFound, about, , hello, home] = site.pages;
    expect(home).toStrictEqual({
      ...sourceFiles.pages[4],
      frontmatter: { title: 'Home', date: new Date('2024-01-02T00:00:00Z') },
      template: undefined,
      body: 'The home page.\n',
    });
    expect(hello).toStrictEqual({ ...sourceFiles.pages[3], frontmatter: { title: 'Hello' }, template: 'post', body: 'The hello post.\n' });
    expect(about).toStrictEqual({ ...sourceFiles.pages[1], frontmatter: {}, template: undefined, body: 'The about page.\n' });
    expect(notFound?.body).toBe('The not-found page.\n');

    const [root, , post] = site.templates;
    expect(root).toStrictEqual({ ...sourceFiles.templates[0], frontmatter: { title: 'Site' }, template: undefined, body: 'The root template.\n' });
    expect(post?.frontmatter).toStrictEqual({ layout: 'post' });
  });

  // spec: docs/specs/templates.md
  test("a frontmatter error names the file ahead of the parser's message", async () => {
    const source = join(fixturePath('bad-frontmatter'), 'source');
    const sourceFiles = classifySource(['index.tpl'], extensions);
    await expect(readSite(source, sourceFiles)).rejects.toThrow(
      new Error('index.tpl: The frontmatter key _title starts with an underscore, which is reserved.'),
    );
  });
});
