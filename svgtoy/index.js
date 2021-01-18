// @ts-check

import './types.js';
import { animationFrame, defer, delay } from './async.js';

const inputPeriod = 200;
const turnPeriod = 100;

/** @type {number} */
let agent;
/** @type {number[]} */
const startXs = [];
/** @type {number[]} */
const startYs = [];
/** @type {number[]} */
const endXs = [];
/** @type {number[]} */
const endYs = [];
/** @type {HTMLElement[]} */
const elements = [];
/** @type {Transition[]} */
const transitions = [];

/** @type {Object<string, string>} */
const aliases = {
  h: 'west',
  H: 'west',
  j: 'south',
  J: 'south',
  k: 'north',
  K: 'north',
  l: 'east',
  L: 'east',
  8: 'north',
  4: 'west',
  6: 'east',
  2: 'south',
  ArrowLeft: 'west',
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowRight: 'east',
};

const agentTemplate = /** @type{HTMLElement} */(document.querySelector('#agentTemplate'));
const viewport = /** @type{HTMLElement} */(document.querySelector('#viewport'));

async function main() {

  /** @type {Deferred<void>} */
  let kick = defer();
  /** @type {string[]} */
  const queue = [];
  /** @type {Object<string, number>} */
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

  /** @type {Transition} */
  function lerp(v0, v1, t) {
    return v0 * (1 - t) + v1 * t;
  }

  /**
   * @param {number} entity
   * @param {number} x
   * @param {number} y
   */
  function teleport(entity, x, y) {
    startXs[entity] = x;
    endXs[entity] = x;
    startYs[entity] = y;
    endYs[entity] = y;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {string} moji
   * @return {number}
   */
  function addMoji(x, y, moji) {
    const entity = elements.length;
    teleport(entity, x, y);
    const element = agentTemplate.cloneNode(true);
    element.textContent = moji;
    elements[entity] = /** @type HTMLElement */(element);
    transitions[entity] = lerp;
    viewport.appendChild(element);
    return entity;
  }

  agent = addMoji(0, 0, '🙂');
  addMoji(-5, -4, '🔗');

  /**
   * @param {number} x
   * @param {number} y
   */
  function move(x, y) {
    startXs[agent] = endXs[agent];
    startYs[agent] = endYs[agent];
    endXs[agent] = startXs[agent] + x;
    endYs[agent] = startYs[agent] + y;
    transitions[agent] = lerp;
  }

  /** @type {Object<string, () => void>} */
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
      /** @type {Deferred<void>} */
      kick = defer();
      const command = queue.shift()
      if (command !== undefined) {
        exec(command);
        kick.resolve();
      }
    }
  }

  let start = performance.now() - turnPeriod;

  /**
   * @param {number} entity
   * @param {number} time
   * @return {number}
   */
  function locateX(entity, time) {
    const transition = transitions[entity];
    return transition(startXs[entity], endXs[entity], time);
  }

  /**
   * @param {number} entity
   * @param {number} time
   * @return {number}
   */
  function locateY(entity, time) {
    const transition = transitions[entity];
    return transition(startYs[entity], endYs[entity], time);
  }

  const center = {x: 0, y: 0};
  const radius = 5;

  /**
   * @param {number} t time since beginning of transition
   * @param {number} dt time since last animation
   */
  function chase(t, dt) {
    center.x = lerp(center.x, locateX(agent, t), 1 - Math.pow(0.995, dt));
    center.y = lerp(center.y, locateY(agent, t), 1 - Math.pow(0.995, dt));
    viewport.setAttribute('viewBox', `${center.x - radius} ${center.y - radius} ${radius * 2} ${radius * 2}`);
  }

  async function animationLoop() {
    let last = performance.now();
    while (true) {
      const now = await animationFrame();
      const t = Math.max(0, Math.min(1, (now - start) / turnPeriod));
      const dt = now - last;
      last = now;

      chase(t, dt);

      for (let entity = 0; entity < elements.length; entity++) {
        const element = elements[entity];
        element.setAttribute('x', String(locateX(entity, t)));
        element.setAttribute('y', String(locateY(entity, t)));
      }
    }
  }

  inputLoop();
  execLoop();
  animationLoop();
}

main();
