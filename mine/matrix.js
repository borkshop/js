// @ts-check

// Transforms 2D points through 3D homogeneous matrix transforms.
// A homogenous matrix transform can capture a sequence of
// affine transforms (translation, scale, skew, reflection, transposition)
// by matrix multiplication.

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 * }} Point
 */

/**
 * @typedef {{
 *   0: number,
 *   1: number,
 *   2: number,
 *   3: number,
 *   4: number,
 *   5: number,
 *   6: number,
 *   7: number,
 *   8: number,
 * }} Matrix
 */

/**
 * @param {Point} point
 * @param {Matrix} matrix
 * @returns {Point}
 */
export function transform(point, matrix) {
  const {
    0: a1, 1: b1, 2: c1, // r1
    3: a2, 4: b2, 5: c2, // r2
    // 0,     0,     1   // r3
  } = matrix;
  const {x, y /*, 1*/} = point; // c1
  return {
    // r  c   r  c   r  c
    x: a1*x + b1*y + c1, // r1*c1
    y: a2*x + b2*y + c2, // r2*c1
  };
}

/**
 * @param {Matrix} m
 * @param {Matrix} n
 * @returns {Matrix}
 */
export function multiply(m, n) {
  const {
    0: ma1, 1: mb1, 2: mc1, // r1
    3: ma2, 4: mb2, 5: mc2, // r2
    6: ma3, 7: mb3, 8: mc3, // r3
  } = m;
  const {
    // c1      c2      c3
    0: na1, 1: nb1, 2: nc1,
    3: na2, 4: nb2, 5: nc2,
    6: na3, 7: nb3, 8: nc3,
  } = n;
  return {
    // r   c     r   c     r   c
    0: ma1*na1 + mb1*na2 + mc1*na3, // r1*c1
    1: ma1*nb1 + mb1*nb2 + mc1*nb3, // r1*c2
    2: ma1*nc1 + mb1*nc2 + mc1*nc3, // r1*c3
    3: ma2*na1 + mb2*na2 + mc2*na3, // r2*c1
    4: ma2*nb1 + mb2*nb2 + mc2*nb3, // r2*c2
    5: ma2*nc1 + mb2*nc2 + mc2*nc3, // r2*c3
    6: ma3*na1 + mb3*na2 + mc3*na3, // r3*c1
    7: ma3*nb1 + mb3*nb2 + mc3*nb3, // r3*c2
    8: ma3*nc1 + mb3*nc2 + mc3*nc3, // r3*c3
  };
}

/**
 * @param {Point} vector
 * @returns {Matrix}
 */
export function translate({x, y}) {
  return {
    0:  1,  1:  0,  2:  x,
    3:  0,  4:  1,  5:  y,
    6:  0,  7:  0,  8:  1,
  };
}

/**
 * @type {Matrix}
 */
export const identity = {
  0:  1,  1:  0,  2:  0,
  3:  0,  4:  1,  5:  0,
  6:  0,  7:  0,  8:  1,
};


/**
 * @type {Matrix}
 */
export const flipY = {
  0: -1,  1:  0,  2:  0,
  3:  0,  4:  1,  5:  0,
  6:  0,  7:  0,  8:  1,
};

/**
 * @type {Matrix}
 */
export const flipX = {
  0:  1,  1:  0,  2:  0,
  3:  0,  4: -1,  5:  0,
  6:  0,  7:  0,  8:  1,
};

/**
 * @type {Matrix}
 */
export const transpose = {
  0:  0,  1:  1,  2:  0,
  3:  1,  4:  0,  5:  0,
  6:  0,  7:  0,  8:  1
};
