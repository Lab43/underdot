const { defaultsDeep } = require('lodash');




module.exports = class Tree {


  constructor () {
    this.tree = {};
  }


  addPage ({ slug, metadata, content, dirname }) {

    const parts = slug.split('/');

    // if the last part of the slug is "index" remove it
    if (parts.length && (parts[parts.length - 1] === 'index')) parts.pop();

    // build this branch of the tree and merge it into the full tree
    let branch = {
      metadata,
      dirname,
      content,
    };
    parts.reverse().forEach((part) => {
      branch = {children: {[part]: branch}};
    });
    defaultsDeep(this.tree, branch);

  }


}
