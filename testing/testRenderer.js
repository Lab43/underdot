const _ = require('lodash');

const Page = require('../lib/Page')
    , Renderer = require('../lib/Renderer')
    , lodashRenderer = require('./lodashRenderer')
;



const templatePaths = [
  '_.lodash',
  '_alt.lodash',
  'alt/_.lodash',
  'alt/_alt.lodash',
];

const globals = {
  siteName: 'Test Site',
};



module.exports = async () => {
  const renderer = new Renderer('dumbyDestination');
  renderer.exports.registerRenderer('lodash', lodashRenderer)
  await Promise.all(templatePaths.map(async (path) => {
    const template = await new Page('testing/testSite', path).parse();
    renderer.registerTemplate(template);
  }));
  return renderer;
}
