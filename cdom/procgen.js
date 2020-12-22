// @ts-check

/// basic Iterator<T> tools

/** An Iterator version of Array.prototype.map
 *
 * @template S,T
 * @param {Iterable<S>} it
 * @param {(s: S) => T} fn
 * @returns {IterableIterator<T>}
 */
export function* map(it, fn) {
  for (const s of it) yield fn(s);
}

/** An Iterator version of Array.prototype.filter
 *
 * @template T
 * @param {Iterable<T>} it
 * @param {(t: T) => boolean} filter
 * @returns {IterableIterator<T>}
 */
export function* filter(it, filter) {
  for (const i of it) if (filter(i)) yield i;
}

/// 2d spatial routines

/** @typedef {import('./tiles').Point} Point */
/** @typedef {import('./tiles').Size} Size */
/** @typedef {import('./tiles').Rect} Rect */

import {
  mortonKey,
} from './tiles';

/** Yields the 4 cardinal neighbors of a point in clockwise order.
 *
 * @param {Point} p
 * @returns {IterableIterator<Point>}
 */
export function* cardinals({x, y}) {
  yield {x, y: y-1};
  yield {x: x+1, y};
  yield {x, y: y+1};
  yield {x: x-1, y};
}

/** Yields the 4 ordinal neighbors of a point in clockwise order.
 *
 * @param {Point} p
 * @returns {IterableIterator<Point>}
 */
export function* ordinals({x, y}) {
  yield {x: x+1, y: y-1};
  yield {x: x+1, y: y+1};
  yield {x: x-1, y: y+1};
  yield {x: x-1, y: y-1};
}

/** Yields all 8 neighbors of a point in clockwise order.
 *
 * @param {Point} p
 * @returns {IterableIterator<Point>}
 */
export function* neighbors({x, y}) {
  yield {x,      y: y-1};
  yield {x: x+1, y: y-1};
  yield {x: x+1, y};
  yield {x: x+1, y: y+1};
  yield {x,      y: y+1};
  yield {x: x-1, y: y+1};
  yield {x: x-1, y};
  yield {x: x-1, y: y-1};
}

/** Returns true only if rect contains all points in ps.
 *
 * @param {Rect} rect
 * @param {Point[]} ps
 * @returns {boolean}
 */
export function contains({x, y, w, h}, ...ps) {
  for (const {x: px, y: py} of ps)
    if ( !(x <= px && px < x+w)
      || !(y <= py && py < y+h)
    ) return false;
  return true;
}

/** Iterates all points connected to a given starting point.
 *
 * Semantics are defined by a query(Point) => {supported, blocked, at} :
 * - whether a given point is spatially defined (supported)
 * - whether a given point is unpassable (blocked)
 * - and is able to pass arbitrary spatial query data at each point through to
 *   the consumer.
 *
 * Search starts from the given pos: Point and
 * - stops on any unsupported or blocked point
 * - blocked points are still yielded, leaving edge inclusion/exclusion up to the consumer
 * - proceeds from any unblocked point to all next(Point) => Iterable<Point> that have not yet been seen
 *
 * @template At
 * @param {Point} pos
 * @param {(at: Point) => {supported: boolean, blocked: boolean, at: At}} query
 * @param {(p: Point) => Iterable<Point>} next
 * @returns {IterableIterator<{at: At, blocked: boolean} & Point>}
 */
export function* iterateSpace(pos, query, next=cardinals) {
  // TODO maybe unify with cdom/fov.iterateField
  /** @type {Set<number>} */
  const seen = new Set();
  const q = [pos];
  while (q.length) {
    const p = q.shift();
    if (!p) continue;
    const k = mortonKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    const {supported, blocked, at} = query(p);
    if (!supported) continue;
    yield {at, blocked, ...p};
    if (!blocked)
      for (const np of next(p))
        if (!seen.has(mortonKey(np))) q.push(np);
  }
}

/// Space Partitioning, mostly Binary

// NOTE for random selection within a range throughout, we use:
//     Range * random()
// which is technically biased, but idiomatic in javascript

/**
 * @typedef {object} Split
 * @prop {number} point
 * @prop {boolean} dir - false if point is X, true if point is Y
 */

/**
 * @param {Rect} region
 * @param {Split} split
 * @returns {{left: Rect, right: Rect}}
 */
function splitRegion (region, {point, dir}) {
  let {x, y, w, h} = region;
  if (dir) {
    const left = {x, w, y, h: point - y - 1};
    const right = {x, w, y: point - 1, h: h - left.h};
    return {left, right};
  }
  const left = {y, h, x, w: point - x - 1};
  const right = {y, h, x: point - 1, w: w - left.w};
  return {left, right};
}

/**
 * Binary Space Partitioning scheme for procedural generation.
 *
 * @template R - regional data type used to pass filled and connection region
 * data up the tree, and out as the final run result
 */
export class BSP {
  /**
   * @template R
   * @typedef {object} BSPOptions
   * @prop {(region: Rect, id: number) => null|R} fill - regional fill function,
   * return null to decline a region, having it further sub-divided
   * @prop {(a: R, b: R) => R} connect - region connector function,
   * receives data from two areas that are each either a filled region leaf or
   * a tree of connected regions
   * @prop {Size} [limit] - sub-division limit
   * @prop {() => number} [random] - random chooser, must return a value
   * in the range [0, 1.0), defaults to Math.random
   * @prop {number} [splitRange] - random range to choose split values
   * over, defaults to 0.2; TODO directionality?
   * @prop {number} [splitOffset] - random offset to start choosing
   * split values from, defaults to 0.4; TODO directionality?
   */

  /**
   * @template R
   * @param {BSPOptions<R> & {bounds: Rect}} options
   */
  static run(options) {
    const {bounds, ...opts} = options;
    const bsp = new BSP(opts);
    return bsp.run(bounds);
  }

  fill
  connect
  limit = {w: 5, h: 5}
  random = Math.random
  splitRange = 0.2
  splitOffset = 0.4

  /** @param {BSPOptions<R>} options */
  constructor(options) {
    this.fill = options.fill;
    this.connect = options.connect;
    if (options.limit) this.limit = options.limit;
    if (options.random) this.random = options.random;
    if (options.splitRange) this.splitRange = options.splitRange;
    if (options.splitOffset) this.splitOffset = options.splitOffset;
  }

  /**
   * @param {Rect} region
   * @returns {boolean}
   */
  chooseSplitDir({w, h}) {
    return this.random() >= w / h;
    // return this.random() < w / h;
  }

  /**
   * @param {Rect} region
   * @returns {null|Split}
   */
  chooseSplit(region) {
    let {x, y, w, h} = region;
    // cannot split if neither size is sufficient
    if (w <= this.limit.w && h <= this.limit.h) return null;
    const dir = w > this.limit.w            // if both sizes
              ? h > this.limit.h            // are sufficient
              ? this.chooseSplitDir(region) // choose randomly
              : false : true;               // otherwise only one is possible
    const rand = this.splitOffset + this.splitRange * this.random();
    const point = Math.floor(dir ? y + h * rand : x + w * rand);
    return {point, dir};
  };

  /**
   * @param {Rect} bounds
   * @returns {null|R}
   */
  run(bounds) {
    return binaryReduce({
      res: binaryDivide({
        regions: [bounds],
        fill: (region, i) => this.fill(region, i),
        chooseSplit: region => this.chooseSplit(region),
      }),
      connect: (a, b) => this.connect(a, b),
    });
  }
}

/** Recursively subdivides regions within a binary tree, stopping descent
 * once a region has been filled by the given fill function.
 *
 * An advanced user may retain and pass all of regions, res, and q along
 * with a constrained maxRounds to smear recursion across many calls.
 *
 * Such a user should check q.length === 0 to know hen to stop.
 *
 * Similarly, allocation averse users may retain/clear/reuse the regions, res,
 * and q arrays.
 *
 * @template R - arbitrary result data type, as returned by the fill and
 * realize functions for later processing
 *
 * @param {object} params
 *
 * @param {Rect[]} params.regions - an implicit binary tree of region
 * rectangles, all regions[q[i]] elements must be defined; i.e. this should
 * typically be a singleton array containing the root bounding rectangle.
 *
 * @param {(null|R)[]} [params.res] - an implicit binary tree, aligned with
 * regions, with a result for each (necessarily leaf!) region where realize or
 * fill returned non-null
 *
 * @param {number[]} [params.q] - the iteration/recursion queue, will default
 * to [0] so as to start division from a root bounding rectangle
 *
 * @param {number} [params.maxRounds] - a limit on the number of iteration
 * rounds allowed, defaults to the total area of all regions indexed by q; a
 * round creates either a non-null result (from realize or fill) or a new split
 * point (chooseSplit) is queued; when this limit is exceeded, the binaryDivide
 * returns normally; if the caller cares to test for such early exit, they must
 * pass an explicit q, and then later check if it's not empty when "done"
 *
 * @param {(region: Rect, i: number) => null|R} [params.fill] - decides whether
 * to stop subdivision by populating a region: any non-null value it returns
 * will be collect as a leaf result in the binary result tree
 *
 * @param {(region: Rect, i: number) => null|Split} [params.chooseSplit] -
 * picks split points within branch regions; each region to the "left" and
 * "right" of the split point will be queued, and eventually seen by the fill
 * function in a future round
 *
 * @param {(region: Rect, split: Split, i: number) => null|R} [params.realize] -
 * has an opportunity to provide a result for a region split, pre-empting
 * recursive fill and potential sub-division of its children
 *
 * @returns {(null|R)[]} - the res(ult) array, an implicit binary tree with any
 * non-null results returned by realize or fill (necessarily at leaf positions)
 */
export function binaryDivide({
  regions,

  // default to creating a new/empty result set
  res = [],

  // default to starting from a root region
  q = [0],

  // default to one round for every possible integer location in the initial q
  maxRounds = q
    .map(i => regions[i])
    .map(({w, h}) => w * h)
    .reduce((a, b) => a + b, 0),

  fill,
  realize,

  // default split to right down the (largest) middle!
  chooseSplit = ({x, y, w, h}) => {
    const dir = h >= w;
    const point = Math.floor(h >= w ? y+h/2 : x+w/2);
    return {point, dir}
  },
}) {
  let remain = maxRounds;
  for (let i = q.shift(); i !== undefined; i = q.shift()) if (remain-->0) {
    // skip degenerate regions (possible for extreme values of splitRange + splitOffset)
    const region = regions[i];
    if (region.w <= 0 || region.h <= 0) continue;

    // done if filled
    if (fill && (res[i] = fill(region, i))) continue;

    // done if cannot sub-divide
    const split = chooseSplit(region, i);
    if (!split) continue;

    // done if realized
    if (realize && (res[i] = realize(region, split, i))) continue;

    // queue sub-regions
    const li = 2*i + 1, ri = 2*i + 2;
    const {left, right} = splitRegion(region, split);
    regions[li] = left, regions[ri] = right;
    if (left.w * left.h > 0) q.push(li);
    if (right.w * right.h > 0) q.push(ri);
  }
  return res;
}

/** Combines results within a binary tree, starting from the leafs on up.
 *
 * Null values are coalesced so that the connect function only sees non-null
 * results, and the final result is null only if all of the binary tree results
 * were null.
 *
 * Primarily of use for processing the results from binaryDivide.
 *
 * @template R
 * @param {object} params
 * @param {(R|null)[]} params.res
 * @param {(a: R, b: R) => R} params.connect
 * @returns {R|null}
 */
export function binaryReduce({res, connect}) {
  /** @param {null|R} a @param {null|R} b */
  const reduce = (a, b) => a ? b ? connect(a, b) : a : b;
  while (res.length > 1)
    binaryReduceOne({res, reduce});
  return res.shift() || null;
}

/** Combines results underneath the deepest full node of an implicit binary
 * tree, plus any additional odd sibling node.
 *
 * Calls the given reduction function one or two times, first on the two child
 * nodes of the deepest full-node, and maybe an additional time with its result
 * and an odd sibling node.
 *
 * @template R
 * @param {object} params
 * @param {(R|null)[]} params.res
 * @param {(a: R, b: R) => R} [params.connect]
 * @param {(a: R|null, b: R|null) => R|null} [params.reduce]
 * @returns {void}
 */
export function binaryReduceOne({res, connect,
  reduce = connect && ((a, b) => a ? b ? connect(a, b) : a : b),
}) {
  if (!reduce) throw new Error('procgen.binaryReduceOne: must provide a connect or reduce function');
  const c = res.length % 2 === 0 && res.pop() || null;
  const b = res.pop() || null;
  const a = res.pop() || null;
  res.push(reduce(reduce(a, b), c));
}

/// General random selection

/** Randomly choose things, with an optional weight function and custom random
 * generator.
 *
 * @template T
 * @param {Iterable<T>} things
 * @param {object} [options]
 * @param {() => number} [options.random]
 * @param {(thing: T) => number} [options.weight]
 * @returns {null|T}
 */
export function choose(things, options={}) {
  const {
    random = Math.random,
    weight = () => 1,
  } = options;
  let choice = null, bestScore = 0;
  for (const thing of things) {
    const w = weight(thing);
    if (w <= 0) {
      if (!choice) choice = thing;
      continue;
    }
    const score = Math.pow(random(), 1/w);
    if (!choice || bestScore < score)
      choice = thing, bestScore = score;
  }
  return choice;
}

/** Selects a random rectangle within a given container rectangle, with at
 * least a minimum size and area.
 *
 * @param {Rect} within
 * @param {Size&{a: number}} min
 * @param {object} [options]
 * @param {() => number} [options.random]
 * @returns {Rect}
 */
export function chooseSubRect(within, min, options={}) {
  const {random=Math.random} = options;
  const w = Math.floor(random() * (within.w - min.w)) + min.w;
  const mh = Math.max(min.h, Math.ceil(min.a/w));
  const h = Math.floor(random() * (within.h - mh)) + mh;
  const x = within.x + Math.floor(random() * (within.w - w));
  const y = within.y + Math.floor(random() * (within.h - h));
  return {x, y, w, h};
}
