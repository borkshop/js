/** Load element data, first from its dataset, falling back to a computed CSS
 * --name variable.
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @return {any}
 */
export function getElData(el: HTMLElement, name: string): any;
/** Set element data: strings and numbers are stored directly, all else is JSON
 * encoded. Data is stored both into the element's dataset and to a CSS
 * --name variable on its inline style declaration.
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @param {any} value
 * @return {void}
 */
export function setElData(el: HTMLElement, name: string, value: any): void;
/**
 * @typedef {Object} Point
 * @prop {number} x
 * @prop {number} y
 */
/**
 * @typedef {Object} Size
 * @prop {number} w
 * @prop {number} h
 */
/**
 * @typedef {Point&Size} Rect
 */
/**
 * @typedef {Object} TileQuery
 *
 * @prop {string} [plane]
 * @prop {(string|string[])} [className] - matches tile element class names
 * @prop {string} [id] - matches tile element ID strings
 * @prop {Object<string, string>} [data] - matches tile dataset attributes
 *
 * NOTE: non-string tile data are encoded as JSON
 * NOTE: id and data matcher strings may start with ^ $ or * to encode a
 *       startsWith/endsWith/contains match
 */
/**
 * @callback TileFilter
 * @param {HTMLElement} tile
 * @param {TileGrid} grid
 * @returns {boolean}
 */
/*** @typedef {Object<string,TileDatum>} TileData */
/*** @typedef {string|number|TileDatum[]|TileData} TileDatum */
/**
 * @typedef {object} classMut
 * @prop {string} [toggle]
 * @prop {string} [remove]
 * @prop {string} [add]
 */
/**
 * @typedef TileSpec
 * @prop {Point} [pos] - specifies new tile location within tile coordinate space
 * @prop {string} [plane] - optional tile plane; if set, tile is appended to a
 * div.plane element, otherwise directly to the grid element.
 * @prop {string} [kind] - primary tile class name
 * @prop {string} [className] - optional, base before any classList mods; need
 * not contain "tile"
 * @prop {string|string[]|classMut|classMut[]} [classList] - specifies more
 * limited classList mutations, rather than full className syncing; string args
 * may start with + - or ! to add, remove, or toggle the string remaining
 * string class name, defaulting to add behavior.
 * @prop {string} [text] - specifies new tile textContent
 * @prop {Partial<CSSStyleDeclaration>} [style] - specifies new tile inline styles
 * @prop {Object<string,any>} [data] - specifies new tile dataset attributes
 */
/** @typedef {TileSpec&{
 *   id?: string
 *   kind: string
 * }} NewTileSpec */
/**
 * Inserts a 0 bit after each of 26 the low bits of x, masking
 * away any higher bits; this is the best we can do in JavaScript since integer
 * precision maxes out at 53 bits.
 * @param {number} x
 * @return {number}
 */
export function mortonSpread1(x: number): number;
/**
 * Removes half (the even ones) of the lower 53 bits from x.
 * @param {number} x
 * @return {number}
 */
export function mortonCompact1(x: number): number;
/**
 * @param {Point} p
 * @return the Z-order curve index for for p, aka its "Morton code"
 *
 * See https://en.wikipedia.org/wiki/Z-order_curve
 */
export function mortonKey(p: Point): number;
/**
 * @param {Object} options
 * @param {HTMLElement[]} options.tiles
 * @param {HTMLTextAreaElement} options.into
 * @param {boolean} [options.detail]
 * @return void
 */
export function dumpTiles({ tiles, into, detail }: {
    tiles: HTMLElement[];
    into: HTMLTextAreaElement;
    detail?: boolean | undefined;
}): void;
/**
 * @param {Point[]} ps
 * @return {Point}
 */
export function centroid(ps: Point[]): Point;
export class TileGrid {
    /**
     * @param {HTMLElement} el
     */
    constructor(el: HTMLElement);
    /** @type {HTMLElement} */
    el: HTMLElement;
    /** @type {ResizeObserver} */
    _obs: ResizeObserver;
    /** @type {HTMLElement} */
    _ghost: HTMLElement;
    /**
     * @param {Point} client
     * @returns {Point}
     */
    translateClient(client: Point): Point;
    /** @return {Point} */
    get tileSize(): Point;
    /** @param {Point} p */
    set viewOffset(arg: Point);
    /** @return {Point} */
    get viewOffset(): Point;
    /** @return {Size} */
    get viewSize(): Size;
    /** @return {Rect} */
    get viewport(): Rect;
    /** @return {Rect} */
    get viewbox(): Rect;
    /** @type {?Point} */
    _viewPoint: Point | null;
    /** @param {Point} p */
    set viewPoint(arg: Point);
    /** @return {Point} */
    get viewPoint(): Point;
    hasFixedViewPoint(): boolean;
    _updateSize(): void;
    idPrefix(): string;
    /** @type Map<string, number> */
    _kindid: Map<string, number>;
    /**
     * @param {NewTileSpec} spec
     * @returns {HTMLElement}
     */
    buildTile(spec: NewTileSpec): HTMLElement;
    /**
     * Creates a new tile element from a given specification, returning it.
     *
     * @param {NewTileSpec} idSpec
     * @return {HTMLElement}
     */
    createTile({ id, ...spec }: NewTileSpec): HTMLElement;
    /**
     * @param {string} name
     * @returns {HTMLElement}
     */
    getPlane(name: string): HTMLElement;
    /**
     * @param {HTMLElement} tile
     * @returns {string}
     */
    getTilePlane(tile: HTMLElement): string;
    /**
     * Updates an existing tile element to match the given specification.
     *
     * @param {HTMLElement} tile
     * @param {TileSpec} spec
     * @return {HTMLElement}
     */
    updateTile(tile: HTMLElement, spec: TileSpec): HTMLElement;
    /**
     * Get a tile by id string returning null if no such tile exists.
     *
     * @param {string} id
     * @return {HTMLElement|null}
     */
    getTile(id: string): HTMLElement | null;
    /**
     * Query a tile returning the first match or null if no tile matches.
     *
     * @param {TileQuery} query
     * @return {HTMLElement|null}
     */
    queryTile(query: TileQuery): HTMLElement | null;
    /**
     * Query tiles returing all that match.
     *
     * @param {TileQuery} [query] - optional, match all tiles if omitted.
     * @return {NodeListOf<HTMLElement>}
     */
    queryTiles(query?: TileQuery | undefined): NodeListOf<HTMLElement>;
    /**
     * @param {?TileQuery} query
     * @return {string}
     */
    tileQuerySelector(query: TileQuery | null): string;
    clear(): void;
    /**
     * @param {HTMLElement} tile
     * @param {string} name
     * @return {any}
     */
    getTileData(tile: HTMLElement, name: string): any;
    /**
     * @param {HTMLElement} tile
     * @param {string} name
     * @param {any} value
     * @return {void}
     */
    setTileData(tile: HTMLElement, name: string, value: any): void;
    /**
     * @param {HTMLElement} tile
     * @returns {string} - un-prefixed id string that may be passed back to getTile
     */
    getTileID(tile: HTMLElement): string;
    /**
     * Get a tile's current position in tile coordinate space.
     *
     * @param {HTMLElement} tile
     * @return {Point}
     */
    getTilePosition(tile: HTMLElement): Point;
    /**
     * Get a tiles "kind": it's first non-generic class name.
     *
     * @param {HTMLElement} tile
     * @param {string[]} ignore - additional class names that the caller
     * considers generic, and should be ignored in addition to the builtin "tile"
     * class name
     * @returns {string} - the tile's kind or the empty string if the tile only
     * has generic class names
     */
    getTileKind(tile: HTMLElement, ...ignore: string[]): string;
    /**
     * Move a tile to a given position in tile coordinate space, returning it for
     * convenience.
     *
     * @param {HTMLElement} tile
     * @param {Point} pt
     * @return {Point}
     */
    moveTileTo(tile: HTMLElement, pt: Point): Point;
    /** @type TileSpatialIndex */
    spatialIndex: TileSpatialIndex;
    /**
     * Returns a list of all tiles at a given point, optionally constrained to
     * having all of the given class names.
     *
     * @param {Point} at
     * @param {string[]} className
     * @return {IterableIterator<HTMLElement>}
     */
    tilesAt(at: Point, ...className: string[]): IterableIterator<HTMLElement>;
    /**
     * Returns the first tile at a given point, optionally constrained to having
     * all of the given class names, or null if there is no such tile.
     *
     * @param {Point} at
     * @param {string[]} className
     * @return {HTMLElement|null}
     */
    tileAt(at: Point, ...className: string[]): HTMLElement | null;
}
/**
 * @typedef {Object} TileInspectEvent
 * @prop {Point} pos
 * @prop {HTMLElement[]} tiles
 * @prop {boolean} pinned
 */
/**
 * @typedef {(ev:TileInspectEvent)=>void} TileInspectHandler
 */
export class TileInspector {
    /**
     * @param {TileGrid} grid
     * @param {TileInspectHandler} handler
     */
    constructor(grid: TileGrid, handler: TileInspectHandler);
    /** @type {TileGrid} */
    grid: TileGrid;
    /** @type {TileInspectHandler} */
    handler: TileInspectHandler;
    /** @type {Point|null} */
    pinned: Point | null;
    /**
     * @param {Point} pos
     * @returns {IterableIterator<HTMLElement>}
     */
    tilesAt(pos: Point): IterableIterator<HTMLElement>;
    /**
     * @param {MouseEvent} ev
     * @return {void}
     */
    handleEvent(ev: MouseEvent): void;
    refresh(): void;
    /** @type {string} */
    _lastHandlid: string;
    /**
     * @param {Point} pos
     * @param {HTMLElement[]} tiles
     * @return void
     */
    update(pos: Point, tiles: HTMLElement[]): void;
}
export type Point = {
    x: number;
    y: number;
};
export type Size = {
    w: number;
    h: number;
};
export type Rect = Point & Size;
export type TileQuery = {
    plane?: string | undefined;
    /**
     * - matches tile element class names
     */
    className?: string | string[] | undefined;
    /**
     * - matches tile element ID strings
     */
    id?: string | undefined;
    /**
     * - matches tile dataset attributes
     *
     * NOTE: non-string tile data are encoded as JSON
     * NOTE: id and data matcher strings may start with ^ $ or * to encode a
     * startsWith/endsWith/contains match
     */
    data?: {
        [x: string]: string;
    } | undefined;
};
export type TileFilter = (tile: HTMLElement, grid: TileGrid) => boolean;
export type classMut = {
    toggle?: string | undefined;
    remove?: string | undefined;
    add?: string | undefined;
};
export type TileSpec = {
    /**
     * - specifies new tile location within tile coordinate space
     */
    pos?: Point | undefined;
    /**
     * - optional tile plane; if set, tile is appended to a
     * div.plane element, otherwise directly to the grid element.
     */
    plane?: string | undefined;
    /**
     * - primary tile class name
     */
    kind?: string | undefined;
    /**
     * - optional, base before any classList mods; need
     * not contain "tile"
     */
    className?: string | undefined;
    /**
     * - specifies more
     * limited classList mutations, rather than full className syncing; string args
     * may start with + - or ! to add, remove, or toggle the string remaining
     * string class name, defaulting to add behavior.
     */
    classList?: string | string[] | classMut | classMut[] | undefined;
    /**
     * - specifies new tile textContent
     */
    text?: string | undefined;
    /**
     * - specifies new tile inline styles
     */
    style?: Partial<CSSStyleDeclaration> | undefined;
    /**
     * - specifies new tile dataset attributes
     */
    data?: {
        [x: string]: any;
    } | undefined;
};
export type NewTileSpec = TileSpec & {
    id?: string;
    kind: string;
};
/**
 * Abstract interface that any TileGrid spatial index needs to implement.
 */
export type TileSpatialIndex = {
    update: (ids: string[], pos: Point[]) => void;
    /**
     * // TODO range query
     */
    tilesAt: (at: Point) => Iterable<string>;
};
export type TileInspectEvent = {
    pos: Point;
    tiles: HTMLElement[];
    pinned: boolean;
};
export type TileInspectHandler = (ev: TileInspectEvent) => void;
