// @ts-check

import {translate, rotateX, rotateY, rotateZ} from './matrix3d.js';
import {turnVectors} from './geometry2d.js';

/** @typedef {import('./matrix3d.js').Matrix} Matrix */
/** @typedef {import('./camera.js').Camera} Camera */
/** @typedef {import('./daia.js').AdvanceFn} AdvanceFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */
/** @typedef {import('./daia.js').Cursor} Cursor */
/** @typedef {import('./daia.js').CursorChange} CursorChange */

/**
 * @callback EaseFn
 * @param {number} p
 * @returns {number}
 */

/** @type {EaseFn} */
const linear = (/** @type {number} */p) => p;

/**
 * @typedef {(p: number) => Matrix} Roll
 */

/**
 * @param {Object} options
 * @param {Camera} options.camera
 * @param {number} options.tileSize
 * @param {AdvanceFn} options.advance
 * @param {EaseFn} [options.ease]
 * @param {number} [options.slow]
 * @param {number} [options.fast]
 *
 */
export function makeCameraController({camera, tileSize, advance, ease = linear, fast = 500, slow = 1500}) {
  /**
   * @type {Array<Roll>}
   */
  const rolls = [
    (/** @type {number} */ p) => rotateX(-Math.PI/2 * ease(p)),
    (/** @type {number} */ p) => rotateY(-Math.PI/2 * ease(p)),
    (/** @type {number} */ p) => rotateX(Math.PI/2 * ease(p)),
    (/** @type {number} */ p) => rotateY(Math.PI/2 * ease(p)),
  ];

  /**
   * @param {Cursor} at
   * @returns {CursorChange}
   */
  function go(at) {
    const {direction} = at;
    const to = advance(at);
    if (to.transit) {

      // rotations
      camera.transition(slow, rolls[direction]);
      // translations
      camera.transition(slow, (/** @type {number} */ p) => rotateZ(-Math.PI/2 * to.turn * ease(p)));

    } else {
      const {x: dx, y: dy} = turnVectors[direction];
      camera.transition(fast, (/** @type {number} */ p) => {
        const e = ease(p);
        return translate({
          x: -dx * tileSize * e,
          y: -dy * tileSize * e,
          z: 0,
        })
      });
    }

    return to;
  }

  return {go};
}
