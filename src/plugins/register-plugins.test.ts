// spec: docs/specs/plugins.md

import { describe, expect, test } from 'vitest';
import { renderBody as render } from '../../test/helpers/render-body.ts';
import { registerPlugins } from './register-plugins.ts';
import type { FileHandler, Helper, Plugin } from './register-plugins.ts';

const other = (body: string): string => body.toUpperCase();

const here: Helper = (context) => context.sourcePath;
const shout: Helper = (_context, word) => String(word).toUpperCase();

const keep: FileHandler = (file) => [file];
const drop: FileHandler = () => [];

const empty = { renderers: new Map(), helpers: new Map(), handlers: [] };

describe('registerPlugins', () => {
  test('no plugins yield an empty registry', () => {
    expect(registerPlugins([])).toStrictEqual(empty);
  });

  test('a plugin with neither renderers, helpers, nor handlers registers nothing', () => {
    expect(registerPlugins([{ name: 'quiet' }])).toStrictEqual(empty);
  });

  test("one plugin's renderers are keyed by extension under its name", () => {
    expect(registerPlugins([{ name: 'text', renderers: { md: render, txt: other } }])).toStrictEqual({
      ...empty,
      renderers: new Map([
        ['md', { pluginName: 'text', render }],
        ['txt', { pluginName: 'text', render: other }],
      ]),
    });
  });

  test('two plugins with distinct extensions both register', () => {
    const plugins: Plugin[] = [
      { name: 'markdown', renderers: { md: render } },
      { name: 'ejs', renderers: { ejs: other } },
    ];
    expect(registerPlugins(plugins)).toStrictEqual({
      ...empty,
      renderers: new Map([
        ['md', { pluginName: 'markdown', render }],
        ['ejs', { pluginName: 'ejs', render: other }],
      ]),
    });
  });

  test('two plugins with one name fail naming it', () => {
    expect(() => registerPlugins([{ name: 'dup' }, { name: 'dup' }])).toThrow(new Error('Two plugins are named dup.'));
  });

  test('two plugins registering one extension fail naming both and the extension', () => {
    const plugins: Plugin[] = [
      { name: 'first', renderers: { md: render } },
      { name: 'second', renderers: { md: other } },
    ];
    expect(() => registerPlugins(plugins)).toThrow(new Error('Both first and second register a renderer for md.'));
  });

  test('a renderers field that is not an object fails naming the plugin', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const plugin = { name: 'broken', renderers: null } as unknown as Plugin;
    expect(() => registerPlugins([plugin])).toThrow(new Error('The renderers of broken must be an object.'));
  });

  test('a renderer that is not a function fails naming the plugin and the extension', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
    const plugin = { name: 'broken', renderers: { md: 'render' } } as unknown as Plugin;
    expect(() => registerPlugins([plugin])).toThrow(
      new Error('The renderer broken registers for md is not a function.'),
    );
  });

  describe('helpers', () => {
    test("one plugin's helpers are keyed by name under its name, in the plugin's order", () => {
      expect(registerPlugins([{ name: 'tools', helpers: { shout, here } }])).toStrictEqual({
        ...empty,
        helpers: new Map([
          ['shout', { pluginName: 'tools', helper: shout }],
          ['here', { pluginName: 'tools', helper: here }],
        ]),
      });
    });

    test('a plugin with helpers and no renderers registers them', () => {
      expect(registerPlugins([{ name: 'tools', helpers: { here } }]).helpers).toStrictEqual(new Map([['here', { pluginName: 'tools', helper: here }]]));
    });

    test('a helpers field that is not an object fails naming the plugin', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
      const plugin = { name: 'broken', helpers: null } as unknown as Plugin;
      expect(() => registerPlugins([plugin])).toThrow(new Error('The helpers of broken must be an object.'));
    });

    test('a helper that is not a function fails naming the plugin and the helper', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
      const plugin = { name: 'broken', helpers: { here: 'here' } } as unknown as Plugin;
      expect(() => registerPlugins([plugin])).toThrow(new Error('The helper here of broken is not a function.'));
    });

    test('a helper name starting with an underscore fails', () => {
      expect(() => registerPlugins([{ name: 'tools', helpers: { _here: here } }])).toThrow(
        new Error('The helper _here of tools starts with an underscore, which is reserved.'),
      );
    });

    test('two plugins registering one helper name fail naming both', () => {
      const plugins: Plugin[] = [
        { name: 'first', helpers: { here } },
        { name: 'second', renderers: { md: render }, helpers: { here: shout } },
      ];
      expect(() => registerPlugins(plugins)).toThrow(new Error('Both first and second register a helper named here.'));
    });
  });

  describe('handlers', () => {
    test("one plugin's handlers are listed in key order under its name", () => {
      expect(registerPlugins([{ name: 'sass', handlers: { '**/*.scss': keep, '**/*.drop': drop } }])).toStrictEqual({
        ...empty,
        handlers: [
          { pluginName: 'sass', glob: '**/*.scss', handle: keep },
          { pluginName: 'sass', glob: '**/*.drop', handle: drop },
        ],
      });
    });

    test("two plugins' handlers follow plugin order, one glob registered twice included", () => {
      const plugins: Plugin[] = [
        { name: 'sass', renderers: { md: render }, handlers: { '**/*.css': keep } },
        { name: 'postcss', handlers: { '**/*.css': drop } },
      ];
      expect(registerPlugins(plugins).handlers).toStrictEqual([
        { pluginName: 'sass', glob: '**/*.css', handle: keep },
        { pluginName: 'postcss', glob: '**/*.css', handle: drop },
      ]);
    });

    test('a handlers field that is not an object fails naming the plugin', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
      const plugin = { name: 'broken', handlers: null } as unknown as Plugin;
      expect(() => registerPlugins([plugin])).toThrow(new Error('The handlers of broken must be an object.'));
    });

    test('a handler that is not a function fails naming the plugin and the glob', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the shape a JavaScript site can pass
      const plugin = { name: 'broken', handlers: { '**/*.css': 'handle' } } as unknown as Plugin;
      expect(() => registerPlugins([plugin])).toThrow(new Error('The handler broken registers for **/*.css is not a function.'));
    });
  });
});
