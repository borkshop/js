/** This creates a new xoshiro256+ based random number generator.
 * The user may provide a seed in number, string, or ArrayBuffer form.
 * If the seed string is a valid 64-character hex number or a 32-byte
 * ArrayBuffer, then it is loaded directly into the 256-bit generator state.
 * Otherwise the seed input is used to randomly fill the internal 256-bit
 * generator state.
 *
 * The returned generator object has random, randomInt, and randomBigint
 * methods for primitive float, uint32 and uint64 generation respectively.
 * It also has a writeInto(ArrayBuffer) method to generate arbitrary amounts of
 * random bytes.
 *
 * The generator may be saved in toString() form, and later restored by creating
 * a new generator using that string as seed.
 *
 * @param {number|bigint|string|ArrayBuffer} seed
 */
export function makeRandom(seed: number | bigint | string | ArrayBuffer): Readonly<{
    toString(): string;
    toJSON(): string;
    random(): number;
    randomInt(): number;
    randomBigint(): bigint;
    /** @param {ArrayBufferLike} buf */
    writeInto(buf: ArrayBufferLike): number;
}>;
/** This creates a hash object based on the xoshiro256+ random number generator.
 * Input to be hashed may be provided to the update() method.
 * Hash state may be reset() to start computing a new hash.
 * The digest() hashed so far may be retrieved at anytime; for efficiency, the
 * hash digest may also be accessed by writeInto(ArrayBuffer).
 *
 * A hash digest().buffer may also be passed directly to makeRandom() to
 * directly create a random generator seeded from a large amount of input.
 */
export function makeHash(): Readonly<{
    toString(): string;
    toJSON(): string;
    reset(): void;
    /** @param {string|ArrayBufferLike} strOrData */
    update(strOrData: string | ArrayBufferLike): void;
    digest(): Uint8Array;
    writeInto: (buf: ArrayBufferLike) => number;
}>;
/** This generates an (effectively) infinite stream of independent random generators.
* It will technically only generate 2^128 independent generators.
*
* @param {number|bigint|string|ArrayBuffer} seed
*/
export function generateRandoms(seed: number | bigint | string | ArrayBuffer): Readonly<{
    toString(): string;
    toJSON(): string;
    [Symbol.iterator](): Readonly<any>;
    /** @returns {IteratorYieldResult<ReturnType<makeRandom>>} */
    next(): IteratorYieldResult<ReturnType<typeof makeRandom>>;
}>;
/** This generates an (effectively) infinite stream of streams of independent random generators.
 * It will technically only generate 2^64 independent stream starting points,
 * each of which can only be used for 2^64 independent generators.
 *
 * @param {number|bigint|string|ArrayBuffer} seed
 */
export function generateStarts(seed: number | bigint | string | ArrayBuffer): {
    toString(): string;
    toJSON(): string;
    [Symbol.iterator](): any;
    /** @returns {IteratorYieldResult<ReturnType<generateRandoms>>} */
    next(): IteratorYieldResult<ReturnType<typeof generateRandoms>>;
};
