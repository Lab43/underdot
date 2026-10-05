// spec: docs/specs/helpers.md

import type { RenderContext } from 'underdot';
import { describe, expect, test } from 'vitest';
import { renderActiveLink } from './render-active-link.ts';

// The context as the spec defines it to a helper: the page's URL among the
// variables, and operations the helper never reaches.
const makeContext = (url: string): RenderContext => {
  const context: RenderContext = {
    sourcePath: '_.ejs',
    variables: { _url: url },
    readFile: () => undefined,
    readOutput: () => undefined,
    readBody: () => '',
    enterFile: () => context,
  };
  return context;
};

describe('renderActiveLink', () => {
  test('the link to the page being rendered is active', () => {
    expect(renderActiveLink(makeContext('/'), '/', 'Home')).toBe('<a href="/" class="active">Home</a>');
  });

  test('the class is appended to the class given', () => {
    expect(renderActiveLink(makeContext('/blog/'), '/blog/', 'Blog', { class: 'nav' })).toBe('<a href="/blog/" class="nav active">Blog</a>');
  });

  test('a link to an ancestor of the page is parent', () => {
    expect(renderActiveLink(makeContext('/blog/hello/'), '/blog/', 'Blog', { class: 'nav' })).toBe('<a href="/blog/" class="nav parent">Blog</a>');
  });

  test('the home link is never parent', () => {
    expect(renderActiveLink(makeContext('/blog/hello/'), '/', 'Home')).toBe('<a href="/">Home</a>');
  });

  test('a link to another page gets no class', () => {
    expect(renderActiveLink(makeContext('/about/'), '/blog/', 'Blog')).toBe('<a href="/blog/">Blog</a>');
  });

  test('the 404 page is active for its own link', () => {
    expect(renderActiveLink(makeContext('/404.html'), '/404.html', 'Missing')).toBe('<a href="/404.html" class="active">Missing</a>');
  });

  test('a wrapper carries the attributes and the anchor carries href alone', () => {
    expect(renderActiveLink(makeContext('/blog/'), '/blog/', 'Blog', { class: 'nav' }, 'li')).toBe('<li class="nav active"><a href="/blog/">Blog</a></li>');
  });

  test('attributes render in the order given, with class last when none was given', () => {
    expect(renderActiveLink(makeContext('/about/'), '/about/', 'About', { id: 'about', title: 'About us' }))
      .toBe('<a href="/about/" id="about" title="About us" class="active">About</a>');
  });

  test('a class given stays in its place', () => {
    expect(renderActiveLink(makeContext('/about/'), '/about/', 'About', { class: 'nav', id: 'about' }))
      .toBe('<a href="/about/" class="nav active" id="about">About</a>');
  });

  test('an empty class takes the class as its value', () => {
    expect(renderActiveLink(makeContext('/about/'), '/about/', 'About', { class: '' })).toBe('<a href="/about/" class="active">About</a>');
  });

  test('attribute values are escaped', () => {
    expect(renderActiveLink(makeContext('/'), '/about/', 'About', { title: 'Say "hi" & <wave>' }))
      .toBe('<a href="/about/" title="Say &quot;hi&quot; &amp; &lt;wave&gt;">About</a>');
  });

  test('the href is escaped in the markup and compared as written', () => {
    expect(renderActiveLink(makeContext('/search/?a=1&b=2'), '/search/?a=1&b=2', 'Search'))
      .toBe('<a href="/search/?a=1&amp;b=2" class="active">Search</a>');
  });

  test('the title is printed as given', () => {
    expect(renderActiveLink(makeContext('/'), '/', '<b>Home</b>')).toBe('<a href="/" class="active"><b>Home</b></a>');
  });

  test('the attributes given are left as they were', () => {
    const attributes = { class: 'nav' };
    renderActiveLink(makeContext('/blog/'), '/blog/', 'Blog', attributes);
    expect(attributes).toStrictEqual({ class: 'nav' });
  });

  test.each<[unknown[], string]>([
    [[42, 'Home'], 'The href must be a string, and 42 is not.'],
    [['', 'Home'], 'The href must not be empty.'],
    [['/', undefined], 'The title must be a string, and undefined is not.'],
    [['/', 'Home', 'nav'], 'The attributes must be an object, and nav is not.'],
    [['/', 'Home', null], 'The attributes must be an object, and null is not.'],
    [['/', 'Home', []], 'The attributes must be an object, and  is not.'],
    [['/', 'Home', { href: '/x' }], 'The attributes must not carry href, which the link already has.'],
    [['/', 'Home', { id: 1 }], 'The attribute id must be a string, and 1 is not.'],
    [['/', 'Home', {}, 42], 'The wrapper must be a string, and 42 is not.'],
    [['/', 'Home', {}, ''], 'The wrapper must not be empty.'],
  ])('the arguments %j fail: %s', ([href, title, attributes, wrapper], message) => {
    expect(() => renderActiveLink(makeContext('/'), href, title, attributes, wrapper)).toThrow(new Error(message));
  });
});
