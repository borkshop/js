// @ts-check

import {circle} from './circle.js';
import {setDifference} from './set.js';

/** @typedef {import('./daia.js').AdvanceFn} AdvanceFn */

/**
 * @callback TileFn
 * @param {number} tile
 */

/**
 * @callback RenderAroundFn
 * @param {number} tile
 * @param {number} radius
 */

/**
 * @typedef {Object} TileKeeper
 * @prop {RenderAroundFn} keepTilesAround
 */

/**
 * @param {Object} args
 * @param {TileFn} args.enter
 * @param {TileFn} args.exit
 * @param {AdvanceFn} args.advance
 * @returns {TileKeeper}
 */
export function makeTileKeeper({enter, exit, advance}) {
  let nextTiles = new Set();
  let prevTiles = new Set();

  /**
   * @param {number} at
   * @param {number} radius
   */
  function keepTilesAround(at, radius) {
    nextTiles.clear();
    for (const t of circle(at, advance, radius)) {
      nextTiles.add(t);
    }
    for (const t of setDifference(prevTiles, nextTiles)) {
      exit(t);
    }
    for (const t of setDifference(nextTiles, prevTiles)) {
      enter(t);
    }
    [nextTiles, prevTiles] = [prevTiles, nextTiles];
  }

  return {keepTilesAround};
}
