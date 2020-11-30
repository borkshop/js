// @ts-check

// TODO move worthwhile parts into cdom/procgen

/** @typedef { import("cdom/tiles").Point } Point */
/** @typedef { import("cdom/tiles").Size } Size */
/** @typedef { import("cdom/tiles").Rect } Rect */

/**
 * Shrinks a region randomly, up to a given minimum size and area.
 *
 * @param {Rect} region
 * @param {Size&{a: number}} min
 * @param {object} [options]
 * @param {() => number} [options.random]
 * @returns {Rect}
 */
export function shrinkRegion(region, min, options={}) {
  const {
    random=Math.random,
  } = options;
  let {x, y, w, h} = region;
  const ux = Math.max(0, w - min.w);
  const uy = Math.max(0, h - min.h);
  if (ux * uy <= 0) return region;
  let dx = Math.floor(random() * ux);
  let dy = Math.floor(random() * uy);
  while ((w - dx) * (h - dy) < min.a) {
    if      (dx > dy) dx--;
    else if (dy > 0)  dy--;
    else              return region;
  }
  w -= dx, h -= dy;
  x += Math.floor(random() * dx);
  y += Math.floor(random() * dy);
  return {x, y, w, h};
}

/** @enum {number} */
export const Adjacent = {
  None: 0,
  Top: 1,
  Right: 2,
  Bottom: 3,
  Left: 4,
};

/**
 * Yields (in clockwise order) any sides of rectangle A that are externally
 * adjacent to the 4 infinite lines that intersect to define rectangle B.
 *
 * These results are tangent candidates, which need to be further checked for
 * orthogonal overlap to confirm their tangency.
 *
 * @param {Rect} a
 * @param {Rect} b
 * @returns {IterableIterator<Adjacent>}
 */
export function* adjacent(a, b) {
  const {x, y, w, h} = a;
  if (b.y + b.h === y    ) yield Adjacent.Top;
  if (b.x       === x + w) yield Adjacent.Right;
  if (b.y       === y + h) yield Adjacent.Bottom;
  if (b.x + b.w === x    ) yield Adjacent.Left;
}

/**
 * A range defined by offset (lower bound inclusive) and length (relative upper
 * bound exclusive). Essentially this is "half of a Rect", since either it's
 * x/w or y/h pairs define a Range.
 *
 * @typedef {object} Range
 * @prop {number} o - starting offset (absolute inclusive lower bound)
 * @prop {number} n - ending length (relative exclusive upper bound)
 */

/**
 * Returns any overlap between the two given ranges, maybe empty.
 *
 * @param {Range} a
 * @param {Range} b
 * @returns {Range}
 */
export function overlap({o: off1, n: n1}, {o: off2, n: n2}) {
  const hi1 = off1 + n1;
  const hi2 = off2 + n2;
  if (off1 <= off2 && hi2 <= hi1) return {o: off2, n: n2};
  if (off2 < off1 && hi1 < hi2) return {o: off1, n: n1};
  if (off2 <= off1 && off1 <= hi2) return {o: off1, n: Math.min(hi1, hi2) - off1};
  if (off2 <= hi1 && hi1 <= hi2) {
    const off = Math.max(off1, off2);
    return {o: off, n: hi1 - off};
  }
  return {o: 0, n: 0};
}

/**
 * @param {Adjacent} t
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Range}
 */
function orthoOverlap(t, a, b) {
  switch (t) {
    case Adjacent.Top:
    case Adjacent.Bottom:
      return overlap({o: a.x, n: a.w}, {o: b.x, n: b.w});
    case Adjacent.Right:
    case Adjacent.Left:
      return overlap({o: a.y, n: a.h}, {o: b.y, n: b.h});
  }
  return {o: 0, n: 0};
}

/**
 * @typedef {object} Tangent
 * @prop {Adjacent} t
 * @prop {Range} o
 */

/**
 * @param {Rect} a
 * @param {Rect} b
 * @returns {IterableIterator<Tangent>}
 */
export function* tangent(a, b) {
  for (const t of adjacent(a, b)) {
    const o = orthoOverlap(t, a, b);
    if (o.n > 0) yield {t, o};
  }
}

/**
 * A Point from a Range; its p property is a proportion in [0, 1) indicating
 * how far through the Range.
 *
 * @typedef {Point&{p: number}} RangePoint
 */

/**
 * @param {Range} range
 * @param {number} co
 * @returns {IterableIterator<RangePoint>}
 */
function* eachPointX(range, co) {
  for (let i=0, v=range.o; i<range.n; i++, v++) {
    const p = i/range.n;
    yield {x: v, y: co, p};
  }
}

/**
 * @param {Range} range
 * @param {number} co
 * @returns {IterableIterator<RangePoint>}
 */
function* eachPointY(range, co) {
  for (let i=0, v=range.o; i<range.n; i++, v++) {
    const p = i/range.n;
    yield {x: co, y: v, p};
  }
}

/**
 * Yields labeled points along an edge of rectangle A and the adjacent edge of
 * rectangle B.
 *
 * Rectangle B is considered to be the "co-rectangle", its points have their
 * added co property set true.
 *
 * @param {Adjacent} t
 * @param {Range} o
 * @param {Rect} a
 * @param {Rect} b
 * @returns {IterableIterator<{co: boolean}&RangePoint>}
 */
export function* adjacentPoints(t, o, a, b) {
  let as, bs;
  switch (t) {
  case Adjacent.Bottom:
    as = eachPointX(o, a.y + a.h - 1);
    bs = eachPointX(o, b.y);
    break;
  case Adjacent.Top:
    as = eachPointX(o, a.y);
    bs = eachPointX(o, b.y + b.h - 1);
    break;
  case Adjacent.Right:
    as = eachPointY(o, a.x + a.w - 1);
    bs = eachPointY(o, b.x);
    break;
  case Adjacent.Left:
    as = eachPointY(o, a.x);
    bs = eachPointY(o, b.x + b.w - 1);
    break;
  default: return;
  }
  for (const p of as) yield {co: false, ...p}
  for (const p of bs) yield {co: true, ...p}
}
