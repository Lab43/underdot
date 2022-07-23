import exp from 'constants';
import Queue, { Events } from '../src/Queue';



const delay = () => new Promise((resolve) => {
  setTimeout(() => {
    resolve('done');
  }, 10);
})


describe('Queue class', () => {

  test('runs an added promise immediately if concurrency hasn\'t been reached', async () => {
    const queue = new Queue(10);
    let a = false;
    queue.add(async () => {
      await delay();
      a = true;
    });
    await delay();
    expect(a).toBe(true);
  });

  test('waits to run promises if the max has been reached', async () => {
    const queue = new Queue(2);
    let b = false;
    let c = false;
    let a = false;
    // add three test promises to the queue
    queue.add(async () => {
      await delay();
      a = true;
    });
    queue.add(async () => {
      await delay();
      b = true;
    });
    queue.add(async () => {
      await delay();
      c = true;
    });
    await delay();
    // the first two should have finished but not the third
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(false);
    await delay();
    // now the third should also be done
    expect(c).toBe(true);
  });
  
  test('resolves waitToFinish when the queue empties', async () => {
    const queue = new Queue(10);
    let a = false;
    queue.add(async () => {
      await delay();
      a = true;
    });
    await expect(queue.waitToFinish()).resolves.not.toThrow();
    expect(a).toBe(true);
  });

  test('resolves wait to finish immediately if the queue is alread empty', async () => {
    const queue = new Queue(10);
    await expect(queue.waitToFinish()).resolves.not.toThrow();
  });

  test('emits an error event on a promise rejection', async () => {
    const queue = new Queue(10);
    queue.on(Events.error, (error) => {
      expect(error).toBe('message');
    });
    queue.add(() => {
      return new Promise((resolve, reject) => {
        reject('message');
      });
    });
  });

});