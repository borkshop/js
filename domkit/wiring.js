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
  const el = document.querySelector(selector);
  if (!el) throw new Error(`must have ${selector} in document`);
  if (el instanceof HTMLElement) return el;
  throw new TypeError(`${selector} must be an HTMLElement, not ${el.constructor.name}`);
}
