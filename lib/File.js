const getFile = require('../utils/getFile');



module.exports = class File {


  constructor (source, path) {
    this.source = source;
    this.path = path;
  }


  async getBuffer () {
    return getFile(this.source)(this.path);
  }


}
