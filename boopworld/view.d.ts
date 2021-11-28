/** @typedef {import('./index.js').Point} Point */
/** @typedef {import('./index.js').Rect} Rect */
/** @typedef {import('./index.js').Event} Event */
/** @typedef {import('./index.js').ROEntity} ROEntity */
/** @typedef {import('./index.js').EntityRef} EntityRef */
/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} Viewport
 * @prop {ViewportRead<Datum>} view
 * @prop {ViewportUpdate<Datum>} update
 */
/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} ViewportRead
 * @prop {() => Rect} bounds
 * @prop {(p: Point) => boolean} contains
 * @prop {(p: Point) => ViewportDatum<Datum>|undefined} at
 * @prop {() => IterableIterator<[Point, ViewportDatum<Datum>]>} entries
 * @prop {(withVirtual?: boolean) => IterableIterator<string>} lines
 * @prop {() => string} toString
 * @prop {() => any} toJSON
 */
/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {{glyph: number} & Omit<Datum, "glyph">} ViewportDatum
 */
/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} ViewportUpdate
 * @prop {() => void} clear
 * @prop {(bounds: Rect, virtual?: number) => void} resize
 * @prop {(pos: Point, dat: ViewportDatum<Datum>) => void} set
 * @returns {void}
 */
/** @returns {Viewport<{ref?: EntityRef}>} */
export function makeBasicViewport(): Viewport<{
    ref?: EntityRef;
}>;
/** @typedef {ReturnType<makeViewMemory>} ViewMemory */
export function makeViewMemory(): Readonly<{
    /**
     * @param {IterableIterator<Readonly<Event>>} events
     * @param {EventCtx} ctx
     */
    integrateEvents(events: IterableIterator<Readonly<Event>>, ctx: {
        time: number;
        deref: (ref: EntityRef) => ROEntity | null;
    }): void;
    bounds: () => Rect;
    contains: (p: Point) => boolean;
    at: (p: Point) => ViewportDatum<{
        lastSeen: number;
        ref?: number | undefined;
        name?: string | undefined;
        known: boolean;
        blocked: boolean;
        canInteract: boolean;
    }> | undefined;
    entries: () => IterableIterator<[import("./index.js").Point, ViewportDatum<{
        lastSeen: number;
        ref?: number | undefined;
        name?: string | undefined;
        known: boolean;
        blocked: boolean;
        canInteract: boolean;
    }>]>;
    lines: (withVirtual?: boolean | undefined) => IterableIterator<string>;
    toString: () => string;
    toJSON: () => any;
}>;
/**
 * @template {{[name: string]: unknown}} Datum
 * @typedef {object} ViewportDeps
 * @prop {(size: number) => void} alloc
 * @prop {() => void} clear
 * @prop {(i: number, dat: ViewportDatum<Datum>) => void} stor
 * @prop {(i: number) => Datum} load
 */
/**
 * @template {{[name: string]: unknown}} Datum
 * @param {ViewportDeps<Datum>} deps
 * @returns {Viewport<Datum>}
 */
export function makeViewport<Datum extends {
    [name: string]: unknown;
}>(deps: ViewportDeps<Datum>): Viewport<Datum>;
export type Point = import('./index.js').Point;
export type Rect = import('./index.js').Rect;
export type Event = import('./index.js').Event;
export type ROEntity = import('./index.js').ROEntity;
export type EntityRef = import('./index.js').EntityRef;
export type Viewport<Datum extends {
    [name: string]: unknown;
}> = {
    view: ViewportRead<Datum>;
    update: ViewportUpdate<Datum>;
};
export type ViewportRead<Datum extends {
    [name: string]: unknown;
}> = {
    bounds: () => Rect;
    contains: (p: Point) => boolean;
    at: (p: Point) => ViewportDatum<Datum> | undefined;
    entries: () => IterableIterator<[Point, ViewportDatum<Datum>]>;
    lines: (withVirtual?: boolean | undefined) => IterableIterator<string>;
    toString: () => string;
    toJSON: () => any;
};
export type ViewportDatum<Datum extends {
    [name: string]: unknown;
}> = {
    glyph: number;
} & Omit<Datum, "glyph">;
export type ViewportUpdate<Datum extends {
    [name: string]: unknown;
}> = {
    clear: () => void;
    resize: (bounds: Rect, virtual?: number | undefined) => void;
    set: (pos: Point, dat: ViewportDatum<Datum>) => void;
};
export type ViewMemory = ReturnType<typeof makeViewMemory>;
export type ViewportDeps<Datum extends {
    [name: string]: unknown;
}> = {
    alloc: (size: number) => void;
    clear: () => void;
    stor: (i: number, dat: ViewportDatum<Datum>) => void;
    load: (i: number) => Datum;
};
