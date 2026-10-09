// spec: q-docs/specs/build.md, Order of work

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { fixturePath } from '../../test/helpers/fixture-path.ts';
import { makeReporter } from '../../test/helpers/make-reporter.ts';
import { renderBody } from '../../test/helpers/render-body.ts';
import type { Helper } from '../plugins/register-plugins.ts';
import { classifySource } from '../source-tree/classify-source.ts';
import { walkSource } from '../source-tree/walk-source.ts';
import { hashFiles } from './hash-files.ts';
import type { FileTable } from './hash-files.ts';
import { readSite } from './read-site.ts';
import type { FileContents } from './read-site.ts';
import type { UnitRecords } from './reuse-unit.ts';

vi.mock('node:fs/promises', { spy: true });

const renderers = new Map([['tpl', { pluginName: 'fixture', render: renderBody }]]);
const none = new Map<string, { pluginName: string; helper: Helper }>();
const here: Helper = (context) => context.sourcePath;

// A table with no entries, for a call whose reads are not reused.
const unhashed: FileTable = new Map();

describe('readSite', () => {
  test('the templated fixture yields its pages and templates in classification order, each with its contents', async () => {
    const source = join(fixturePath('templated'), 'source');
    const sourceFiles = classifySource(await walkSource(source), renderers);
    const site = await readSite(source, sourceFiles.pages, sourceFiles.templates, none, unhashed, new Map(), makeReporter());

    expect(site.pages.map((page) => page.sourcePath)).toStrictEqual(['404.tpl', 'about.tpl', 'about/team.tpl', 'blog/hello.tpl', 'blog/index.tpl', 'index.tpl', 'pages.tpl']);
    expect(site.templates.map((template) => template.sourcePath)).toStrictEqual(['_.tpl', '_page.tpl', 'blog/_.tpl', 'blog/_archive.tpl', 'blog/_post.tpl']);

    const [notFound, about, , hello, , home] = site.pages;
    expect(home).toStrictEqual({
      ...sourceFiles.pages[5],
      frontmatter: { title: 'Home', date: new Date('2024-01-02T00:00:00Z') },
      template: undefined,
      body: 'The home page: date {{ date }}.\n',
    });
    expect(hello).toStrictEqual({ ...sourceFiles.pages[3], frontmatter: { title: 'Hello' }, template: 'post', body: 'The hello post: layout {{ layout }}.\n' });
    expect(about).toStrictEqual({ ...sourceFiles.pages[1], frontmatter: {}, template: undefined, body: 'The about page: title {{ title }}, here {{ here }}.\nThe about include: [{{> missing.txt }}]\nThe about output: {{ handled /extra/plain.html }}\nThe about derived: {{ derived /notes.text txt }} {{ derived /notes.text text }}\n' });
    expect(notFound?.body).toBe('The not-found page: url {{ _url }}.\nThe not-found derived: {{ derived /notes.text txt }}\n');

    const [root, , , , post] = site.templates;
    expect(root).toStrictEqual({
      ...sourceFiles.templates[0],
      frontmatter: { title: 'Site' },
      template: undefined,
      body: 'The root template: title {{ title }}, siteName {{ siteName }}, year {{ site.year }}, url {{ _url }}, chain {{ _chain }}, here {{ here }}.\nThe root include: {{> _partial.txt }}\nThe root output: {{ handled _partial.text }}\n{{ _content }}\n',
    });
    expect(post?.frontmatter).toStrictEqual({ layout: 'post' });
  });

  // spec: q-docs/specs/templates.md
  test("a frontmatter error names the file ahead of the parser's message", async () => {
    const source = join(fixturePath('bad-frontmatter'), 'source');
    const { pages, templates } = classifySource(['index.tpl'], renderers);
    await expect(readSite(source, pages, templates, none, unhashed, new Map(), makeReporter())).rejects.toThrow(
      new Error('index.tpl: The frontmatter key _title starts with an underscore, which is reserved.'),
    );
  });

  // spec: q-docs/specs/plugins.md, Template helpers
  test("a frontmatter key sharing a helper's name fails naming the file and the plugin", async () => {
    const source = join(fixturePath('templated'), 'source');
    const { pages, templates } = classifySource(await walkSource(source), renderers);
    const helpers = new Map([['date', { pluginName: 'tools', helper: here }]]);
    await expect(readSite(source, pages, templates, helpers, unhashed, new Map(), makeReporter())).rejects.toThrow(new Error('Both index.tpl and the plugin tools define date.'));
  });

  // spec: q-docs/specs/build.md, Incremental builds
  test('two calls with one table read and parse each file once', async () => {
    const source = join(fixturePath('templated'), 'source');
    const paths = await walkSource(source);
    const { pages, templates } = classifySource(paths, renderers);
    const files = await hashFiles(source, paths, new Map());
    const records: UnitRecords<FileContents> = new Map();
    vi.mocked(readFile).mockClear();
    const first = await readSite(source, pages, templates, none, files, records, makeReporter());
    const second = await readSite(source, pages, templates, none, files, records, makeReporter());
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(pages.length + templates.length);
    expect(second).toStrictEqual(first);
  });

  test('a reused read still fails a frontmatter key sharing a helper\'s name', async () => {
    const source = join(fixturePath('templated'), 'source');
    const paths = await walkSource(source);
    const { pages, templates } = classifySource(paths, renderers);
    const files = await hashFiles(source, paths, new Map());
    const records: UnitRecords<FileContents> = new Map();
    await readSite(source, pages, templates, none, files, records, makeReporter());
    const helpers = new Map([['date', { pluginName: 'tools', helper: here }]]);
    await expect(readSite(source, pages, templates, helpers, files, records, makeReporter())).rejects.toThrow(new Error('Both index.tpl and the plugin tools define date.'));
  });

  // spec: q-docs/specs/build.md, Output
  test('a read reports its label', async () => {
    const source = join(fixturePath('templated'), 'source');
    const { pages } = classifySource(await walkSource(source), renderers);
    const reporter = makeReporter();
    await readSite(source, pages.filter(({ sourcePath }) => sourcePath === 'index.tpl'), [], none, unhashed, new Map(), reporter);
    expect(reporter.ran).toHaveBeenCalledExactlyOnceWith('Read index.tpl', []);
  });
});
