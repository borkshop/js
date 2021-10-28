import test from 'ava';

import {evaluateNumeric} from './index.js';

/** @template T
 * @typedef {import('./index.js').Numeric<T>} Numeric<T> */

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
 * @template N
 * @typedef {Numeric<N>
 *   | {blend: Maths<N>}
 * } Maths
 */

/**
 * @param {Maths<number|string>} expr
 * @param {{get: (name: string) => number|undefined}} scope
 * @returns {number}
 */
function calculate(expr, scope={get() {return undefined}}) {
    return term(expr);

    /**
     * @param {Maths<number|string>} expr
     * @returns {number}
     */
    function term(expr) {
        return evaluateNumeric(expr, expr => {
            if (typeof expr == 'string') {
                const value = scope.get(expr);
                return value == undefined ? NaN : value;
            }
            if (typeof expr == 'object') {
                if ('blend' in expr) return blend(term(expr.blend));
            }
            assertNever(expr, 'invalid maths expression');
        });
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
     * {expr: Numeric<number>} & (
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
        {expr: {pow: [2, 3, 2]}, expected: Math.pow(Math.pow(2, 3), 2)},

        // numeric extensions
        {expr: "doge", expected: NaN},
        {expr: "such", expected: 10},
        {expr: "much", expected: 10000},
        {expr: {sub: [{mul: [7, "much"]}, "such"]}, expected: 7 * 10000 - 10},
        {expr: {sub: [{mul: [7, "much"]}, "doge"]}, expected: NaN},
        {expr: {blend: 42}, expected: blend(42)},
        {expr: {blend: {add: ["such", 9]}}, expected: blend(10 + 9)},

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
