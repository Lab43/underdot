// spec: docs/specs/plugins.md

import { describe, expect, test } from 'vitest';
import { registerPlugins } from './register-plugins.ts';
import type { Plugin } from './register-plugins.ts';

const render = (body: string): string => body;
const other = (body: string): string => body.toUpperCase();

describe('registerPlugins', () => {
  test('no plugins yield an empty registry', () => {
    expect(registerPlugins([])).toStrictEqual({ renderers: new Map() });
  });

  test('a plugin with no renderers registers nothing', () => {
    expect(registerPlugins([{ name: 'quiet' }])).toStrictEqual({ renderers: new Map() });
  });

  test("one plugin's renderers are keyed by extension under its name", () => {
    expect(registerPlugins([{ name: 'text', renderers: { md: render, txt: other } }])).toStrictEqual({
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
});
