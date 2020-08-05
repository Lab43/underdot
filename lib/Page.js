const fs = require('fs-extra')
    , p = require('path')
    , fm = require('front-matter')
;




module.exports = class Page {


  constructor (source, path) {
    this.source = source;
    this.path = path;
  }


  async parse () {
    const raw = await fs.readFile(p.join(this.source, this.path), {encoding: 'utf8'});
    const {attributes, body } = fm(raw);
    let {template = '', ...metadata} = attributes;
    const {dir, name, ext} = p.parse(this.path);
    template = template.startsWith('_') ? template : '_' + template;
    return {
      template: p.join(dir, template),
      metadata,
      body,
      slug: p.join(dir, name),
      ext: ext.slice(1),
    };
  }


}
