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
