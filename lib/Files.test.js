const fs = require('fs-extra');

const File = require('./File');



const chidi = () => new File('testing', 'assets/chidi.jpg');


describe('File', () => {

  it('accepts source and path arguments', () => {
    const file = chidi();
    expect(file.source).toBe('testing');
    expect(file.path).toBe('assets/chidi.jpg');
  });

  it('returns the file Buffer', async () => {
    const file = chidi();
    const buffer = await file.getBuffer();
    const expected = await fs.readFile('testing/assets/chidi.jpg')
    expect(buffer.equals(expected)).toBe(true);
  });

});
