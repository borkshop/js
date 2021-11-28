/** @typedef { import("./tiles").Point } Point */
/** @typedef { import("./tiles").Rect } Rect */
/** @typedef { import("./tiles").TileFilter } TileFilter */
/** @typedef { import("./tiles").TileSpec } TileSpec */
/** @typedef { import("./tiles").TileInspectEvent } TileInspectEvent */
/** @typedef {{kind: string}&TileSpec} TileSpecKind */
/**
 * A procedure (Proc) involves a subject tile acting upon an object tile.
 * Should return true only if the Proc action has semantically succeeded.
 *
 * Where-as false should only be returned if no effect has been made, in which
 * case the caller may give the object's controller a chance to elect a
 * different action.
 *
 * @callback Proc
 * @param {ProcParams} params
 * @returns {boolean} - must be true only if the Proc semantically had an effect
 */
/**
 * @typedef {Object} ProcParams
 * @prop {TileGrid} grid - the tile grid of reference
 * @prop {HTMLElement} subject - the tile that is performing an action
 * @prop {HTMLElement} object - the tile being acted upon
 */
/** @typedef {Object<string, Proc>} Procs */
/**
 * @param {Procs} a
 * @param {Procs} b
 * @returns {Procs}
 */
export function assignProcs(a: Procs, b: Procs): Procs;
/** Runs all procs with the given params, returning false only if none of them
 * had an effect.
 *
 * If it's first arg is bound, the resultant partial function is itself a Proc.
 *
 * @param {Iterable<Proc>} procs
 * @param {ProcParams} params
 * @returns {boolean}
 */
export function runAllProcs(procs: Iterable<Proc>, params: ProcParams): boolean;
/**
 * Carries config data for a DOMgeon.
 * See DOMgeon.prototype.config for detailed defaults.
 * May pass override to DOMgeon.constructor.
 *
 * @typedef {Object} DOMgeonConfig
 * @prop {ActionButtonSpec[]} moveButtons - movement button definitions;
 * defaults to WASD cardinal moves
 * @prop {number} lightLimit
 * @prop {boolean} [playing] - whether the DOMgeon starts in a play state.
 */
export class DOMgeon extends EventTarget {
    /**
     * DOMgeon binding elements
     *
     * @typedef {Object} DOMgeonBindings
     * @prop {HTMLElement} grid - document element to place tiles within
     * @prop {HTMLElement} [ui] - document element to toggle UI state classes upon; defaults to grid
     * @prop {HTMLElement} [keys] - document element to listen for key events upon; defaults to ui
     * @prop {HTMLElement} [moveBar] - element under which to place move buttons; defaults to ui
     * @prop {HTMLElement} [actionBar] - element under which to add action buttons; defaults to ui
     */
    /**
     * Options to DOMgeon constructor, must specify a grid binding element, may
     * specify ancillary elements, and config overrides.
     *
     * @typedef {DOMgeonBindings&Partial<DOMgeonConfig>} DOMgeonOptions
     */
    /**
     * May pass just a grid element if no other option is needed.
     *
     * @param {HTMLElement|DOMgeonOptions} options
     */
    constructor(options: HTMLElement | ({
        /**
         * - document element to place tiles within
         */
        grid: HTMLElement;
        /**
         * - document element to toggle UI state classes upon; defaults to grid
         */
        ui?: HTMLElement | undefined;
        /**
         * - document element to listen for key events upon; defaults to ui
         */
        keys?: HTMLElement | undefined;
        /**
         * - element under which to place move buttons; defaults to ui
         */
        moveBar?: HTMLElement | undefined;
        /**
         * - element under which to add action buttons; defaults to ui
         */
        actionBar?: HTMLElement | undefined;
    } & Partial<DOMgeonConfig>));
    /** @type {TileGrid} */
    grid: TileGrid;
    /** @type {HTMLElement|null} */
    moveBar: HTMLElement | null;
    /** @type {HTMLElement|null} */
    actionBar: HTMLElement | null;
    /** @type {HTMLElement} */
    ui: HTMLElement;
    /** @type {HTMLElement} */
    keys: HTMLElement;
    /** @type {Handlers} */
    onKey: Handlers;
    /** @type {ButtonInputs} */
    inputs: ButtonInputs;
    /** @type {KeySynthesizer} */
    keySynth: KeySynthesizer;
    /** @type {KeyAliases} */
    keyAliases: KeyAliases;
    /** @type {KeyHighlighter} */
    keyShow: KeyHighlighter;
    /** @type {KeyChorder} */
    keyChord: KeyChorder;
    /** @type {null|(() => boolean)} */
    mayPlay: null | (() => boolean);
    /**
     * Set true by start(), indicating that an animation loop is running; set
     * false when the start() loop exits, or when stop() is called to signal to
     * halt it.
     *
     * @type {boolean}
     */
    running: boolean;
    set playing(arg: boolean);
    /**
     * True if the domgeon game is currently play(ing)(able); controls whether
     * player input will be processed or discarded within any running the main
     * interaction/animation loop.
     */
    get playing(): boolean;
    _playing: boolean;
    _fovID: string;
    /** @type {Object<string, TileMoverProc>} */
    moveProcs: {
        [x: string]: TileMoverProc;
    };
    /** @type {Object<string, Proc>} */
    procs: {
        [x: string]: Proc;
    };
    /** @type {DOMgeonConfig} */
    config: DOMgeonConfig;
    stop(): void;
    /** @type {import('./anim').SchedulePart[]} */
    animParts: import('./anim').SchedulePart[];
    /**
     * How long viewport move animations should take; default 1s.
     */
    viewAnimTime: number;
    /**
     * Consult things like https://easings.net for some likely maths.
     *
     * @param {number} p - animation progress proportion
     * @returns {number} - eased animation progress proportion
     */
    viewAnimEase(p: number): number;
    /**
     * Sets a goal point for viewport animation to re-center upon, superceding
     * any previous goal point. The animation takes plaec over the next t time,
     * defaulting to 100ms.
     *
     * @param {Point} to - new grid viewPoint
     * @param {number} t - how long the animation should take
     * @returns {void}
     */
    viewTo(to: Point, t?: number): void;
    /** @type {null|Anim<Point>} */
    _viewAnim: null | Anim<Point>;
    /**
     * @param {number} dt
     * @returns {void}
     */
    _animView(dt: number): void;
    start(): Promise<void>;
    /**
     * Computes any newly desired grid viewPoint to (re)-center upon given the
     * position of the currently focused actor.
     *
     * The default simply returns pos so that we alway follow the new player
     * location. If instead you only want to move the viewport when the player
     * tries to go outside of it, override with something like:
     *
     *   (pos, {x: vx, y: vy, w: vw, h: vh}) => (
     *       pos.x   <= vx      ? pos
     *     : pos.y   <= vy      ? pos
     *     : pos.x+1 >= vx + vw ? pos
     *     : pos.y+1 >= vy + vh ? pos
     *     : null);
     *
     * @param {Point} pos - position of the currently focused actor
     * @param {Rect} _viewport - current viewport rectangle in tile space
     * @returns {null|Point} - null for no change, or a new viewPoint
     */
    wantedViewPoint(pos: Point, _viewport: Rect): null | Point;
    /**
     * @param {null|HTMLElement} actor
     * @returns {void}
     */
    updateActorView(actor: null | HTMLElement): void;
    _litActorID: string;
    focusedActor(): HTMLElement | null;
    _findLightSelectors(): Generator<string, void, unknown>;
    /**
     * @param {number} _dt
     */
    _runLightAnim(_dt: number): void;
    /**
     * @param {Iterable<string>} keys
     * @returns {null|HTMLElement}
     */
    processInput(keys: Iterable<string>): null | HTMLElement;
    /** @returns {IterableIterator<ActionButtonSpec>} */
    collectActions(): IterableIterator<ActionButtonSpec>;
}
export class DOMgeonInspector extends TileInspector {
    /**
     * @param {DOMgeon} dmg
     * @param {HTMLElement} el
     */
    constructor(dmg: DOMgeon, el: HTMLElement);
    /** @type {HTMLElement} */
    el: HTMLElement;
    /** @type {DOMgeon} */
    dmg: DOMgeon;
    /** @type {HTMLElement|null} */
    cur: HTMLElement | null;
    /** @type {TileFilter} */
    filter: TileFilter;
    /**
     * @param {TileInspectEvent} ev
     */
    inspect({ pos, tiles, pinned }: TileInspectEvent): void;
    enable(): void;
    disable(): void;
}
export type Point = import("./tiles").Point;
export type Rect = import("./tiles").Rect;
export type TileFilter = import("./tiles").TileFilter;
export type TileSpec = import("./tiles").TileSpec;
export type TileInspectEvent = import("./tiles").TileInspectEvent;
export type TileSpecKind = {
    kind: string;
} & TileSpec;
/**
 * A procedure (Proc) involves a subject tile acting upon an object tile.
 * Should return true only if the Proc action has semantically succeeded.
 *
 * Where-as false should only be returned if no effect has been made, in which
 * case the caller may give the object's controller a chance to elect a
 * different action.
 */
export type Proc = (params: ProcParams) => boolean;
export type ProcParams = {
    /**
     * - the tile grid of reference
     */
    grid: TileGrid;
    /**
     * - the tile that is performing an action
     */
    subject: HTMLElement;
    /**
     * - the tile being acted upon
     */
    object: HTMLElement;
};
export type Procs = {
    [x: string]: Proc;
};
export type Anim<T> = {
    t: number;
    et: number;
    from: T;
    to: T;
};
export type ButtonSpec = {
    label: string;
    key?: string | undefined;
    keycode?: string | undefined;
    title?: string | undefined;
    legend?: string | undefined;
    alias?: string | undefined;
    aliasKeys?: string[] | undefined;
    aliasCodes?: string[] | undefined;
};
export type ActionButtonSpec = ButtonSpec & Partial<Move>;
export type TileMove = {
    dmg: DOMgeon;
    grid: TileGrid;
    mover: HTMLElement;
    move: Move;
};
export type TileMoverProc = (req: TileMove) => void;
/**
 * A move has a spatial component and an optional action string.
 * The action string may be used to define custom extensions or to otherwise
 * change the semantics of the x,y spatial component.
 */
export type Move = {
    action: string;
    x: number;
    y: number;
    data?: {
        [x: string]: string | undefined;
    } | undefined;
};
/**
 * Carries config data for a DOMgeon.
 * See DOMgeon.prototype.config for detailed defaults.
 * May pass override to DOMgeon.constructor.
 */
export type DOMgeonConfig = {
    /**
     * - movement button definitions;
     * defaults to WASD cardinal moves
     */
    moveButtons: ActionButtonSpec[];
    lightLimit: number;
    /**
     * - whether the DOMgeon starts in a play state.
     */
    playing?: boolean | undefined;
};
import { TileGrid } from "./tiles";
import { Handlers } from "./input";
import { ButtonInputs } from "./input";
import { KeySynthesizer } from "./input";
import { KeyAliases } from "./input";
import { KeyHighlighter } from "./input";
import { KeyChorder } from "./input";
import { TileInspector } from "./tiles";
