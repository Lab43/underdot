// spec: q-docs/specs/svgo.md

import type { Config } from 'svgo';
import { describe, expect, test } from 'vitest';
import { optimizeSvg } from './optimize-svg.ts';

const config: Config = { multipass: true, plugins: ['preset-default'] };

// An icon as an editor exports it, with everything the preset removes or rewrites.
const icon = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generator: Sketch 3.0 -->',
  '<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" version="1.1">',
  '  <title>Mail</title>',
  '  <desc>Created with Sketch.</desc>',
  '  <g id="icon" stroke="none" fill="#000000">',
  '    <path d="M2,4 L22,4 L22,20 L2,20 Z" id="envelope"></path>',
  '  </g>',
  '</svg>',
  '',
].join('\n');

const optimizedIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><title>Mail</title><path d="M2 4h20v16H2Z"/></svg>';

const logo = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40">',
  '  <!-- The wordmark -->',
  '  <rect x="0" y="0" width="100" height="40" fill="#FF0000"/>',
  '</svg>',
  '',
].join('\n');

const optimizedLogo = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><path fill="red" d="M0 0h100v40H0z"/></svg>';

describe('optimizeSvg', () => {
  test('the icon is optimized at its own path, with svgo\'s output as it is', () => {
    expect(optimizeSvg({ outputPath: '_icons/mail.svg', contents: Buffer.from(icon) }, config)).toStrictEqual([
      { outputPath: '_icons/mail.svg', contents: optimizedIcon },
    ]);
  });

  test('the logo is optimized at its own path', () => {
    expect(optimizeSvg({ outputPath: 'images/logo.svg', contents: Buffer.from(logo) }, config)).toStrictEqual([
      { outputPath: 'images/logo.svg', contents: optimizedLogo },
    ]);
  });

  test('the plugin list decides what the output keeps', () => {
    const [output] = optimizeSvg(
      { outputPath: '_icons/mail.svg', contents: Buffer.from(icon) },
      { multipass: true, plugins: ['preset-default', 'removeDimensions'] },
    );
    expect(output!.contents).not.toContain('width');
    expect(output!.contents).not.toContain('height');
  });

  test("svgo's parser error names the file and the line", () => {
    const broken = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>');
    expect(() => optimizeSvg({ outputPath: '_icons/broken.svg', contents: broken }, config)).toThrow(
      '_icons/broken.svg:1:49: Unexpected close tag',
    );
  });
});
