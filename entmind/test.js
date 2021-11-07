import test from 'ava';

import {evaluate} from './index.js';

/** @template T
 * @typedef {import('./index.js').Expression<T>} Expression<T> */

/**
 * @param {number} x
 * @returns {number}
 */
function blend(x) {
    const mult = 1103515245;
    const inc = 12345;
    return x * mult + inc;
}

/**
 * @typedef {Expression<
 *   | {$: string}
 *   | {blend: Maths}
 * >} Maths
 */

/**
 * @param {Maths} expr
 * @param {{get: (name: string) => number|undefined}} scope
 * @returns {string|number|boolean}
 */
function calculate(expr, scope={get() {return undefined}}) {
    return term(expr);

    /** @param {Maths} expr */
    function term(expr) {
        return evaluate(expr, expr => {
            if (typeof expr == 'object') {
                if ('$' in expr) {
                    const value = scope.get(expr.$);
                    return value == undefined ? NaN : value;
                }
                if ('blend' in expr) return blend(numericTerm(expr.blend));
            }
            assertNever(expr, 'invalid maths expression');
        });
    }

    /** @type {(sub: Maths) => number} */
    function numericTerm(sub) {
        const subVal = term(sub);
        if (typeof subVal == 'number') return subVal;
        throw new Error('boolean value used in numeric expression');
    }
}

/**
 * @param {never} _
 * @param {string} [mess]
 * @returns {never}
 */
function assertNever(_, mess) {
    throw new Error(mess);
}

test('maths', t => {
    /** @type {(
     * {expr: Maths} & (
     *   | {expected: number|boolean}
     *   | {throws: string}
     * ))[]} */
    const testCases = [
        // numerics
        {expr: {add: []}, expected: NaN},
        {expr: {add: [1]}, expected: 1},
        {expr: {add: [1, 2]}, expected: 1 + 2},
        {expr: {sub: [8, 3, 2]}, expected: 8 - 3 - 2},
        {expr: {mul: [3, -2, {neg: 5}]}, expected: 3 * -2 * -5},
        {expr: {div: [13, 10]}, expected: 13/10},
        {expr: {mod: [13, 10]}, expected: 13%10},

        // numeric extensions
        {expr: "doge", expected: NaN},
        {expr: "such", expected: 10},
        {expr: "much", expected: 10000},
        {expr: {sub: [{mul: [7, {$:"much"}]}, {$:"such"}]}, expected: 7 * 10000 - 10},
        {expr: {sub: [{mul: [7, {$:"much"}]}, {$:"doge"}]}, expected: NaN},
        {expr: {blend: 42}, expected: blend(42)},
        {expr: {blend: {add: [{$:"such"}, 9]}}, expected: blend(10 + 9)},

        // comparisons
        {expr: {eq: [1, 2]}, expected: false},
        {expr: {eq: [1, 1]}, expected: true},

        {expr: {neq: [1, 2]}, expected: true},
        {expr: {neq: [1, 1]}, expected: false},

        {expr: {lt: [1, 2]}, expected: true},
        {expr: {lt: [2, 1]}, expected: false},
        {expr: {lt: [2, 2]}, expected: false},

        {expr: {gt: [1, 2]}, expected: false},
        {expr: {gt: [2, 1]}, expected: true},
        {expr: {gt: [2, 2]}, expected: false},

        {expr: {lte: [1, 2]}, expected: true},
        {expr: {lte: [2, 1]}, expected: false},
        {expr: {lte: [2, 2]}, expected: true},

        {expr: {gte: [1, 2]}, expected: false},
        {expr: {gte: [2, 1]}, expected: true},
        {expr: {gte: [2, 2]}, expected: true},

        // logic
        {expr: {not: {lt: [1, 2]}}, expected: false},
        {expr: {not: {lt: [2, 1]}}, expected: true},
        {expr: {not: {lt: [2, 2]}}, expected: true},

        {expr: {and: [false, true]}, expected: false},
        {expr: {and: [{lt: [1, 2]}, {lt: [2, 3]}]}, expected: true},
        {expr: {and: [{gt: [1, 2]}, {lt: [2, 3]}]}, expected: false},
        {expr: {and: [{lt: [1, 2]}, {gt: [2, 3]}]}, expected: false},
        {expr: {and: [{gt: [1, 2]}, {gt: [2, 3]}]}, expected: false},

        {expr: {or: [true, false]}, expected: true},
        {expr: {or: [{lt: [1, 2]}, {lt: [2, 3]}]}, expected: true},
        {expr: {or: [{gt: [1, 2]}, {lt: [2, 3]}]}, expected: true},
        {expr: {or: [{lt: [1, 2]}, {gt: [2, 3]}]}, expected: true},
        {expr: {or: [{gt: [1, 2]}, {gt: [2, 3]}]}, expected: false},

        // boolean extensions
        {expr: {lt: ["such", "much"]}, expected: true},

        // @ts-ignore: unexpected numeric
        {expr: {and: [3, false]}, throws: 'numeric value used in boolean expression'},

        // @ts-ignore: unexpected boolean
        {expr: {add: [3, false]}, throws: 'boolean value used in numeric expression'},

        // @ts-ignore: invalid typed data
        {expr: {such: "NOPE"}, throws: 'invalid maths expression'},
    ];

    for (const testCase of testCases) {
        const scope = new Map([
            ['such', 10],
            ['much', 10000],
        ]);
        if ('expected' in testCase) t.is(
            calculate(testCase.expr, scope),
            testCase.expected,
            JSON.stringify(testCase.expr),
        );
        if ('throws' in testCase) t.throws(
            () => calculate(testCase.expr, scope),
            {message: testCase.throws},
            JSON.stringify(testCase.expr),
        );
    }
});

test('collatz', t => {
    for (let n = 42, i = 0; n != 1;) {
        if (++i > 1000) throw new Error('runaway test');
        const m = n % 2 == 0 ? n / 2 : 3 * n + 1;
        const expr = n % 2 == 0
            ? {div: [n, 2]}
            : {add: [{mul: [3, n]}, 1]};
        t.is(calculate(expr), m);
        t.log(`round[${i}] ${n} -> ${m}`);
        n = m;
    }
});
