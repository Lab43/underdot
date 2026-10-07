// spec: docs/specs/configuration.md

import { describe, expect, test } from 'vitest';
import { resolveConfiguration } from './resolve-configuration.ts';

const project = '/site';

describe('resolveConfiguration', () => {
  test('an empty configuration resolves to the defaults', () => {
    expect(resolveConfiguration({}, project)).toStrictEqual({
      projectDirectory: project,
      source: '/site/source',
      destination: '/site/build',
      exclude: ['**/.DS_Store'],
      plugins: [],
      globals: {},
      rewrites: {},
    });
  });

  test('each setting flows through, resolved against the project directory', () => {
    expect(resolveConfiguration({
      source: 'content',
      destination: 'out/site',
      exclude: ['**/*.draft'],
      plugins: [{ name: 'first' }, { name: 'second' }],
      globals: { siteName: 'Site', team: ['Ada'] },
      rewrites: { '/cart': '/store/', '/cart/**': '/store/' },
    }, project)).toStrictEqual({
      projectDirectory: project,
      source: '/site/content',
      destination: '/site/out/site',
      exclude: ['**/*.draft'],
      plugins: [{ name: 'first' }, { name: 'second' }],
      globals: { siteName: 'Site', team: ['Ada'] },
      rewrites: { '/cart': '/store/', '/cart/**': '/store/' },
    });
  });

  test('rewrites keep their listed order', () => {
    const { rewrites } = resolveConfiguration({ rewrites: { '/z': '/a/', '/a': '/z/' } }, project);
    expect(Object.entries(rewrites)).toStrictEqual([['/z', '/a/'], ['/a', '/z/']]);
  });

  test('an absolute path stands as given', () => {
    const resolved = resolveConfiguration({ source: '/elsewhere/content', destination: '/site/build' }, project);
    expect(resolved.source).toBe('/elsewhere/content');
    expect(resolved.destination).toBe('/site/build');
  });

  test('a setting given as undefined is absent', () => {
    const resolved = resolveConfiguration({ source: undefined, destination: undefined, exclude: undefined, rewrites: undefined }, project);
    expect(resolved).toStrictEqual(resolveConfiguration({}, project));
  });

  test("a site's exclude list replaces the default", () => {
    expect(resolveConfiguration({ exclude: ['**/*.tmp'] }, project).exclude).toStrictEqual(['**/*.tmp']);
  });

  describe('a configuration that is not an object', () => {
    test.each([
      ['undefined', undefined],
      ['null', null],
      ['an array', []],
      ['a string', 'source'],
    ])('%s is rejected', (_name, value) => {
      expect(() => resolveConfiguration(value, project)).toThrow(new Error('The configuration must be an object.'));
    });
  });

  describe('unknown settings', () => {
    test('one unknown setting is named', () => {
      expect(() => resolveConfiguration({ sources: 'content' }, project)).toThrow(
        new Error('Unknown setting: sources.'),
      );
    });

    test('two unknown settings are both named in one error', () => {
      expect(() => resolveConfiguration({ sources: 'content', out: 'build' }, project)).toThrow(
        new Error('Unknown settings: sources, out.'),
      );
    });
  });

  describe('a setting of the wrong shape', () => {
    test('source must be a string', () => {
      expect(() => resolveConfiguration({ source: ['content'] }, project)).toThrow(
        new Error('The source setting must be a string.'),
      );
    });

    test('destination must be a string', () => {
      expect(() => resolveConfiguration({ destination: 42 }, project)).toThrow(
        new Error('The destination setting must be a string.'),
      );
    });

    test('exclude must be an array', () => {
      expect(() => resolveConfiguration({ exclude: '**/.DS_Store' }, project)).toThrow(
        new Error('The exclude setting must be an array of strings.'),
      );
    });

    test('exclude must hold only strings', () => {
      expect(() => resolveConfiguration({ exclude: ['**/.DS_Store', /tmp/] }, project)).toThrow(
        new Error('The exclude setting must be an array of strings.'),
      );
    });

    test('plugins must be an array', () => {
      expect(() => resolveConfiguration({ plugins: 'markdown' }, project)).toThrow(
        new Error('The plugins setting must be an array.'),
      );
    });

    test('a plugin with no name is rejected', () => {
      expect(() => resolveConfiguration({ plugins: [{ renderers: {} }] }, project)).toThrow(
        new Error('Each plugin must be an object with a name.'),
      );
    });

    test('a plugin given as a string is rejected', () => {
      expect(() => resolveConfiguration({ plugins: ['markdown'] }, project)).toThrow(
        new Error('Each plugin must be an object with a name.'),
      );
    });

    test('globals must be an object', () => {
      expect(() => resolveConfiguration({ globals: [['siteName', 'Site']] }, project)).toThrow(
        new Error('The globals setting must be an object.'),
      );
    });

    test('a global starting with an underscore is reserved', () => {
      expect(() => resolveConfiguration({ globals: { siteName: 'Site', _site: {} } }, project)).toThrow(
        new Error('The global _site starts with an underscore, which is reserved.'),
      );
    });

    // spec: docs/specs/configuration.md, Rewrites
    test('rewrites must be an object', () => {
      expect(() => resolveConfiguration({ rewrites: [['/cart', '/store/']] }, project)).toThrow(
        new Error('The rewrites setting must be an object.'),
      );
    });

    test('a rewrite must be a string', () => {
      expect(() => resolveConfiguration({ rewrites: { '/cart': ['/store/'] } }, project)).toThrow(
        new Error('The rewrite for /cart must be a string.'),
      );
    });

    test('a rewrite glob must start with a slash', () => {
      expect(() => resolveConfiguration({ rewrites: { 'cart/**': '/store/' } }, project)).toThrow(
        new Error('The rewrite glob cart/** must start with a slash.'),
      );
    });

    test('a rewrite path must start with a slash', () => {
      expect(() => resolveConfiguration({ rewrites: { '/cart': 'store/' } }, project)).toThrow(
        new Error('The rewrite path store/ for /cart must start with a slash.'),
      );
    });
  });

  // spec: docs/specs/build.md
  describe('placement', () => {
    test('the destination may not be the project directory', () => {
      expect(() => resolveConfiguration({ destination: '.' }, project)).toThrow(
        new Error('The destination /site must be inside the project directory /site.'),
      );
    });

    test('the destination may not be outside the project directory', () => {
      expect(() => resolveConfiguration({ destination: '../build' }, project)).toThrow(
        new Error('The destination /build must be inside the project directory /site.'),
      );
    });

    test('the destination may not be the parent of the project directory', () => {
      expect(() => resolveConfiguration({ destination: '..' }, project)).toThrow(
        new Error('The destination / must be inside the project directory /site.'),
      );
    });

    test('an absolute destination outside the project directory is outside it', () => {
      expect(() => resolveConfiguration({ destination: '/elsewhere/build' }, project)).toThrow(
        new Error('The destination /elsewhere/build must be inside the project directory /site.'),
      );
    });

    test('a directory inside the project directory whose name starts with two dots is inside it', () => {
      expect(resolveConfiguration({ destination: '..site' }, project).destination).toBe('/site/..site');
    });

    test('the destination may not be the source root', () => {
      expect(() => resolveConfiguration({ source: 'www', destination: 'www' }, project)).toThrow(
        new Error('The destination and the source root must differ, but both are /site/www.'),
      );
    });

    test('the destination may not be inside the source root', () => {
      expect(() => resolveConfiguration({ destination: 'source/build' }, project)).toThrow(
        new Error('The destination /site/source/build must not be inside the source root /site/source.'),
      );
    });

    test('the source root may not be inside the destination', () => {
      expect(() => resolveConfiguration({ source: 'build/source' }, project)).toThrow(
        new Error('The source root /site/build/source must not be inside the destination /site/build.'),
      );
    });
  });
});
