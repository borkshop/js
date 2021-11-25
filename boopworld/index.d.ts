/**
 * @callback Thunk
 * @param {ThunkCtx} ctx
 * @returns {ThunkRes}
 */
/**
 * @template Ext
 * @callback ThunkExt
 * @param {ThunkCtx} ctx
 * @param {Ext} ext
 * @returns {ThunkRes}
 */
/** @typedef {(
 *   | {ok: true, reason: string, waitFor?: ThunkWaitFor, next?: Thunk}
 *   | {ok: false, reason: string, waitFor?: ThunkWaitFor, next?: Thunk}
 * )} ThunkRes */
/** @param {string} [reason] @returns {ThunkRes} */
export function thunkDone(reason?: string | undefined): ThunkRes;
/**
 * @param {string} reason
 * @param {Thunk} [next]
 * @returns {ThunkRes}
 */
export function thunkFail(reason: string, next?: Thunk | undefined): ThunkRes;
/**
 * @param {Thunk} next
 * @returns {ThunkRes}
 */
export function thunkContinue(next: Thunk, reason?: string): ThunkRes;
/**
 * @param {ThunkWaitFor} waitFor
 * @param {Thunk} [next]
 * @returns {ThunkRes}
 */
export function thunkWait(waitFor: ThunkWaitFor, next?: Thunk | undefined, reason?: string): ThunkRes;
/**
 * @typedef {(
 *   | "up"
 *   | "right"
 *   | "down"
 *   | "left"
 *   | "stay"
 * )} Move */
/**
 * @typedef {object} Shard
 * @prop {(deadline?: number) => void} update
 */
/**
 * @typedef {object} ShardCtl
 * @prop {number} time
 * @prop {Entity} root
 * @prop {(spec?: TypeSpec) => IterableIterator<Entity>} entities
 * @prop {(p: Point) => IterableIterator<Entity>} at
 * @prop {(r: Rect) => IterableIterator<[Point, Iterable<Entity>]>} within
 * @prop {() => IterableIterator<[Entity, Event]>} events
 * @prop {() => IterableIterator<[Entity, Move]>} moves
 * @prop {() => IterableIterator<{entity: Entity, remnant: RemnantCtx}>} reap
 * @prop {(ref: EntityRef) => Entity|null} deref
 * @prop {(name: string) => Entity|null} byName
 */
/**
 * @typedef {object} MindState
 * @prop {Thunk} thunk
 * @prop {ThunkCtx} ctx
 * @prop {ThunkWaitFor|undefined} waitFor
 * @prop {number|undefined} tick
 */
/**
 * @typedef {object} RemnantCtx
 * @prop {boolean} done
 * @prop {boolean} ok
 * @prop {string} [reason]
 * @prop {Thunk} thunk
 * @prop {ThunkWaitFor} [waitFor]
 * @prop {number} time
 * @prop {Move} [move]
 * @prop {Readonly<Event>[]} events
 * TODO provide frozen view
 * @prop {{
 *   keys: () => IterableIterator<string>,
 *   get: (key: string) => any,
 * }} memory
 */
/**
 * @typedef {object} Point
 * @prop {number} x
 * @prop {number} y
 */
/**
 * @typedef {object} Rect
 * @prop {number} x
 * @prop {number} y
 * @prop {number} w
 * @prop {number} h
 */
/**
 * @typedef {object} TypeSpec
 * @prop {boolean} [isSolid]
 * @prop {boolean} [isVisible]
 * @prop {boolean} [canInteract]
 * @prop {boolean} [hasMind]
 * @prop {boolean} [hasInput]
 */
/**
 * @callback InputBinder
 * @param {((input: string) => void)|null} consumer
 */
/** @typedef {ReturnType<makeInput>} Input */
export function makeInput(): Readonly<{
    /** @type {InputBinder} */
    bind(consumer: ((input: string) => void) | null): any;
    /** @param {string} input */
    provide(input: string): boolean;
}>;
/**
 * @param {object} options
 * @param {Builder} options.build
 * @param {(ctl: ShardCtl) => void} [options.control]
 * @param {number} [options.moveRate]
 * @param {() => number} [options.now]
 * @param {number} [options.defaultTimeout]
 * @param {number} [options.size]
 * @param {number|bigint|string} [options.seed]
 * @param {(choose: (s: string) => boolean, ent: ROEntity) => void} [options.chooseName]
 * @returns {Shard}
 */
export function makeShard({ build, control, moveRate, now, defaultTimeout, size, seed, chooseName, }: {
    build: Builder;
    control?: ((ctl: ShardCtl) => void) | undefined;
    moveRate?: number | undefined;
    now?: (() => number) | undefined;
    defaultTimeout?: number | undefined;
    size?: number | undefined;
    seed?: string | number | bigint | undefined;
    chooseName?: ((choose: (s: string) => boolean, ent: ROEntity) => void) | undefined;
}): Shard;
/**
 * deep object freeze that avoids the Readonly<{set foo()}> trap, and avoids
 * needing to pull in something heavier like harden()
 *
 * @template {object} O
 * @param {O} o
 * @returns {O}
 */
export function freeze<O extends object>(o: O): O;
/** guard wraps all of an object's methods and accessors (and those of any
 * sub-objects) with any number of guard functions.
 *
 * Users should also freeze the object to prevent guard removal via property
 * mutation of redefinition.
 *
 * Guards may check the object passed to them, or ambient state available to
 * them, and should throw an error if the guarded object should no longer be
 * used.
 *
 * NOTE: an "obvious" next step would be to pass key/access info along to the
 *       guards, allowing for more granular policy; however such use case has
 *       not presented in boopworld yet, anticipated only by this comment ;-)
 *
 * @template {object} O
 * @param {O} o
 * @param {((o: O) => void)[]} guards
 * @returns {O}
 */
export function guard<O extends object>(o: O, ...guards: ((o: O) => void)[]): O;
export * as build from "./build.js";
export * as behavior from "./behavior.js";
export type Interaction = (ctx: InteractCtx) => void;
export type InteractCtx = {
    self: Entity;
    subject: Entity;
    time: number;
    queueEvents: (self: Event, subject: Event) => void;
};
export type Thunk = (ctx: ThunkCtx) => ThunkRes;
export type ThunkExt<Ext> = (ctx: ThunkCtx, ext: Ext) => ThunkRes;
export type ThunkRes = ({
    ok: true;
    reason: string;
    waitFor?: ThunkWaitFor;
    next?: Thunk;
} | {
    ok: false;
    reason: string;
    waitFor?: ThunkWaitFor;
    next?: Thunk;
});
export type ThunkWaitFor = (EventType | "input" | {
    time: number;
} | {
    any: ThunkWaitFor[];
} | {
    all: ThunkWaitFor[];
});
export type ThunkCtx = {
    time: number;
    deref: (ref: EntityRef) => ROEntity | null;
    self: Entity;
    isReady: (waitFor: ThunkWaitFor) => boolean;
    memory: ThunkMemory;
    random: () => number;
    events: () => IterableIterator<Readonly<Event>>;
    input?: IterableIterator<number> | undefined;
    move: Move | undefined;
};
export type ThunkMemory = {
    view: ViewMemory;
    get: (key: string) => any;
    set: (key: string, value: any) => void;
};
export type Move = ("up" | "right" | "down" | "left" | "stay");
export type Shard = {
    update: (deadline?: number | undefined) => void;
};
export type ShardCtl = {
    time: number;
    root: Entity;
    entities: (spec?: TypeSpec | undefined) => IterableIterator<Entity>;
    at: (p: Point) => IterableIterator<Entity>;
    within: (r: Rect) => IterableIterator<[Point, Iterable<Entity>]>;
    events: () => IterableIterator<[Entity, Event]>;
    moves: () => IterableIterator<[Entity, Move]>;
    reap: () => IterableIterator<{
        entity: Entity;
        remnant: RemnantCtx;
    }>;
    deref: (ref: EntityRef) => Entity | null;
    byName: (name: string) => Entity | null;
};
export type MindState = {
    thunk: Thunk;
    ctx: ThunkCtx;
    waitFor: ThunkWaitFor | undefined;
    tick: number | undefined;
};
export type RemnantCtx = {
    done: boolean;
    ok: boolean;
    reason?: string | undefined;
    thunk: Thunk;
    waitFor?: ThunkWaitFor | undefined;
    time: number;
    move?: Move | undefined;
    /**
     * TODO provide frozen view
     */
    events: Readonly<Event>[];
    memory: {
        keys: () => IterableIterator<string>;
        get: (key: string) => any;
    };
};
export type Point = {
    x: number;
    y: number;
};
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type TypeSpec = {
    isSolid?: boolean | undefined;
    isVisible?: boolean | undefined;
    canInteract?: boolean | undefined;
    hasMind?: boolean | undefined;
    hasInput?: boolean | undefined;
};
export type InputBinder = (consumer: ((input: string) => void) | null) => any;
export type Input = ReturnType<typeof makeInput>;
export type EntityRef = number;
export type Entity = {
    ref: EntityRef;
    name?: string | undefined;
    toString: () => string;
    location: Point;
    zIndex: number;
    glyph: number | string;
    isSolid: boolean;
    isVisible: boolean;
    interact?: Interaction | undefined;
    mind?: Thunk | undefined;
    mindState?: MindState | undefined;
    input?: InputBinder | undefined;
    create: (spec: EntitySpec) => Entity;
    destroy: () => void;
};
export type ROEntity = {
    ref: EntityRef;
    name?: string | undefined;
    toString: () => string;
    location: Point;
    zIndex: number;
    glyph: number | string;
    isSolid: boolean;
    isVisible: boolean;
    canInteract: boolean;
};
export type EntitySpec = Partial<Omit<Entity, "ref" | "toString">>;
export type Event = ({
    type: "hit";
    target: EntityRef;
} | {
    type: "hitBy";
    entity: EntityRef;
} | {
    type: "move";
    from: Point;
    to: Point;
    here: EntityRef[];
} | {
    type: "inspect";
    here: EntityRef[];
} | {
    type: "view";
    view: ViewportRead<{
        ref?: EntityRef;
    }>;
});
export type EventType = Event["type"];
export type Builder = (ctl: ShardCtl) => any;
export type PointQuery<ID> = import('morty-mc-fov').PointQuery<ID>;
export type ViewportRead<Datum extends {
    [name: string]: unknown;
}> = import('./view.js').ViewportRead<Datum>;
export type ViewMemory = import('./view.js').ViewMemory;
