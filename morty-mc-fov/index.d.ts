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
export function makeMortonMap<ID>(init: PointStoreInit<ID>): ROMortonMap<ID>;
/** @param {{x: number, y: number}} p */
export function mortonKey({ x, y }: {
    x: number;
    y: number;
}): bigint;
/** @param {bigint} key */
export function mortonPoint(key: bigint): {
    x: number;
    y: number;
};
/** @template At
 * @typedef {object} FOVDatum -- describes a single position within a field of
 * view iteration
 *
 * @prop {boolean} blocked -- whether field of view is blocked here
 *
 * @prop {At} at -- passthru spatial data so that the field consumer need not
 * re-query here
 */
/** Symmetric Shadowcasting field of view iterator
 *
 * Adapted from https://www.albertford.com/shadowcasting/
 *
 * @template At
 *
 * @param {Point} origin
 *
 * @param {object} params
 *
 * @param {(pos: Point, depth: number) => FOVDatum<At>|null} params.query --
 * spatial query callback, may return null if space is not defined at the
 * given point, or may return whether field is blocked, and any passthru At
 * data.
 *
 * @param {number} [params.maxDepth] -- maximum cardinal distance from origin: no
 * point yielded will have its x or y component differ from origin's by more
 * than maxDepth; defaults to 100, may be set to NaN to disable any explicit
 * limit.
 *
 * @param {Rect} [params.bounds] -- bounding rectangle to not exceed, default
 * to positive 32-bit space due to internal use of morton keying; spaces that
 * use unnatural numbers will need to set this, even if they have no real
 * notional bounds to enforce.
 *
 * @returns {Generator<{pos: Point, at: At}>} -- depth is the row
 * number within the first quadrant to encounter each location.
 */
export function shadowField<At>(origin: Point, { query, maxDepth, bounds, }: {
    query: (pos: Point, depth: number) => FOVDatum<At> | null;
    maxDepth?: number | undefined;
    bounds?: Rect | undefined;
}): Generator<{
    pos: Point;
    at: At;
}, any, any>;
export type Point = {
    x: number;
    y: number;
};
export type Rect = Point & {
    w: number;
    h: number;
};
export type PointLookup<ID> = {
    size: number;
    has: (id: ID) => boolean;
    get: (id: ID) => Point | undefined;
    entries: () => IterableIterator<[ID, Point]>;
};
export type PointQuery<ID> = {
    at: (pos: Point) => IterableIterator<ID>;
    within: (rect: Rect) => IterableIterator<[Point, Iterable<ID>]>;
};
export type PointStore<ID> = {
    set: (id: ID, pos: Point) => void;
    delete: (id: ID) => void;
    clear: () => void;
};
export type ROMortonMap<ID> = PointLookup<ID> & PointQuery<ID>;
export type MortonMap<ID> = PointStore<ID> & PointLookup<ID> & PointQuery<ID>;
/**
 * -- called when creating a ROMortonMap, and is the
 * only piece of code with access to its PointStore
 */
export type PointStoreInit<ID> = (store: PointStore<ID>) => PointStoreFreshen<ID>;
/**
 * -- called before any point read or query method
 * to lazily update the underlying PointStore
 */
export type PointStoreFreshen<ID> = (store: PointStore<ID>) => void;
/**
 * -- describes a single position within a field of
 * view iteration
 */
export type FOVDatum<At> = {
    /**
     * -- whether field of view is blocked here
     */
    blocked: boolean;
    /**
     * -- passthru spatial data so that the field consumer need not
     * re-query here
     */
    at: At;
};
