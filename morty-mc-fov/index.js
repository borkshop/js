/** @typedef {{x: number, y: number}} Point */

/** @typedef {Point & {w: number, h: number}} Rect */

/**
 * @template ID
 * @typedef {object} PointLookup
 * @prop {number} size
 * @prop {(id: ID) => boolean} has
 * @prop {(id: ID) => Point|undefined} get
 * @prop {() => IterableIterator<[ID, Point]>} entries
 */

/**
 * @template ID
 * @typedef {object} PointQuery
 * @prop {(pos: Point) => IterableIterator<ID>} at
 * @prop {(rect: Rect) => IterableIterator<[Point, Iterable<ID>]>} within
 */

/**
 * @template ID
 * @typedef {object} PointStore
 * @prop {(id: ID, pos: Point) => void} set
 * @prop {(id: ID) => void} delete
 * @prop {() => void} clear
 */

/**
 * @template ID
 * @typedef {PointLookup<ID> & PointQuery<ID>} ROMortonMap
 */

/**
 * @template ID
 * @typedef {PointStore<ID> & PointLookup<ID> & PointQuery<ID>} MortonMap
 */

/**
 * @template ID
 * @callback PointStoreInit -- called when creating a ROMortonMap, and is the
 * only piece of code with access to its PointStore
 * @param {PointStore<ID>} store
 * @returns {PointStoreFreshen<ID>}
 */

/**
 * @template ID
 * @callback PointStoreFreshen -- called before any point read or query method
 * to lazily update the underlying PointStore
 * @param {PointStore<ID>} store
 * @returns {void}
 */

/**
 * @template ID
 * @param {PointStoreInit<ID>} init
 * @returns {ROMortonMap<ID>}
 */
export function makeMortonMap(init) {
  const base = makeBasicMortonMap();

  const {
    // strip write facet
    set, delete: del, clear,

    // strip dynamic property so that branches below must define it and
    // call thru base.size
    size: _size,

    ...readQuery
  } = base;

  // reify write facet for init and freshen
  const write = Object.freeze({
    set, delete: del, clear,
  });

  const freshen = init(write);

  return Object.freeze({
    // freshen before read and facets
    get size() {
      // @ts-ignore GG typescript, you can tell that the others are defined, but not this one?
      freshen(write);
      return base.size;
    },
    has(id) {
      freshen(write);
      return readQuery.has(id);
    },
    get(id) {
      freshen(write);
      return readQuery.get(id);
    },
    *entries() {
      freshen(write);
      yield* readQuery.entries();
    },
    *at(p) {
      freshen(write);
      yield* readQuery.at(p);
    },
    *within(r) {
      freshen(write);
      yield* readQuery.within(r);
    },
  });
}

/** Base map implementation with read, write, and query facets.
 *
 * Let's try to not export this, but leaving it separated here in case a need arises.
 *
 * @template ID
 * @returns {MortonMap<ID>}
 */
function makeBasicMortonMap() {
  // foreward map from spatial keys to sets of IDs; used for point queries
  /** @type {Map<bigint, Set<ID>>} */
  const fore = new Map();

  // backward map from IDs to last-indexed spatial key; used to remove
  // (invalidate) prior fore entry when updated.
  /** @type {Map<ID, bigint>} */
  const back = new Map();

  /** @param {ID} id @param {Point} pos */
  function set(id, pos) {
    const key = mortonKey(pos);
    const prior = back.get(id);
    if (prior !== undefined) fore.get(prior)?.delete(id);
    const at = fore.get(key);
    if (at) at.add(id);
    else fore.set(key, new Set([id]));
    back.set(id, key);
  }

  return Object.freeze({
    // write facet
    set,
    delete(id) {
      const key = back.get(id);
      if (key != undefined) {
        back.delete(id);
        const at = fore.get(key);
        if (at != undefined) {
          at.delete(id);
          if (!at.size) fore.delete(key);
        }
      }
    },
    clear() {
      fore.clear();
      back.clear();
    },

    // read facet
    get size() { return back.size },
    has(id) { return back.has(id) },
    get(id) {
      const key = back.get(id);
      return key == undefined ? undefined : mortonPoint(key);
    },
    *entries() {
      for (const [id, key] of back.entries())
        yield [id, mortonPoint(key)];
    },

    // query facet
    *at(p) {
      const got = fore.get(mortonKey(p));
      if (got) yield* got;
    },
    *within({x: x1, y: y1, w, h}) {
      const x2 = x1 + w, y2 = y1 + h;
      // TODO precompute key prefix matcher, rather than needing to always
      // convert back to points inside the loop
      for (const [key, ids] of fore.entries()) {
        const {x, y} = mortonPoint(key);
        if (x < x1 || x > x2) continue;
        if (y < y1 || y > y2) continue;
        // TODO force iteration of ids, don't expose set
        yield [{x, y}, iter(ids)];
      }
    },

  });
}

/** @template T @param {Iterable<T>} it */
function *iter(it) { yield* it }

// TODO a linear index that can do better on range queries

/** @param {{x: number, y: number}} p */
export function mortonKey({x, y}) {
  const bx = BigInt(Math.floor(x));
  const by = BigInt(Math.floor(y));
  return mortonSpread1(bx) | mortonSpread1(by) << 1n;
}

/** @param {bigint} key */
export function mortonPoint(key) {
  const bx = mortonCompact1(key);
  const by = mortonCompact1(key >> 1n);
  return {x: Number(bx), y: Number(by)};
}

/** @param {bigint} x */
function mortonSpread1(x) {
  const min = 0, max = 2n ** 32n - 1n;
  if (x < min || x > max)
    throw RangeError('Number not within acceptable 32-bit range');
  x = BigInt.asUintN(32, x);
  x =  x               & 0x0000_0000_FFFF_FFFFn; // mask lower 32-bit syllable (double word)
  x = (x | (x << 16n)) & 0x0000_FFFF_0000_FFFFn; // spread 16-bit syllables (words)
  x = (x | (x <<  8n)) & 0x00FF_00FF_00FF_00FFn; // spread 8-bit syllables (bytes)
  x = (x | (x <<  4n)) & 0x0F0F_0F0F_0F0F_0F0Fn; // spread 4-bit syllables (nibbles)
  x = (x | (x <<  2n)) & 0x3333_3333_3333_3333n; // spread 2-bit syllables
  x = (x | (x <<  1n)) & 0x5555_5555_5555_5555n; // spread bits, even parity
  return x;
}

/** @param {bigint} x */
function mortonCompact1(x) {
  x =  x               & 0x5555_5555_5555_5555n; // mask even parity bits
  x = (x | (x >>  1n)) & 0x3333_3333_3333_3333n; // compact bits
  x = (x | (x >>  2n)) & 0x0F0F_0F0F_0F0F_0F0Fn; // compact 2-bit syllables
  x = (x | (x >>  4n)) & 0x00FF_00FF_00FF_00FFn; // compact 4-bit syllables (nibbles)
  x = (x | (x >>  8n)) & 0x0000_FFFF_0000_FFFFn; // compact 8-bit syllables (bytes)
  x = (x | (x >> 16n)) & 0x0000_0000_FFFF_FFFFn; // compact 16-bit syllables (words)
  x = BigInt.asUintN(32, x);
  return x;
}
