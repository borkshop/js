// @ts-check
import {DOMgeon, DOMgeonInspector} from 'cdom/domgeon';
import {fillRect, toShader} from 'cdom/builder';
import {makePrng} from 'cdom/prng';

const search = new URLSearchParams(location.search);
const seed = search.get('seed') || '';
const prng = makePrng(seed);

/** @typedef { import("cdom/tiles").Point } Point */
/** @typedef { import("cdom/tiles").Rect } Rect */
/** @typedef { import("cdom/builder").Context } Context */

/**
 * @template T
 * @typedef { import("cdom/builder").Shader<T> } Shader
 */

/**
 * @template T
 * @param {T | null} value
 * @param {string} label
 * @returns {T}
 */
function check(value, label) {
  if (value == null) {
    throw new TypeError(`${label} must not be ${value}`);
  }
  return value;
}

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
function find(selector) {
  return check(document.querySelector(selector), selector);
}

const dmg = new DOMgeon({
  ui: document.body,
  keys: document.body,
  grid: find('.grid'),
  moveBar: find('.buttonbar.moves'),
  actionBar: find('.buttonbar.actions'),
  lightLimit: 0.2,
  procs: {
    link() {
      const search = new URLSearchParams();
      const match = /^(.*?)(\d*)$/.exec(seed);
      if (match === null) {
        throw new Error('assertion failed: regex should always match');
      }
      const n = parseInt(match[2] || '0', 10);
      search.set('seed', `${match[1]}${n + 1}`);
      window.location.search = search.toString();
    }
  }
});
globalThis.dmg = dmg;
new DOMgeonInspector(dmg, find('#inspector'));

const floorShader = toShader({plane: 'solid', kind: 'floor', classList: ['support', 'passable'], text: ''});
const treeShader = toShader({plane: 'solid', kind: 'wall', text: '🌲'});
const linkShader = toShader({
  plane: 'solid',
  kind:  'link',
  text: '🔗',
  classList: ['interact', 'wall'],
  data: { proc: 'link' }
});

dmg.grid.getPlane('solid').classList.add('lit');

const distance = prng.random() * 5 + 5;
const angle = prng.random() * Math.PI * 2;
const linkPos = {
  x: Math.round(distance * Math.cos(angle)),
  y: Math.round(distance * Math.sin(angle)),
};

/**
 * @param {Context} grid
 * @param {Point} pos
 * @param {Rect} rect
 */
function forestShader(grid, pos, rect) {
  floorShader(grid, pos, rect);
  if (pos.x === 0 && pos.y === 0) {
  } else if (pos.x == linkPos.x && pos.y === linkPos.y) {
    linkShader(grid, pos, rect);
  } else if ((prng.randomUint32() & 0x3) === 0) {
    treeShader(grid, pos, rect);
  }
}

fillRect(/** @type{Context} */(dmg.grid), {x: -50, y: -50, w: 101, h: 101}, forestShader);

const actor = dmg.grid.createTile({
  pos: {x: 0, y: 0},
  plane: 'solid',
  kind: 'char',
  classList: ['mover', 'input', 'focus'],
  text: '🙂'
});

dmg.updateActorView(actor);
