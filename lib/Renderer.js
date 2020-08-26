const p = require('path')
    , fs = require('fs-extra')
;

const logger = require('../utils/logger');




module.exports = class Renderer {


  constructor () {

    this.renderers = {};
    this.helpers = {};
    this.templates = {};

    this.exports = {
      registerRenderer: this.registerRenderer.bind(this),
      registerTemplateHelper: this.registerTemplateHelper.bind(this),
    }

  }


  registerTemplateHelper (name, method) {
    this.helpers[name] = method;
  }


  registerRenderer (ext, renderer) {
    this.renderers[ext] = renderer;
  }


  isRenderable (path) {
    const ext = p.extname(path).slice(1);
    return ext in this.renderers;
  }


  async registerTemplate ({slug, ...data}) {
    this.templates[slug] = data;
  }


  async render (ext, body, ...metadatas) {

    // render() accepts any number of metadata objects, which get merged together before being sent to the renderer
    const metadata = metadatas.reduce((obj, metadata) => Object.assign(obj, metadata), {});

    // pass the metadata as the first argument to each helper, then pass the other arguments given to the helper in the template
    const boundHelpers = {};
    for (const helper in this.helpers) {
      boundHelpers[helper] = (...args) => this.helpers[helper](metadata, ...args);
    }

    return this.renderers[ext](body, metadata, boundHelpers);
  }


  outputTree (destination) { return ({ tree, globals }) => {

    // recursively resolve the template hierarchy and fully render this page
    const resolveAndRender = (
      slug,
      dirname,
      previousTemplateSlug,
      requestedTemplate = '_',
      content,
      ...metadatas
    ) => {

      // look for the closest template with the correct name
      requestedTemplate = requestedTemplate.startsWith('_') ? requestedTemplate : '_' + requestedTemplate;
      requestedTemplate = p.join(dirname, requestedTemplate);

      // build an array of possible locations for the template, going up the directory structure
      const templateCandidates = [requestedTemplate];
      const parts = requestedTemplate.split('/');
      while (parts.length > 1) {
        // remove the second to last part of the path
        parts.splice(parts.length - 2, 1);
        templateCandidates.push(parts.join('/'));
      }

      // if the previous template was named "_" we don't want to try to find the parent template in the current directory because that will cause an infinite loop
      if (previousTemplateSlug && previousTemplateSlug.split('/').pop() === '_') {
        templateCandidates.shift();
      }

      // figure out the slug of the closest matching template
      const resolvedTemplate = templateCandidates.find((slug) => this.templates[slug]);

      // get data from the template
      const {
        ext,
        template: parentTemplate,
        body,
        metadata: templateMetadata,
        dirname: templateDirname,
      } = this.templates[resolvedTemplate];
      // Render! If there is a parent template, then pass the results from this render back into the function
      return this.render(ext, body, globals, templateMetadata, ...metadatas, {content, slug, dirname}).then((content) => {
        if (resolvedTemplate !== '_') {
          // this is not the root template, so this template has a parent template that we need to resolve
          return resolveAndRender(
            slug,
            templateDirname,
            resolvedTemplate,
            parentTemplate,
            content,
            templateMetadata,
            ...metadatas
          );
        } else {
          return content;
        }
      })
    }

    // output the html file for this page
    const outputPage = async (slug, html) => {
      const dest = p.join(destination, slug, 'index.html');
      return fs.outputFile(dest, html).then(() => {
        logger.log('Created file', dest);
      });
    }

    // iteratively process each level of the tree, building an array of promise generators to be passed into the queue
    const promises = [];
    const processLevel = (slug, {children, metadata, dirname, content}) => {
      if (content) promises.push(async () => {
        const html = await resolveAndRender(slug, dirname, null, metadata.template, content, metadata);
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
