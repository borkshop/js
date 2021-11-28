/**
 * @template T
 * @param {T | null} value
 * @param {string} label
 * @returns {T}
 */
export function check<T>(value: T | null, label: string): T;
export { find, mustFind } from "domkit/wiring";
