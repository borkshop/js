/** @typedef {import('./index.js').Point} Point */
/** @typedef {import('./index.js').Move} Move */
/** @typedef {import('./index.js').Thunk} Thunk */

import {
    thunkWait,
} from './index.js';

/**
 * @param {(input: number) => Move|null} [parse]
 * @returns {Thunk}
 */
export function inputParser(
    parse=input => { switch (String.fromCodePoint(input)) {
        case 'w': return 'up';
        case 'a': return 'left';
        case 's': return 'down';
        case 'd': return 'right';
        case '.': return 'stay';
        default: return null;
    } },
) {
    return ctx => {
        if (ctx.input) {
            for (const unit of ctx.input) {
                const move = parse(unit);
                if (move != undefined) ctx.move = move;
            }
        }
        // wait for (more) input
        if (ctx.move == undefined)
            return thunkWait("input");

        // wait for next turn once move chosen
        return thunkWait({time: ctx.time+1});
    };
}

/** @type {Move[]} */
const moves = ['up', 'right', 'down', 'left'];

/** @type {Partial<Point>[]} */
const moveDeltas = [{y: -1}, {x: 1}, {y: 1}, {x: -1}];

/** @type {Thunk} */
export function wander(ctx) {
    const {
        events, deref,
        time, random,
        self: {location: {x, y}},
    } = ctx;

    let lastDX = 0, lastDY = 0;
    let ats = moveDeltas.map(() => 0);

    for (const event of events()) switch (event.type) {
        case 'move':
            const {
                from: {x: x1, y: y1},
                to:   {x: x2, y: y2},
            } = event;
            lastDX = x2 - x1;
            lastDY = y2 - y1;
            break;

        case 'view':
            const {view: {at}} = event;
            ats = moveDeltas.map(({x: dx=0, y: dy=0}) => at({
                x: x + dx,
                y: y + dy,
            })?.ref || 0);
            break;
    }

    const can = ats.map(at => at != 0);
    const blocked = ats.map(at => deref(at)?.isSolid);

    const moveIds = ats
        .map((_, id) => id)
        .filter(id => {
            const {x: mx=0, y: my=0} = moveDeltas[id];
            return !(mx == -lastDX && my == -lastDY);
        })
        .filter(id => can[id] && !blocked[id]);
    if (moveIds.length) {
        const moveId = moveIds[Math.floor(random() * moveIds.length)];
        ctx.move = moves[moveId];
    }

    return thunkWait({time: time+1}); // wait for the next turn
}
