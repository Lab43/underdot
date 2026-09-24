// spec: docs/specs/configuration.md

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveConfiguration } from './resolve-configuration.ts';

const project = '/site';

describe('resolveConfiguration', () => {
  test('an empty configuration resolves to the defaults', () => {
    assert.deepEqual(resolveConfiguration({}, project), {
      projectDirectory: project,
      source: '/site/source',
      destination: '/site/build',
      exclude: ['**/.DS_Store'],
    });
  });

  test('each setting flows through, resolved against the project directory', () => {
    assert.deepEqual(resolveConfiguration({
      source: 'content',
      destination: 'out/site',
      exclude: ['**/*.draft'],
    }, project), {
      projectDirectory: project,
      source: '/site/content',
      destination: '/site/out/site',
      exclude: ['**/*.draft'],
    });
  });

  test('an absolute path stands as given', () => {
    const resolved = resolveConfiguration({ source: '/elsewhere/content', destination: '/site/build' }, project);
    assert.equal(resolved.source, '/elsewhere/content');
    assert.equal(resolved.destination, '/site/build');
  });

  test('a setting given as undefined is absent', () => {
    const resolved = resolveConfiguration({ source: undefined, destination: undefined, exclude: undefined }, project);
    assert.deepEqual(resolved, resolveConfiguration({}, project));
  });

  test("a site's exclude list replaces the default", () => {
    assert.deepEqual(resolveConfiguration({ exclude: ['**/*.tmp'] }, project).exclude, ['**/*.tmp']);
  });

  describe('a configuration that is not an object', () => {
    for (const [name, value] of [
      ['undefined', undefined],
      ['null', null],
      ['an array', []],
      ['a string', 'source'],
    ] as const) {
      test(`${name} is rejected`, () => {
        assert.throws(() => resolveConfiguration(value, project), {
          message: 'The configuration must be an object.',
        });
      });
    }
  });

  describe('unknown settings', () => {
    test('one unknown setting is named', () => {
      assert.throws(() => resolveConfiguration({ sources: 'content' }, project), {
        message: 'Unknown setting: sources.',
      });
    });

    test('two unknown settings are both named in one error', () => {
      assert.throws(() => resolveConfiguration({ sources: 'content', out: 'build' }, project), {
        message: 'Unknown settings: sources, out.',
      });
    });
  });

  describe('a setting of the wrong shape', () => {
    test('source must be a string', () => {
      assert.throws(() => resolveConfiguration({ source: ['content'] }, project), {
        message: 'The source setting must be a string.',
      });
    });

    test('destination must be a string', () => {
      assert.throws(() => resolveConfiguration({ destination: 42 }, project), {
        message: 'The destination setting must be a string.',
      });
    });

    test('exclude must be an array', () => {
      assert.throws(() => resolveConfiguration({ exclude: '**/.DS_Store' }, project), {
        message: 'The exclude setting must be an array of strings.',
      });
    });

    test('exclude must hold only strings', () => {
      assert.throws(() => resolveConfiguration({ exclude: ['**/.DS_Store', /tmp/] }, project), {
        message: 'The exclude setting must be an array of strings.',
      });
    });
  });

  describe('placement', () => {
    // spec: docs/specs/build.md
    test('the destination may not be the project directory', () => {
      assert.throws(() => resolveConfiguration({ destination: '.' }, project), {
        message: 'The destination /site must be inside the project directory /site.',
      });
    });

    test('the destination may not be outside the project directory', () => {
      assert.throws(() => resolveConfiguration({ destination: '../build' }, project), {
        message: 'The destination /build must be inside the project directory /site.',
      });
    });

    test('the destination may not be the parent of the project directory', () => {
      assert.throws(() => resolveConfiguration({ destination: '..' }, project), {
        message: 'The destination / must be inside the project directory /site.',
      });
    });

    test('an absolute destination outside the project directory is outside it', () => {
      assert.throws(() => resolveConfiguration({ destination: '/elsewhere/build' }, project), {
        message: 'The destination /elsewhere/build must be inside the project directory /site.',
      });
    });

    test('a directory inside the project directory whose name starts with two dots is inside it', () => {
      assert.equal(resolveConfiguration({ destination: '..site' }, project).destination, '/site/..site');
    });

    test('the destination may not be the source root', () => {
      assert.throws(() => resolveConfiguration({ source: 'www', destination: 'www' }, project), {
        message: 'The destination and the source root must differ, but both are /site/www.',
      });
    });

    test('the destination may not be inside the source root', () => {
      assert.throws(() => resolveConfiguration({ destination: 'source/build' }, project), {
        message: 'The destination /site/source/build must not be inside the source root /site/source.',
      });
    });

    test('the source root may not be inside the destination', () => {
      assert.throws(() => resolveConfiguration({ source: 'build/source' }, project), {
        message: 'The source root /site/build/source must not be inside the destination /site/build.',
      });
    });
  });
});
