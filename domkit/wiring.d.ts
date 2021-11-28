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
