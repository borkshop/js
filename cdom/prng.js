// @ts-check

/**
 * @typedef {object} PRNG
 *
 * @prop {() => number} random - returns a random number in the range [0, 1);
 * compatible replacement for Math.random()
 *
 * @prop {() => number} randomUint32 - returns a random 32-bit unsigned
 * integer, with better integrity for integer applications than applying the
 * legacy floating point API
 *
 * @prop {(buffer: ArrayBuffer) => void} update - folds data from a given array into
 * internal PRNG state; useful for hashing data
 *
 * @prop {(buffer: ArrayBuffer) => void} scribble - writes 32 bit words from internal
 * PRNG state into a given buffer
 *
 * @prop {() => PRNG} fork - returns a new PRNG with copied internal state
 */

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
 * Ingests string content into a given PRNG; useful for seeding from a user
 * string, or as a convenient way to hash string content.
 *
 * @param {PRNG} rng
 * @param {string|ArrayBuffer} content
 * @returns {PRNG}
 */
export function ingest(rng, content) {
  const n = typeof content === 'string'
    ? content.length
    : content.byteLength;
  if (n > 0) rng.update(typeof content === 'string'
    ? new TextEncoder().encode(content).buffer
    : content);
  return rng;
}

/**
 * This variation on the xorshift128+ psuedo-random number generator provides
 * an API that allows the user to inject more entropy into the generator's
 * state between extractions.
 *
 * The generator provides an API suitable for use both as a random number
 * generator and also a hash digest.
 * As a random number generator, it accepts a seed and returns an object
 * implementing `random()`, like `Math.random()`.
 * To preserve integer integrity, it also provides `randomUint32()`, which
 * returns the noiser high 32 bits of randomness from the underlying 64 bits of
 * randomness provided by a crank of the xorshift128+ algorithm.
 *
 * As a hash digest, like one that implements {`update()` and `digest()`}, the
 * generator provides `update(array)`, which will fold an arbitrary amount of
 * entropy into its own state from an array or typed array of 32 bit unsigned
 * integers.
 * The `random()` function serves as `digest()`, but doesn't leave the
 * generator in a useless state.
 *
 * In addition, `fork()` will create a new branch of the generator sequence
 * beginning with the same state, and is useful for testing.
 *
 * Once significant difference in this implementation to the prior version by
 * Andreas Madsen & Emil Bay is that there is no method that returns an duple
 * of [high and low] unsigned 32 bit integers, owing to a prejudice against
 * unnecessary allocation.
 * Instead, pass a reusable array or typed array to the `scribble` method.
 *
 * Portions of this software are licensed under "MIT"
 * Copyright (c) 2014 Andreas Madsen & Emil Bay
 * https://github.com/AndreasMadsen/xorshift
 */
export class XorShift128Plus {
  /**
   * Chris Hibbert really wanted the default seed to be Bob's Coffee Façade,
   * which is conveniently exactly 64 bits long.
   *
   * @type {Uint32Array}
   */
  state = new Uint32Array([0xb0b5c0ff, 0xeefacade, 0xb0b5c0ff, 0xeefacade])
  high = 0
  low = 0

  /** @param {Uint32Array | number[]} [seed] */
  constructor(seed) {
    if (seed) {
      if (seed.length !== 4) {
        throw new TypeError(
          `Cannot construct XorShift128Plus RNG: seed must have a length of 4, got ${seed.length}`,
        );
      }
      for (let i=0; i<4; i++) if (seed[i] >>> 0 !== seed[i]) {
        throw new RangeError(
          `Cannot construct XorShift128Plus RNG: seed[${i}] must have a value in the range of a 32 bit unsigned integer, got ${seed[i]}`,
        );
      }
      this.state.set(seed);
    }
  }

  advance() {
    // uint64_t s1 = s[0]
    let s1U = this.state[0];
    let s1L = this.state[1];
    // uint64_t s0 = s[1]
    const s0U = this.state[2];
    const s0L = this.state[3];

    // result = s0 + s1
    const sumL = (s0L >>> 0) + (s1L >>> 0);
    this.high = (s0U + s1U + ((sumL / 2) >>> 31)) >>> 0;
    this.low = sumL >>> 0;

    // s[0] = s0
    this.state[0] = s0U;
    this.state[1] = s0L;

    // - t1 = [0, 0]
    let t1U = 0;
    let t1L = 0;
    // - t2 = [0, 0]
    let t2U = 0;
    let t2L = 0;

    // s1 ^= s1 << 23;
    // :: t1 = s1 << 23
    const a1 = 23;
    const m1 = 0xffffffff << (32 - a1);
    t1U = (s1U << a1) | ((s1L & m1) >>> (32 - a1));
    t1L = s1L << a1;
    // :: s1 = s1 ^ t1
    s1U ^= t1U;
    s1L ^= t1L;

    // t1 = ( s1 ^ s0 ^ ( s1 >> 17 ) ^ ( s0 >> 26 ) )
    // :: t1 = s1 ^ s0
    t1U = s1U ^ s0U;
    t1L = s1L ^ s0L;
    // :: t2 = s1 >> 18
    const a2 = 18;
    const m2 = 0xffffffff >>> (32 - a2);
    t2U = s1U >>> a2;
    t2L = (s1L >>> a2) | ((s1U & m2) << (32 - a2));
    // :: t1 = t1 ^ t2
    t1U ^= t2U;
    t1L ^= t2L;
    // :: t2 = s0 >> 5
    const a3 = 5;
    const m3 = 0xffffffff >>> (32 - a3);
    t2U = s0U >>> a3;
    t2L = (s0L >>> a3) | ((s0U & m3) << (32 - a3));
    // :: t1 = t1 ^ t2
    t1U ^= t2U;
    t1L ^= t2L;

    // s[1] = t1
    this.state[2] = t1U;
    this.state[3] = t1L;
  }

  _consumeIndex = 0

  /** @param {number} word */
  _consume(word) {
    this.state[this._consumeIndex] ^= word;
    this._consumeIndex = (this._consumeIndex + 1) & (4 - 1);
    this.advance();
  }

  /** @param {ArrayBuffer} buffer */
  update(buffer) {
    const view = new DataView(buffer)
    const whole = 4 * Math.floor(view.byteLength / 4);
    let offset = 0;
    for (; offset < whole; offset += 4)
      this._consume(view.getUint32(offset));
    switch (view.byteLength % 4) {
      case 3:
        this._consume(view.getUint8(offset++));
        this._consume(view.getUint16(offset));
        break;
      case 2:
        this._consume(view.getUint16(offset));
        break;
      case 1:
        this._consume(view.getUint8(offset));
        break;
    }
  }

  random() {
    this.advance();
    return this.high        * 2.3283064365386963e-10 + // * Math.pow(2, -32)
          (this.low >>> 12) * 2.220446049250313e-16;   // * Math.pow(2, -52)
  }

  randomUint32() {
    // High bits are noiser.
    this.advance();
    return this.high;
  }

  /**
   * Writes random bytes into the given buffer.
   *
   * @param {ArrayBuffer} buffer
   */
  scribble(buffer) {
    let n = 0;
    const produce = () => {
      const even = (n++ % 2) === 0;
      if (even) this.advance();
      return even ? this.high : this.low;
    };
    const view = new DataView(buffer);
    const whole = 4 * Math.floor(view.byteLength / 4);
    let offset = 0;
    for (; offset < whole; offset += 4)
      view.setUint32(offset, produce());
    const rem = view.byteLength % 4;
    if (rem > 0 ) {
      const val = produce();
      switch (rem) {
        case 3:
          view.setUint8(offset++, val & 0xff);
          view.setUint16(offset, (val >>> 8) & 0xffff);
          break;
        case 2:
          view.setUint16(offset, val & 0xffff);
          break;
        case 1:
          view.setUint8(offset, val & 0xff);
          break;
      }
    }
  }

  fork() {
    return new XorShift128Plus(this.state);
  }
}

/**
 * Runs a given world function under a stream of RNGs, returning a frequency
 * counts for each successive random choice.
 *
 * For example, if you care about rolling 4d6 (drop lowest) across a few stats:
 *
 *   PRNG.countOutcomes(someLikelyRNGs, (rng, count) => {
 *     for (let i = 0; i < 6; ++i) count(
 *       new Array(4).fill(1).map(              // 4
 *         _ => Math.floor((rng.random() * 6))) // d6
 *         .sort((a, b) => a - b)               // sort ascending
 *         .slice(1)                            // drop lowest
 *         .reduce((a, b) => a + b)             // sum
 *     );
 *   })
 *
 * For someLikelyRNGs, typically use either an eager Array<PRNG> or a lazy
 * function()* to generate many lazily; it can also be easier to write a
 * stateful generator, than to build an ahead-of-time list for scenarios where
 * each generation's seed is determined by the prior generation.
 *
 * @param {Iterable<PRNG>} rngs
 * @param {(rng: PRNG, collect: (value: number) => void) => void} world
 */
export function countOutcomes(rngs, world) {
  /** @type {Array<Map<number, number>>} */
  const rounds = [];
  for (const rng of rngs) {
    let i = 0;
    world(rng, value => {
      const counts = rounds[i] || (rounds[i] = new Map());
      counts.set(value, (counts.get(value) || 0) + 1);
      i++;
    });
  }
  return rounds;
}
