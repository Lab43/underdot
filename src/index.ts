import fs from 'fs/promises';
import p from 'path';

import defaultConfig, { Config } from './config.js';
import Queue, { Events } from './Queue.js';
import File from './File.js';



class Underdot {

  #source;
  #destination;
  #queue;
  public files: File[] = [];

  constructor (config: Config = {}) {
    this.#source = config.source || defaultConfig.source as string;
    this.#destination = config.destination || defaultConfig.destination as string;
    this.#queue = new Queue(config.concurrency || defaultConfig.concurrency as number);
  }

  public async build (): Promise<void> {

    this.files = [];

    // recursively parse through the source directory identifying files, pages, and templates
    const processDirectory = async (directory: string = '') => {
      // get everything in this directory, including subdirectories
      const everything = await fs.readdir(p.join(this.#source, directory), {withFileTypes: true});
      everything.forEach(async (thing) => {
        const path = p.join(directory, thing.name);
        // if this is a directory add another processor to the queue
        if (thing.isDirectory()) {
          this.#queue.add(() => processDirectory(path));
        } else {
          this.files.push(new File(path));
        }
      });
    }
    this.#queue.add(() => processDirectory());

    // wait for the directory structure to be read then process and output files
    await this.#queue.waitToFinish();
    this.files.forEach((file) => {
      this.#queue.add(async () => {
        await file.readFile(this.#source);
        await file.writeFile(this.#destination);
      })
    });

    await this.#queue.waitToFinish();

    // need to handle queue errors, currently they just get swallowed up

  }

}

export default Underdot;