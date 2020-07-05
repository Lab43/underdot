const p = require('path')
    , fs = require('fs').promises
;

const files = require('./files')
    , templates = require('./templates')
    , pages = require('./pages')
;



exports.build = async (options = {}) => {


  const {
    source = 'source',
    destination = 'build',
    metadata = {},
  } = options;


  const processDirectory = async (directory) => {

    // get everything in this directory, including subdirectories
    const everything = await fs.readdir(directory, {withFileTypes: true});

    // set aside subdirectories
    const subdirectories = [];

    await Promise.all(everything.map(async (thing) => {
      const fullPath = p.join(directory, thing.name);
      // string the source directory from the path for this item
      const relativePath = p.relative(source, fullPath);
      // if this is a directory stash of later processing
      if (thing.isDirectory()) return subdirectories.push(fullPath);
      // if this is an ejs file either register it as a page or template
      if (p.extname(thing.name) !== '.ejs') {
        return files.add(source, relativePath);
      }
      if (thing.name.startsWith('_')) return templates.add(source, relativePath);
      // otherwise, treat this as a regular file
      return pages.add(source, relativePath);
    }));

    // recursively process the subdirectories
    return Promise.all(subdirectories.map(async (directory) => processDirectory(directory)));

  }
  await processDirectory(source);


  // Pass non-ejs files through the plugins. We do this first in case any data from these files is needed for template
  files.processAll();


  // Pass ejs files through the plugins so we can do things like build collections of files
  pages.processAll();


  // Render all the pages
  await pages.renderAndSaveAll(metadata);


};
