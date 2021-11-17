/** @param {{x: number, y: number}} p */
export function mortonKey({x, y}) {
  const bx = BigInt(Math.floor(x));
  const by = BigInt(Math.floor(y));
  return mortonSpread1(bx) | mortonSpread1(by) << 1n;
}

/** @param {bigint} key */
export function mortonPoint(key) {
  const bx = mortonCompact1(key);
  const by = mortonCompact1(key >> 1n);
  return {x: Number(bx), y: Number(by)};
}

/** @param {bigint} x */
function mortonSpread1(x) {
  const min = 0, max = 2n ** 32n - 1n;
  if (x < min || x > max)
    throw RangeError('Number not within acceptable 32-bit range');
  x = BigInt.asUintN(32, x);
  x =  x               & 0x0000_0000_FFFF_FFFFn; // mask lower 32-bit syllable (double word)
  x = (x | (x << 16n)) & 0x0000_FFFF_0000_FFFFn; // spread 16-bit syllables (words)
  x = (x | (x <<  8n)) & 0x00FF_00FF_00FF_00FFn; // spread 8-bit syllables (bytes)
  x = (x | (x <<  4n)) & 0x0F0F_0F0F_0F0F_0F0Fn; // spread 4-bit syllables (nibbles)
  x = (x | (x <<  2n)) & 0x3333_3333_3333_3333n; // spread 2-bit syllables
  x = (x | (x <<  1n)) & 0x5555_5555_5555_5555n; // spread bits, even parity
  return x;
}

/** @param {bigint} x */
function mortonCompact1(x) {
  x =  x               & 0x5555_5555_5555_5555n; // mask even parity bits
  x = (x | (x >>  1n)) & 0x3333_3333_3333_3333n; // compact bits
  x = (x | (x >>  2n)) & 0x0F0F_0F0F_0F0F_0F0Fn; // compact 2-bit syllables
  x = (x | (x >>  4n)) & 0x00FF_00FF_00FF_00FFn; // compact 4-bit syllables (nibbles)
  x = (x | (x >>  8n)) & 0x0000_FFFF_0000_FFFFn; // compact 8-bit syllables (bytes)
  x = (x | (x >> 16n)) & 0x0000_0000_FFFF_FFFFn; // compact 16-bit syllables (words)
  x = BigInt.asUintN(32, x);
  return x;
}
