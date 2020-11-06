// @ts-check

import './types.js';

/**
 * @param {any} value
 * @param {string} message
 * @return {asserts value}
 */
export function assert(value, message) {
  if (!value) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
