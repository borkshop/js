// @ts-check

/**
 * @template T
 * @typedef {{
 *   promise: Promise<T>,
 *   resolve: (value:T) => void,
 *   reject: (reason:Error) => void
 * }} Deferred
 */

/**
 * @callback Transition
 * @param {number} v0
 * @param {number} v1
 * @param {number} t
 * @return {number}
 */
