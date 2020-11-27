// @ts-check
import {DOMgeon, DOMgeonInspector} from 'cdom/domgeon';
import {fillRect, toShader} from 'cdom/builder';
import {makeXorShift128} from './xorshift128/index';

const search = new URLSearchParams(location.search);

// Create a random number generator for the given or implied seed.
// This requires converting the seed *string* to a sequence of 4 byte words.
const encoder = new TextEncoder();
const given = encoder.encode(search.get('seed') || '');
const seed = new Uint32Array(Math.ceil(given.length / 4));
seed.set(new Uint32Array(given.buffer));
const prng = makeXorShift128();
prng.update(seed);

/** @typedef { import("./cdom/tiles").Point } Point */
/** @typedef { import("./cdom/tiles").Rect } Rect */
/** @typedef { import("./cdom/builder").Context } Context */

/**
 * @template T
 * @typedef { import("./cdom/builder").Shader<T> } Shader
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
});
globalThis.dmg = dmg;
new DOMgeonInspector(dmg, find('#inspector'));

const floorShader = toShader({plane: 'solid', kind: 'floor', classList: ['support', 'passable'], text: ''});
const treeShader = toShader({plane: 'solid', kind: 'wall', text: '🌲'});

dmg.grid.getPlane('solid').classList.add('lit');

/**
 * @param {Context} grid
 * @param {Point} pos
 * @param {Rect} rect
 */
function forestShader(grid, pos, rect) {
  floorShader(grid, pos, rect);
  if (prng.random() < .25 && !(pos.x === 50 && pos.y === 50)) {
    treeShader(grid, pos, rect);
  }
}

fillRect(dmg.grid, {x: 0, y: 0, w: 101, h: 101}, forestShader);

const actor = dmg.grid.createTile({pos: {x: 50, y: 50}, plane: 'solid', kind: 'char', classList: ['mover', 'input', 'focus'], text: '🙂'});
dmg.updateActorView(actor);
