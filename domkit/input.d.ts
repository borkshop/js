/**
 * Coalesces "chords" of held keys from any received keydown and keyup events.
 *
 * Dispatches a "keychord" event on itself, passing a KeyChordEvent to
 * listeners, after the last held key is released.
 *
 * Example usage:
 *
 *     const keyChorder = new KeyChorder();
 *     document.addEventListener('keydown', keyChorder);
 *     document.addEventListener('keyup', keyChorder);
 *     keyChorder.addEventListener('keychord', ({keys}) => console.log('keychord', keys));
 *
 * @implements {EventListenerObject}
 */
export class KeyChorder extends EventTarget implements EventListenerObject {
    constructor(allowedModifiers?: string[]);
    held: Set<any>;
    chord: Set<any>;
    clear(): void;
    /**
     * @param {KeyboardEvent} event
     * @returns {boolean}
     */
    filter(event: KeyboardEvent): boolean;
    ignoredModifiers: Set<string>;
    /** @param {KeyboardEvent} event */
    hasIgnoredModifier(event: KeyboardEvent): boolean;
    /** @param {Event} event */
    handleEvent(event: Event): void;
}
export class KeyChordEvent extends Event {
    /** @param {Iterable<string>} keys */
    constructor(keys: Iterable<string>);
    /** @type {readonly string[]} */
    keys: readonly string[];
}
