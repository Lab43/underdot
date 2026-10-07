// spec: docs/specs/dev-server.md, Live reload

import { describe, expect, test } from 'vitest';
import { injectClientScript } from './inject-client-script.ts';

describe('injectClientScript', () => {
  test('the script goes before the closing body tag', () => {
    expect(injectClientScript('<html><body><p>Hi</p></body></html>')).toMatch(
      /^<html><body><p>Hi<\/p><script>[\s\S]+<\/script><\/body><\/html>$/,
    );
  });

  test('the closing tag is matched without regard to case, and the last one is taken', () => {
    const injected = injectClientScript('<BODY>a</BODY>b</Body>');
    expect(injected).toMatch(/^<BODY>a<\/BODY>b<script>[\s\S]+<\/script><\/Body>$/);
  });

  test('a document without a body tag gets the script appended', () => {
    expect(injectClientScript('<p>Snippet</p>\n')).toMatch(/^<p>Snippet<\/p>\n<script>[\s\S]+<\/script>$/);
  });

  test('the script connects to the event stream and handles the three events', () => {
    const injected = injectClientScript('');
    expect(injected).toContain("new EventSource('/_underdot/events')");
    expect(injected).toContain("addEventListener('building'");
    expect(injected).toContain("addEventListener('failed'");
    expect(injected).toContain("addEventListener('built'");
    expect(injected).toContain('location.reload()');
  });
});
