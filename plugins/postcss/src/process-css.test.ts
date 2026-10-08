// spec: docs/specs/postcss.md

import { realpath, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import createProcessor from 'postcss';
import type { AcceptedPlugin } from 'postcss';
import postcssImport from 'postcss-import';
import { describe, expect, vi } from 'vitest';
import { fixturePath } from '../../../test/helpers/fixture-path.ts';
import { makeHandlerContext } from '../../../test/helpers/make-handler-context.ts';
import { test } from '../../../test/helpers/test.ts';
import { processCss } from './process-css.ts';

const sourceDirectory = join(fixturePath('postcss'), 'source');

// The text as a file at the output path given.
const file = (outputPath: string, text: string) => ({ outputPath, contents: Buffer.from(text) });

// A plugin that adds the message given to the result.
const report = (message: Record<string, unknown>): AcceptedPlugin => ({
  postcssPlugin: 'report',
  Once: (_root, { result }) => {
    result.messages.push({ type: 'unknown', ...message });
  },
});

describe('processCss', () => {
  test('the CSS is returned at its own output path, as the plugins left it', async () => {
    const uppercase: AcceptedPlugin = {
      postcssPlugin: 'uppercase',
      Declaration: (declaration) => {
        declaration.value = declaration.value.toUpperCase();
      },
    };
    await expect(processCss(file('styles/print.css', 'a {\n  color: red;\n}\n'), makeHandlerContext({ sourceDirectory }), createProcessor([uppercase]))).resolves.toStrictEqual([
      { outputPath: 'styles/print.css', contents: 'a {\n  color: RED;\n}\n' },
    ]);
  });

  test('PostCSS is given the file at its output path under the source root on disk, as both from and to, with no source map', async () => {
    const options = vi.fn();
    const capture: AcceptedPlugin = {
      postcssPlugin: 'capture',
      Once: (_root, { result }) => {
        options(result.opts);
      },
    };
    const [output] = await processCss(file('styles/print.css', 'a {}\n'), makeHandlerContext({ sourceDirectory }), createProcessor([capture]));
    const absolutePath = join(sourceDirectory, 'styles/print.css');
    expect(options).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ from: absolutePath, to: absolutePath, map: false }));
    expect(output!.contents).toBe('a {}\n');
  });

  test('a dependency message is declared by its posix path under the source root', async () => {
    const declareFile = vi.fn();
    const processor = createProcessor([report({ type: 'dependency', file: join(sourceDirectory, 'styles/parts/_base.css') })]);
    await processCss(file('styles/print.css', ''), makeHandlerContext({ sourceDirectory, declareFile }), processor);
    expect(declareFile).toHaveBeenCalledExactlyOnceWith('styles/parts/_base.css');
  });

  describe('with the source root behind a symlink', () => {
    test.override({ fixture: 'postcss' });

    test('a dependency reported by its real path is declared under the source root', async ({ directory }) => {
      const linkedSourceDirectory = join(directory, 'linked');
      await symlink(join(directory, 'source'), linkedSourceDirectory);
      const declareFile = vi.fn();
      const realBase = await realpath(join(directory, 'source/styles/parts/_base.css'));
      const processor = createProcessor([report({ type: 'dependency', file: realBase })]);
      await processCss(file('styles/print.css', ''), makeHandlerContext({ sourceDirectory: linkedSourceDirectory, declareFile }), processor);
      expect(declareFile).toHaveBeenCalledExactlyOnceWith('styles/parts/_base.css');
    });
  });

  test('a declare that fails fails the file', async () => {
    const declareFile = vi.fn(() => {
      throw new Error('outside');
    });
    const processor = createProcessor([report({ type: 'dependency', file: join(sourceDirectory, '../outside.css') })]);
    await expect(processCss(file('styles/print.css', ''), makeHandlerContext({ sourceDirectory, declareFile }), processor)).rejects.toThrow(new Error('outside'));
    expect(declareFile).toHaveBeenCalledExactlyOnceWith('../outside.css');
  });

  test('a directory dependency fails', async () => {
    const processor = createProcessor([report({ type: 'dir-dependency', dir: '/site/templates', glob: '**/*.html' })]);
    await expect(processCss(file('styles/print.css', ''), makeHandlerContext({ sourceDirectory }), processor)).rejects.toThrow(
      new Error('PostCSS reports a dependency on the directory /site/templates, which the build cannot track.'),
    );
  });

  test('a message of another type is ignored', async () => {
    const processor = createProcessor([report({ type: 'asset', file: '/elsewhere/logo.png' })]);
    await expect(processCss(file('styles/print.css', ''), makeHandlerContext({ sourceDirectory }), processor)).resolves.toStrictEqual([
      { outputPath: 'styles/print.css', contents: '' },
    ]);
  });

  test('each warning reaches the build as PostCSS writes it', async () => {
    const warn = vi.fn();
    const caution: AcceptedPlugin = {
      postcssPlugin: 'caution',
      Rule: (rule, { result }) => {
        result.warn(`careful with ${rule.selector}`, { node: rule });
      },
    };
    await processCss(file('styles/print.css', 'a {}\nb {}\n'), makeHandlerContext({ sourceDirectory, warn }), createProcessor([caution]));
    const absolutePath = join(sourceDirectory, 'styles/print.css');
    expect(warn.mock.calls).toStrictEqual([[`caution: ${absolutePath}:1:1: careful with a`], [`caution: ${absolutePath}:2:1: careful with b`]]);
  });

  test("a syntax error propagates with PostCSS's report", async () => {
    const absolutePath = join(sourceDirectory, 'styles/print.css');
    await expect(processCss(file('styles/print.css', 'a {\n'), makeHandlerContext({ sourceDirectory }), createProcessor([{ postcssPlugin: 'noop' }]))).rejects.toThrow(
      `${absolutePath}:1:1: Unclosed block`,
    );
  });

  test("postcss-import inlines a relative import from the stylesheet's directory and declares the file", async () => {
    const declareFile = vi.fn();
    const [output] = await processCss(file('styles/print.css', '@import "parts/_base.css";\n'), makeHandlerContext({ sourceDirectory, declareFile }), createProcessor([postcssImport()]));
    expect(output!.contents).toBe('body {\n  font-size: 12pt;\n}\n');
    expect(declareFile).toHaveBeenCalledExactlyOnceWith('styles/parts/_base.css');
  });
});
