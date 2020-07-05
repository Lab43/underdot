const p = require('path')
    , fs = require('fs').promises
    , fm = require('front-matter')
    , ejs = require('ejs')
;

const templates = {};



class Template {

  constructor({path, metadata, raw}) {
    this.path = path;
    this.metadata = metadata;
    this.raw = raw;
  }

  render(body, globalMetadata, bodyMetadata) {
    const metadata = Object.assign({}, globalMetadata, this.metadata, bodyMetadata, {body});
    const html = ejs.render(this.raw, metadata);
    // if this is not the root template find its parent template at pass it to it
    if (this.path !== '_.ejs') {
      const parentTemplate = resolve(this.path, this.metadata.template);
      return parentTemplate.render(html, metadata);
    } else {
      return html;
    }
  }
}


exports.add = async (source, path) => {
  const data = await fs.readFile(p.join(source, path), {encoding: 'utf8'});
  const {attributes, body} = fm(data);
  templates[path] = new Template({
    path: path,
    metadata: attributes,
    raw: body,
  });
}


// figure out what template a given page should be rendered with
const resolve = (pagePath, templateName = '') => {
  const dirname = p.dirname(pagePath);
  function look (dirname, templateName) {
    const candidate = p.join(dirname, `_${templateName}.ejs`);
    if (templates[candidate]) {
      return templates[candidate];
    } else {
      // If we can't find this template in the current directoy go up a level and look for it there.
      // If we reach the root source directory and still don't find it throw an error.
      if (dirname === '.') throw new Error(`Could not resolve template for ${pagePath}`);
      return look(p.dirname(dirname), templateName);
    }
  }
  return look(dirname, templateName);
}
exports.resolve = resolve;
