// @ts-check

/**
 * Generate random numbers from a seed.
 * Usage:
 *
 *   import {makePrng} from './cdom/prng';
 *
 *   const search = new URLSearchParams(location.search);
 *   const prng = makePrng(search.get('seed') || '');
 */

/**
 * @typedef {Uint32Array | Array<number>} Words
 */

/**
 * @typedef {{
 *  random(): number,
 *  randomUint32(): number,
 *  update(array: Words): void,
 *  scribble(buffer: Words): void,
 *  fork(): PRNG
 * }} PRNG
 */

import {makeXorShift128} from './xorshift128/index';

const encoder = new TextEncoder();

/**
 * @param {string} seed
 * @returns {PRNG}
 */
export function makePrng(seed) {
  const text = encoder.encode(seed);
  const padded = new Uint8Array(Math.ceil(text.length / 4) * 4);
  padded.set(text);
  const prng = makeXorShift128();
  prng.update(new Uint32Array(padded.buffer));
  return prng;
}
