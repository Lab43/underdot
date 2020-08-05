const p = require('path')
    , fs = require('fs-extra')
    , {default: PQueue} = require('p-queue')
;

const Plugin = require('./Plugin')
    , Renderer = require('./Renderer')
    , File = require('./File')
    , Page = require('./Page')
    , Tree = require('./Tree')
    , outputFile = require('../utils/outputFile')
    , getFile = require('../utils/getFile')
    , logger = require('../utils/logger')
;




module.exports = class Underdot {


  constructor ({
    source = 'source',
    destination = 'build',
    metadata = {},
    concurrency = 10,
    plugins = [],
  }) {

    this.source = source;
    this.queue = new PQueue({concurrency});
    this.renderer = new Renderer(metadata);

    this.nextPlugin = {
      nextFileHandler: outputFile(destination),
      nextTreeHandler: this.renderer.outputTree(destination),
    }

    // load plugins
    // the plugins need to be processed in reverse order, so that each plugin will be able to trigger the next plugin
    plugins.reverse().forEach((register) => {
      this.nextPlugin = new Plugin(this.nextPlugin, this.queue);
      register({
        logger,
        getFile: getFile(source),
        ...this.renderer.exports,
        ...this.nextPlugin.exports,
      });
    });

  }


  async build () {

    const files = [];
    const pages = [];
    const templates = [];

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
          const renderable = new Page(this.source, relativePath);
          if (thing.name.startsWith('_')) {
            templates.push(renderable);
          } else {
            pages.push(renderable);
          }
        } else {
          files.push(new File(this.source, relativePath));
        }
      });
    }
    this.queue.add(() => processDirectory(this.source));

    // wait for all files to process
    // then pass the generic files through the plugins and output them
    await this.queue.onIdle();
    this.queue.addAll(files.map((file) => async () => {
      const buffer = await file.getBuffer();
      await this.nextPlugin.nextFileHandler({path: file.path, file: buffer});
    }));

    // wait for file plugins to finish in case template helpers need info from them
    // then parse each page and build the tree
    await this.queue.onIdle();
    const tree = new Tree();
    this.queue.addAll(pages.map((page) => async () => {
      const {template, metadata, body, slug, ext} = await page.parse();
      const content = await this.renderer.render(ext, body, metadata, {slug, filePath: page.path});
      tree.addPage({
        slug,
        template,
        metadata,
        content,
        filePath: page.path,
      });
    }));

    // register all the templates
    this.queue.addAll(templates.map((page) => async () => {
      const template = await page.parse();
      await this.renderer.registerTemplate(template);
    }));

    // pass the tree through the plugins and render the all pages
    await this.queue.onIdle();
    this.queue.addAll(this.nextPlugin.nextTreeHandler(tree.tree));

    await this.queue.onIdle();
    logger.log('Done!');

  }


}
