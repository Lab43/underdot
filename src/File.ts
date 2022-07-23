import fs from 'fs/promises';
import p from 'path';



class File {

  private buffer: Buffer | null = null;

  constructor (
    private readonly path: string,
  ) {}

  public async readFile (dir: string) {
    return this.buffer = await fs.readFile(p.join(dir, this.path));
  }

  public async writeFile (dir: string) {
    if (!this.buffer) {
      throw new Error('The file must be read first.');
    }
    const path = p.join(dir, this.path);
    await fs.mkdir(p.dirname(path), {recursive: true});
    await fs.writeFile(path, this.buffer);
  }

}



export default File;