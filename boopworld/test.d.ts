export type ctlStep = {
    time: number;
    tick?: number;
} & ({
    expect: ctlExpect;
} | {
    do: ctlDo;
});
export type eventRecord = ({
    entity: boopworld.EntityRef;
} & boopworld.Event);
export type Movement = Partial<boopworld.Point>;
export type ctlExpect = {
    saw: {
        [name: string]: string;
    };
} | {
    view: {
        [name: string]: string;
    };
} | {
    moves: [name: string, move: boopworld.Move][];
} | {
    movement: {
        [name: string]: Partial<boopworld.Point>;
    };
} | {
    movements: {
        [name: string]: MaybeCounted<Partial<boopworld.Point>>[];
    };
};
export type ctlDo = ("update" | {
    input: boopworld.InputDatum;
} | {
    inputs: MaybeCounted<boopworld.InputDatum>[];
});
export type MaybeCounted<T> = T | [number, ...T[]];
import * as boopworld from "./index.js";
/** @template T @typedef {T | [number, ...T[]]} MaybeCounted */
/** @param {boopworld.Point} p1 @param {boopworld.Point} p2 */
declare function movement({ x: x1, y: y1 }: boopworld.Point, { x: x2, y: y2 }: boopworld.Point): Partial<boopworld.Point>;
export {};
