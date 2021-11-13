import test from 'ava';

import {freeze} from './index.js';

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
    t.throws(() => { o.a = 9 }, {message: /Cannot assign to read only property/});
    t.is(o.a, 3);

    // nope to array element change, frozen
    t.is(o.bs[1], 5);
    t.throws(() => { o.bs[1] = 9 }, {message: /Cannot assign to read only property/});
    t.is(o.bs[1], 5);

    // nope to array push, frozen
    t.deepEqual(o.bs, [4, 5, 6]);
    t.throws(() => o.bs.push(9), {message: /Cannot add property 3/})
    t.deepEqual(o.bs, [4, 5, 6]);

    // nope to array pop, frozen
    t.deepEqual(o.bs, [4, 5, 6]);
    t.throws(() => o.bs.pop(), {message: /Cannot delete property '2'/})
    t.deepEqual(o.bs, [4, 5, 6]);

    // explicitly defined property change is okay tho
    t.is(o.c, 7);
    o.c = 9;
    t.is(o.c, 9);
});

import {guard} from './index.js';

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
    t.throws(() => { return o.foo }, {message: 'time has moved on'});
    t.throws(() => { o.foo = 3 }, {message: 'time has moved on'});
    t.throws(() => o.bar(), {message: 'time has moved on'});
    o = it.ref();
    t.is(o.foo, 2);
    t.is(o.bar(), 4);
});

import * as boopworld from './index.js';

/**
 * @callback Shader
 * @param {boopworld.Point} p
*/

/**
 * @param {boopworld.Rect} rect
 * @param {Shader} fill
 * @param {Shader} [stroke]
 * @param {Shader} [corner]
 */
export function buildRect(rect, fill, stroke, corner) {
    const {x: minx, y: miny, w, h} = rect
    const maxx = minx + w - 1;
    const maxy = miny + h - 1;
    for (let y=miny; y <= maxy; y++) {
        const edgey = y == miny || y  == maxy;
        for (let x=minx; x <= maxx; x++) {
            const edgex = (x == minx || x == maxx);
            if (stroke && (edgex || edgey)) {
                if (corner && (edgex || edgey)) corner({x, y});
                else stroke({x, y});
            } else fill({x, y});
        }
    }
}

/** @param {number} seed */
function makePRNG(seed, inc=12345) {
    const
        mult = 1103515245
      , mod  = 0xffffffff
      , mask = 0x3fffc000
      , max  = 0x3fffc
    ;

    return {
        get seed() { return seed },
        get inc() { return inc },
        get maxint() { return max },
        next,
        randint,
        random,
        mix,
        blend,
    };

    function next() {
        return seed = (seed * mult + inc) & mod;
    }

    function randint() {
        return (next() & mask) >> 14;
    }

    function random() {
        return randint() / max;
    }

    /** @param {number} n */
    function mix(n) {
        seed = seed ^ n;
        return next();
    }

    /** @param {string} s */
    function blend(s) {
        for (const glyph of s) {
            const code = glyph.codePointAt(0);
            if (code != undefined) mix(code);
        }
    }
}

/** @typedef {{time: number, tick?: number} & (
 *   | {expect: ctlExpect}
 *   | {do: ctlDo}
 * )} ctlStep */

/** @typedef {({entity: boopworld.EntityRef} & boopworld.Event)} eventRecord */

/** @typedef {Partial<boopworld.Point>} Movement */

/** @typedef {(
*   | {overview: string|string[]}
*   | {events: eventRecord[]}
*   | {moves: [name: string, move: boopworld.Move][]}
*   | {movement: { [name: string]: Movement}}
*   | {movements: { [name: string]: MaybeCounted<Movement>[] }}
* )} ctlExpect */

/** @typedef {(
 *   | "update"
 *   | {input: string}
 *   | {inputs: MaybeCounted<string>[]}
 * )} ctlDo */

/**
 * @param {ctlStep[]} steps
 * @param {object} [params]
 * @param {(...values: any[]) => void} [params.log]
 * @param {number} [params.debug]
 */
function makeTestStepper(steps, {
    log=console.log,
    debug=0,
}={}) {
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
            let sanity=2 * ticksNeeded();
            stepi < steps.length && sanity-->0;
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
        function count({time: t2, tick: k2=0}) {
            if (t2 > t1) n += t2 - t1 + k2;
            else if (t1 == t2 && k2 > k1) n += k2 - k1;
            t1 = t2, k1 = k2;
        }
        if (stepi < steps.length)
            count(steps[stepi]);
        for (let i = stepi+1; i < steps.length; i++)
            count(steps[i]);
        return n;
    }

    /**
     * @template T
     * @param {string} what
     * @param {(step: ctlStep) => T|null} match
     * @returns {Generator<T>}
     */
    function *take(what, match) {
        for (;;) {
            const {step} = next(what, match);
            if (!step) break;
            yield step;
        }
    }

    /**
     * @template T
     * @param {string} what
     * @param {(step: ctlStep) => T|null} match
     * @returns {{step: T|null, done: boolean}}
     */
    function next(what, match) {
        if (stepi >= steps.length) return {step: null, done: true};
        const ctl = steps[stepi];
        if (ctl.time < time)
            throw new Error(`obsolete control[${stepi}]: T${ctl.time} < T${time}.${tick}`);
        if (ctl.time > time) {
            if (debug) log(`- ${what} waiting for T${time}.${tick} -> T${ctl.time}`);
            return {step: null, done: false};
        }
        if (ctl.tick != undefined) {
            if (ctl.tick < tick)
                throw new Error(`obsolete control[${stepi}]: T${ctl.time}.${ctl.tick} < T${time}.${tick}`);
            if (ctl.tick > tick) {
                if (debug) log(`- ${what} waiting for T${time}.${tick} -> T${ctl.time}.${ctl.tick}`);
                return {step: null, done: false};
            }
        }
        const ext = match(ctl);
        if (!ext) return {step: null, done: false};
        stepi++;
        return {step: ext, done: false};
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

        {time: 1, expect: {
            overview: [
                '########                ',
                '#@·····#                ',
                '#······#                ',
                '#······##########       ',
                '#······+········#       ',
                '#······########·#       ',
                '#······#      #·#       ',
                '########      #·#       ',
                '              #·#       ',
                '              #·#       ',
                '            ###+########',
                '            #··········#',
                '            #··········#',
                '            #·········D#',
                '            ############',
            ],
            events: [],
        }},

        {time: 1, do: 'update'},
        {time: 1, expect: {moves: [
            ["antagonist", "up"],
        ]}},

        {time: 1, do: {input: 's'}},
        {time: 2, expect: {
            overview: [
                '########                ',
                '#······#                ',
                '#@·····#                ',
                '#······##########       ',
                '#······+········#       ',
                '#······########·#       ',
                '#······#      #·#       ',
                '########      #·#       ',
                '              #·#       ',
                '              #·#       ',
                '            ###+########',
                '            #··········#',
                '            #·········D#',
                '            #··········#',
                '            ############',
            ], 
            events: [
                {entity: [253,1], time: 2, type: "move", from: {x:22, y:13}, to: {x:22, y:12}, here: []},
                {entity: [252,1], time: 2, type: "move", from: {x:1, y:1}, to: {x:1, y:2}, here: []},
            ],
        }},

        {time: 2, do: 'update'},
        {time: 2, expect: {moves: [
            ["antagonist", "up"],
        ]}},

        {time: 2, do: {input: 'd'}},
        {time: 3, expect: {
            overview: [
                '########                ',
                '#······#                ',
                '#·@····#                ',
                '#······##########       ',
                '#······+········#       ',
                '#······########·#       ',
                '#······#      #·#       ',
                '########      #·#       ',
                '              #·#       ',
                '              #·#       ',
                '            ###+########',
                '            #·········D#',
                '            #··········#',
                '            #··········#',
                '            ############',
            ],
            events: [
                {entity: [253,1], time: 3, type: "move", from: {x:22, y:12}, to: {x:22, y:11}, here: []},
                {entity: [252,1], time: 3, type: "move", from: {x:1, y:2}, to: {x:2, y:2}, here: []},
            ],
        }},

        {time: 3, do: {inputs: [
            [2, 'd'], 's',
            [2, 'd'], 's',
            'd',
        ]}},

        {time: 4, expect: {movements: {
            protagonist: [
                [2, {x: 1}], {y: 1},
                [2, {x: 1}], {y: 1},
                {},
            ],
            antagonist: [
                // FIXME why? doesn't seem very "random" ; also y no left/right?
                [3, {y: 1}, {y: -1}],
                {y: 1},
            ],
        }}},

        {time: 10, expect: {
            overview: [
                '########                ',
                '#······#                ',
                '#······#                ',
                '#······##########       ',
                '#·····@-········#       ',
                '#······########·#       ',
                '#······#      #·#       ',
                '########      #·#       ',
                '              #·#       ',
                '              #·#       ',
                '            ###+########',
                '            #··········#',
                '            #·········D#',
                '            #··········#',
                '            ############',
            ],
            events: [
                {entity: [252, 1], time: 10, type: "hit", target: [60, 3]},
                {entity: [253, 1], time: 10, type: "move", from: {x: 22, y: 11}, to: {x: 22, y: 12}, here: []},
            ]
        }},

        {time: 10, do: {input: 'd'}},
        {time: 11, expect: {overview: [
            '########                ',
            '#······#                ',
            '#······#                ',
            '#······##########       ',
            '#······@········#       ',
            '#······########·#       ',
            '#······#      #·#       ',
            '########      #·#       ',
            '              #·#       ',
            '              #·#       ',
            '            ###+########',
            '            #·········D#',
            '            #··········#',
            '            #··········#',
            '            ############',
        ]}},

        {time: 11, do: {inputs: [
            [8, 'd'],
            [6, 's'],
        ]}},
        {time: 12, expect: {movements: {
            protagonist: [
                [8, {x: 1}],
                [5, {y: 1}],
                {},
            ],
            antagonist: [
                // FIXME why? doesn't seem very "random" ; also y no left/right?
                [7, {y: 1}, {y: -1}],
            ],
        }}},

        {time: 19, expect: {overview: [
            '########                ',
            '#······#                ',
            '#······#                ',
            '#······##########       ',
            '#······-·······@#       ',
            '#······########·#       ',
            '#······#      #·#       ',
            '########      #·#       ',
            '              #·#       ',
            '              #·#       ',
            '            ###+########',
            '            #·········D#',
            '            #··········#',
            '            #··········#',
            '            ############',
        ]}},

        {time: 25, expect: {overview: [
            '########                ',
            '#······#                ',
            '#······#                ',
            '#······##########       ',
            '#······-········#       ',
            '#······########·#       ',
            '#······#      #·#       ',
            '########      #·#       ',
            '              #·#       ',
            '              #@#       ',
            '            ###-########',
            '            #·········D#',
            '            #··········#',
            '            #··········#',
            '            ############',
        ]}},

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

    /** @type {boopworld.ShardView|null} */
    let overview = null;

    /** @type {{
     *   movements: Map<string, Partial<boopworld.Point>[]>
     * }} */
    const expecting = {
        movements: new Map(),
    };

    const shard = boopworld.makeShard({
        build(root) {
            const floor = root.create({
                glyph: '·', // ·⦁⦂⦙⦚ etc other fences in misc math syms
                zIndex: 1,
                isVisible: true,
                isSolid: false,
            });

            const wall = root.create({
                glyph: '#',
                zIndex: 8,
                isVisible: true,
                isSolid: true,
            });

            const door = root.create({
                glyph: '+',
                zIndex: 9,
                isVisible: true,
                isSolid: true,
                interact: ctx => {
                    const {subject} = ctx;
                    const closed = subject.isSolid;
                    subject.isSolid = !closed;
                    subject.glyph = closed ? '-' : '+';
                    // TODO open/close events
                },
            });

            const char = root.create({
                glyph: 'X',
                zIndex: 16,
                isVisible: true,
                isSolid: true,
            });

            /**
             * @param {boopworld.Rect} bounds
             * @param {boopworld.Point[]} doors
             */
            function buildRoom(bounds, ...doors) {
                // NOTE: this is intentionally written "wastefully" to exercise
                // entity reallocation (e.g. by destroying walls and creating
                // doors)
                buildRect(
                    bounds,
                    ({x, y}) => floor.create({location: {x, y}}),
                    ({x, y}) => {
                        floor.create({location: {x, y}});
                        let w = wall.create({location: {x, y}});
                        for (const {x: dx, y: dy} of doors)
                        if (dx == x && dy == y) {
                            w.destroy();
                            w = door.create({location: {x, y}})
                        }
                    },
                );
            }

            const
                WallNorth = 0x01
              , WallEast = 0x02
              , WallSouth = 0x04
              , WallWest = 0x08
              , HWalls = WallNorth|WallSouth
              , VWalls = WallWest|WallEast
              ;

            /**
             * @param {boopworld.Rect} bounds
             * @param {number} walls
             */
            function buildHall(bounds, walls) {
                const {x: minx, y: miny, w, h} = bounds;
                const maxx = minx + w - 1;
                const maxy = miny + h - 1;
                buildRect(
                    bounds,
                    ({x, y}) => floor.create({location: {x, y}}),
                    ({x, y}) => {
                        floor.create({location: {x, y}});
                        if (shouldWall({x, y}))
                            wall.create({location: {x, y}});
                    },
                );

                /** @param {boopworld.Point} p */
                function shouldWall({x, y}) {
                    if (walls & WallNorth && y == miny) return true;
                    if (walls & WallEast && x == maxx) return true;
                    if (walls & WallSouth && y == maxy) return true;
                    if (walls & WallWest && x == minx) return true;
                    if ((y == miny || y == maxy) &&
                        (x == maxx || x == minx)) return true;
                    return false;
                }
            }

            buildRoom({x: 0, y: 0, w: 8, h: 8}, {x: 7, y: 4});
            buildHall({x: 8, y: 3, w: 6, h: 3}, HWalls);
            buildHall({x: 14, y: 3, w: 3, h: 3}, WallNorth|WallEast);
            buildHall({x: 14, y: 6, w: 3, h: 4}, VWalls);
            buildRoom({x: 12, y: 10, w: 12, h: 5}, {x: 15, y: 10});

            const spyThunks = false;

            /**
             * @param {string} name
             * @param {boopworld.Thunk} thunk
             * @returns {boopworld.Thunk}
             */
            function spyThunk(name, thunk) {
                if (!spyThunks) return thunk;
                return ctx => {
                    const {time} = ctx;
                    t.log(`== T${time} ${name}`);
                    if (ctx.move)
                        t.log(`  - move <- ${JSON.stringify(ctx.move)}`);
                    for (const event of ctx.events())
                        t.log(`  - event <- ${JSON.stringify(event)}`);
                    const res = thunk(ctx);
                    if (ctx.move)
                        t.log(`  - <- move ${JSON.stringify(ctx.move)}`);
                    t.log(`  - <- res ${JSON.stringify(res)}`);
                    return res;
                };
            }

            const seeder = makePRNG(0xdeadbeef);

            /** Extended thunk wrapper that executes an inner thunk with a
             * deterministic RNG whose states lives in the entity's memory.
             *
             * TODO this is probably a common enough feature that it should be
             * baked into the underlying system rather than done as an
             * extension/wrapper on top, but we're starting here and keeping
             * the core small for now.
             *
             * @param {boopworld.ThunkExt<() => number>} thunk
             * @returns {boopworld.Thunk}
             */
            function withMindRNG(thunk) { return ctx => {
                // load prng from entity memory or init from shared seeder prng
                let rng = null;
                let seed = ctx.memory.get('rngSeed');
                let inc = ctx.memory.get('rngInc');
                if (typeof seed == 'number' && typeof inc == 'number') {
                    rng = makePRNG(seed, inc);
                } else {
                    seed = seeder.next();
                    inc = (seeder.inc + seeder.randint()) % seeder.maxint;
                    rng = makePRNG(seed, inc);
                    rng.blend(ctx.self.name || 'unnamed');
                }

                // run the extended thunk passing it just the normative random()
                const res = thunk(ctx, rng.random);

                // save prng state back to entity memory
                ctx.memory.set('rngSeed', rng.seed);
                ctx.memory.set('rngInc', rng.inc);

                return res;
            } }

            char.create({
                location: {x: 1, y: 1},
                name: "protagonist",
                glyph: '@',
                input: player.bind,
                mind: spyThunk('protagonist', ctx => {
                    // TODO present events to user
                    // TODO render from ctx.view

                    // parse moves from input, taking the last parsed move
                    for (const codePoint of ctx.input()) {
                        const move = ( c => { switch (c) {
                            case 'w': return 'up';
                            case 'a': return 'left';
                            case 's': return 'down';
                            case 'd': return 'right';
                            case '.': return 'stay';
                            default: return undefined;
                        } } )(String.fromCodePoint(codePoint))
                        if (move != undefined) ctx.move = move;
                    }

                    return boopworld.thunkWait(ctx.move != undefined
                        ? {time: ctx.time+1} // wait for the next turn
                        : "input"            // after input has determined a move
                    );
                })
            });

            /** @type {boopworld.Move[]} */
            const moves = ['up', 'right', 'down', 'left'];

            /** @type {Partial<boopworld.Point>[]} */
            const moveDeltas = [
                {y: -1},
                {x: 1},
                {y: 1},
                {x: -1}
            ];

            char.create({
                location: {x: 22, y: 13},
                name: "antagonist",
                glyph: 'D',
                mind: spyThunk('antagonist', withMindRNG((ctx, random) => {
                    // TODO protagonist hunter instead of random walker

                    const {x, y} = ctx.self.location;
                    const {x: vx, y: vy} = ctx.view.bounds;
                    const ats = moveDeltas.map(({x: dx=0, y: dy=0}) => ctx.view.at({
                        x: x + dx - vx,
                        y: y + dy - vy
                    }));

                    const can = ats.map(at => at != null);
                    const blocked = ats.map(at => at ? at.isSolid : false);

                    const moveIds = ats
                        .map((_, i) => i)
                        .filter(i => can[i] && !blocked[i]);
                    if (moveIds.length) {
                        // TODO use ctx-threaded random (i.e. per-mind rng state),
                        // rather than ambient random
                        const moveId = moveIds[Math.floor(random() * moveIds.length)];
                        ctx.move = moves[moveId];
                    } else {
                        t.log(`- no moves`);
                    }

                    return boopworld.thunkWait({time: ctx.time+1}); // wait for the next turn
                }))
            });

            floor.destroy();
            wall.destroy();
            door.destroy();
            char.destroy();

            // TODO test that destroyed entity cannot be accessed
            // TODO retain a live entity, test that it cannot be used after build
        },

        control(ctl) {
            testSteps.advance(ctl.time);

            // TODO tron/troff rather than expected-or-log

            if (!overview) overview = ctl.makeView(ctl.bounds);
            else overview.bounds = ctl.bounds;
            let ovExpected = false;

            /** @type {eventRecord[]} */
            const evRecords = [];
            for (const [entity, event] of ctl.events())
                evRecords.push({entity: entity.ref, ...event});
            let evExpected = false;

            /** @type {[name: string, move: boopworld.Move][]} */
            const mvRecords = [];
            for (const [entity, move] of ctl.moves())
                mvRecords.push([entity.name || ('' + entity.ref), move]);
            let mvExpected = false;

            for (const step of testSteps.take('control expect',
                step => 'expect' in step ? step.expect : null
            )) {
                if ('overview' in step) {
                    const ovs = overview.toString();
                    const ov = step.overview;
                    t.deepEqual(
                        Array.isArray(ov) ? ovs.split('\n') : ovs,
                        ov, `${testSteps.stamp} overview`);
                    ovExpected = true;
                }

                else if ('moves' in step) {
                    t.deepEqual(mvRecords, step.moves, `${testSteps.stamp} moves`);
                    mvExpected = true;
                }

                else if ('events' in step) {
                    t.deepEqual(evRecords, step.events, `${testSteps.stamp} events`);
                    evExpected = true;
                }

                else if ('movement' in step) {
                    for (const [name, delta] of Object.entries(step.movement))
                        t.deepEqual(getMovement(name), delta, `${testSteps.stamp} ${name} movement`)
                    evExpected = true;
                }

                else if ('movements' in step) {
                    for (const [name, deltas] of Object.entries(step.movements))
                        expecting.movements.set(name, [...expandCounts(deltas)]);
                }

                else assertNever(step, 'unimplemented control expect');
            }

            for (const [name, deltas] of expecting.movements) {
                const delta = deltas.shift();
                if (!deltas.length) expecting.movements.delete(name);
                if (delta) t.deepEqual(
                    getMovement(name), delta,
                    `${testSteps.stamp} ${name} movement`);
                evExpected = true;
            }

            /** @param {string} name */
            function getMovement(name) {
                /** @type {Partial<boopworld.Point>} */
                const d = {};
                for (const [entity, event] of ctl.events())
                    if (entity.name == name && event.type == 'move') {
                        const {from: {x: x1, y: y1}, to: {x: x2, y: y2}} = event;
                        if (x2 != x1) d.x = x2 - x1;
                        if (y2 != y1) d.y = y2 - y1;
                        break;
                    }
                return d;
            }

            if (testSteps.tick == 0) {
                const noExpects = !(ovExpected || evExpected || mvExpected);
                if ( tracing === true ||
                    (tracing === null && noExpects)) {
                    t.log(`== ${testSteps.stamp} overview`);
                    t.log('```');
                    t.log(overview.toString());
                    t.log('```');
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

            for (const {entity, remnant} of ctl.reap()) {
                // TODO reap expector
                const {done, ok, reason, time, waitFor, move, events, memory} = remnant;
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
                    else update('inter-input');
                    t.true(player.provide(input), 'must provide input');
                }
            });

            else assertNever(step, 'unimplemented control do')
        }

        update();

        function update(why='implicit') {
            t.log(`= ${testSteps.stamp} shard update (${why})`);
            shard.update();
        }
    });

    // TODO obsolete prior guard test by testing its effect within shard
});

/** @template T @typedef {T | [number, ...T[]]} MaybeCounted */

/**
 * @template T
 * @param {MaybeCounted<T>[]} items
 * @returns {Generator<T>}
 */
function *expandCounts(items) {
    for (const item of items) {
        if (Array.isArray(item)) {
            const [count, ...values] = item;
            for (let i=count; i-->0;)
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
