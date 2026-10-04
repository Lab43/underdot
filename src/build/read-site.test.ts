// spec: docs/specs/build.md, Order of work

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { renderBody } from '../../test/helpers/render-body.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { readSite } from './read-site.ts';

const renderers = new Map([['tpl', { render: renderBody }]]);

describe('readSite', () => {
  test('the templated fixture yields its pages and templates in classification order, each with its contents', async () => {
    const source = join(fixturePath('templated'), 'source');
    const sourceFiles = classifySource(await walkSource(source), renderers);
    const site = await readSite(source, sourceFiles.pages, sourceFiles.templates);

    expect(site.pages.map((page) => page.sourcePath)).toStrictEqual(['404.tpl', 'about.tpl', 'about/team.tpl', 'blog/hello.tpl', 'blog/index.tpl', 'index.tpl']);
    expect(site.templates.map((template) => template.sourcePath)).toStrictEqual(['_.tpl', '_page.tpl', 'blog/_.tpl', 'blog/_archive.tpl', 'blog/_post.tpl']);

    const [notFound, about, , hello, , home] = site.pages;
    expect(home).toStrictEqual({
      ...sourceFiles.pages[5],
      frontmatter: { title: 'Home', date: new Date('2024-01-02T00:00:00Z') },
      template: undefined,
      body: 'The home page: date {{ date }}.\n',
    });
    expect(hello).toStrictEqual({ ...sourceFiles.pages[3], frontmatter: { title: 'Hello' }, template: 'post', body: 'The hello post: layout {{ layout }}.\n' });
    expect(about).toStrictEqual({ ...sourceFiles.pages[1], frontmatter: {}, template: undefined, body: 'The about page: title {{ title }}.\nThe about include: [{{> missing.txt }}]\n' });
    expect(notFound?.body).toBe('The not-found page: url {{ _url }}.\n');

    const [root, , , , post] = site.templates;
    expect(root).toStrictEqual({
      ...sourceFiles.templates[0],
      frontmatter: { title: 'Site' },
      template: undefined,
      body: 'The root template: title {{ title }}, siteName {{ siteName }}, year {{ site.year }}, url {{ _url }}, chain {{ _chain }}.\nThe root include: {{> _partial.txt }}\n{{ _content }}\n',
    });
    expect(post?.frontmatter).toStrictEqual({ layout: 'post' });
  });

  // spec: docs/specs/templates.md
  test("a frontmatter error names the file ahead of the parser's message", async () => {
    const source = join(fixturePath('bad-frontmatter'), 'source');
    const { pages, templates } = classifySource(['index.tpl'], renderers);
    await expect(readSite(source, pages, templates)).rejects.toThrow(
      new Error('index.tpl: The frontmatter key _title starts with an underscore, which is reserved.'),
    );
  });
});
