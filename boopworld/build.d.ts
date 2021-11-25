/** @typedef {import('./index.js').Point} Point */
/** @typedef {import('./index.js').Rect} Rect */
/** @typedef {import('./index.js').Entity} Entity */
/** @typedef {import('./index.js').EntitySpec} EntitySpec */
/**
 * @template Ctx
 * @callback Creator
 * @param {EntitySpec} spec
 * @param {Ctx} ctx
 * @returns {Entity|null}
 */
/**
 * @template Ctx
 * @param {Array<[Point, Creator<Ctx>]>} features
 * @returns {Creator<Ctx>}
 */
export function where<Ctx>(...features: [import("./index.js").Point, Creator<Ctx>][]): Creator<Ctx>;
/**
 * @template Ctx
 * @param {Array<Creator<Ctx>>} creators
 * @returns {Creator<Ctx>}
 */
export function first<Ctx>(...creators: Creator<Ctx>[]): Creator<Ctx>;
/**
 * @template Ctx
 * @param {Creator<Ctx>} prime
 * @param {Array<Creator<Ctx>>} under
 * @returns {Creator<Ctx>}
 */
export function underlay<Ctx>(prime: Creator<Ctx>, ...under: Creator<Ctx>[]): Creator<Ctx>;
/**
 * @param {Rect} rect
 * @param {Creator<Rect>} create
 */
export function rect(rect: Rect, create: Creator<Rect>): void;
/**
 * @param {number} walls
 * @param {Creator<Rect>} wall
 * @param {object} [params]
 *
 * @param {Creator<Rect>} [params.wallNorth]
 * @param {Creator<Rect>} [params.wallEast]
 * @param {Creator<Rect>} [params.wallSouth]
 * @param {Creator<Rect>} [params.wallWest]
 *
 * @param {Creator<Rect>} [params.corner]
 * @param {Creator<Rect>} [params.cornerNW]
 * @param {Creator<Rect>} [params.cornerNE]
 * @param {Creator<Rect>} [params.cornerSW]
 * @param {Creator<Rect>} [params.cornerSE]
 *
 * @returns {Creator<Rect>}
 */
export function hallCreator(walls: number, wall: Creator<Rect>, { wallNorth, wallEast, wallSouth, wallWest, corner, cornerNW, cornerNE, cornerSW, cornerSE, }?: {
    wallNorth?: Creator<import("./index.js").Rect> | undefined;
    wallEast?: Creator<import("./index.js").Rect> | undefined;
    wallSouth?: Creator<import("./index.js").Rect> | undefined;
    wallWest?: Creator<import("./index.js").Rect> | undefined;
    corner?: Creator<import("./index.js").Rect> | undefined;
    cornerNW?: Creator<import("./index.js").Rect> | undefined;
    cornerNE?: Creator<import("./index.js").Rect> | undefined;
    cornerSW?: Creator<import("./index.js").Rect> | undefined;
    cornerSE?: Creator<import("./index.js").Rect> | undefined;
} | undefined): Creator<Rect>;
export namespace hallCreator {
    const WallNorth: number;
    const WallEast: number;
    const WallSouth: number;
    const WallWest: number;
    const SansCorners: number;
    const WallsNE: number;
    const WallsNW: number;
    const WallsSE: number;
    const WallsSW: number;
    const WallsNS: number;
    const WallsEW: number;
    const WallsNEW: number;
    const WallsNSW: number;
    const WallsESW: number;
    const WallsNES: number;
    const AllWalls: number;
}
/**
 * @param {Creator<{content: string}>} create
 * @param {Point} at
 * @param {string} content
 */
export function fromString(create: Creator<{
    content: string;
}>, { x, y }: Point, content: string): void;
export function makeLexicon(): Readonly<{
    define: <Ctx>(glyphOrTerm: string | number | {
        glyph: number | string;
        create: Creator<Ctx>;
        destroy: () => void;
    }, ...terms: (string | number | (Creator<Ctx> | {
        create: Creator<Ctx>;
        destroy: () => void;
    }))[]) => Creator<Ctx>;
    lookup: (glyph: number | string) => Creator<any> | undefined;
    mustLookup: (glyph: number | string) => Creator<any>;
    /**
     * @param {EntitySpec} spec
     * @param {any} ctx
     */
    create(spec: EntitySpec, ctx: any): import("./index.js").Entity | null;
    destroy(): void;
}>;
export type Point = import('./index.js').Point;
export type Rect = import('./index.js').Rect;
export type Entity = import('./index.js').Entity;
export type EntitySpec = import('./index.js').EntitySpec;
export type Creator<Ctx> = (spec: EntitySpec, ctx: Ctx) => Entity | null;
