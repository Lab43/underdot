// spec: q-docs/specs/helpers.md

import type { RenderContext } from 'underdot';

/**
 * A navigation link as markup, with the class `active` when it points at the
 * page being rendered and `parent` when it points at an ancestor of it.
 */
export const renderActiveLink = (context: RenderContext, href: unknown, title: unknown, attributes: unknown = {}, wrapper?: unknown): string => {
  if (typeof href !== 'string') {
    throw new Error(`The href must be a string, and ${String(href)} is not.`);
  }
  if (href === '') {
    throw new Error('The href must not be empty.');
  }
  if (typeof title !== 'string') {
    throw new Error(`The title must be a string, and ${String(title)} is not.`);
  }
  if (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes)) {
    throw new Error(`The attributes must be an object, and ${String(attributes)} is not.`);
  }
  if (Object.hasOwn(attributes, 'href')) {
    throw new Error('The attributes must not carry href, which the link already has.');
  }
  const given: [string, unknown][] = Object.entries(attributes);
  for (const [name, value] of given) {
    if (typeof value !== 'string') {
      throw new Error(`The attribute ${name} must be a string, and ${String(value)} is not.`);
    }
  }
  if (wrapper !== undefined && typeof wrapper !== 'string') {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- narrowed past unknown by the undefined check; print the value as the other checks do
    throw new Error(`The wrapper must be a string, and ${String(wrapper)} is not.`);
  }
  if (wrapper === '') {
    throw new Error('The wrapper must not be empty.');
  }

  // A page is active for its own link alone, and `/` is never a parent, since
  // every URL starts with it.
  const url = String(context.variables._url);
  let className: string | undefined;
  if (url === href) {
    className = 'active';
  } else if (href !== '/' && url.startsWith(href)) {
    className = 'parent';
  }

  // A copy, so the caller's object is left as it was.
  const rendered = new Map<string, string>();
  for (const [name, value] of given) {
    rendered.set(name, String(value));
  }
  if (className !== undefined) {
    const existing = rendered.get('class');
    rendered.set('class', existing === undefined || existing === '' ? className : `${existing} ${className}`);
  }

  // Keep in sync with the escape in plugins/srcset/src/render-image-set.ts.
  const escape = (value: string): string =>
    value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const renderedAttributes = [...rendered].map(([name, value]) => ` ${name}="${escape(value)}"`).join('');
  const anchorHref = `href="${escape(href)}"`;
  if (wrapper === undefined) {
    return `<a ${anchorHref}${renderedAttributes}>${title}</a>`;
  }
  return `<${wrapper}${renderedAttributes}><a ${anchorHref}>${title}</a></${wrapper}>`;
};
