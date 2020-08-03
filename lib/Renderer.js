const p = require('path')
    , fs = require('fs-extra')
;

const logger = require('../utils/logger');




module.exports = class Renderer {


  constructor (globalMetadata) {
    this.globalMetadata = globalMetadata;
    this.renderers = {};
    this.helpers = {};
    this.register = this.register.bind(this);
  }


  register (ext, registerer) {
    // need to make sure all helpers have been registered before renderers are intialized
    // so, probably need an initialize() method to call after processing all plugins
    this.renderers[ext] = registerer(this.helpers);
  }


  isRenderable (path) {
    const ext = p.extname(path).slice(1);
    return ext in this.renderers;
  }


  async render (ext, template, ...metadatas) {
    // render() accepts any number of metadata objects, which get merged together before being sent to the renderer
    const pageMetadata = metadatas.reduce((obj, metadata) => Object.assign(obj, metadata), {});
    const metadata = Object.assign({}, this.globalMetadata, pageMetadata);
    return await this.renderers[ext](template, metadata);
  }


  outputTree (destination) { return (tree) => {

    const promises = [];

    // resolve the template hierarchy, fully render, and output this page
    const resolveAndOutput = ({slug, metadata, template, content}) => {
      return () => {
        // TODO: resolve the template then recursively render through the template hierarchy
        const dest = p.join(destination, slug, 'index.html');
        return fs.outputFile(dest, content).then(() => {
          logger.log('Created file', dest);
        });
      }
    }

    // iteratively process each level of the tree, building an array of promises to be passed into the queue
    const processLevel = (slug, {children, metadata, template, content}) => {
      if (content) promises.push(resolveAndOutput({slug, metadata, template, content}));
      if (children) {
        for (const child in children) {
          processLevel(`${slug}/${child}`, children[child]);
        }
      }
    }
    processLevel('', tree);

    return promises;

  }}


}
