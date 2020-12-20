// @ts-check

import { north, east, south, west } from './geometry.js';

/** @typedef { import("cdom/tiles").Point } Point */
/** @typedef { import("./space.js").Space } Space */

/**
 * @param {number} area
 * @param {Space} space
 * @param {{[index: number]: number}} weights
 * @param {number} turnWeight
 */
export function makeRookSpace(area, space, weights, turnWeight) {

  /**
   * @param {number} from
   * @param {number} to
   * @returns {number}
   */
  function rookWeights(from, to) {
    const a = from >= area;
    const b = to >= area;
    if (a !== b) {
      return turnWeight;
    }
    return weights[to % area];
  }

  /**
   * @param {number} index
   * @param {Point} direction
   * @param {number} offset
   * @yields {number}
   */
  function *moveby(index, {x: dx, y: dy}, offset) {
    const {x, y} = space.point(index);
    index = space.index({x: x + dx, y: y + dy});
    if (index >= 0) {
      yield index + offset;
    }
  }

  /**
   * @param {number} index
   * @yields {number}
   */
  function *neighbors(index) {
    if (index >= area) {
      yield index - area;
      yield* moveby(index - area, north, area);
      yield* moveby(index - area, south, area);
    } else {
      yield index + area;
      yield* moveby(index, west, 0);
      yield* moveby(index, east, 0);
    }
  }

  return { neighbors, weights: rookWeights };
}
