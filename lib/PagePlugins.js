module.exports = class PagePlugins {


  constructor (lastPlugin) {
    this.lastPlugin = lastPlugin;
    this.register = this.register.bind(this);
  }


  register (plugin) {
    const next = this.lastPlugin;
    const wrapper = (tree) => {
      return plugin(tree, next);
    }
    this.lastPlugin = wrapper;
  }


  processTree (tree) {
    return this.lastPlugin(tree);
  }


}
