// spec: docs/specs/sass.md

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileStringAsync } from 'sass';
import type { SourceSpan } from 'sass';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../../test/helpers/fixture-path.ts';
import { makeHandlerContext } from '../../../test/helpers/make-handler-context.ts';
import { test } from '../../../test/helpers/test.ts';
import { compileSass } from './compile-sass.ts';

vi.mock('sass', { spy: true });

const sourceDirectory = join(fixturePath('sass'), 'source');

// The text as a file at the output path given.
const file = (outputPath: string, text: string) => ({ outputPath, contents: Buffer.from(text) });

describe('compileSass', () => {
  test.override({ fixture: 'sass' });

  test('a partial compiles to nothing', async () => {
    await expect(compileSass(file('styles/_vars.scss', '$accent: red;\n'), makeHandlerContext({ sourceDirectory }))).resolves.toStrictEqual([]);
  });

  test('a stylesheet compiles to CSS beside itself, as Sass writes it, with every file it loaded declared', async () => {
    const declareFile = vi.fn();
    const text = await readFile(join(sourceDirectory, 'styles/site.scss'), 'utf8');
    const [output] = await compileSass(file('styles/site.scss', text), makeHandlerContext({ sourceDirectory, declareFile }));
    expect(output).toStrictEqual({
      outputPath: 'styles/site.css',
      contents: '.button {\n  background: #c0392b;\n}\n\nbody {\n  color: #c0392b;\n}\n\n.page {\n  margin-left: auto;\n  margin-right: auto;\n  max-width: 40rem;\n}',
    });
    // A relative import, an import through the source root, and a directory's index.
    expect(declareFile.mock.calls).toStrictEqual([['styles/_vars.scss'], ['_sass/_mixins.scss'], ['styles/parts/_index.scss']]);
  });

  test('an import from outside the source root fails as the declare fails', async () => {
    const declareFile = vi.fn(() => {
      throw new Error('outside');
    });
    await expect(compileSass(file('styles/site.scss', "@use '../../outside';\n"), makeHandlerContext({ sourceDirectory, declareFile }))).rejects.toThrow(new Error('outside'));
    expect(declareFile).toHaveBeenCalledExactlyOnceWith('../outside.scss');
  });

  test('the stylesheet itself is never declared, so one at a path the build does not see compiles', async () => {
    await expect(compileSass(file('renamed/site.scss', 'a {\n  color: red;\n}\n'), makeHandlerContext({ sourceDirectory }))).resolves.toStrictEqual([
      { outputPath: 'renamed/site.css', contents: 'a {\n  color: red;\n}' },
    ]);
  });

  test("a syntax error propagates with Sass's report", async () => {
    await expect(compileSass(file('styles/site.scss', 'a {\n'), makeHandlerContext({ sourceDirectory }))).rejects.toThrow(/^expected end of rule\.\n[\s\S]*site\.scss 1:4 {2}root stylesheet$/);
  });

  describe('warnings, named relative to the working directory', () => {
    // The text compiled at styles/site.scss in the copy, with every warning it gave.
    const compileWarning = async (workingDirectory: string, text: string): Promise<string[]> => {
      const warn = vi.fn<(message: string) => void>();
      const context = makeHandlerContext({ sourceDirectory: join(workingDirectory, 'source'), declareFile: vi.fn(), warn });
      await compileSass(file('styles/site.scss', text), context);
      return warn.mock.calls.map(([message]) => message);
    };

    test('@warn reaches the build with its stack below it', async ({ workingDirectory }) => {
      await expect(compileWarning(workingDirectory, '@warn "Mind the gap.";\n')).resolves.toStrictEqual([
        'Mind the gap.\nsource/styles/site.scss 1:1  root stylesheet',
      ]);
    });

    test("a deprecation reaches the build with Sass's notice and its stack", async ({ workingDirectory }) => {
      await expect(compileWarning(workingDirectory, "@import 'vars';\n")).resolves.toStrictEqual([
        [
          'Sass @import rules are deprecated and will be removed in Dart Sass 3.0.0.',
          '',
          'More info and automated migrator: https://sass-lang.com/d/import',
          'source/styles/site.scss 1:9  root stylesheet',
        ].join('\n'),
      ]);
    });

    test('@debug reaches the build with its location below it', async ({ workingDirectory }) => {
      await expect(compileWarning(workingDirectory, 'a {\n  @debug "here";\n}\n')).resolves.toStrictEqual(['here\nsource/styles/site.scss 2:3']);
    });

    // Sass gives both only outside a stylesheet compiled from a URL.
    test('a warning with no stack is the message alone, and a debug with no URL names the stylesheet', async ({ workingDirectory }) => {
      vi.mocked(compileStringAsync).mockImplementationOnce((_text, options) => {
        options?.logger?.warn?.('Bare.', { deprecation: false });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the fields the logger reads
        const span = { url: undefined, start: { line: 0, column: 4 } } as unknown as SourceSpan;
        options?.logger?.debug?.('Unplaced.', { span });
        return Promise.resolve({ css: '', loadedUrls: [] });
      });
      await expect(compileWarning(workingDirectory, '')).resolves.toStrictEqual(['Bare.', 'Unplaced.\nsource/styles/site.scss 1:5']);
    });
  });
});
