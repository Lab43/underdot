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
    globals = {},
    concurrency = 10,
    plugins = [],
  }) {

    this.source = source;
    this.globals = globals;
    this.queue = new PQueue({concurrency});
    this.renderer = new Renderer(destination);


    this.nextPlugin = {
      nextFileHandler: ({ path, file }) => outputFile(destination, path, file),
      nextTreeHandler: this.renderer.outputTree,
    }

    // load plugins
    // the plugins need to be processed in reverse order, so that each plugin will be able to trigger the next plugin
    plugins.reverse().forEach((register) => {
      this.nextPlugin = new Plugin(this.nextPlugin, this.queue);
      register({
        logger,
        source,
        getFile: getFile(source),
        ...this.renderer.exports,
        ...this.nextPlugin.exports,
      });
    });

  }


  async build () {
    const startTime = Date.now();

    const files = [];
    const pages = [];
    const templates = [];

    // recursively parse through the source directory identifying files, pages, and templates
    const processDirectory = async (directory) => {
      // get everything in this directory, including subdirectories
      const everything = await fs.readdir(p.join(this.source, directory), {withFileTypes: true});
      everything.forEach((thing) => {
        const path = p.join(directory, thing.name);
        // if this is a directory add another processor to the queue
        if (thing.isDirectory()) {
          if (thing.name.startsWith('_')) return logger.log('Ignoring directory', path);
          logger.log('Processing directory', path);
          return this.queue.add(() => processDirectory(path)).catch(logger.error);
        }
        if (this.renderer.isRenderable(path)) {
          const renderable = new Page(this.source, path);
          if (thing.name.startsWith('_')) {
            templates.push(renderable);
          } else {
            pages.push(renderable);
          }
        } else {
          files.push(new File(this.source, path));
        }
      });
    }
    this.queue.add(() => processDirectory('')).catch(logger.error);

    // wait for all files to process
    // then pass the generic files through the plugins and output them
    await this.queue.onIdle();
    this.queue.addAll(files.map((file) => async () => {
      const buffer = await file.getBuffer();
      try {
        await this.nextPlugin.nextFileHandler({path: file.path, file: buffer});
      } catch (err) {
        logger.error(err, `Error processing ${file.path}`);
      }
    }));

    // wait for file plugins to finish in case template helpers need info from them
    // then parse each page and build the tree
    await this.queue.onIdle();
    const tree = new Tree();
    this.queue.addAll(pages.map((page) => async () => {
      const {metadata, body, slug, ext, dirname} = await page.parse();
      let content;
      try {
        content = await this.renderer.render(ext, body, this.globals, metadata, {slug, dirname});
      } catch (err) {
        logger.error(err, `Error processing ${page.path}`);
      }
      tree.addPage({
        slug,
        metadata,
        content,
        dirname,
      });
    }));

    // register all the templates
    this.queue.addAll(templates.map((page) => async () => {
      let template;
      try {
        template = await page.parse();
      } catch (err) {
        logger.error(err, `Error processing ${page.path}`);
      }
      this.renderer.registerTemplate(template);
    }));

    // pass the tree through the plugins and render all pages
    await this.queue.onIdle();
    const renderArray = await this.nextPlugin.nextTreeHandler({tree: tree.tree, globals: this.globals});
    this.queue.addAll(renderArray).catch(logger.error);

    await this.queue.onIdle();
    logger.log(`Finished building site in ${(Date.now() - startTime) / 1000} seconds`);

  }


}
