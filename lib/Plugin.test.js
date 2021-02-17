const fs = require('fs')
    , fsExtra = require('fs-extra')
;

const Plugin = require('./Plugin');



const mockPlugin = {
  nextFileHandler: jest.fn(),
  nextTreeHandler: jest.fn(),
};
const mockQueue = {
  add: jest.fn(),
};
const mockTree = {
  tree: 'branch',
};

const chidiPath = 'testing/assets/chidi.jpg';
const chidiBuffer = fs.readFileSync(chidiPath);
const kantPath = 'testing/assets/kant.txt';
const kantBuffer = fs.readFileSync(kantPath);

let plugin;
beforeEach(() => {
  plugin = new Plugin(mockPlugin, mockQueue);
});



describe('Plugin class', () => {

  test('accepts nextPlugin and queue arguments', () => {
    expect(plugin.nextPlugin).toBe(mockPlugin);
    expect(plugin.nextFileHandler).toBe(mockPlugin.nextFileHandler);
    expect(plugin.nextTreeHandler).toBe(mockPlugin.nextTreeHandler);
    expect(plugin.queue).toBe(mockQueue);
  });

  test('exports is an object of methods', () => {
    expect(plugin.exports).toMatchObject({
      registerFileHandler: expect.any(Function),
      registerTreeHandler: expect.any(Function),
      enqueueFile: expect.any(Function),
    });
  });

  describe('exports.registerFileHandler', () => {

    const handler = jest.fn(({ path, file }) => ({path, file}));
    beforeEach(() => {
      plugin.exports.registerFileHandler('**/*.jpg', handler);
    });

    test('wraps the handler and assigns it to this.nextFileHandler', async () => {
      await plugin.nextFileHandler({path: chidiPath, file: chidiBuffer});
      // when issue #8 is fixed this can be
      // expect(handler).toHaveBeenCalledWith(path, file);
      expect(handler.mock.calls[0][0]).toEqual({path: chidiPath, file: chidiBuffer});
    });

    test('only calls the handler for a file if it matches the rule', async () => {
      await plugin.nextFileHandler({path: kantPath, file: kantBuffer});
      expect(handler).not.toHaveBeenCalled();
    });

    test('calls handlers in reverse order', async () => {
      await plugin.nextFileHandler({path: chidiPath, file: chidiBuffer});
      // when issue #8 is fixed this can be
      // expect(mockPlugin.nextFileHandler).toHaveBeenCalledWith(path, file);
      expect(mockPlugin.nextFileHandler.mock.calls[0][0]).toEqual({path: chidiPath, file: chidiBuffer});
      expect(handler).toHaveBeenCalledBefore(mockPlugin.nextFileHandler);
    });

    test('calls next handler even if the rule for this handler doesn\'t match', async () => {
      await plugin.nextFileHandler({path: kantPath, file: kantBuffer});
      expect(mockPlugin.nextFileHandler).toHaveBeenCalled();
    });

    test('calls the next hander multiple times if this handler returns an array', async () => {
      // fake file handler that adds another file and returns an array
      plugin.exports.registerFileHandler(null, ({ path, file }) => {
        return [
          {path, file},
          {path: kantPath, file: kantBuffer},
        ];
      });
      await plugin.nextFileHandler({path: chidiPath, file: chidiBuffer});
      // when issue #8 is fixed this can be
      // expect(mockPlugin.nextFileHandler).toHaveBeenNthCalledWith(0, path, file);
      // expect(mockPlugin.nextFileHandler).toHaveBeenNthCalledWith(1, path, file);
      // the file order gets flipped because the other mock handler
      // added in beforeEach above is also processing chidi.jpg, so
      // kant.txt arrives at mockPlugin.nextFileHandler before chidi.jpg
      expect(mockPlugin.nextFileHandler.mock.calls[0][0]).toEqual({path: kantPath, file: kantBuffer});
      expect(mockPlugin.nextFileHandler.mock.calls[1][0]).toEqual({path: chidiPath, file: chidiBuffer});
    });

  });

  describe('exports.registerTreeHandler', () => {

    const handler = jest.fn((tree) => tree);
    beforeEach(() => {
      plugin.exports.registerTreeHandler(handler);
    });

    test('wraps the handler and assigns it to this.nextTreeHandler', async () => {
      await plugin.nextTreeHandler(mockTree);
      expect(handler).toHaveBeenCalledWith(mockTree);
    });

    test('calls handlers in reverse order', async () => {
      await plugin.nextTreeHandler(mockTree);
      expect(mockPlugin.nextTreeHandler).toHaveBeenCalledWith(mockTree);
      expect(handler).toHaveBeenCalledBefore(mockPlugin.nextTreeHandler);
    });

  });

  describe('exports.enqueueFile', () => {
    test('enqueues a function which passes the file to the next plugin\'s file handler', async () => {
      const fileGetter = () => fsExtra.readFile(chidiPath);
      plugin.exports.enqueueFile(chidiPath, fileGetter);
      await mockQueue.add.mock.calls[0][0]();
      // when issue #8 is fixed this can be
      //expect(mockPlugin.nextFileHandler).toHaveBeenCalledWith(chidiPath, chidiBuffer);
      expect(mockPlugin.nextFileHandler.mock.calls[0][0]).toEqual({path: chidiPath, file: chidiBuffer});
    });
  });

});
