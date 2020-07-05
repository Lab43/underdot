const fs = require('fs').promises
    , fm = require('front-matter')
    , ejs = require('ejs')
    , p = require('path')
    , templates = require('./templates')
;

const pages = {};



class Page {

  constructor({path, metadata, raw}) {
    this.path = path;
    this.metadata = metadata;
    this.raw = raw;
  }

  render(globalMetadata) {
    const metadata = Object.assign({}, globalMetadata, this.metadata);
    return ejs.render(this.raw, metadata);
  }

}


exports.add = async (source, path) => {
  const data = await fs.readFile(p.join(source, path), {encoding: 'utf8'});
  const {attributes, body} = fm(data);
  pages[path] = new Page({
    path: path,
    metadata: attributes,
    raw: body,
  })
}


exports.processAll = () => {
  console.log(pages);
}


exports.renderAndSaveAll = async (globalMetadata) => {
  return await Object.keys(pages).map(async (path) => {
    const page = pages[path];
    const body = page.render(globalMetadata);
    const pageMetadata = page.metadata
    const template = templates.resolve(path, pageMetadata.template);
    const html = template.render(body, globalMetadata, pageMetadata);
    console.log(html); // this needs to write the file to the destination directory
  });
}
