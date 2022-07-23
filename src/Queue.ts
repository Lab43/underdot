import EventEmitter, { once } from "events";



type PromiseGenator = () => Promise<void>;

export enum Events {
  empty = 'empty',
  error = 'error',
}



class Queue {

  #max: number;
  #current: number = 0; // number of promises we are currently waiting to resolve
  #queue: PromiseGenator[] = [];
  #emitter = new EventEmitter();

  constructor (concurrency: number) {
    this.#max = concurrency;
  }

  public async add (generator: PromiseGenator) {
    this.#queue.push(generator);
    this.#go();
  }

  async #go () {
    if (this.#current >= this.#max) return;
    const generator = this.#queue.shift();
    // istanbul ignore next
    if (typeof generator === 'undefined') return; // in theory this shouldn't be possible
    this.#current++;
    try {
      await generator();
    } catch (error) {
      this.#emitter.emit(Events.error, error);
    }
    this.#current--;
    if (this.#isEmpty()) return this.#emitter.emit(Events.empty);
    if (this.#queue.length > 0) {
      this.#go();
    }
  }

  public on (event: Events, callback: (...args: any[]) => void) {
    return this.#emitter.on(event, callback);
  }

  #isEmpty() {
    return this.#current === 0 && this.#queue.length === 0;
  }

  public async waitToFinish() {
    if (!this.#isEmpty()) {
      await once(this.#emitter, Events.empty);
    }
    return;
  }

}


export default Queue;
