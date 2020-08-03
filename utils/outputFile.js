const p = require('path')
    , fs = require('fs-extra')
;

const logger = require('./logger');




module.exports = (destination) => (path, buffer) => {

  // don't output file if it starts with an underscore
  if (p.basename(path).startsWith('_')) {
    return logger.log('Ignoring file', path);
  }

  const dest = p.join(destination, path);
  return fs.outputFile(dest, buffer).then(() => {
    logger.log('Created file', dest);
  });

}
