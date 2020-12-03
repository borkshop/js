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

/**
 * @param {string} selector
 * @returns {HTMLElement|undefined}
 */
export function find(selector) {
  const el = document.querySelector(selector);
  if (el instanceof HTMLElement) return el;
  return undefined;
}

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
export function mustFind(selector) {
  const el = check(document.querySelector(selector), selector);
  if (el instanceof HTMLElement) return el;
  throw new TypeError(`${selector} must be an HTMLElement, not ${el.constructor.name}`);
}
