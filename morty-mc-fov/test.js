import test from 'ava';

import {mortonKey, mortonPoint} from './index.js';

[
  {x: 0, y: 0, k: 0x0000_0000_0000_0000n},
  {x: 1, y: 0, k: 0x0000_0000_0000_0001n},
  {x: 0, y: 1, k: 0x0000_0000_0000_0002n},
  {x: 1, y: 1, k: 0x0000_0000_0000_0003n},
  {x: 2, y: 0, k: 0x0000_0000_0000_0004n},
  {x: 0, y: 2, k: 0x0000_0000_0000_0008n},
  {x: 2, y: 2, k: 0x0000_0000_0000_000cn},
  {x: 0xffff_ffff, y: 0, k: 0x5555_5555_5555_5555n},
  {x: 0, y: 0xffff_ffff, k: 0xaaaa_aaaa_aaaa_aaaan},
  {x: 0xffff_ffff, y: 0xffff_ffff, k: 0xffff_ffff_ffff_ffffn},
].forEach(({x, y, k}) => test(test.macro({
  /** @param {number} x @param {number} y @param {bigint} key */
  exec(t, x, y, key) {
    t.is(mortonKey({x, y}), key, 'there');
    t.deepEqual(mortonPoint(key), {x, y}, 'back again');
  },
  title(providedTitle='', x, y) {
    return `${providedTitle} mortonKey(${x},${y})`;
  }
}), x, y, k));

[
  {x: -1, y:  0},
  {x:  0, y: -1},
  {x: -1, y: -1},
  {x: -2, y:  0},
  {x:  0, y: -2},
  {x: -2, y: -2},
  {x: 0x1_ffff_ffff, y: 0},
  {x: 0, y: 0x1_ffff_ffff},
].forEach(({x, y}) => test(test.macro({
  /** @param {number} x @param {number} y */
  exec(t, x, y) { t.throws(
    () => mortonKey({x, y}),
    {message: 'Number not within acceptable 32-bit range'},
  ) },
  title(providedTitle='', x, y) {
    return `${providedTitle} !mortonKey(${x},${y})`;
  }
}), x, y));
