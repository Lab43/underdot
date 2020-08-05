const fs = require('fs-extra')
    , p = require('path')
;



module.exports = (source) => (path) => {
  return fs.readFile(p.join(source, path));
}
