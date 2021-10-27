import test from 'ava';

import {evaluateNumeric} from './index.js';

/** @template {number} T
 * @typedef {import('./index.js').Numeric<T>} Numeric<T> */

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
        // @ts-ignore: invalid typed data
        {expr: "NOPE", throws: 'invalid numeric expression'},

        // @ts-ignore: invalid typed data
        {expr: {such: "NOPE"}, throws: 'invalid numeric expression'},
    ];

    for (const testCase of testCases) {
        if ('expected' in testCase) t.is(
            evaluateNumeric(testCase.expr),
            testCase.expected,
            JSON.stringify(testCase.expr),
        );
        if ('throws' in testCase) t.throws(
            () => evaluateNumeric(testCase.expr),
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
        t.is(evaluateNumeric(expr), m);
        t.log(`round[${i}] ${n} -> ${m}`);
        n = m;
    }
});
