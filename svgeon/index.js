// @ts-check

/**
 * @return {Promise<number>}
 */
export function animationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * @template T
 * @typedef {{
 *   promise: Promise<T>,
 *   resolve: (value:T) => void,
 *   reject: (reason:Error) => void
 * }} Deferred
 */

/*
 * @template T
 * @return {Deferred<T>}
 */
const defer = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * @param {number} ms
 * @return {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const inputPeriod = 200;
const turnPeriod = 100;

const aliases = {
  ArrowLeft: 'west',
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowRight: 'east',
};

async function main() {

  /**
   * @type {Deferred<void>}
   */
  let kick = defer();
  const queue = [];
  const keyboard = {};

  /**
   * @param {string} command
   */
  function enqueue(command) {
    queue.push(command);
    kick.resolve();
  }

  window.addEventListener('keydown', function keydown(event) {
    if (!event.repeat) {
      keyboard[event.key] = performance.now();
    }
  });

  window.addEventListener('keyup', function keyup(event) {
    if (event.key === 'Escape') {
      queue.length = 0;
    }
    const since = keyboard[event.key];
    if (since !== undefined) {
      const now = performance.now();
      const threshold = now - inputPeriod;
      const command = aliases[event.key];
      if (command !== undefined && since !== undefined && since > threshold) {
        enqueue(command);
      }
      delete keyboard[event.key];
    }
  });

  /**
   */
  function flush() {
    const now = performance.now();
    const threshold = now - inputPeriod;
    for (const [key, since] of Object.entries(keyboard)) {
      const command = aliases[key];
      if (command !== undefined ) {
        if (since < threshold) {
          keyboard[key] += inputPeriod;
          enqueue(command);
        }
      }
    }
  }

  /**
   * @param {number} v0
   * @param {number} v1
   * @param {number} t
   * @return {number}
   */
  function lerp(v0, v1, t) {
    return v0 * (1 - t) + v1 * t;
  }

  const x1s = [0];
  const y1s = [0];
  const x2s = [0];
  const y2s = [0];
  const elements = [document.getElementById('agent')];
  const transitions = [lerp];

  /**
   * @param {number} x
   * @param {number} y
   */
  function move(x, y) {
    x1s[0] = x2s[0];
    y1s[0] = y2s[0];
    x2s[0] = x1s[0] + x;
    y2s[0] = y1s[0] + y;
  }

  const commands = {
    west() { move(-1, 0); },
    east() { move(1, 0); },
    north() { move(0, -1); },
    south() { move(0, 1); }
  };

  /**
   * @param {string} command
   */
  function exec(command) {
    commands[command]();
    start = performance.now();
  }

  async function inputLoop() {
    while (true) {
      flush();
      await delay(inputPeriod);
    }
  }

  async function execLoop() {
    let d;
    while (true) {
      await Promise.all([kick.promise, d]);
      d = delay(turnPeriod);
      kick = defer();
      if (queue.length) {
        exec(queue.shift());
        kick.resolve();
      }
    }
  }

  let start = performance.now() - turnPeriod;

  async function animationLoop() {
    while (true) {
      const now = await animationFrame();
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const transition = transitions[i];
        const t = Math.max(0, Math.min(1, (now - start) / turnPeriod));
        element.setAttribute('x', String(transition(x1s[i], x2s[i], t)));
        element.setAttribute('y', String(transition(y1s[i], y2s[i], t)));
      }
    }
  }

  inputLoop();
  execLoop();
  animationLoop();

}

main();
