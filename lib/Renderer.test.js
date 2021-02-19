const testRenderer = require('../testing/testRenderer')
    , testTree = require('../testing/testTree')
    , globals = require('../testing/testSiteGlobals')
    , lodashRenderer = require('../testing/lodashRenderer')
    , outputFile = require('../utils/outputFile')
;



let renderer;
let tree;
beforeEach(async () => {
  jest.restoreAllMocks();
  renderer = await testRenderer();
  tree = await testTree();
});

jest.mock('../utils/outputFile');


describe('Renderer class', () => {

  test('exports is an object of methods', () => {
    expect(renderer.exports).toMatchObject({
      registerRenderer: expect.any(Function),
      registerTemplateHelper: expect.any(Function),
    });
  });

  test('exports.registerTemplateHelper adds a method to renderer.helpers', () => {
    const helperMethod = jest.fn();
    renderer.exports.registerTemplateHelper('helperName', helperMethod);
    expect(renderer.helpers).toEqual({
      helperName: helperMethod,
    });
  });

  test('exports.registerRenderer adds a method to renderer.renderers', () => {
    expect(renderer.renderers).toEqual({
      lodash: lodashRenderer,
    });
  });

  test('registerTemplate adds templates to renderer.templates with slug as key', () => {
    expect(renderer.templates).toMatchSnapshot();
  });

  describe('exports.isRenderable', () => {

    test('returns true if a registered renderer supports the extension', () => {
      expect(renderer.isRenderable('/example/file.lodash')).toBe(true);
    });

    test('returns false if no registered renderer supports the extension', () => {
      expect(renderer.isRenderable('/example/file.ejs')).toBe(false);
    });

  });

  describe('render', () => {

    const templateHelper1 =  jest.fn();
    const templateHelper2 =  jest.fn();

    beforeEach(() => {
      renderer.exports.registerTemplateHelper('helper1', templateHelper1);
      renderer.exports.registerTemplateHelper('helper2', templateHelper2);
    })

    test('calls the renderer with the template body, merged metadata, and template helpers', () => {
      const mockRenderer = jest.fn();
      renderer.exports.registerRenderer('md', mockRenderer);
      const metadata1 = {
        foo: 'bar',
      };
      const metadata2 = {
        fizz: 'fuzz',
      };
      const body = 'template body';
      renderer.render('md', body, metadata1, metadata2);
      expect(mockRenderer).toHaveBeenCalledWith(
        body,
        Object.assign({}, metadata1, metadata2),
        {
          helper1: expect.any(Function),
          helper2: expect.any(Function),
        }
      )
    });

    test('calls the correct renderer for each extension', () => {
      const markdownRenderer = jest.fn();
      const ejsRenderer = jest.fn();
      renderer.exports.registerRenderer('md', markdownRenderer);
      renderer.exports.registerRenderer('ejs', ejsRenderer);
      renderer.render('md', 'body');
      expect(markdownRenderer).toHaveBeenCalled();
      expect(ejsRenderer).not.toHaveBeenCalled();
    });

    test('passes the metadata as the first argument when a helper is used in a template', () => {
      const mockRenderer = (body, metadata, helpers) => {
        helpers.helper1('foo', 'bar');
      }
      renderer.exports.registerRenderer('md', mockRenderer);
      renderer.render('md', 'body', {meta: 'data'});
      expect(templateHelper1).toHaveBeenCalledWith({meta: 'data'}, 'foo', 'bar');
    });

  });

  describe('outputTree', () => {
    test('calls _processLevel', () => {
      const mock = jest.spyOn(renderer, '_processLevel');
      mock.mockImplementation(() => {});
      renderer.outputTree(testTree, globals);
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledWith('', globals, testTree);
    });
  });

  describe('_processLevel', () => {

    const simpleTree = {
      content: 'home',
      metadata: {template: 'template'},
      dirname: 'dirname',
      children: {
        section1: {
          content: 'section 1',
          children: {
            page1: {
              content: 'sub page 1',
            },
            page2: {
              content: 'sub page 2',
            },
          },
        },
        section2: {
          content: 'section 2',
        },
      },
    };

    test('recursively calls iteself for every level in the tree', () => {
      const mock = jest.spyOn(renderer, '_processLevel');
      const result = renderer._processLevel('', globals, simpleTree);
      expect(mock).toHaveBeenCalledTimes(5);
      expect(mock).toHaveBeenNthCalledWith(1, '', globals, simpleTree);
      expect(mock).toHaveBeenNthCalledWith(2, 'section1', globals, simpleTree.children.section1);
      expect(mock).toHaveBeenNthCalledWith(3, 'section1/page1', globals, simpleTree.children.section1.children.page1);
      expect(mock).toHaveBeenNthCalledWith(4, 'section1/page2', globals, simpleTree.children.section1.children.page2);
      expect(mock).toHaveBeenNthCalledWith(5, 'section2', globals, simpleTree.children.section2);
    });

    test('returns an array of functions', () => {
      const results = renderer._processLevel('', globals, simpleTree);
      expect(results).toEqual([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    test('returns an array of functions that return a promise, call _resolveAndRender, and call _outputPage', async () => {
      // mock the function we expect to be called
      const _resolveAndRender = jest.spyOn(renderer, '_resolveAndRender').mockImplementation(() => 'rendered page');
      const _outputPage = jest.spyOn(renderer, '_outputPage').mockImplementation(() => {});
      // process the first level of the tree
      const results = renderer._processLevel('test/slug', globals, simpleTree);
      const result = results[0]();
      // check that the return function returns a promise
      expect(result).toEqual(expect.any(Promise));
      await result;
      // check that the mocked functions get called
      expect(_resolveAndRender).toHaveBeenCalledTimes(1);
      expect(_resolveAndRender).toHaveBeenCalledWith(
        'test/slug',
        simpleTree.dirname,
        null,
        simpleTree.metadata.template,
        simpleTree.content,
        globals,
        simpleTree.metadata
      );
      expect(_outputPage).toHaveBeenCalledTimes(1);
      expect(_outputPage).toHaveBeenCalledWith(
        'test/slug',
        'rendered page',
      );
    });

  });

  describe('_resolveAndRender', () => {

    test('renders with the root default template', async () => {
      const content = await renderer._resolveAndRender(
        '',
        '',
        undefined,
        tree.tree.metadata.template,
        tree.tree.content,
        globals,
        tree.tree.metadata,
      );
      expect(content).toMatchSnapshot();
    });

    test('renders with the root default template from a subdirectory', async () => {
      const content = await renderer._resolveAndRender(
        'sub',
        '',
        undefined,
        tree.tree.children.sub.metadata.template,
        tree.tree.children.sub.content,
        globals,
        tree.tree.children.sub.metadata,
      );
      expect(content).toMatchSnapshot();
    });

    test('renders with the default template in a subdirectory', async () => {
      const content = await renderer._resolveAndRender(
        'alt/page',
        '',
        undefined,
        tree.tree.children.alt.children.page.metadata.template,
        tree.tree.children.alt.children.page.content,
        globals,
        tree.tree.children.alt.children.page.metadata,
      );
      expect(content).toMatchSnapshot();
    });

    test('renders with a specified template', async () => {
      const content = await renderer._resolveAndRender(
        'alt-page',
        '',
        undefined,
        tree.tree.children['alt-page'].metadata.template,
        tree.tree.children['alt-page'].content,
        globals,
        tree.tree.children['alt-page'].metadata,
      );
      expect(content).toMatchSnapshot();
    });

    test('renders with a specified template in a subdirecoty', async () => {
      const content = await renderer._resolveAndRender(
        'alt/alt-page',
        '',
        undefined,
        tree.tree.children.alt.children['alt-page'].metadata.template,
        tree.tree.children.alt.children['alt-page'].content,
        globals,
        tree.tree.children.alt.children['alt-page'].metadata,
      );
      expect(content).toMatchSnapshot();
    });

  });

  test('_outputPage', async () => {
    await renderer._outputPage('/slug/to/page', 'html of page');
    expect(outputFile).toHaveBeenCalledWith(
      'dumbyDestination',
      '/slug/to/page/index.html',
      'html of page',
    );
  });

});
