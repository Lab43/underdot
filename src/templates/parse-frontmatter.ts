// spec: q-docs/specs/templates.md

import { CORE_SCHEMA, loadAll, timestampTag, YAMLException } from 'js-yaml';

export interface Frontmatter {
  keys: Record<string, unknown>;
  template: string | undefined;
  body: string;
}

// The core schema, with unquoted dates read as dates.
const schema = CORE_SCHEMA.withTags(timestampTag);

const isDelimiter = (line: string): boolean => line.replace(/\r$/, '') === '---';

// A YAML mapping parses to a plain object. A date parses to a Date, which is
// an object too, so the prototype is what tells them apart.
const isMapping = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

// Parse the block's YAML into its one document, an empty block giving none.
// The parser counts lines from the block, so the file's line is two more.
const parseBlock = (lines: string[]): unknown => {
  try {
    return loadAll(lines.join('\n'), { schema })[0];
  } catch (error) {
    // On malformed YAML the parser throws only its own exception, with a mark.
    if (!(error instanceof YAMLException) || error.mark === undefined) {
      throw error;
    }
    const line = String(error.mark.line + 2);
    throw new Error(`The frontmatter is not valid YAML: ${error.reason} (line ${line}).`, { cause: error });
  }
};

/**
 * Split a page or template into its frontmatter and its body.
 */
export const parseFrontmatter = (text: string): Frontmatter => {
  const lines = text.split('\n');
  // The block opens only when the file's first line is a delimiter.
  if (lines.findIndex(isDelimiter) !== 0) {
    return { keys: {}, template: undefined, body: text };
  }
  const end = lines.findIndex((line, index) => index > 0 && isDelimiter(line));
  if (end === -1) {
    throw new Error('The frontmatter block never closes.');
  }
  const document = parseBlock(lines.slice(1, end)) ?? {};
  if (!isMapping(document)) {
    throw new Error('The frontmatter must be a mapping.');
  }
  const { template, ...keys } = document;
  for (const key of Object.keys(keys)) {
    if (key.startsWith('_')) {
      throw new Error(`The frontmatter key ${key} starts with an underscore, which is reserved.`);
    }
  }
  if (template !== undefined && typeof template !== 'string') {
    throw new Error('The template key must be a string.');
  }
  return { keys, template, body: lines.slice(end + 1).join('\n') };
};
