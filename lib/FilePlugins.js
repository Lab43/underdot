const matches = require('../utils/matchesRule');




module.exports = class FilePlugins {


  constructor (lastPlugin) {
    this.lastPlugin = lastPlugin;
    this.register = this.register.bind(this);
  }


  register (rule, plugin) {

    const next = this.lastPlugin;

    const wrapper = (path, buffer) => {
      // bypass this plugin if the rule doesn't pass
      if (!matches(path, rule)) return next(path, buffer);
      // pass the previously registered plugin to this plugin to be run next
      return plugin(path, buffer, next);
    }

    this.lastPlugin = wrapper;

  }


  processFile (path, buffer) {
    return this.lastPlugin(path, buffer);
  }


}
