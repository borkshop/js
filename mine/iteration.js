// @ts-check

/**
 * @param {number} n
 * @yields {number}
 */
export function *count(n) {
  for (let i = 0; i < n; i++) {
    yield i;
  }
}

/**
 * @param {Iterable<number>} source
 * @yields {number}
 */
export function *select(source) {
  let i = 0;
  for (const value of source) {
    if (value) {
      yield i;
    }
    i++;
  }
}
