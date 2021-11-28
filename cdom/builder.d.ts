/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").Rect } Rect */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").NewTileSpec } NewTileSpec */
/**
 * A shader is a function that gets called over many points, and is expected to
 * build tiles at each point.
 *
 * The simplest shader will call grid.buildTile({pos, kind, ...}) once;
 * however a shader may:
 * - query for and destroy any prior tiles
 * - create many stacked tiles
 * - decline to create any tiles, maybe after destroying any priors, to discard
 *   portions of a larger structure being built
 *
 * @template {any} S - build shape type, e.g. Rect
 * @callback Shader
 * @param {Context} grid - the grid being built within; this is an abstracted subset of TileGrid
 * @param {Point} pos - current position to build
 * @param {S} shape - build shape, e.g. rectangle position and size
 */
/**
 * Shaders get called under this abstracted Context context.
 *
 * @typedef {object} Context
 * @prop {(spec: NewTileSpec) => HTMLElement} buildTile
 * @prop {(pos: Point, ...className: string[]) => HTMLElement|null} tileAt
 * @prop {(pos: Point, ...className: string[]) => Iterable<HTMLElement>} tilesAt
 */
/**
 * Converts constant tile spec values into shader functions, passing through
 * any user-given shader function.
 *
 * @template {any} S
 * @param {string|NewTileSpec|Shader<S>|null|undefined} shader
 * @param {string} [defaultKind]
 * @returns {Shader<S>}
 */
export function toShader<S extends unknown>(shader: string | import("./tiles").NewTileSpec | Shader<S> | null | undefined, defaultKind?: string | undefined): Shader<S>;
/**
 * @param {string|NewTileSpec|null|undefined} spec
 * @param {string} [defaultKind]
 * @returns {NewTileSpec|null|undefined}
 */
export function toSpec(spec: string | NewTileSpec | null | undefined, defaultKind?: string | undefined): NewTileSpec | null | undefined;
/**
 * Shades a tile at every position within the given rectangle.
 *
 * @param {Context} grid
 * @param {Rect} rect
 * @param {string|NewTileSpec|Shader<Rect>} shader
 */
export function fillRect(grid: Context, rect: Rect, shader: string | NewTileSpec | Shader<Rect>): void;
/**
 * Shades a tile at every position along the perimeter of the given rectangle.
 *
 * @param {Context} grid
 * @param {Rect} rect
 * @param {string|NewTileSpec|Shader<Rect>} shader
 */
export function strokeRect(grid: Context, rect: Rect, shader: string | NewTileSpec | Shader<Rect>): void;
/**
 * Creates a rectangular shader that build tiles only along the perimeter of a
 * rectangle.
 *
 * @param {string|NewTileSpec|null} top
 * @param {string|NewTileSpec|null} [right] - defaults to top if not given
 * @param {string|NewTileSpec|null} [bottom] - defaults to top if not given
 * @param {string|NewTileSpec|null} [left] - defaults to right if not given
 * @returns {Shader<Rect>} - a shader that builds a tile along the rectangle's
 * perimeter, skipping any interior position; therefore may be used under
 * fillRect as well as strokeRect.
 */
export function borderShader(top: string | NewTileSpec | null, right?: string | import("./tiles").NewTileSpec | null | undefined, bottom?: string | import("./tiles").NewTileSpec | null | undefined, left?: string | import("./tiles").NewTileSpec | null | undefined): Shader<Rect>;
/**
 * Creates a rectangular room shader, that will build floors, walls, and
 * optionally doors.
 *
 * @param {object} [params]
 * @param {string|NewTileSpec|Shader<Rect>} [params.floors]
 * @param {string|NewTileSpec|Shader<Rect>} [params.walls]
 * @param {string|NewTileSpec|Shader<Rect>} [params.doors]
 * @param {(pos:Point, rect:Rect) => boolean} [params.doorsAt] - a convenience mask for
 * where to call the door shader; mostly useful when you don't want to
 * implement a fully custom door shader
 * @returns {Shader<Rect>}
 */
export function roomShader(params?: {
    floors?: string | import("./tiles").NewTileSpec | Shader<import("./tiles").Rect> | undefined;
    walls?: string | import("./tiles").NewTileSpec | Shader<import("./tiles").Rect> | undefined;
    doors?: string | import("./tiles").NewTileSpec | Shader<import("./tiles").Rect> | undefined;
    doorsAt?: ((pos: Point, rect: Rect) => boolean) | undefined;
} | undefined): Shader<Rect>;
export type Point = import("./tiles").Point;
export type Rect = import("./tiles").Rect;
export type TileSpec = import("./tiles").TileSpec;
export type NewTileSpec = import("./tiles").NewTileSpec;
/**
 * A shader is a function that gets called over many points, and is expected to
 * build tiles at each point.
 *
 * The simplest shader will call grid.buildTile({pos, kind, ...}) once;
 * however a shader may:
 * - query for and destroy any prior tiles
 * - create many stacked tiles
 * - decline to create any tiles, maybe after destroying any priors, to discard
 *   portions of a larger structure being built
 */
export type Shader<S extends unknown> = (grid: Context, pos: Point, shape: S) => any;
/**
 * Shaders get called under this abstracted Context context.
 */
export type Context = {
    buildTile: (spec: NewTileSpec) => HTMLElement;
    tileAt: (pos: Point, ...className: string[]) => HTMLElement | null;
    tilesAt: (pos: Point, ...className: string[]) => Iterable<HTMLElement>;
};
