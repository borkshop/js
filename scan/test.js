import test from 'ava';

import {Scanner, FixedRecognizer} from './index.js';
import * as bytes from './bytes.js';

/**
 * @param {number} n
 * @param {string} s
 */
async function* chunked(n, s) {
  const b = bytes.fromString(s);
  for (let i = 0; i < b.length;) {
    const j = Math.min(b.length, i + n);
    yield b.subarray(i, j);
    i = j;
  }
}

/** @typedef {import('ava').ExecutionContext} ExecutionContext */

/**
 * @param {ExecutionContext} t
 * @param {Scanner} sc
 * @param {(i: number) => any} report
 * @param {any[]} expected
 */
async function testScanner(t, sc, report, expected) {
  let i = 0;
  while (await sc.scan()) expect(i++);
  expect(i++);
  if (i < expected.length) t.fail(`expected ${expected.length} results, got ${i}`);
  /** @param {number} i */
  function expect(i) {
    const res = report(i);
    if (i < expected.length) t.like(res, expected[i], `expected result [${i}]`);
    else {
      t.fail(`unexpected result [${i}]`);
      t.log(res);
    }
  }
}

class FizzBuzzRec {
  say = ''

  /**
   * @param {Uint8Array} buf
   * @param {boolean} done
   * @returns {number}
   */
  recognize(buf, done) {
    this.say = '';

    const i = buf.indexOf(0x0a); // find next newline
    if (i == 0) return -1; // skip newline
    if (i > 0) buf = buf.subarray(0, i); // truncate current line content
    else if (!done) return 0; // wait for more input

    let n = 0;
    for (let i=0; i<buf.length; i++) {
      const b = buf[i];
      // skip lines with invalid decimal digit(s)
      if (0x30 > b || b > 0x39) return -buf.length;
      n = 10*n + (b - 0x30);
    }

    if (n % 3 == 0) this.say += 'Fizz';
    if (n % 5 == 0) this.say += 'Buzz';
    if (!this.say) return -buf.length; // skip tokens that we've nothing to say about

    return buf.length;
  }
}

/**
 * @param {ExecutionContext} t
 * @param {number} chunkSize
 * @param {string} input
 * @param {Array<{offset?: number, say: string, text: null|string}>} expected
 */
async function testFizzBuzz(t, chunkSize, input, ...expected) {
  const stream = chunked(chunkSize, input);
  const rec = new FizzBuzzRec();
  const sc = new Scanner(stream, rec, 1);
  await testScanner(t, sc, () => {
    const offset = sc.offset;
    const say = rec.say;
    const text = bytes.toString(sc.bytes);
    return {offset, say, text}
  }, expected);
}

/**
 * @param {string} providedTitle
 * @param {number} chunkSize
 */
testFizzBuzz.title = (providedTitle = '', chunkSize) => `${providedTitle} chunkSize=${chunkSize}`.trim();

test('fizz buzz', testFizzBuzz, 5, [
  "1",
  "2",
  "3",
  "4",
  "mushroom",
  "5",
  "6",
  "7",
  "8",
  "9",
  "snake",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
].join('\n'),
  {text: '3', say: 'Fizz'},
  {text: '5', say: 'Buzz'},
  {text: '6', say: 'Fizz'},
  {text: '9', say: 'Fizz'},
  {text: '10', say: 'Buzz'},
  {text: '12', say: 'Fizz'},
  {text: '15', say: 'FizzBuzz'},
  {text: null, say: 'FizzBuzz'},
);

/**
 * @param {ExecutionContext} t
 * @param {FixedRecognizer} rec
 * @param {number} chunkSize
 * @param {string} input
 * @param {Array<{offset: number, type: number, fragment?: boolean, text: null|string}>} expected
 */
async function testFixed(t, rec, chunkSize, input, ...expected) {
  const stream = chunked(chunkSize, input);
  const sc = new Scanner(stream, rec, 1);
  await testScanner(t, sc, () => {
    const offset = sc.offset;
    const type = rec.id;
    const fragment = rec.fragment;
    const text = bytes.toString(sc.bytes);
    return {offset, type, fragment, text}
  }, expected);
}

/**
 * @param {string} providedTitle
 * @param {FixedRecognizer} _rec
 * @param {number} chunkSize
 */
testFixed.title = (providedTitle = '', _rec, chunkSize) => `${providedTitle} chunkSize=${chunkSize}`.trim();

for (let chunkSize=1; chunkSize<13; chunkSize++) {
  const rec = new FixedRecognizer("\n");
  rec.maxToken = 8;
  test('unix lines', testFixed,
    rec,
    chunkSize,
    'it was the best of times\n' +
    'it was the worst of times\n',

    {offset: 0,  type: -1, text: 'it was t', fragment: true},
    {offset: 8,  type: -1, text: 'he best ', fragment: true},
    {offset: 16, type: -1, text: 'of times', fragment: false},
    {offset: 24, type:  0, text: '\n', fragment: false},

    {offset: 25, type: -1, text: 'it was t', fragment: true},
    {offset: 33, type: -1, text: 'he worst', fragment: true},
    {offset: 41, type: -1, text: ' of time', fragment: true},
    {offset: 49, type: -1, text: 's', fragment: false},
    {offset: 50, type:  0, text: '\n', fragment: false},

    {offset: 51, type:  0, text: null},
  );
}

for (let chunkSize=1; chunkSize<13; chunkSize++) {
  const rec = new FixedRecognizer("\n", "\r\n");
  rec.maxToken = 8;
  test('mixed lines', testFixed,
    rec,
    chunkSize,
    'it was the best of times\n' +
    'it was the worst of times\n\r\n' +
    'lorem ipsum\r\n' +
    'dolor\r\n' +
    'sit amet',

    {offset: 0,  type: -1, text: 'it was t', fragment: true},
    {offset: 8,  type: -1, text: 'he best ', fragment: true},
    {offset: 16, type: -1, text: 'of times', fragment: false},
    {offset: 24, type:  0, text: '\n', fragment: false},

    {offset: 25, type: -1, text: 'it was t', fragment: true},
    {offset: 33, type: -1, text: 'he worst', fragment: true},
    {offset: 41, type: -1, text: ' of time', fragment: true},
    {offset: 49, type: -1, text: 's', fragment: false},
    {offset: 50, type:  0, text: '\n', fragment: false},
    {offset: 51, type:  1, text: '\r\n', fragment: false},

    {offset: 53, type: -1, text: 'lorem ip', fragment: true},
    {offset: 61, type: -1, text: 'sum', fragment: false},
    {offset: 64, type:  1, text: '\r\n', fragment: false},

    {offset: 66, type: -1, text: 'dolor'},
    {offset: 71, type:  1, text: '\r\n'},

    {offset: 73, type: -1, text: 'sit amet'},
    {offset: 81, type: -1, text: null},
  );
}
