const fs = require('fs-extra');

const outputFile = require('../utils/outputFile');



jest.mock('fs-extra');
fs.outputFile.mockImplementation(() => Promise.resolve());



describe('outputFile', () => {

  test('outputs a file', () => {
    outputFile('destination', 'path/to/file', 'contents');
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile).toHaveBeenCalledWith('destination/path/to/file', 'contents');
  });

  test('skips a file that starts with an underscore', () => {
    outputFile('destination', 'path/to/_file', 'contents');
    expect(fs.outputFile).not.toHaveBeenCalled();
  });


});
