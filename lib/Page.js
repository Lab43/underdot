const fs = require('fs-extra')
    , p = require('path')
    , fm = require('front-matter')
;

const logger = require('../utils/logger');



module.exports = class Page {


  constructor (source, path) {
    this.source = source;
    this.path = path;
  }


  async parse () {

    let raw;
    try {
      raw = await fs.readFile(p.join(this.source, this.path), {encoding: 'utf8'})
    } catch (err) {
      logger.error(err, `Error parsing ${this.path}`);
    }
    const { attributes, body } = fm(raw);
    const { dir, name, ext } = p.parse(this.path);

    const data = {
      metadata: attributes,
      body,
      slug: p.join(dir, name),
      ext: ext.slice(1),
      dirname: dir,
    }

    return data;

  }


}
