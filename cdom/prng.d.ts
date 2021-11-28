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
export function ingest(rng: PRNG, content: string | ArrayBuffer): PRNG;
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
export function countOutcomes(rngs: Iterable<PRNG>, world: (rng: PRNG, collect: (value: number) => void) => void): Map<number, number>[];
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
    /** @param {Uint32Array | number[]} [seed] */
    constructor(seed?: number[] | Uint32Array | undefined);
    /**
     * Chris Hibbert really wanted the default seed to be Bob's Coffee Façade,
     * which is conveniently exactly 64 bits long.
     *
     * @type {Uint32Array}
     */
    state: Uint32Array;
    high: number;
    low: number;
    advance(): void;
    _consumeIndex: number;
    /** @param {number} word */
    _consume(word: number): void;
    /** @param {ArrayBuffer} buffer */
    update(buffer: ArrayBuffer): void;
    random(): number;
    randomUint32(): number;
    /**
     * Writes random bytes into the given buffer.
     *
     * @param {ArrayBuffer} buffer
     */
    scribble(buffer: ArrayBuffer): void;
    fork(): XorShift128Plus;
}
export type PRNG = {
    /**
     * - returns a random number in the range [0, 1);
     * compatible replacement for Math.random()
     */
    random: () => number;
    /**
     * - returns a random 32-bit unsigned
     * integer, with better integrity for integer applications than applying the
     * legacy floating point API
     */
    randomUint32: () => number;
    /**
     * - folds data from a given array into
     * internal PRNG state; useful for hashing data
     */
    update: (buffer: ArrayBuffer) => void;
    /**
     * - writes 32 bit words from internal
     * PRNG state into a given buffer
     */
    scribble: (buffer: ArrayBuffer) => void;
    /**
     * - returns a new PRNG with copied internal state
     */
    fork: () => PRNG;
};
