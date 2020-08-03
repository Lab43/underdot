const p = require('path')
    , fs = require('fs-extra')
    , {default: PQueue} = require('p-queue')
    , fm = require('front-matter')
;

const FilePlugins = require('./FilePlugins')
    , PagePlugins = require('./PagePlugins')
    , Renderer = require('./Renderer')
    , File = require('./File')
    , Page = require('./Page')
    , Tree = require('./Tree')
    , outputFile = require('../utils/outputFile')
    , logger = require('../utils/logger')
;




module.exports = class Underdot {


  constructor ({
    source = 'source',
    destination = 'build',
    metadata = {},
    concurrency = 10,
    use: plugins = [],
  }) {

    this.source = source;
    this.queue = new PQueue({concurrency});
    this.renderer = new Renderer(metadata);
    this.filePlugins = new FilePlugins(outputFile(destination));
    this.pagePlugins = new PagePlugins(this.renderer.outputTree(destination));

    // load plugins
    // the plugins need to be processed in reverse order, so that each plugin will be able to trigger the next plugin
    plugins.reverse().forEach((plugin) => plugin({
      registerFilePlugin: this.filePlugins.register,
      registerRenderer: this.renderer.register,
      // registerTemplateHelper: TODO,
      registerPagePlugin: this.pagePlugins.register,
      getTemplateHelpers: () => {return {}},
      logger,
    }));

  }


  async build () {

    const files = [];
    const pages = [];

    // recursively parse through the source directory identifying files, pages, and templates
    const processDirectory = async (directory) => {
      logger.log('Processing directory', directory);
      // get everything in this directory, including subdirectories
      const everything = await fs.readdir(directory, {withFileTypes: true});
      everything.forEach((thing) => {
        const fullPath = p.join(directory, thing.name);
        const relativePath = p.relative(this.source, fullPath);
        // if this is a directory add another processor to the queue
        if (thing.isDirectory()) return this.queue.add(() => processDirectory(fullPath));
        if (this.renderer.isRenderable(relativePath)) {
          if (thing.name.startsWith('_')) {
            // TODO: register this as a template
          } else {
            pages.push(new Page(this.source, relativePath));
          }
        } else {
          files.push(new File(this.source, relativePath));
        }
      });
    }
    this.queue.add(() => processDirectory(this.source));

    // pass the generic files through the plugins and output them
    await this.queue.onIdle();
    this.queue.addAll(files.map((file) => async () => {
      const buffer = await file.getBuffer();
      await this.filePlugins.processFile(file.path, buffer);
    }));

    // parse each page and build the tree
    await this.queue.onIdle();
    const tree = new Tree();
    await this.queue.addAll(pages.map((page) => async () => {
      const raw = await page.getString();
      // parse front matter
      const {attributes, body } = fm(raw);
      // extract the template name from the other front matter attributes
      const {template: templateName, ...metadata} = attributes;
      const slug = page.getSlug();
      const content = await this.renderer.render(page.getExt(), body, metadata, {slug});
      tree.addPage({
        slug,
        templateName,
        metadata,
        content,
      })
    }));

    // pass the tree through the plugins and render the all pages
    await this.queue.onIdle();
    this.queue.addAll(this.pagePlugins.processTree(tree.tree));

    await this.queue.onIdle();
    logger.log('Done!');

  }


}
