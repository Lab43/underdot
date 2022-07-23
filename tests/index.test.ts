import fs from 'fs/promises';

import Underdot from '../src/index';



describe('Underdot class', () => {

  test('copies all files on build', async () => {
    fs.mkdir = jest.fn();
    fs.writeFile = jest.fn();
    const underdot = new Underdot({
      source: 'tests/data',
      destination: 'tests/temp',
      concurrency: 1, // so files are always processed in the same order
    });
    await underdot.build();
    expect(fs.mkdir).toMatchSnapshot();
    expect(fs.writeFile).toMatchSnapshot();
  });

  test('reads from the default source directory', async () => {
    fs.readdir = jest.fn(async () => []);
    const underdot = new Underdot();
    await underdot.build();
    expect(fs.readdir).toBeCalledWith('source', {withFileTypes: true});
  });

});