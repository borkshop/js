import test from 'ava';

import * as xorbig from './index.js';

const testRandom = test.macro({
    /** @param {number|bigint|string|ArrayBuffer} seed */
    exec(t, seed) {
        const r = xorbig.makeRandom(seed);
        const buckets = new Uint16Array(100);
        const rounds = 16 * 1024-1;
        for (let i = 0; i < rounds; ++i)
            buckets[Math.floor(r.random() * buckets.length)]++;

        const target = rounds / buckets.length;
        t.false([...buckets]
            .map(n => n / target - 1.0)
            .some(n => Math.abs(n) > 0.35),
        'buckets should have even distribution');
    },

    title(providedTitle='', seed) {
        return `${providedTitle} random(${
            seed instanceof ArrayBuffer
                ? [...new Uint8Array(seed)].map(n => n.toString(16).padStart(2, '0')).join(' ')
                : typeof seed == 'string' ? JSON.stringify(seed)
                : seed.toString(16)
        })`;
    }
});

const testRandomInt = test.macro({
    /** @param {number|bigint|string|ArrayBuffer} seed */
    exec(t, seed) {
        const r = xorbig.makeRandom(seed);
        const buckets = new Uint16Array(100);
        const rounds = 16 * 1024-1;
        for (let i = 0; i < rounds; ++i) {
            for (;;) {
                const n = r.randomInt() & 0x7f;
                if (n < 100) {
                    buckets[n]++;
                    break;
                }
            }
        }

        const target = rounds / buckets.length;
        t.false([...buckets]
            .map(n => n / target - 1.0)
            .some(n => Math.abs(n) > 0.35),
        'buckets should have even distribution');
    },

    title(providedTitle='', seed) {
        return `${providedTitle} randomInt(${
            seed instanceof ArrayBuffer
                ? [...new Uint8Array(seed)].map(n => n.toString(16).padStart(2, '0')).join(' ')
                : typeof seed == 'string' ? JSON.stringify(seed)
                : seed.toString(16)
        })`;
    }
});

const testRandomBigint = test.macro({
    /** @param {number|bigint|string|ArrayBuffer} seed */
    exec(t, seed) {
        const r = xorbig.makeRandom(seed);
        const buckets = new Uint16Array(100);
        const rounds = 16 * 1024-1;
        for (let i = 0; i < rounds; ++i) {
            for (;;) {
                const n = r.randomBigint() & 0x7fn;
                if (n < 100) {
                    buckets[Number(n)]++;
                    break;
                }
            }
        }
        t.false([...buckets]
            .map(n => Math.round(n / rounds * 100))
            .some(n => n != 1),
        'buckets should have even distribution');
    },

    title(providedTitle='', seed) {
        return `${providedTitle} randomBigint(${
            seed instanceof ArrayBuffer
                ? [...new Uint8Array(seed)].map(n => n.toString(16).padStart(2, '0')).join(' ')
                : typeof seed == 'string' ? JSON.stringify(seed)
                : seed.toString(16)
        })`;
    }
});

const testRandomBytes = test.macro({
    /**
     * @param {number|bigint|string|ArrayBuffer} seed
     * @param {number} bufSize
     */
    exec(t, seed, bufSize) {
        const r = xorbig.makeRandom(seed);

        function *gen() {
            const buf = new Uint8Array(bufSize);
            for (;;) {
                t.is(r.writeInto(buf.buffer), buf.length, 'must fill buffer');
                // t.log(buf);
                yield *buf;
            }
        }
        const bs = gen();

        const buckets = new Uint32Array(256);
        const rounds = 24 * 1024-1;
        for (let i = 0; i < rounds; ++i)
            buckets[Number(next(bs))]++;

        const target = rounds / buckets.length;

        // NOTE: this test has a wide margin of error ( upto 40% variation per
        // bucket ) since hammering on small buffer sizes can lead to
        // pathology; that's not really the main intended case tho, since if
        // you need a steam of 1/2 bytes at a time, you're better off just
        // calling randomInt() yourself and masking
        const problems = [...buckets]
            .map((n, i) => [i, n / target - 1.0])
            .filter(([_i, n]) => Math.abs(n) > 0.4);
        if (problems.length) {
            t.log(problems);
            t.fail('buckets should have even distribution');
        }
    },

    title(providedTitle='', seed, bufSize) {
        return `${providedTitle} randomBytes(${
            seed instanceof ArrayBuffer
                ? [...new Uint8Array(seed)].map(n => n.toString(16).padStart(2, '0')).join(' ')
                : typeof seed == 'string' ? JSON.stringify(seed)
                : seed.toString(16)
        }) w/ bufSize:${bufSize}`;
    }
});

for (const seed of [
    0,
    0x123456789abcdef0n,
    '',
    'lool',
]) {
    test(testRandom, seed);
    test(testRandomInt, seed);
    test(testRandomBigint, seed);
    for (const bufSize of [1, 2, 3, 4, 5, 6, 7, 8, 33])
        test(testRandomBytes, seed, bufSize);
}

// NOTE: this seed fails testRandomBytes still, and its primary purpose is to
// hit the "direct seed hex string" branch
test(
    testRandom,
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);

for (let n=0; n < 128; n++) {
    const seed = new Uint8Array(n);
    for (let i = 0; i < n; ++i) seed[i] = i;
    test(testRandom, seed.buffer);
}

// TODO this is just a basic test to pin expectations, make it more statistical
const testHash = test.macro({
    /**
     * @param {string} input
     * @param {string} expected
     * @param {number} bufSize
     */
    exec(t, input, expected, bufSize) {
        const h = xorbig.makeHash();

        for (let i=2; i-->0; h.reset()) {
            h.update(input);
            t.is(h.toString(), expected, `[${i}] string`);

            const digestHexes = [...h.digest()].map(n => n.toString(16).padStart(2, '0'));
            t.is(digestHexes.join(''), expected, `[${i}] digest join`);

            const ar = new Uint8Array(bufSize);
            t.is(h.writeInto(ar.buffer), bufSize, `[${i}] expected writeInto => ${bufSize}`);
            const hexes = [...ar].map(n => n.toString(16).padStart(2, '0'));
            t.deepEqual(hexes, digestHexes.slice(0, ar.length), `[${i}] expected first ${ar.length} bytes`);

            t.is(JSON.stringify(h), JSON.stringify(h.toString()), `[${i}] json`);
        }
    },

    title(providedTitle='', input, _expected, bufSize) {
        return `${providedTitle} hash(${JSON.stringify(input)}) bufSize:${bufSize}`;
    }
});

for (let n = 1; n <= 32; n++) test(testHash,
    'cat',
    '93dd3fb11090c72471c475000ee495d10f67882dc6e3b832afa088f23a817014', n);

for (let n = 1; n <= 32; n++) test(testHash,
    'cab',
    'cd4f007c655d7f71a998e7deccdd1af7d73b1af304da3714294ef82bef2306ea', n);

// TODO trivial test for coverage, make it more statistical
test('jumps...', t => {
    const starter = xorbig.generateStarts(0);
    t.is(JSON.stringify(starter), JSON.stringify(starter.toString()), `starter json`);
    for (const start of starter) {
        t.is(JSON.stringify(start), JSON.stringify(start.toString()), `start json`);
        for (const rng of start) {
            t.is(JSON.stringify(rng), JSON.stringify(rng.toString()), `rng json`);
            break;
        }
        break;
    }

    const starts = [
        starter.next().value,
        starter.next().value,
        starter.next().value,
    ];

    const gens = starts.flatMap(start => starts.map(_ => start.next().value));
    const seeds = gens.map(gen => gen.toString());
    for (let i = 0; i < seeds.length; ++i)
        for (let j = 0; j < seeds.length; ++j)
            if (i != j) t.not(seeds[i], seeds[j],
                `expected different seed ${i} <=> ${j}`);
    // t.log(seeds);

    t.deepEqual(
        gens.map(gen => JSON.stringify(gen)),
        seeds.map(seed => JSON.stringify(seed)),
        'generator json');

    const n = 10000;
    const samps = gens.map(gen => {
        const samp = [];
        for (let i = 0; i < n; ++i)
            samp.push(gen.randomInt())
        return samp;
    });
    for (let i = 0; i < samps.length; ++i) {
        const A = samps[i];
        for (let j = 0; j < samps.length; ++j) {
            if (i != j) {
                const B = samps[j];
                const coincidents = A
                    .map((a, i) => [i, a, B[i]])
                    .filter(([_, a, b]) => a == b);
                t.is(coincidents.length, 0, `expected no coincidents(${i}, ${j})`);
            }
        }
    }
});

test('random <=> string round-trips', t => {
    let rng = xorbig.makeRandom(0);
    t.is(
        xorbig.makeRandom(rng.toString()).toString(),
        rng.toString(),
        'initial state should round-trip');

    rng.random();
    t.is(
        xorbig.makeRandom(rng.toString()).toString(),
        rng.toString(),
        `next state should round-trip`);
});

test('jumper <=> string round-trips', t => {
    let jumper = xorbig.generateRandoms(0);
    t.is(
        xorbig.generateRandoms(jumper.toString()).toString(),
        jumper.toString(),
        'initial state should round-trip');

    jumper.next();
    t.is(
        xorbig.generateRandoms(jumper.toString()).toString(),
        jumper.toString(),
        `next state should round-trip`);
});

test('starter <=> string round-trips', t => {
    let rng = xorbig.generateStarts(0);
    t.is(
        xorbig.generateStarts(rng.toString()).toString(),
        rng.toString(),
        'initial state should round-trip');

    rng.next();
    t.is(
        xorbig.generateStarts(rng.toString()).toString(),
        rng.toString(),
        `next state should round-trip`);
});

test('invalid seed', t => t.throws(
    // @ts-ignore: the point of this is to intentionally pass an ill-typed seed
    () => xorbig.makeRandom({wat: 'even'}),
    {message: /invalid .* seed/},
));

/** @template T
 * @param {Iterator<T>} it
 * @returns {T}
 */
function next(it) {
    const res = it.next();
    if (!res.done) return res.value;
    throw new Error('iterator exhausted');
}
