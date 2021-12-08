import test from 'ava';

import { freeze } from './index.js';

test('freeze', t => {
  let cv = 7;
  const o = {
    a: 3,
    bs: [4, 5, 6],
    get c() { return cv },
    set c(v) { cv = v },

    /** @type {any} this field is just a hack to prove cycle safety */
    d: null,
  };
  o.d = o;
  freeze(o);

  // nope to regular property change
  t.is(o.a, 3);
  t.throws(() => { o.a = 9 }, { message: /Cannot assign to read only property/ });
  t.is(o.a, 3);

  // nope to array element change, frozen
  t.is(o.bs[1], 5);
  t.throws(() => { o.bs[1] = 9 }, { message: /Cannot assign to read only property/ });
  t.is(o.bs[1], 5);

  // nope to array push, frozen
  t.deepEqual(o.bs, [4, 5, 6]);
  t.throws(() => o.bs.push(9), { message: /Cannot add property 3/ })
  t.deepEqual(o.bs, [4, 5, 6]);

  // nope to array pop, frozen
  t.deepEqual(o.bs, [4, 5, 6]);
  t.throws(() => o.bs.pop(), { message: /Cannot delete property '2'/ })
  t.deepEqual(o.bs, [4, 5, 6]);

  // explicitly defined property change is okay tho
  t.is(o.c, 7);
  o.c = 9;
  t.is(o.c, 9);
});

import { guard } from './index.js';

test('guard', t => {
  const makeIt = () => {
    let time = 0;
    let v = 1;
    return freeze({
      get time() { return time },
      tick() { time++; },
      ref() {
        const asof = time;
        return freeze(guard({
          get foo() { return v },
          set foo(x) { v = x },
          bar() { return v * v },
        }, () => {
          if (time > asof) throw new Error('time has moved on');
        }));
      },
    });
  }

  const it = makeIt();

  let o = it.ref();
  t.is(it.time, 0);
  t.is(o.foo, 1);
  o.foo = 2;
  t.is(o.foo, 2);
  t.is(o.bar(), 4);

  it.tick();
  t.is(it.time, 1);
  t.throws(() => { return o.foo }, { message: 'time has moved on' });
  t.throws(() => { o.foo = 3 }, { message: 'time has moved on' });
  t.throws(() => o.bar(), { message: 'time has moved on' });
  o = it.ref();
  t.is(o.foo, 2);
  t.is(o.bar(), 4);
});

import * as boopworld from './index.js';

/** @typedef {{time: number, tick?: number} & (
 *   | {expect: ctlExpect}
 *   | {do: ctlDo}
 * )} ctlStep */

/** @typedef {({entity: boopworld.EntityRef} & boopworld.Event)} eventRecord */

/** @typedef {Partial<boopworld.Point>} Movement */

/** @typedef {(
*   | {saw: {[name: string]: string}}
*   | {view: {[name: string]: string}}
*   | {moves: [name: string, move: boopworld.Move][]}
*   | {movement: { [name: string]: Movement}}
*   | {movements: { [name: string]: MaybeCounted<Movement>[] }}
* )} ctlExpect */

/** @typedef {(
 *   | "update"
 *   | {input: boopworld.InputDatum}
 *   | {inputs: MaybeCounted<boopworld.InputDatum>[]}
 * )} ctlDo */

/**
 * @param {ctlStep[]} steps
 * @param {object} [params]
 * @param {(...values: any[]) => void} [params.log]
 * @param {number} [params.debug]
 */
function makeTestStepper(steps, {
  log = console.log,
  debug = 0,
} = {}) {
  freeze(steps);
  let time = NaN, tick = 0;
  let stepi = 0;
  return Object.freeze({
    get time() { return time },
    get tick() { return tick },
    get stamp() { return isNaN(time) ? 'T∄' : `T${time}.${tick}` },
    advance,
    run,
    take,
    next,
    shouldTick,
  });

  /** @param {number} newTime */
  function advance(newTime) {
    if (newTime < time)
      throw new Error(`time must only go forward (${time} -> ${newTime})`);
    if (newTime == time) tick++;
    else time = newTime, tick = 0;
    if (debug) log(`- advanced to T${time}.${tick}`);
  }

  /** @param {() => void} body */
  function run(body) {
    for (
      let sanity = 2 * ticksNeeded();
      stepi < steps.length && sanity-- > 0;
    ) {
      if (debug > 1) log(`- sanity: ${sanity} i: ${stepi} / ${steps.length}`);
      body();
    }
    if (stepi < steps.length)
      throw new Error('must execute all controls');
  }

  function ticksNeeded() {
    let t1 = 0, k1 = 0, n = 0;
    /** @param {{time: number, tick?: number}} stamp */
    function count({ time: t2, tick: k2 = 0 }) {
      if (t2 > t1) n += t2 - t1 + k2;
      else if (t1 == t2 && k2 > k1) n += k2 - k1;
      t1 = t2, k1 = k2;
    }
    if (stepi < steps.length)
      count(steps[stepi]);
    for (let i = stepi + 1; i < steps.length; i++)
      count(steps[i]);
    return n;
  }

  /**
   * @template T
   * @param {string} what
   * @param {(step: ctlStep) => T|null} match
   * @returns {Generator<T>}
   */
  function* take(what, match) {
    for (; ;) {
      const { step } = next(what, match);
      if (!step) break;
      yield step;
    }
  }

  function shouldTick() {
    if (stepi >= steps.length) return false;
    const ctl = steps[stepi];
    if (ctl.time != time) return false;
    if (ctl.tick == undefined) return true;
    return ctl.tick > tick
  }

  /**
   * @template T
   * @param {string} what
   * @param {(step: ctlStep) => T|null} match
   * @returns {{step: T|null, done: boolean}}
   */
  function next(what, match) {
    if (stepi >= steps.length) return { step: null, done: true };
    const ctl = steps[stepi];
    if (ctl.time < time)
      throw new Error(`obsolete control[${stepi}]: T${ctl.time} < T${time}.${tick}`);
    if (ctl.time > time) {
      if (debug) log(`- ${what} waiting for T${time}.${tick} -> T${ctl.time}`);
      return { step: null, done: false };
    }
    if (ctl.tick != undefined) {
      if (ctl.tick < tick)
        throw new Error(`obsolete control[${stepi}]: T${ctl.time}.${ctl.tick} < T${time}.${tick}`);
      if (ctl.tick > tick) {
        if (debug) log(`- ${what} waiting for T${time}.${tick} -> T${ctl.time}.${ctl.tick}`);
        return { step: null, done: false };
      }
    }
    const ext = match(ctl);
    if (!ext) return { step: null, done: false };
    stepi++;
    return { step: ext, done: false };
  }
}

test('boops', t => {
  const testSteps = makeTestStepper([
    /* TODO test coverages goals
     * - thunk continuation / swapping
     * - thunk resultors currently unused: thunkExec, thunkDone, thunkFail, thunkYield, and thunkContinue
     * - mind death / reaping
     * - input rebind
     * - either of those 2 will cover component destruction paths
     * - a thunk that inspects its events
     * - a thunk that derefs entities (e.g. from such events)
     * - hitting a cell that contains more than one solid entity
     *   - e.g. one entity still stood in a doorway it closed, gets hit by another entity
     *   - e.g. an object buried in a wall
     * - other lol moves like "left" or "stay"
     * - sub views, querying view dead space, and such
     *   - however this should wait for the private view revamp
     * - all of the banal branches, however many will need dedicated unit tests only once we hit a done-enough point
     */

    {
      time: 1, expect: {
        saw: {
          protagonist: lines(
            '########',
            '#@·····#',
            '#······#',
            '#······#',
            '#······+',
            '#······#',
            '#······#',
            '########',
          ),

          antagonist: lines(
            '###+########',
            '#··········#',
            '#··········#',
            '#·········D#',
            '############',
          ),
        },
      },
    },

    { time: 1, do: 'update' },
    {
      time: 1, expect: {
        moves: [
          ["antagonist", "left"],
        ],
      },
    },

    { time: 1, do: { input: { key: 's' } } },
    {
      time: 2, expect: {
        saw: {
          protagonist: lines(
            '########',
            '#······#',
            '#@·····#',
            '#······#',
            '#······+',
            '#······#',
            '#······#',
            '########',
          ),

          antagonist: lines(
            '###+########',
            '#··········#',
            '#··········#',
            '#········D·#',
            '############',
          ),
        }
      },
    },

    { time: 2, do: 'update' },
    {
      time: 2, expect: {
        moves: [
          ["antagonist", "up"],
        ],
      },
    },

    { time: 2, do: { input: { key: 'd' } } },
    {
      time: 3, expect: {
        saw: {
          protagonist: lines(
            '########',
            '#······#',
            '#·@····#',
            '#······#',
            '#······+',
            '#······#',
            '#······#',
            '########',
          ),

          antagonist: lines(
            '###+########',
            '#··········#',
            '#········D·#',
            '#··········#',
            '############',
          ),
        },
      },
    },

    {
      time: 3, do: {
        inputs: [
          [2, { key: 'd' }], { key: 's' },
          [2, { key: 'd' }], { key: 's' },
          { key: 'd' },
        ],
      },
    },

    {
      time: 4, expect: {
        movements: {
          protagonist: [
            [2, { x: 1 }], { y: 1 },
            [2, { x: 1 }], { y: 1 },
            {},
          ],
          antagonist: [
            { x: -1 },
            { x: -1 },
            { y: 1 },
            { x: 1 },
            { x: 1 },
            { y: -1 },
            { x: 1 },
          ],
        },
      },
    },

    {
      time: 10, expect: {
        saw: {
          protagonist: lines(
            '########         ',
            '#······#         ',
            '#······#         ',
            '#······##########',
            '#·····@-········#',
            '#······######## #',
            '#······#         ',
            '########         ',
          ),

          antagonist: lines(
            '###+########',
            '#··········#',
            '#·········D#',
            '#··········#',
            '############',
          ),
        },
      },
    },

    { time: 10, do: { input: { key: 'd' } } },

    {
      time: 11, expect: {
        saw: {
          protagonist: lines(
            '######           ',
            '#·····           ',
            '#······          ',
            '#······##########',
            '#······@········#',
            '#······######## #',
            '#······          ',
            '######           ',
          ),

          antagonist: lines(
            '###+########',
            '#··········#',
            '#··········#',
            '#·········D#',
            '############',
          ),
        },
      },
    },

    {
      time: 11, tick: 2, expect: {
        view: {
          protagonist: lines(
            '########         ',
            '#······#         ',
            '#······#         ',
            '#······##########',
            '#······@········#',
            '#······######## #',
            '#······#         ',
            '########         ',
          ),
        },
      },
    },

    {
      time: 11, do: {
        inputs: [
          [8, { key: 'd' }],
          [6, { key: 's' }],
        ],
      },
    },
    {
      time: 12, expect: {
        movements: {
          protagonist: [
            [8, { x: 1 }],
            [5, { y: 1 }],
            {},
          ],
          antagonist: [
            { x: -1 },
            { x: -1 },
            { x: -1 },
            { x: -1 },
            { y: -1 },
            { y: -1 },
            { x: -1 },
            { y: 1 },
            { x: -1 },
            { x: -1 },
            { x: -1 },
            { x: -1 },
            { y: -1 },
            { x: 1 },
          ],
        },
      },
    },

    {
      time: 19, expect: {
        saw: {
          protagonist: lines(
            '#      ##########',
            '#······-·······@#',
            '#      ########·#',
            '              #·#',
            '              #·#',
            '              #·#',
            '              #·#',
            '              #+#',
          ),

          antagonist: lines(
            '###+########',
            '#··········#',
            '#····D·····#',
            '#··········#',
            '############',
          ),
        },
      },
    },

    {
      time: 19, tick: 2, expect: {
        view: {
          protagonist: lines(
            '########         ',
            '#······#         ',
            '#······#         ',
            '#······##########',
            '#······-·······@#',
            '#······########·#',
            '#······#      #·#',
            '########      #·#',
            '              #·#',
            '              #·#',
            '              #+#',
          ),
        },
      },
    },

    {
      time: 25, expect: {
        saw: {
          protagonist: lines(
            '### ',
            ' ·# ',
            '#·# ',
            '#·# ',
            '#·# ',
            '#·# ',
            '#@# ',
            '#-# ',
            'D·· ',
            ' ·· ',
            '····',
            '####',
          ),

          antagonist: lines(
            '   @#       ',
            '###-########',
            '#·D········#',
            '#··········#',
            '#··········#',
            '############',
          ),
        },
      },
    },

    {
      time: 25, tick: 2, expect: {
        view: {
          protagonist: lines(
            '########          ',
            '#······#          ',
            '#······#          ',
            '#······########## ',
            '#······-········# ',
            '#······########·# ',
            '#······#      #·# ',
            '########      #·# ',
            '              #·# ',
            '              #@# ',
            '              #-# ',
            '              D·· ',
            '               ·· ',
            '              ····',
            '              ####',
          ),
        },
      },
    },

  ], {
    log: t.log
  });

  /** @type {boolean|null} */
  let tracing = null;

  /**
   * @param {boolean|null} value
   * @param {() => void} body
   */
  function withTracing(value, body) {
    const prior = tracing;
    tracing = value;
    try { body() }
    finally { tracing = prior }
  }

  const player = boopworld.makeInput();

  /** @type {{
   *   movements: Map<string, {time: number, deltas: Partial<boopworld.Point>[]}>
   * }} */
  const expecting = {
    movements: new Map(),
  };

  const shard = boopworld.makeShard({
    seed: 0xdeadbeef,
    build(ctl) {
      const { root } = ctl;

      const {
        behavior,
        build: { rect, first, where, hallCreator, makeLexicon },
        // TODO test build.fromString
      } = boopworld;

      const lexicon = makeLexicon();

      const parseInput = behavior.inputParser();

      // TODO explore behavior
      // TODO follow(target) behavior
      // TODO boop(target) behavior
      // TODO flee(...targets) behavior

      const buildFloor = lexicon.define(root.create({
        glyph: '·', // ·⦁⦂⦙⦚ etc other fences in misc math syms
        zIndex: 1,
        isVisible: true,
        isSolid: false,
      }));

      const buildWall = lexicon.define(root.create({
        glyph: '#',
        zIndex: 8,
        isVisible: true,
        isSolid: true,
      }), '·');

      const door = root.create({
        glyph: '+',
        zIndex: 9,
        isVisible: true,
        isSolid: true,
        interact: ctx => {
          const { subject } = ctx;
          const closed = subject.isSolid;
          subject.isSolid = !closed;
          subject.glyph = closed ? '-' : '+';
          // TODO open/close events
        },
      });
      const buildDoor = lexicon.define(door, '·');

      const char = root.create({
        glyph: 'X',
        zIndex: 16,
        isVisible: true,
        isSolid: true,
      });
      lexicon.define(char, '·');

      /** @param {number} walls */
      const buildRoom = walls => first(
        hallCreator(walls, buildWall),
        buildFloor,
      );

      rect({ x: 0, y: 0, w: 8, h: 8 }, first(
        where([{ x: 7, y: 4 }, buildDoor]),
        buildRoom(hallCreator.AllWalls)));
      rect({ x: 8, y: 3, w: 6, h: 3 }, buildRoom(hallCreator.WallsNS));
      rect({ x: 14, y: 3, w: 3, h: 3 }, buildRoom(hallCreator.WallsNE));
      rect({ x: 14, y: 6, w: 3, h: 4 }, buildRoom(hallCreator.WallsEW));
      rect({ x: 12, y: 10, w: 12, h: 5 }, first(
        where([{ x: 15, y: 10 }, buildDoor]),
        buildRoom(hallCreator.AllWalls)));

      char.create({
        location: { x: 1, y: 1 },
        name: "protagonist",
        glyph: '@',
        input: player.bind,
        mind: behavior.all(
          behavior.updateView,
          parseInput,
        ),
      });

      char.create({
        location: { x: 22, y: 13 },
        name: "antagonist",
        glyph: 'D',
        mind: behavior.wander,
      });

      /**
       * @param {boopworld.Thunk} thunk
       * @returns {boopworld.Thunk}
       */
      function spyThunk(thunk) {
        return ctx => {
          const { time, self: { name } } = ctx;
          t.log(`== T${time} ${name}`);
          if (ctx.move)
            t.log(`  - move <- ${JSON.stringify(ctx.move)}`);
          for (const event of ctx.events())
            t.log(`  - event <- ${JSON.stringify(event)}`);
          const res = thunk(ctx);
          if (ctx.move)
            t.log(`  - <- move ${JSON.stringify(ctx.move)}`);
          t.log(`  - <- res ${JSON.stringify(res)}`);
          if (res.next) res.next = spyThunk(thunk);
          return res;
        };
      }

      const spyThunks = false;
      if (spyThunks) {
        for (const ent of ctl.entities({ hasMind: true }))
          if (ent.mind) ent.mind = spyThunk(ent.mind);
      }

      lexicon.destroy();

      // TODO test that destroyed entity cannot be accessed
      // TODO retain a live entity, test that it cannot be used after build
    },

    control(ctl) {
      testSteps.advance(ctl.time);

      // TODO tron/troff rather than expected-or-log

      let viewExpected = false;

      /** @type {eventRecord[]} */
      const evRecords = [];
      for (const [entity, event] of ctl.events())
        evRecords.push({ entity: entity.ref, ...event });
      let evExpected = false;

      /** @type {[name: string, move: boopworld.Move][]} */
      const mvRecords = [];
      for (const [entity, move] of ctl.moves())
        mvRecords.push([entity.name || ('' + entity.ref), move]);
      let mvExpected = false;

      for (const step of testSteps.take('control expect',
        step => 'expect' in step ? step.expect : null
      )) {
        if ('view' in step) for (const [name, s] of Object.entries(step.view)) {
          const ent = ctl.byName(name);
          const mind = ent?.mindState;
          if (!mind) {
            t.fail(`${testSteps.stamp} ∄ view.${name}`);
          } else {
            const { ctx: { memory: { view } } } = mind;
            t.deepEqual(
              view ? view.toString() : '',
              s, `${testSteps.stamp} view.${name}`);
            viewExpected = true;
          }
        }

        else if ('saw' in step) for (const [name, s] of Object.entries(step.saw)) {
          const view = getSaw(name);
          t.deepEqual(
            view ? view.toString() : '',
            s, `${testSteps.stamp} view.${name}`);
          viewExpected = true;
        }

        else if ('moves' in step) {
          t.deepEqual(mvRecords, step.moves, `${testSteps.stamp} moves`);
          mvExpected = true;
        }

        else if ('movement' in step) {
          for (const [name, delta] of Object.entries(step.movement))
            t.deepEqual(getMovement(name), delta, `${testSteps.stamp} ${name} movement`)
          evExpected = true;
        }

        else if ('movements' in step) {
          for (const [name, deltas] of Object.entries(step.movements))
            expecting.movements.set(name, { time: ctl.time, deltas: [...expandCounts(deltas)] });
        }

        else assertNever(step, 'unimplemented control expect');
      }

      for (const [name, { time, deltas }] of expecting.movements)
        if (ctl.time > time) {
          t.fail(`${testSteps.stamp} ${name} movement obsolete`);
          expecting.movements.delete(name);
        } else if (ctl.time == time) {
          const [delta, ...rest] = deltas;
          if (delta) t.deepEqual(
            getMovement(name), delta,
            `${testSteps.stamp} ${name} movement`);
          evExpected = true;
          if (rest.length) expecting.movements.set(name, { time: time + 1, deltas: rest });
          else expecting.movements.delete(name);
        }

      /** @param {string} name */
      function getSaw(name) {
        for (const [entity, event] of ctl.events())
          if (entity.name == name && event.type == 'view') {
            return event.view;
          }
        return null;
      }

      /** @param {string} name */
      function getMovement(name) {
        for (const [entity, event] of ctl.events())
          if (entity.name == name && event.type == 'move') {
            const { from, to } = event;
            return movement(from, to);
          }
        return {};
      }

      if (testSteps.tick == 0) {
        const noExpects = !(viewExpected || evExpected || mvExpected);
        if (tracing === true ||
          (tracing === null && noExpects)) {
          for (const [entity, event] of ctl.events()) if (event.type == 'view') {
            const { view } = event;
            t.log(`== ${testSteps.stamp} view.${entity.name}`);
            t.log('```');
            t.log(view ? view.toString() : '');
            t.log('```');
          }
          if (mvRecords.length) {
            t.log(`== ${testSteps.stamp} moves`);
            for (const rec of mvRecords)
              t.log(`- ${JSON.stringify(rec)}`);
          }
          if (evRecords.length) {
            t.log(`== ${testSteps.stamp} events`);
            for (const rec of evRecords)
              t.log(`- ${JSON.stringify(rec)}`);
          }
        }
      }

      for (const { entity, remnant } of ctl.reap()) {
        // TODO reap expector
        const { done, ok, reason, time, waitFor, move, events, memory } = remnant;
        t.log(`unexpected ${entity} remnant`);
        t.log(`- done:${done}`);
        t.log(`- ok:${ok}`);
        t.log(`- reason:${reason && JSON.stringify(reason)}`);
        t.log(`- time:${time}`);
        t.log(`- waitFor:${waitFor}`);
        t.log(`- move:${move}`);
        t.log(`- events:`);
        for (const event of events)
          t.log(`  - ${JSON.stringify(event)}`);
        t.log(`- memory:`);
        for (const key of memory.keys()) {
          const value = memory.get(key);
          t.log(`  - ${JSON.stringify(key)} => ${JSON.stringify(value)}`);
        }
      }

    },
  });

  testSteps.run(() => {
    for (const step of testSteps.take('test do',
      step => 'do' in step ? step.do : null,
    )) {
      t.log(`= ${testSteps.stamp} do ${JSON.stringify(step)}`);

      if (step === 'update')
        update('explicit');

      else if ('input' in step)
        t.true(player.provide(step.input), 'must provide input');

      else if ('inputs' in step) withTracing(false, () => {
        let first = true;
        for (const input of expandCounts(step.inputs)) {
          if (first) first = false;
          else {
            do update('inter-input');
            while (testSteps.shouldTick());
          }
          t.true(player.provide(input), 'must provide input');
        }
      });

      else assertNever(step, 'unimplemented control do')
    }

    update();

    function update(why = 'implicit') {
      t.log(`= ${testSteps.stamp} shard update (${why})`);
      shard.update();
    }
  });

  // TODO obsolete prior guard test by testing its effect within shard
});

/** @param {string[]} content */
function lines(...content) { return content.join('\n') + '\n' }

/** @template T @typedef {T | [number, ...T[]]} MaybeCounted */

/** @param {boopworld.Point} p1 @param {boopworld.Point} p2 */
function movement({ x: x1, y: y1 }, { x: x2, y: y2 }) {
  /** @type {Partial<boopworld.Point>} */
  const d = {};
  if (x2 != x1) d.x = x2 - x1;
  if (y2 != y1) d.y = y2 - y1;
  return d;
}

/**
 * @template T
 * @param {MaybeCounted<T>[]} items
 * @returns {Generator<T>}
 */
function* expandCounts(items) {
  for (const item of items) {
    if (Array.isArray(item)) {
      const [count, ...values] = item;
      for (let i = count; i-- > 0;)
        yield* values;
    }
    else yield item;
  }
}

/**
 * @param {never} _
 * @param {string} desc
 */
function assertNever(_, desc) {
  throw new Error(desc);
}
