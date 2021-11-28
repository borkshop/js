/** An Iterator version of Array.prototype.map
 *
 * @template S,T
 * @param {Iterable<S>} it
 * @param {(s: S) => T} fn
 * @returns {IterableIterator<T>}
 */
export function map<S, T>(it: Iterable<S>, fn: (s: S) => T): IterableIterator<T>;
/** An Iterator version of Array.prototype.filter
 *
 * @template T
 * @param {Iterable<T>} it
 * @param {(t: T) => boolean} filter
 * @returns {IterableIterator<T>}
 */
export function filter<T>(it: Iterable<T>, filter: (t: T) => boolean): IterableIterator<T>;
/** Yields the 4 cardinal neighbors of a point in clockwise order.
 *
 * @param {Point} p
 * @returns {IterableIterator<Point>}
 */
export function cardinals({ x, y }: Point): IterableIterator<Point>;
/** Yields the 4 ordinal neighbors of a point in clockwise order.
 *
 * @param {Point} p
 * @returns {IterableIterator<Point>}
 */
export function ordinals({ x, y }: Point): IterableIterator<Point>;
/** Yields all 8 neighbors of a point in clockwise order.
 *
 * @param {Point} p
 * @returns {IterableIterator<Point>}
 */
export function neighbors({ x, y }: Point): IterableIterator<Point>;
/** Returns true only if rect contains all points in ps.
 *
 * @param {Rect} rect
 * @param {Point[]} ps
 * @returns {boolean}
 */
export function contains({ x, y, w, h }: Rect, ...ps: Point[]): boolean;
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
export function iterateSpace<At>(pos: Point, query: (at: Point) => {
    supported: boolean;
    blocked: boolean;
    at: At;
}, next?: (p: Point) => Iterable<Point>): IterableIterator<{
    at: At;
    blocked: boolean;
} & import("./tiles").Point>;
/** Creates a random split choice function, as can be passed to binaryDivide.
 *
 * @param {object} params
 * @param {Size} [params.limit] - sub-division limit
 * @param {() => number} [params.random] - random chooser, must return a value
 * in the range [0, 1.0), defaults to Math.random
 * @param {number} [params.splitRange] - random range to choose split values
 * over, defaults to 0.2; TODO directionality?
 * @param {number} [params.splitOffset] - random offset to start choosing
 * split values from, defaults to 0.4; TODO directionality?
 * @returns {(region: Rect) => null|Split}
 */
export function randomSplitChooser(params?: {
    limit?: import("./tiles").Size | undefined;
    random?: (() => number) | undefined;
    splitRange?: number | undefined;
    splitOffset?: number | undefined;
}): (region: Rect) => null | Split;
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
export function binaryDivide<R>({ regions, res, q, maxRounds, fill, realize, chooseSplit, }: {
    regions: Rect[];
    res?: (R | null)[] | undefined;
    q?: number[] | undefined;
    maxRounds?: number | undefined;
    fill?: ((region: Rect, i: number) => R | null) | undefined;
    chooseSplit?: ((region: Rect, i: number) => null | Split) | undefined;
    realize?: ((region: Rect, split: Split, i: number) => R | null) | undefined;
}): (R | null)[];
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
export function binaryReduce<R>({ res, connect }: {
    res: (R | null)[];
    connect: (a: R, b: R) => R;
}): R | null;
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
export function binaryReduceOne<R>({ res, connect, reduce, }: {
    res: (R | null)[];
    connect?: ((a: R, b: R) => R) | undefined;
    reduce?: ((a: R | null, b: R | null) => R | null) | undefined;
}): void;
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
export function choose<T>(things: Iterable<T>, options?: {
    random?: (() => number) | undefined;
    weight?: ((thing: T) => number) | undefined;
} | undefined): T | null;
/** Selects a random rectangle within a given container rectangle, with at
 * least a minimum size and area (if possible).
 *
 * @param {Rect} within - bounding rectangle to choose within
 * @param {Size&{a: number}} min - minimum size and area; if within does not
 * suffice, then it is returned immediately, and no sampling happens
 * @param {object} [options]
 * @param {() => number} [options.random] - Math.random-like function
 * @param {number} [options.sanityLimit] - maximum number of sampling rounds to
 * attempt before giving up and returning then given within rect
 * @returns {Rect}
 */
export function chooseSubRect(within: Rect, min: Size & {
    a: number;
}, options?: {
    random?: (() => number) | undefined;
    sanityLimit?: number | undefined;
} | undefined): Rect;
export type Split = {
    point: number;
    /**
     * - false if point is X, true if point is Y
     */
    dir: boolean;
};
export type Point = import('./tiles').Point;
export type Size = import('./tiles').Size;
export type Rect = import('./tiles').Rect;
