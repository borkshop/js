// @ts-check

/**
 * @param {Event} event
 * @returns {null|HTMLButtonElement}
 */
function buttonFor(event) {
  if (event instanceof MouseEvent) {
    const {target} = event;
    if (target instanceof HTMLButtonElement) return target;
  } else if (event instanceof KeyboardEvent) {
    const {key, code, view} = event;
    const root = view?.document;
    if (!root) return null;
    /** @type {null|HTMLButtonElement} */
    return root.querySelector(`button[data-keycode="${code}"]`)
        || root.querySelector(`button[data-key="${key}"]`);
  }
  return null;
}

/**
 * Allows aliasing buttons by key or keycode, canceling any originating event,
 * and dispatching a newly synthesized copy of the source event on any resolved
 * button element (skipping any intermediaries in the case of an alias chain).
 *
 * @implements {EventListenerObject}
 */
export class KeyAliases {
  /**
   * @param {HTMLButtonElement} button
   * @returns {null|HTMLButtonElement}
   */
  lookup(button) {
    const alias = button.dataset.alias;
    if (!alias) return null;

    const root = button.ownerDocument;
    /** @type {null|HTMLButtonElement} */
    const next = root.querySelector(`button[data-keycode="${alias}"]`)
              || root.querySelector(`button[data-key="${alias}"]`);
    if (!next) return null;
    return this.lookup(next) || next;
  }

  /**
   * @param {Event} event
   */
  handleEvent(event) {
    const button = buttonFor(event);
    if (!button) return;
    const alias = this.lookup(button);
    if (!alias) return;

    event.stopImmediatePropagation();
    event.preventDefault();
    // TODO do we need to filter down the event fields into *EventInit?
    if (event instanceof MouseEvent) {
      alias.dispatchEvent(new MouseEvent(event.type, {
        bubbles: true, cancelable: true, composed: true,
        view: button.ownerDocument.defaultView,
        // TODO other MouseEventInit fields?
      }))
    } else if (event instanceof KeyboardEvent) {
      const {key, keycode} = alias.dataset;
      alias.dispatchEvent(new KeyboardEvent(event.type, {
        bubbles: true, cancelable: true, composed: true,
        view: button.ownerDocument.defaultView,
        key, code: keycode,
        // TODO other KeyboardEventInit fields?
      }));
    }
  }
}

/**
 * Allows easy handling of one-off keys, cancelling the triggering event.
 *
 * The first handler defined in byCode, byKey, or byID is called, in that order
 * of precedence.
 *
 * @implements {EventListenerObject}
 */
export class Handlers {
  /** @typedef {(event:Event)=>void} EventHandler */
  /** @typedef {Object<string, EventHandler>} EventHandlers */

  /** @type {EventHandlers} */
  byCode = {}

  /** @type {EventHandlers} */
  byKey = {}

  /** @type {EventHandlers} */
  byID = {}

  /**
   * @param {Event} event
   * @returns {null|EventHandler}
   */
  lookup(event) {
    if (!(event instanceof KeyboardEvent)) return null;
    const byCode = event.code && this.byCode[event.code];
    if (byCode) return byCode;
    const byKey = event.key && this.byKey[event.key];
    if (byKey) return byKey;
    const button = buttonFor(event);
    const byID = button?.id && this.byID[button.id];
    if (byID) return byID;
    return null;
  }

  /** @param {Event} event */
  handleEvent(event) {
    const handler = this.lookup(event);
    if (handler) {
      event.stopImmediatePropagation();
      event.preventDefault();
      handler(event);
    }
  }
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
export class ButtonInputs {
  /**
   * @param {Event} event
   */
  handleEvent(event) {
    const button = buttonFor(event);
    if (!button) return;
    const label = button.parentNode;
    if (!(label instanceof HTMLLabelElement)) return;
    const forEl = label.ownerDocument.getElementById(label.htmlFor);
    if (!(forEl instanceof HTMLInputElement)) return;
    this.handleInput(event, forEl);
  }

  /**
   * @param {Event} event
   * @param {HTMLInputElement} input
   */
  handleInput(event, input) {
    if (input.type !== 'checkbox') return;
    event.stopImmediatePropagation();
    event.preventDefault();
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change', {
      bubbles: true, cancelable: true, composed: true,
    }));
  }
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
export class KeyHighlighter {
  className = 'held'

  /** @param {Event} event */
  handleEvent(event) {
    const {type} = event;
    const button = buttonFor(event);
    if      (!button)            return;
    else if (button.disabled)    button.classList.toggle('held', false);
    else if (type === 'keydown') button.classList.toggle('held', true);
    else if (type === 'keyup')   button.classList.toggle('held', false);
  }
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
export class KeySynthesizer {
  /** @param {Event} event */
  handleEvent(event) {
    if (!(event instanceof MouseEvent)) return;
    const {type, target, view} = event;
    if (type !== 'click' || !(target instanceof HTMLButtonElement)) return;
    const {key, keycode} = target.dataset;
    if (!target.disabled && (key || keycode)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      const holdable = !!view?.getComputedStyle(target).getPropertyValue('--holdable');
      /** @type {KeyboardEventInit} */
      const init = {
        bubbles: true, cancelable: true, composed: true,
        view,
        key, code: keycode,
      };
      if (!holdable) {
        target.dispatchEvent(new KeyboardEvent('keydown', init));
        target.dispatchEvent(new KeyboardEvent('keyup', init));
      } else if (target.classList.toggle('held')) {
        target.dispatchEvent(new KeyboardEvent('keydown', init));
      } else {
        target.dispatchEvent(new KeyboardEvent('keyup', init));
      }
    }
  }
}

/**
 * Coalesces "chords" of held keys from any received keydown and keyup events.
 *
 * Dispatches a "keychord" event on itself, passing a KeyChordEvent to
 * listeners, after the last held key is released.
 *
 * @implements {EventListenerObject}
 */
export class KeyChorder extends EventTarget {
  held = new Set()
  chord = new Set()

  ignoredModifiers = new Set([
    'control',
    'shift',
    'alt',
    'meta',
  ])

  /** @param {KeyboardEvent} event */
  hasIgnoredModifier(event) {
    if (this.ignoredModifiers.has(event.key.toLowerCase())) return true;
    return false;
  }

  clear() {
    this.held.clear();
    this.chord.clear();
  }

  /** @param {Event} event */
  handleEvent(event) {
    if (!(event instanceof KeyboardEvent)) return;
    const {type, key, code, view} = event;

    if (this.hasIgnoredModifier(event)) return;

    const root = view?.document;
    if (!root) return;
    /** @type {null|HTMLButtonElement} */
    const button = root.querySelector(`button[data-keycode="${code}"]`)
                || root.querySelector(`button[data-key="${key}"]`);
    if (button?.disabled) return;

    if (type === 'keyup') {
      if (this.held.delete(key)) {
        this.chord.add(key);
        if (!this.held.size) {
          this.dispatchEvent(new KeyChordEvent(this.chord));
          this.chord.clear();
        }
      }
    } else if (type === 'keydown') {
      this.chord.clear();
      this.held.add(key);
    } else {
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}

export class KeyChordEvent extends Event {
  /** @type {Iterable<string>} */
  keys

  /** @param {Iterable<string>} keys */
  constructor(keys) {
    super('keychord');
    this.keys = keys;
  }
}
