// @ts-check
/** @typedef {import('./matrix.js').Matrix} Matrix */
/** @typedef {import('./matrix.js').Point} Point */

import {
  identity,
  transform,
  translate,
  transpose,
  multiply,
  flipX,
  flipY,
}from './matrix.js';

// // FIXME unused debugging utils

// /**
//  * @param {Matrix} matrix
//  * @returns {Array<number>}
//  */
// function array(matrix) {
//   const {
//     0: a1, 1: b1, 2: c1,
//     3: a2, 4: b2, 5: c2,
//     6: a3, 7: b3, 8: c3,
//   } = matrix;
//   return [
//     a1, b1, c1,
//     a2, b2, c2,
//     a3, b3, c3
//   ];
// }

// /**
//  * @param {Matrix} matrix
//  */
// function showMatrix(matrix) {
//   let strings = array(matrix).map(String);
//   const longest = Math.max(...strings.map(string => string.length));
//   const prefix = new Array(longest).fill(' ').join('');
//   strings = strings.map(string =>
//     (prefix + string).slice(prefix.length + string.length - longest));
//   let [a1, b1, c1, a2, b2, c2, a3, b3, c3] = strings;
//   console.log(`⌈ ${a1} ${b1} ${c1} ⌉`);
//   console.log(`⎮ ${a2} ${b2} ${c2} ⎮`);
//   console.log(`⌊ ${a3} ${b3} ${c3} ⌋`);
// }

/**
 * @param {Matrix} a
 * @param {Matrix} b
 * @returns {boolean}
 */
export function equalMatrixes(a, b) {
  return (
    a[0] === b[0] &&
    a[1] === b[1] &&
    a[2] === b[2] &&
    a[3] === b[3] &&
    a[4] === b[4] &&
    a[5] === b[5] &&
    a[6] === b[6] &&
    a[7] === b[7] &&
    a[8] === b[8]
  );
}

/**
 * @param {Point} a
 * @param {Point} b
 * @returns {boolean}
 */
export function equalPoints(a, b) {
  return (
    a.x === b.x &&
    a.y === b.y
  );
}

/**
 * @param {Matrix} a
 * @param {Matrix} b
 */
export function assertEqualMatrixes(a, b) {
  if (!equalMatrixes(a, b)) {
    throw new Error(`matrixes inequal ${a} ${b}`);
  }
}

/**
 * @param {Point} a
 * @param {Point} b
 */
export function assertEqualPoints(a, b) {
  if (!equalPoints(a, b)) {
    throw new Error(`points inequal, expect (${a.x}, ${a.y}) actual (${b.x}, ${b.y})`);
  }
}

console.log('# transform by identity');
assertEqualPoints(
  {x: 1, y: 2},
  transform({x: 1, y: 2}, identity)
);

console.log('# transform by translate');
assertEqualPoints(
  {x: 2, y: 3},
  transform({x: 1, y: 2}, translate({x: 1, y: 1}))
);

console.log('# transform by translate by translate');
assertEqualPoints(
  {x: 4, y: 6},
  transform({x: 1, y: 2}, multiply(translate({x: 1, y: 1}), translate({x: 2, y: 3})))
);

console.log('# transform by flipY');
assertEqualPoints(
  {x: -1, y: 2},
  transform({x: 1, y: 2}, flipY)
);

console.log('# transform by flipX');
assertEqualPoints(
  {x: 1, y: -2},
  transform({x: 1, y: 2}, flipX)
);

console.log('# transform by transpose');
assertEqualPoints(
  {x: 2, y: 1},
  transform({x: 1, y: 2}, transpose)
);

console.log('# transform by transpose and transpose');
assertEqualPoints(
  {x: 1, y: 2},
  transform({x: 1, y: 2}, multiply(transpose, transpose))
);

console.log('# transform by flipY and transpose');
assertEqualPoints(
  {x: -2, y: 1},
  transform({x: 1, y: 2}, multiply(flipY, transpose))
);

console.log('# transform by flipY and transpose and translate');
assertEqualPoints(
  {x: 1, y: 5},
  transform({x: 1, y: 2}, multiply(translate({x: 3, y: 4}), multiply(flipY, transpose)))
);

console.log('# transform by transpose by identity');
assertEqualPoints(
  {x: 2, y: 1},
  transform({x: 1, y: 2}, multiply(transpose, identity))
);

console.log('# transform by translate and flipY');
assertEqualPoints(
  {x: 0, y: 3},
  transform({x: 1, y: 2}, multiply(translate({x: 1, y: 1}), flipY))
);
