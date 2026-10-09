// spec: q-docs/specs/sass.md

import { describe, expect, test } from 'vitest';
import { sass } from './index.ts';

describe('sass', () => {
  test('the plugin is named sass and registers a handler for every SCSS file', () => {
    expect(sass()).toStrictEqual({ name: 'sass', handlers: { '**/*.scss': expect.any(Function) } });
  });
});
