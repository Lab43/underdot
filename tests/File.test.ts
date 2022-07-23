import fs from 'fs/promises';

import File from '../src/File';



describe('File class', () => {

  test('throws an error when reading a file that doesn\'t exist', async () => {
    const file = new File('nope.jpg');
    await expect(() => file.readFile('tests/data')).rejects.toThrow();
  });

  test('reads and writes files', async () => {
    const file = new File('chidi.jpg');
    // copy the file
    await file.readFile('tests/data');
    await file.writeFile('tests/temp');
    // check that the copies match
    const input = await fs.readFile('tests/data/chidi.jpg');
    const output = await fs.readFile('tests/temp/chidi.jpg');
    expect(input.equals(output)).toBe(true);
  });

  test('throws an error when writing a file that hasn\'t been read yet', async () => {
    const file = new File('chidi.jpg');
    await expect(() => file.writeFile('tests/temp')).rejects.toThrow();
  });

});


// clean up the test data
afterEach(() => fs.rm('tests/temp', { recursive: true, force: true}));