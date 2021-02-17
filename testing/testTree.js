const Page = require('../lib/Page')
    , Tree = require('../lib/Tree')
    , testRenderer = require('./testRenderer')
    , globals = require('./testSiteGlobals')
;



const pagePaths = [
  'index.lodash',
  'alt-page.lodash',
  'simple.lodash',
  'alt/alt-page.lodash',
  'alt/page.lodash',
  'simple/child1.lodash',
  'simple/child2.lodash',
  'sub/index.lodash',
  'sub/regular.lodash',
];


module.exports = async () => {
  const tree = new Tree();
  const renderer = await testRenderer();
  await Promise.all(pagePaths.map(async (path) => {
    const {
      metadata,
      body,
      slug,
      ext,
      dirname
    } = await new Page('testing/testSite', path).parse();
    const content = await renderer.render(ext, body, globals, metadata, {slug, dirname});
    tree.addPage({
      slug,
      metadata,
      content,
      dirname,
    });
  }));
  return tree;
};
