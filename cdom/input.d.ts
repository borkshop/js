/**
 * Allows aliasing buttons by key or keycode, canceling any originating event,
 * and dispatching a newly synthesized copy of the source event on any resolved
 * button element (skipping any intermediaries in the case of an alias chain).
 *
 * @implements {EventListenerObject}
 */
export class KeyAliases implements EventListenerObject {
    /**
     * @param {HTMLButtonElement} button
     * @returns {null|HTMLButtonElement}
     */
    lookup(button: HTMLButtonElement): null | HTMLButtonElement;
    /**
     * @param {Event} event
     */
    handleEvent(event: Event): void;
}
/**
 * Allows easy handling of one-off keys, cancelling the triggering event.
 *
 * The first handler defined in byCode, byKey, or byID is called, in that order
 * of precedence.
 *
 * @implements {EventListenerObject}
 */
export class Handlers implements EventListenerObject {
    /** @typedef {(event:Event)=>void} EventHandler */
    /** @typedef {Object<string, EventHandler>} EventHandlers */
    /** @type {EventHandlers} */
    byCode: {
        [x: string]: (event: Event) => void;
    };
    /** @type {EventHandlers} */
    byKey: {
        [x: string]: (event: Event) => void;
    };
    /** @type {EventHandlers} */
    byID: {
        [x: string]: (event: Event) => void;
    };
    /**
     * @param {Event} event
     * @returns {null|EventHandler}
     */
    lookup(event: Event): ((event: Event) => void) | null;
    /** @param {Event} event */
    handleEvent(event: Event): void;
}
/**
 * Couples received button events with associated input elements.
 *
 * A button has an associated input if it is a direct child of a label element
 * with a valid for that resolves to an input element.
 *
 * Currently only input[type="checkbox"] elements are supported, toggling their
 * checked property, and dispatching their change event.
 *
 * @implements {EventListenerObject}
 */
export class ButtonInputs implements EventListenerObject {
    /**
     * @param {Event} event
     */
    handleEvent(event: Event): void;
    /**
     * @param {Event} event
     * @param {HTMLInputElement} input
     */
    handleInput(event: Event, input: HTMLInputElement): void;
}
/**
 * Toggles a CSS class on any <button data-key="KEY" data-keycode="CODE">
 * element that matches received keydown/keyup events.
 *
 * Buttons should have at least one of the data-key or data-keycode attributes.
 * Any keycode match is preferred to a mere key match.
 *
 * @implements {EventListenerObject}
 */
export class KeyHighlighter implements EventListenerObject {
    className: string;
    /** @param {Event} event */
    handleEvent(event: Event): void;
}
/**
 * Dispatches keydown and keyup events synthesized from any mouse clicks events
 * targeted at a <button data-key="KEY" data-keycode="CODE"> element.
 *
 * Buttons should at least have the data-key attribute, and may also have a
 * data-keycode attribute.
 *
 * @implements {EventListenerObject}
 */
export class KeySynthesizer implements EventListenerObject {
    /** @param {Event} event */
    handleEvent(event: Event): void;
}
export { KeyChordEvent } from "domkit/input";
export class KeyChorder extends KeyChorderBase {
    constructor();
}
import { KeyChorder as KeyChorderBase } from "domkit/input";
