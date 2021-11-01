import test from 'ava';

import * as boopworld from './index.js';

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
    boopworld.freeze(o);

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

test('guard', t => {
    const makeIt = () => {
        let time = 0;
        let v = 1;
        return boopworld.freeze({
            get time() { return time },
            tick() { time++; },
            ref() {
                const asof = time;
                return boopworld.freeze(boopworld.guard({
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

// /** @param {number} seed */
// function *prng(seed, inc=12345) {
//     for (;;) {
//         const
//             mult = 1103515245
//           , mod  = 0xffffffff
//           , mask = 0x3fffc000;
//         seed = (seed * mult + inc) & mod;
//         yield ((seed & mask) >> 14) / 0x3fffc;
//     }
// }
//
// const randIt = prng(0xdeadbeef);
// function rand() {
//     const res = randIt.next();
//     if (res.done) throw new Error('rand exhausted');
//     return res.value;
// }

test('boops', t => {

    // TODO this probably replaces boopworld.Input
    class Input {
        /** @type {boopworld.InputCtl|null} */
        ctl = null;

        /**
         * @param {string} code
         * @returns {boolean}
         */
        provide(code) {
            if (!this.ctl) return false;
            this.ctl.queueInput(code);
            return true;
        }
    }

    const player = new Input();

    /** @type {boopworld.ShardView|null} */
    let overview = null;

    let dumpEntities = false;

    let time = NaN, ticks = 0;

    const shard = boopworld.makeShard({
        build(_root, create) {
            const floor = create({
                glyph: '·',
                zIndex: 1,
                isVisible: true,
                isSolid: false,
            });

            const wall = create({
                glyph: '#',
                zIndex: 8,
                isVisible: true,
                isSolid: true,
            });

            const door = create({
                glyph: '/',
                zIndex: 9,
                isVisible: true,
                isSolid: true,
            });

            const char = create({
                glyph: 'X',
                zIndex: 16,
                isVisible: true,
                isSolid: true,
                hasMind: true,
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

            char.create({
                location: {x: 1, y: 1},
                name: "protagonist",
                input(ctl) { player.ctl = ctl },
                taskInit: {
                    switch: {$: 'input'},
                    cases: [
                        ['w', {move: 'up'}],
                        ['a', {move: 'left'}],
                        ['s', {move: 'down'}],
                        ['d', {move: 'right'}],
                        ['.', {move: 'stay'}],
                    ],
                    else: {yield: 'unrecognized input'},
                },
            });

            char.create({
                location: {x: 22, y: 13},
                name: "antagonist",
                // TODO task logic
            });

            floor.destroy();
            wall.destroy();
            door.destroy();
            char.destroy();

            // TODO test that destroyed entity cannot be accessed
            // TODO retain a live entity, test that it cannot be used after build
        },

        control(ctl) {
            if (ctl.time == time) {
                ticks++;
                return;
            }
            t.true(isNaN(time) || ctl.time > time,
                `time must only go forward (${time} -> ${ctl.time})`);

            time = ctl.time;
            ticks = 1;

            if (!overview) overview = ctl.makeView(ctl.bounds);
            else overview.bounds = ctl.bounds;

            // TODO expector t.log(`- bounds: ${JSON.stringify(overview.bounds)}`);

            // TODO expector t.log(`- at(0,0): ${overview.at({x: 0, y: 0})}`);

            // TODO expector
            t.log(overview.toString());

            // TODO expector
            t.log('minds:');
            for (const mind of ctl.entities({hasMind: true}))
                t.log(`- ${mind}`)

            // TODO expector
            if (dumpEntities) {
                t.log(`== extant entities`);
                for (const entity of ctl.entities()) {
                    const {task} = entity;
                    t.log(`- ${entity}`);
                    if (task) t.log(`  - task:${JSON.stringify(task)}`);
                }
            }

        },
    });

    // TODO dispatcher that drives input, and expects control progress above,
    // feeding expectations to it

    shard.update();
    t.deepEqual({time, ticks}, {time: 1, ticks: 1});

    shard.update();
    t.deepEqual({time, ticks}, {time: 1, ticks: 2});

    // TODO provider
    t.true(player.provide('w'), 'must provide input');

    shard.update();
    t.deepEqual({time, ticks}, {time: 2, ticks: 1});

    // TODO obsolete prior guard test by testing its effect within shard
});
