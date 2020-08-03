const fs = require('fs-extra')
    , p = require('path')
;




module.exports = class Page {


  constructor (source, path) {
    this.source = source;
    this.path = path;
  }


  async getString() {
    return await fs.readFile(p.join(this.source, this.path), {encoding: 'utf8'});
  }


  getExt () {
    return p.extname(this.path).slice(1);
  }


  getSlug () {
    const dirname = p.dirname(this.path);
    const ext = this.getExt();
    const basename = p.basename(this.path, '.' + ext);
    return p.join(dirname, basename);
  }


}
