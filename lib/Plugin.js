const matches = require('../utils/matchesRule');



module.exports = class Plugin {


  constructor (nextPlugin, queue) {

    this.nextPlugin = nextPlugin;
    this.nextFileHandler = nextPlugin.nextFileHandler;
    this.queue = queue;
    this.nextTreeHandler = nextPlugin.nextTreeHandler;

    this.exports = {
      registerFileHandler: this.registerFileHandler.bind(this),
      registerTreeHandler: this.registerTreeHandler.bind(this),
      enqueueFile: this.enqueueFile.bind(this),
    }

  }


  registerFileHandler (rule, handler) {

    const next = this.nextFileHandler;
    this.nextFileHandler = async ({path, file}) => {
      // if the path doesn't fit the rule we can skip to the next file handler
      if (!matches(path, rule)) return next({path, file});
      // otherwise, pass the file to the handler and wait for the results
      const results = await handler({path, file});
      // if the results are a single file pass them to the next handler
      if (!Array.isArray(results)) return next(results);
      // if the results are an array of files pass each to the next handler
      return Promise.all(results.map((result) => next(result)));
    }

  }


  enqueueFile (path, promiseGenerator) {
    const next = this.nextPlugin.nextFileHandler;
    this.queue.add(async () => {
      const file = await promiseGenerator();
      return next({path, file});
    });
  }


  registerTreeHandler (handler) {
    this.nextTreeHandler = async (tree) => {
      const newTree = await handler(tree);
      return nextTreeHandler(tree);
    }
  }


}
