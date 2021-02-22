// @ts-check

/** @typedef {import('./tile-renderer.js').TileRenderer} TileRenderer */
/** @typedef {import('./daia.js').AdvanceFn} AdvanceFn */

import {circle} from './topology.js';

/**
 * @template T
 * @param {Set<T>} a
 * @param {Set<T>} b
 * @returns {Iterable<T>}
 */
function *setDifference(a, b) {
  for (const v of a) {
    if (!b.has(v)) {
      yield v;
    }
  }
}

/**
 * @callback RenderAroundFn
 * @param {number} tile
 * @param {number} radius
 */

/**
 * @typedef {Object} TileKeeper
 * @prop {RenderAroundFn} renderAround
 */

/**
 * @param {TileRenderer} renderer
 * @param {AdvanceFn} advance
 * @returns {TileKeeper}
 */
export function makeTileKeeper(renderer, advance) {
  let nextTiles = new Set();
  let prevTiles = new Set();

  /**
   * @param {number} at
   * @param {number} radius
   */
  function renderAround(at, radius) {
    nextTiles.clear();
    for (const t of circle(at, advance, radius)) {
      nextTiles.add(t);
    }
    for (const t of setDifference(prevTiles, nextTiles)) {
      renderer.exit(t);
    }
    for (const t of setDifference(nextTiles, prevTiles)) {
      renderer.enter(t);
    }
    [nextTiles, prevTiles] = [prevTiles, nextTiles];
  }

  return {renderAround}
}
