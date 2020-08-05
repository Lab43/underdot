const p = require('path')
    , fs = require('fs-extra')
;

const logger = require('../utils/logger');




module.exports = class Renderer {


  constructor (globalMetadata) {
    this.globalMetadata = globalMetadata;
    this.renderers = {};
    this.helpers = {};
    this.templates = {};
    this.registerRenderer = this.registerRenderer.bind(this);
    this.registerHelper = this.registerHelper.bind(this);
  }


  registerHelper (name, method) {
    this.helpers[name] = method;
  }


  registerRenderer (ext, registrator) {
    this.renderers[ext] = registrator;
  }


  initialize () {
    // call each renderer registrator function, passing in all the template helpers
    for (let registrator in this.renderers) {
      this.renderers[registrator] = this.renderers[registrator](this.helpers);
    }
  }


  isRenderable (path) {
    const ext = p.extname(path).slice(1);
    return ext in this.renderers;
  }


  async registerTemplate ({template, metadata, body, slug, ext}) {
    if (slug === '_') {
      // this is the top-level template
      this.templates[slug] = {metadata, body, ext};
    } else {
      // this is a sub-template
      this.templates[slug] = {template, metadata, body, ext};
    }
  }


  async render (ext, body, ...metadatas) {
    // render() accepts any number of metadata objects, which get merged together before being sent to the renderer
    const pageMetadata = metadatas.reduce((obj, metadata) => Object.assign(obj, metadata), {});
    const metadata = Object.assign({}, this.globalMetadata, pageMetadata);
    return await this.renderers[ext](body, metadata);
  }


  outputTree (destination) { return (tree) => {

    // recursively resolve the template hierarchy and fully render this page
    const resolveAndRender = async (slug, template, content, ...metadatas) => {
      // build an array of possible template slugs
      const templateCandidates = [template];
      const parts = template.split('/');
      while (parts.length > 1) {
        // remove the second to last part of the path
        parts.splice(parts.length - 2, 1);
        templateCandidates.push(parts.join('/'));
      }
      // figure out the slug of the closest matching template
      const resolvedTemplate = templateCandidates.find((slug) => this.templates[slug]);
      // get data from the template
      const {
        ext,
        template: parentTemplate,
        body,
        metadata: templateMetadata,
      } = this.templates[resolvedTemplate];
      // Render! If there is a parent template, then pass the results from this render back into the function
      const renderedContent = await this.render(ext, body, templateMetadata, ...metadatas, {content, slug});
      if (parentTemplate) {
        return resolveAndRender(slug, parentTemplate, renderedContent, templateMetadata, ...metadatas);
      } else {
        return renderedContent;
      }
    }

    // output the html file for this page
    const outputPage = async (slug, html) => {
      const dest = p.join(destination, slug, 'index.html');
      return fs.outputFile(dest, html).then(() => {
        logger.log('Created file', dest);
      });
    }

    // iteratively process each level of the tree, building an array of promises to be passed into the queue
    const promises = [];
    const processLevel = (slug, {children, metadata, template, content}) => {
      if (content) promises.push(async () => {
        const html = await resolveAndRender(slug, template, content, metadata);
        return outputPage(slug, html);
      });
      if (children) {
        for (const child in children) {
          processLevel(p.join(slug, child), children[child]);
        }
      }
    }
    processLevel('', tree);
    return promises;

  }}


}
