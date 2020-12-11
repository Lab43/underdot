const Page = require('./Page');



const kant = () => new Page('testing', 'assets/kant.txt');


describe('Page class', () => {

  it('accepts source and path arguments', () => {
    const file = kant();
    expect(file.source).toBe('testing');
    expect(file.path).toBe('assets/kant.txt');
  });

  describe('parse method', () => {

    it('returns the directory name', async () => {
      const file = kant();
      const { dirname } = await file.parse();
      expect(dirname).toBe('assets');
    });

    it('returns a slug', async () => {
      const file = kant();
      const { slug } = await file.parse();
      expect(slug).toBe('assets/kant');
    });

    it('returns the file extension', async () => {
      const file = kant();
      const { ext } = await file.parse();
      expect(ext).toBe('txt');
    });

    it('returns the yaml front matter', async () => {
      const file = kant();
      const { metadata } = await file.parse();
      expect(metadata).toEqual({
        'title': 'Immanuel Kant',
        'subject': 'Philosophy',
      });
    });

    it('returns the body', async () => {
      const file = kant();
      const { body } = await file.parse();
      expect(body).toMatchSnapshot();
    });

  });

});
