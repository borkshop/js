/**
 * @param {Uint8Array|string} s
 * @param {boolean} [borrow] -- set to true if the caller does not need to
 * retain the returned value
 * @returns {Uint8Array}
 */
export function fromString(s, borrow=false) {
  if (typeof s == 'string')
    return new TextEncoder().encode(s);
  if (!borrow) return s.slice();
  return s;
}

/**
 * @param {null|string|Uint8Array} s
 * @returns {null|string}
 */
export function toString(s) {
  if (s === null) return null;
  if (typeof s == 'string') return s;
  return new TextDecoder().decode(s);
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {number} -- length of the longest common suffix between a and b
 */
export function longestCommonSuffix(a, b) {
  for (let i = 0; i < a.length && i < b.length; i++)
    if (a[a.length-1-i] != b[b.length-1-i]) return i;
  return 0;
}

/**
 * @param {Uint8Array|string} prefix
 * @param {Uint8Array} s
 * @returns {boolean}
 */
export function hasPrefix(prefix, s) {
  prefix = fromString(prefix, true);
  for (let i = 0; i < prefix.length; i++)
    if (i >= s.length || s[i] != prefix[i]) return false;
  return true;
}

/** Implements efficient string search using the Boyer-Moore algorithm.
 *
 * Directly ported from golang.org/src/strings/search.go .
 */
export class Finder {
  /**
   * @param {Uint8Array|string} pattern
   */
  constructor(pattern) {
    this.pattern = fromString(pattern);

    // last is the index of the last character in the pattern.
    const last = this.pattern.length - 1;

    // badCharSkip[b] contains the distance between the last byte of pattern
    // and the rightmost occurrence of b in pattern. If b is not in pattern,
    // badCharSkip[b] is pattern.length.
    //
    // Whenever a mismatch is found with byte b in the text, we can safely
    // shift the matching frame at least badCharSkip[b] until the next time
    // the matching char could be in alignment.
    this.badCharSkip = new Int32Array(256);

    // Bytes not in the pattern can skip one pattern's length.
    this.badCharSkip.fill(this.pattern.length);

    // The loop condition is < instead of <= so that the last byte does not
    // have a zero distance to itself. Finding this byte out of place implies
    // that it is not in the last position.
    for (let i = 0; i < last; i++)
      this.badCharSkip[this.pattern[i]] = last - i;

    // goodSuffixSkip[i] defines how far we can shift the matching frame given
    // that the suffix pattern[i+1:] matches, but the byte pattern[i] does
    // not. There are two cases to consider:
    //
    // 1. The matched suffix occurs elsewhere in pattern (with a different
    // byte preceding it that we might possibly match). In this case, we can
    // shift the matching frame to align with the next suffix chunk. For
    // example, the pattern "mississi" has the suffix "issi" next occurring
    // (in right-to-left order) at index 1, so goodSuffixSkip[3] ==
    // shift+suffix.length == 3+4 == 7.
    //
    // 2. If the matched suffix does not occur elsewhere in pattern, then the
    // matching frame may share part of its prefix with the end of the
    // matching suffix. In this case, goodSuffixSkip[i] will contain how far
    // to shift the frame to align this portion of the prefix to the
    // suffix. For example, in the pattern "abcxxxabc", when the first
    // mismatch from the back is found to be in position 3, the matching
    // suffix "xxabc" is not found elsewhere in the pattern. However, its
    // rightmost "abc" (at position 6) is a prefix of the whole pattern, so
    // goodSuffixSkip[3] == shift+suffix.length == 6+5 == 11.
    this.goodSuffixSkip = new Int32Array(this.pattern.length);

    // First pass: set each value to the next index which starts a prefix of pattern.
    let lastPrefix = last;
    for (let i = last; i >= 0; i--) {
      if (hasPrefix(this.pattern.subarray(i+1), this.pattern)) lastPrefix = i + 1;
      // lastPrefix is the shift, and (last-i) is suffix.length.
      this.goodSuffixSkip[i] = lastPrefix + last - i;
    }

    // Second pass: find repeats of pattern's suffix starting from the front.
    for (let i = 0; i < last; i++) {
      // (last-i) is the shift, and lenSuffix is suffix.length.
      const lenSuffix = longestCommonSuffix(this.pattern, this.pattern.subarray(1, i+1));
      if (this.pattern[i-lenSuffix] != this.pattern[last-lenSuffix])
        this.goodSuffixSkip[last-lenSuffix] = lenSuffix + last - i;
    }
  }

  /**
   * @param {Uint8Array} text
   * @returns {number} -- the index in text of the first occurrence of the
   * pattern. If the pattern is not found, it returns -1.
   */
  find(text) {
    for (let i = this.pattern.length - 1; i < text.length;) {
      // Compare backwards from the end until the first unmatching character.
      let j = this.pattern.length - 1;
      for (; j >= 0 && text[i] == this.pattern[j];) {
          i--;
          j--;
      }
      if (j < 0) return i + 1; // match
      i += Math.max(this.badCharSkip[text[i]], this.goodSuffixSkip[j]);
    }
    return -1; // no match
  }
}
