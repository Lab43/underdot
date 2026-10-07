// spec: docs/specs/srcset.md

import { describe, expect, test } from 'vitest';
import { checkSizing } from './check-sizing.ts';

describe('checkSizing', () => {
  test.each([
    ['without webp', { sizes: '100vw', widths: [300, 600] }],
    ['with webp true', { sizes: '100vw', widths: [300], webp: true }],
    ['with webp false', { sizes: '100vw', widths: [300], webp: false }],
  ])('a sizing %s passes', (_name, sizing) => {
    expect(() => {
      checkSizing(sizing, 'The preset wide');
    }).not.toThrow();
  });

  test.each([
    ['null', null],
    ['an array', [300]],
    ['a string', 'wide'],
  ])('%s fails as not an object', (_name, sizing) => {
    expect(() => {
      checkSizing(sizing, 'The preset wide');
    }).toThrow(new Error('The preset wide must be an object.'));
  });

  test.each([
    ['missing', { widths: [300] }],
    ['a number', { sizes: 100, widths: [300] }],
  ])('sizes %s fails', (_name, sizing) => {
    expect(() => {
      checkSizing(sizing, 'The sizing passed to imageSet');
    }).toThrow(new Error('The sizing passed to imageSet needs sizes, a string.'));
  });

  test.each([
    ['missing', { sizes: '100vw' }],
    ['not a list', { sizes: '100vw', widths: 300 }],
    ['empty', { sizes: '100vw', widths: [] }],
    ['holding zero', { sizes: '100vw', widths: [0] }],
    ['holding a negative', { sizes: '100vw', widths: [-300] }],
    ['holding a fraction', { sizes: '100vw', widths: [300.5] }],
    ['holding a string', { sizes: '100vw', widths: ['300'] }],
  ])('widths %s fails', (_name, sizing) => {
    expect(() => {
      checkSizing(sizing, 'The preset wide');
    }).toThrow(new Error('The preset wide needs widths, a non-empty list of positive integers.'));
  });

  test('webp that is not a boolean fails', () => {
    expect(() => {
      checkSizing({ sizes: '100vw', widths: [300], webp: 'no' }, 'The preset wide');
    }).toThrow(new Error('The preset wide may only have webp true or false.'));
  });
});
