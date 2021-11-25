/**
 * @param {(Thunk|SubThunkState)[]} subs
 * @returns {Thunk}
 */
export function all(...subs: (Thunk | SubThunkState)[]): Thunk;
/** @type {Thunk} */
export function updateView(ctx: import("./index.js").ThunkCtx): import("./index.js").ThunkRes;
/**
 * @param {(input: number) => Move|null} [parse]
 * @returns {Thunk}
 */
export function inputParser(parse?: ((input: number) => Move | null) | undefined): Thunk;
/** @type {Thunk} */
export function wander(ctx: import("./index.js").ThunkCtx): import("./index.js").ThunkRes;
export type SubThunkState = {
    thunk: Thunk;
    waitFor?: import("./index.js").ThunkWaitFor | undefined;
};
export type Point = import('./index.js').Point;
export type Move = import('./index.js').Move;
export type Thunk = import('./index.js').Thunk;
export type ThunkCtx = import('./index.js').ThunkCtx;
export type ThunkRes = import('./index.js').ThunkRes;
export type ThunkWaitFor = import('./index.js').ThunkWaitFor;
