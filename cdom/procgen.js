// @ts-check

// NOTE for random selection within a range throughout, we use:
//     Range * random()
// which is technically biased, but idiomatic in javascript

/** @typedef {import('./tiles').Size} Size */
/** @typedef {import('./tiles').Rect} Rect */

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
   * @prop {(a: R, b: R) => null|R} connect - region connector function,
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
              : false : true;               // otherwise only one is possibel
    const rand = this.splitOffset + this.splitRange * this.random();
    const point = Math.floor(dir ? y + h * rand : x + w * rand);
    return {point, dir};
  };

  /**
   * @param {Rect} bounds
   * @returns {null|R}
   */
  run(bounds) {
    const limit = bounds.w * bounds.h;

    /** @type {Rect[]} */
    const regions = [bounds];
    /** @type {(null|Split)[]} */
    const splits = [];
    /** @type {(null|R)[]} */
    const res = [];
    /** @type {number[]} */
    const q = [0];

    // recursively subdivide, giving fill a chance
    let round = 0;
    for (let i = q.shift(); i !== undefined; i = q.shift()) {
      if (++round > limit)
        throw new Error(`BSP iteration limit:${limit} exceeded`);
      const region = regions[i];
      // skip degenerate regions (possible for extreme values of splitRange + splitOffset)
      if (region.w <= 0 || region.h <= 0) continue;
      // done if filled
      if (res[i] = this.fill(region, i)) continue;
      // done if cannot sub-divide
      const split = splits[i] = this.chooseSplit(region);
      if (!split) continue;
      // queue sub-regions
      const li = 2*i + 1, ri = 2*i + 2;
      const {left, right} = splitRegion(region, split);
      regions[li] = left, regions[ri] = right;
      if (left.w * left.h > 0) q.push(li);
      if (right.w * right.h > 0) q.push(ri);
    }

    // connect back up from the leaves
    /** @param {null|R} a @param {null|R} b */
    const reduce = (a, b) => a ? b ? this.connect(a, b) : a : b;
    while (res.length > 1) {
      const c = res.length % 2 === 0 && res.pop() || null;
      const b = res.pop() || null;
      const a = res.pop() || null;
      res.push(reduce(reduce(a, b), c));
    }

    return res.shift() || null;
  }
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
