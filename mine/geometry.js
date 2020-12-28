// @ts-check

/** @typedef { import("cdom/tiles").Rect } Rect */
/** @typedef { import("cdom/tiles").Point } Point */

export const origin = {x:  0, y:  0};
export const north =  {x:  0, y: -1};
export const east =   {x: +1, y:  0};
export const south =  {x:  0, y: +1};
export const west =   {x: -1, y:  0};

/**
 * @param {number} n
 * @param {() => number} random
 * @returns {number}
 */
function half(n, random = Math.random) {
  const h = Math.floor(n / 2);
  if (random() < 0.5) {
    return n - h;
  }
  return h;
}

/**
 * Returns the given numbers as a duple in ascending order.
 *
 * @param {number} n
 * @param {number} m
 * @returns {[number, number]}
 */
function ascend(n, m) {
  if (n > m) {
    return [m, n];
  }
  return [n, m];
}

/**
 * @param {Rect} rect
 * @param {() => number} random
 * @returns {Point}
 */
export function centerOfRect({x, y, w, h}, random = Math.random) {
  return {x: x + half(w - 1, random), y: y + half(h - 1, random)};
}

/**
 * @param {Rect} rect
 * @returns {Point}
 */
export function sizeOfRect({w: x, h: y}) {
  return {x, y};
}

/**
 * @param {Rect} rect
 * @yields {Point}
 */
export function *pointsForRect({x, y, w, h}) {
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      yield {x: x + i, y: y + j};
    }
  }
}

/**
 * @param {Rect} rect
 * @yields {Point}
 */
export function *outerCorners({x, y, w, h}) {
  const x1 = x - 1;
  const y1 = y - 1;
  const x2 = x + w;
  const y2 = y + h;
  yield {x: x1, y: y1};
  yield {x: x2, y: y1};
  yield {x: x2, y: y2};
  yield {x: x1, y: y2};
}

/**
 * @param {Rect} rect
 * @yields {Point}
 */
export function *innerCorners({x, y, w, h}) {
  const x1 = x;
  const y1 = y;
  const x2 = x + w - 1;
  const y2 = y + h - 1;
  yield {x: x1, y: y1};
  yield {x: x2, y: y1};
  yield {x: x2, y: y2};
  yield {x: x1, y: y2};
}

/**
 * @param {Rect} rect
 * @yields {[Point, Point]}
 */
export function *edges(rect) {
  const [a, b, c, d] = outerCorners(rect);
  yield [a, b];
  yield [b, c];
  yield [c, d];
  yield [d, a];
};

/**
 * @param {Point} a
 * @param {Point} b
 * @param {() => number} random
 * @returns {Point}
 */
export function midpoint(a, b, random = Math.random) {
  return centerOfRect(rectForCorners(a, b), random);
}

/**
 * @param {Rect} rect
 * @param {() => number} random
 * @yields {Point}
 */
export function *midpointsForRect(rect, random = Math.random) {
  for (const [a, b] of edges(rect)) {
    yield midpoint(a, b, random);
  }
}

/**
 * @param {Rect} rect
 * @returns {Rect}
 */
export function insetRect({x, y, w, h}) {
  return {
    x: x + 1,
    y: y + 1,
    w: w - 2,
    h: h - 2,
  };
}

/**
 * Returns the rectangle that has the given opposing corners, regardless of
 * order.
 *
 * @param {Point} a
 * @param {Point} b
 * @returns {Rect} 
 */
export function rectForCorners({x, y}, {x: x2, y: y2}) {
  [x, x2] = ascend(x, x2);
  [y, y2] = ascend(y, y2);
  const w = x2 - x;
  const h = y2 - y;
  return {x, y, w, h};
}

/**
 * @param {Point} point
 * @returns {number}
 */
export function areaOfPoint({x, y}) {
  return x * y;
}

/**
 * @param {Rect} rect
 * @yields {Point}
 */
export function *border({x, y, w, h}) {
  for (let i = 0; i < w + 1; i++) {
    yield {x: x + i, y: y - 1};
  }
  for (let i = 0; i < h + 1; i++) {
    yield {x: x + w, y: y + i};
  }
  for (let i = 0; i < w + 1; i++) {
    yield {x: x + w - i, y: y + h};
  }
  for (let i = 0; i < h + 1; i++) {
    yield {x: x - 1, y: y + h - i};
  }
}

