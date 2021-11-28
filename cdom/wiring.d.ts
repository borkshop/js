/**
 * @template T
 * @param {T | null} value
 * @param {string} label
 * @returns {T}
 */
export function check<T>(value: T | null, label: string): T;
/**
 * @param {string} selector
 * @returns {HTMLElement|undefined}
 */
export function find(selector: string): HTMLElement | undefined;
/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
export function mustFind(selector: string): HTMLElement;
