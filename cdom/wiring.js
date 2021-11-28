// @ts-check

/**
 * @template T
 * @param {T | null} value
 * @param {string} label
 * @returns {T}
 */
export function check(value, label) {
  if (!value) throw new TypeError(`${label} must not be ${value}`);
  return value;
}

export {find, mustFind} from 'domkit/wiring';
