// @ts-check

/**
 * Enumerates a range of numbers.
 *
 * @param {number} [end]
 * @param {number} [start]
 * @param {number} [stride]
 * @yields {number}
 */
export function *count(end = Infinity, start = 0, stride = 1) {
  for (; start < end; start += stride) {
   yield start;
  }
}

/**
 * @template T
 * Enumerates the indexes of the truthy values in the source.
 * @param {Iterable<T>} source
 * @param {(value: T) => boolean} [test]
 * @yields {number}
 */
export function *select(source, test = Boolean) {
  let i = 0;
  for (const value of source) {
    if (test(value)) {
      yield i;
    }
    i++;
  }
}
