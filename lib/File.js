const fs = require('fs-extra')
    , p = require('path')
;




module.exports = class File {


  constructor (source, path) {
    this.source = source;
    this.path = path;
  }


  async getBuffer () {
    return await fs.readFile(p.join(this.source, this.path))
  }


}
