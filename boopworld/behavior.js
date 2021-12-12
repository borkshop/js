/** @typedef {import('./index.js').InputDatum} InputDatum */
/** @typedef {import('./index.js').Move} Move */
/** @typedef {import('./index.js').Point} Point */
/** @typedef {import('./index.js').Thunk} Thunk */
/** @typedef {import('./index.js').ThunkCtx} ThunkCtx */
/** @typedef {import('./index.js').ThunkRes} ThunkRes */
/** @typedef {import('./index.js').ThunkWaitFor} ThunkWaitFor */

import {
  thunkDone,
  thunkFail,
  thunkWait,
  thunkContinue,
} from './index.js';

/**
 * @param {(Thunk|SubThunkState)[]} subs
 * @returns {Thunk}
 */
export function all(...subs) {
  return degenerateSubThunk(subs) || (ctx => {
    const term = Array.from(runSubThunks(subs, ctx));
    if (term.some(res => res?.ok === false))
      return thunkFail('some sub-thunk failed');
    subs = subs.filter((_, i) => term[i] === null);
    if (!subs.length)
      return thunkDone('all sub thunks done');
    return subThunkRes(subs, all(...subs));
  });
}

/** @type {Thunk} */
export function updateView(ctx) {
  const {
    time,
    events, deref,
    memory: { view },
    log,
  } = ctx;
  view.integrateEvents(
    events(),
    Object.freeze({ time, deref, log }),
  );
  return thunkWait({ time: time + 1 });
}

/**
 * @param {(dat: InputDatum) => Move|null} [parse]
 * @returns {Thunk}
 */
export function inputParser(
  parse = dat => {
    if ('key' in dat) switch (dat.key) {

      case 'ArrowUp': case 'W': case 'w': return 'up';
      case 'ArrowLeft': case 'A': case 'a': return 'left';
      case 'ArrowDown': case 'S': case 's': return 'down';
      case 'ArrowRight': case 'D': case 'd': return 'right';

      case '.': return 'stay';
    }

    return null;
  },
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
    return thunkWait({ time: ctx.time + 1 });
  };
}

/** @type {Move[]} */
const moves = ['up', 'right', 'down', 'left'];

/** @type {Partial<Point>[]} */
const moveDeltas = [{ y: -1 }, { x: 1 }, { y: 1 }, { x: -1 }];

/** @type {Thunk} */
export function wander(ctx) {
  const {
    events, deref,
    time, random,
    self: { location: { x, y } },
  } = ctx;

  let lastDX = 0, lastDY = 0;
  let ats = moveDeltas.map(() => 0);

  for (const event of events()) switch (event.type) {
    case 'move':
      const {
        from: { x: x1, y: y1 },
        to: { x: x2, y: y2 },
      } = event;
      lastDX = x2 - x1;
      lastDY = y2 - y1;
      break;

    case 'view':
      const { view: { at } } = event;
      ats = moveDeltas.map(({ x: dx = 0, y: dy = 0 }) => at({
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
      const { x: mx = 0, y: my = 0 } = moveDeltas[id];
      return !(mx == -lastDX && my == -lastDY);
    })
    .filter(id => can[id] && !blocked[id]);
  if (moveIds.length) {
    const moveId = moveIds[Math.floor(random() * moveIds.length)];
    ctx.move = moves[moveId];
  }

  return thunkWait({ time: time + 1 }); // wait for the next turn
}

/**
 * @typedef {object} SubThunkState
 * @prop {Thunk} thunk
 * @prop {ThunkWaitFor} [waitFor]
 */

/**
 * @param {(Thunk|SubThunkState)[]} subs
 * @returns {Thunk|null}
 */
function degenerateSubThunk(subs) {
  if (subs.length == 0)
    return () => thunkDone('no sub-tasks left');
  if (subs.length == 1)
    return subThunk(subs[0]);
  return null;
}

/**
 * @param {(Thunk|SubThunkState)} sub
 * @returns {Thunk}
 */
function subThunk(sub) {
  if (typeof sub == 'function') return sub;
  const { thunk, waitFor } = sub;
  if (!waitFor) return thunk;
  return ctx => ctx.isReady(waitFor)
    ? thunk(ctx)
    : thunkWait(waitFor, thunk);
}

/**
 * @param {(Thunk|SubThunkState)[]} subs
 * @param {ThunkCtx} ctx
 * @returns {Generator<ThunkRes|null>}
 */
function* runSubThunks(subs, ctx) {
  for (let i = 0; i < subs.length; ++i) {
    const sub = subs[i];
    const waitingFor = typeof sub == 'function' ? undefined : sub.waitFor;
    if (waitingFor && !ctx.isReady(waitingFor)) { yield null; continue }
    const thunk = typeof sub == 'function' ? sub : sub.thunk;
    const res = thunk(ctx);
    const { next, waitFor } = res;
    if (next) { subs[i] = { thunk: next, waitFor }; yield null }
    else if (waitFor) { subs[i] = { thunk, waitFor }; yield null }
    else { yield res }
  }
}

/**
 * @param {(Thunk|SubThunkState)[]} subs
 * @param {Thunk} next
 */
function subThunkRes(subs, next) {
  const waitForAny = /** @type {ThunkWaitFor[]} */ (subs
    .map(sub => typeof sub == 'function' ? undefined : sub.waitFor)
    .filter(waitFor => waitFor != undefined));
  switch (waitForAny.length) {
    case 0: return thunkContinue(next);
    case 1: return thunkWait(waitForAny[0], next);
    default: return thunkWait({ any: waitForAny }, next);
  }
}
